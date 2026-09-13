// @vitest-environment node
//
// Database-level regression tests for the generation_context boundary.
//
// These run the ACTUAL SQL from docs/pending-migrations/ inside an in-process
// Postgres (pglite), so the permission boundary itself is exercised — not a
// mock marker check. An authenticated client must not be able to insert a
// forged snapshot (even one carrying the exact server marker and current
// version), overwrite an established one, or clear one.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const MIGRATION = 'docs/pending-migrations/20260914120000_assessment_tier_and_generation_context.sql';

const FORGED = JSON.stringify({
  context_version: 1,
  resolved_by: 'server', // exact server marker — must still be refused
  assessment_tier: 'higher',
  exam_board: 'aqa',
});

const SERVER = JSON.stringify({
  context_version: 1,
  resolved_by: 'server',
  assessment_tier: 'foundation',
  exam_board: 'aqa',
});

let db: PGlite;

/** Runs a statement as the `authenticated` client role. */
const asClient = async (sql: string) => {
  await db.exec('SET ROLE authenticated;');
  try {
    await db.query(sql);
  } finally {
    await db.exec('RESET ROLE;');
  }
};

const contextOf = async (table: string, id: string) => {
  const r = await db.query<{ generation_context: unknown }>(
    `select generation_context from public.${table} where id = '${id}'`,
  );
  return r.rows[0]?.generation_context ?? null;
};

beforeAll(async () => {
  db = new PGlite();

  // Minimal stand-ins for the two real tables plus the Supabase auth.role()
  // helper the guard consults.
  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.role() returns text language sql stable as $$
      select coalesce(current_setting('request.jwt.role', true), current_user::text)
    $$;
    create table public.exams (
      id text primary key,
      user_id text not null,
      title text,
      generation_context jsonb
    );
    create table public.practice_question_sets (
      id text primary key,
      user_id text not null,
      title text,
      generation_context jsonb
    );
    create role authenticated;
    grant usage on schema public, auth to authenticated;
    grant select, insert, update, delete on public.exams, public.practice_question_sets to authenticated;
  `);

  // Apply only the guard section of the pending migration; the column DDL is
  // already represented by the stand-in tables above.
  const sql = readFileSync(MIGRATION, 'utf8');
  const guard = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.guard_generation_context'));
  expect(guard).toContain('guard_generation_context');
  await db.exec(guard);
});

afterAll(async () => {
  await db?.close();
});

for (const table of ['exams', 'practice_question_sets'] as const) {
  describe(`generation_context boundary on ${table}`, () => {
    const rowId = `${table}-row`;

    it('refuses a client INSERT carrying a forged server-marked snapshot', async () => {
      await expect(
        asClient(
          `insert into public.${table} (id, user_id, title, generation_context)
           values ('${rowId}-forged', 'u1', 'x', '${FORGED}'::jsonb)`,
        ),
      ).rejects.toThrow(/managed by the server/);
    });

    it('allows a client INSERT without a snapshot, and the backend to establish one', async () => {
      await asClient(
        `insert into public.${table} (id, user_id, title) values ('${rowId}', 'u1', 'set')`,
      );
      expect(await contextOf(table, rowId)).toBeNull();

      // Trusted backend (service role) writes the authoritative snapshot.
      await db.query(
        `update public.${table} set generation_context = '${SERVER}'::jsonb where id = '${rowId}'`,
      );
      expect(await contextOf(table, rowId)).toMatchObject({ resolved_by: 'server' });
    });

    it('refuses a client UPDATE that overwrites an established snapshot', async () => {
      await expect(
        asClient(
          `update public.${table} set generation_context = '${FORGED}'::jsonb where id = '${rowId}'`,
        ),
      ).rejects.toThrow(/managed by the server/);
      expect(await contextOf(table, rowId)).toMatchObject({ assessment_tier: 'foundation' });
    });

    it('refuses a client UPDATE that clears an established snapshot', async () => {
      await expect(
        asClient(`update public.${table} set generation_context = null where id = '${rowId}'`),
      ).rejects.toThrow(/managed by the server/);
      expect(await contextOf(table, rowId)).not.toBeNull();
    });

    it('still allows ordinary owner edits to other fields', async () => {
      await asClient(`update public.${table} set title = 'renamed' where id = '${rowId}'`);
      const r = await db.query<{ title: string }>(
        `select title from public.${table} where id = '${rowId}'`,
      );
      expect(r.rows[0].title).toBe('renamed');
      expect(await contextOf(table, rowId)).toMatchObject({ assessment_tier: 'foundation' });
    });

    it('leaves the snapshot unchanged when the backend re-writes the same value (retry)', async () => {
      await db.query(
        `update public.${table} set generation_context = '${SERVER}'::jsonb where id = '${rowId}'`,
      );
      expect(await contextOf(table, rowId)).toMatchObject({
        resolved_by: 'server',
        assessment_tier: 'foundation',
      });
    });
  });
}
