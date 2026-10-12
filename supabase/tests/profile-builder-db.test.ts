// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
import { templateFixture } from "./profile-builder-fixtures";
import {
  prepareProfileSave,
  type BuilderProposal,
} from "../functions/_shared/profile-builder-service";
let db: PGlite;
const owner = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
const proposal: BuilderProposal = {
  proposalVersion: 1,
  promptVersion: 1,
  origin: "model_knowledge_ai",
  evidence: null,
  evidenceVersion: null,
  presetId: null,
  profileSettings: null,
  template: templateFixture(),
};
const saved = prepareProfileSave(proposal, proposal.template),
  settings = { ...saved.settings, subject_name: "Biology" };
const key = () => crypto.randomUUID();
const claim = (user: string, id: string, hash = "a".repeat(64)) =>
  db.query<{ r: any }>("select claim_profile_builder_request($1,$2,$3) r", [
    user,
    id,
    hash,
  ]);
async function client(sql: string, params: unknown[] = []) {
  await db.exec(`set role authenticated;set "request.jwt.sub"='${owner}';`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create schema auth;create role anon;create role authenticated;create role service_role;create table public.user_profiles(id uuid primary key);insert into public.user_profiles values('${owner}'),('${other}');create function auth.role() returns text language sql stable as $$select current_user::text$$;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.sub',true),'')::uuid$$;create table public.subject_exam_profiles(id uuid primary key default gen_random_uuid(),user_id uuid not null,subject_name text not null,profile_name text not null,topics text[] not null,question_count integer not null check(question_count between 1 and 50),educational_tier text,assessment_tier text,exam_board text,time_limit_minutes integer,mcq_count integer,written_question_count integer,mcq_options_count integer,question_structure text,parent_question_count integer,max_parts_per_question integer,mcq_position text,mark_distribution jsonb,include_extended boolean,extended_marks integer,difficulty_progression text,calculator_policy text,include_graphs boolean,include_tables boolean,paper_blueprint jsonb);grant usage on schema public,auth to authenticated,service_role;grant select,insert,update,delete on subject_exam_profiles to authenticated,service_role;grant select,delete on public.user_profiles to authenticated,service_role;`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261012090000_profile_builder_rollout.sql",
      "utf8",
    ),
  );
});
afterAll(async () => {
  await db.close();
});
it("authenticated clients cannot forge, overwrite or clear trusted template provenance", async () => {
  const id = key();
  await expect(
    client(
      "insert into subject_exam_profiles(id,user_id,subject_name,profile_name,topics,question_count,profile_template) values($1,$2,$3,$4,$5,6,$6)",
      [id, owner, "Biology", "Fake", ["Cells"], JSON.stringify(saved.context)],
    ),
  ).rejects.toThrow(/server-owned/);
  await db.query(
    "insert into subject_exam_profiles(id,user_id,subject_name,profile_name,topics,question_count,profile_template) values($1,$2,$3,$4,$5,6,$6)",
    [id, owner, "Biology", "Trusted", ["Cells"], JSON.stringify(saved.context)],
  );
  await expect(
    client(
      "update subject_exam_profiles set profile_template=null where id=$1",
      [id],
    ),
  ).rejects.toThrow(/server-owned/);
  await expect(
    client("update subject_exam_profiles set profile_template=$2 where id=$1", [
      id,
      JSON.stringify({ ...saved.context, presetId: "forged" }),
    ]),
  ).rejects.toThrow(/server-owned/);
  await client("update subject_exam_profiles set profile_name=$2 where id=$1", [
    id,
    "Renamed",
  ]);
});
it("ordinary legacy manual creation remains valid with null provenance", async () => {
  await client(
    "insert into subject_exam_profiles(user_id,subject_name,profile_name,topics,question_count) values($1,$2,$3,$4,2)",
    [owner, "Geography", "Legacy", ["Rivers"]],
  );
  const row = await db.query<{ profile_template: any }>(
    "select profile_template from subject_exam_profiles where profile_name=$1",
    ["Legacy"],
  );
  expect(row.rows[0].profile_template).toBe(null);
});
it("request claims are persistent, owner-scoped and never resurrect a possibly charged request", async () => {
  const id = key();
  expect((await claim(owner, id)).rows[0].r.state).toBe("claimed");
  expect((await claim(owner, id)).rows[0].r.state).toBe("busy");
  expect((await claim(other, id)).rows[0].r.state).toBe("claimed");
  await expect(claim(owner, id, "b".repeat(64))).rejects.toThrow(
    /different input/,
  );
  await db.query(
    "update profile_builder_requests set state=$3 where user_id=$1 and request_id=$2",
    [owner, id, "failed"],
  );
  expect((await claim(owner, id)).rows[0].r.state).toBe("failed");
});
it("service-only request/save RPCs cannot be invoked by authenticated clients", async () => {
  await expect(
    client("select claim_profile_builder_request($1,$2,$3)", [
      owner,
      key(),
      "a".repeat(64),
    ]),
  ).rejects.toThrow(/permission/);
  await expect(
    client("select save_builder_profile($1,null,$2,$3,$4)", [
      owner,
      "Fake",
      JSON.stringify(settings),
      JSON.stringify(saved.context),
    ]),
  ).rejects.toThrow(/permission/);
});
it("owner read policy isolates private evidence and disallows client mutation", async () => {
  const a = key(),
    b = key();
  await claim(owner, a);
  await claim(other, b);
  const rows = await client("select user_id from profile_builder_requests");
  expect(rows.rows.length).toBeGreaterThan(0);
  expect(rows.rows.every((r: any) => r.user_id === owner)).toBe(true);
  await expect(
    client("update profile_builder_requests set payload_hash=$1", [
      "0".repeat(64),
    ]),
  ).rejects.toThrow(/permission/);
});
it("limits provider intents to three and preserves incurred usage on failure", async () => {
  const id = key();
  await claim(owner, id);
  for (let i = 0; i < 3; i++) {
    await db.query("select record_profile_builder_call($1,$2)", [owner, id]);
    await db.query("select record_profile_builder_usage($1,$2,$3)", [
      owner,
      id,
      JSON.stringify({
        promptTokens: 20,
        completionTokens: 10,
        outcome: i === 2 ? "unknown_provider_cost" : "provider_success",
      }),
    ]);
  }
  await expect(
    db.query("select record_profile_builder_call($1,$2)", [owner, id]),
  ).rejects.toThrow(/budget/);
  await db.query(
    "update profile_builder_requests set state=$3 where user_id=$1 and request_id=$2",
    [owner, id, "failed"],
  );
  const r = (
    await db.query<any>(
      "select call_intents,provider_usage from profile_builder_requests where user_id=$1 and request_id=$2",
      [owner, id],
    )
  ).rows[0];
  expect(r.call_intents).toBe(3);
  expect(r.provider_usage).toHaveLength(3);
  expect(r.provider_usage[2].outcome).toBe("unknown_provider_cost");
});
it.each([
  { promptTokens: null, completionTokens: 0, outcome: "provider_success" },
  { promptTokens: -1, completionTokens: 0, outcome: "provider_success" },
  { promptTokens: 1.2, completionTokens: 0, outcome: "provider_success" },
])("refuses malformed accounting %j", async (usage) => {
  const id = key();
  await claim(owner, id);
  await db.query("select record_profile_builder_call($1,$2)", [owner, id]);
  await expect(
    db.query("select record_profile_builder_usage($1,$2,$3)", [
      owner,
      id,
      JSON.stringify(usage),
    ]),
  ).rejects.toThrow(/Invalid provider accounting/);
});
it("atomic concurrent confirmation creates one profile, saves/reopens across sessions, and blocks foreign updates", async () => {
  const id = key();
  await claim(owner, id);
  await db.query(
    "update profile_builder_requests set state=$3,result=$4 where user_id=$1 and request_id=$2",
    [owner, id, "complete", JSON.stringify(proposal)],
  );
  const args = [
    owner,
    "Profile",
    JSON.stringify(settings),
    JSON.stringify({ ...saved.context, proposalId: id }),
    id,
  ];
  const [a, b] = await Promise.all([
    db.query<any>("select save_builder_profile($1,null,$2,$3,$4,$5) r", args),
    db.query<any>("select save_builder_profile($1,null,$2,$3,$4,$5) r", args),
  ]);
  expect(a.rows[0].r.id).toBe(b.rows[0].r.id);
  const reopened = (
    await db.query<any>(
      "select profile_template from subject_exam_profiles where id=$1",
      [a.rows[0].r.id],
    )
  ).rows[0];
  expect(reopened.profile_template.template.sections).toEqual(
    proposal.template.sections,
  );
  await expect(
    db.query("select save_builder_profile($1,$2,$3,$4,$5)", [
      other,
      a.rows[0].r.id,
      "Foreign",
      JSON.stringify(settings),
      JSON.stringify(saved.context),
    ]),
  ).rejects.toThrow(/not found/);
});
it("the existing fifty-part database limit is preserved", async () => {
  await expect(
    db.query("select save_builder_profile($1,null,$2,$3,$4)", [
      owner,
      "Oversized",
      JSON.stringify({ ...settings, question_count: 51 }),
      JSON.stringify(saved.context),
    ]),
  ).rejects.toThrow(/check constraint/);
});

it("rollout uses the existing public user identity without an auth.users table", async () => {
  const authTable = await db.query<{ name: string | null }>(
    "select to_regclass('auth.users')::text name",
  );
  expect(authTable.rows[0].name).toBe(null);
  const sql = readFileSync(
    "supabase/migrations/20261012090000_profile_builder_rollout.sql",
    "utf8",
  );
  expect(sql).not.toMatch(/references\s+auth\.users/i);
  expect(sql).toMatch(
    /REFERENCES public\.user_profiles\(id\) ON DELETE CASCADE/i,
  );
});
it("deleting the existing public account profile removes its private builder requests", async () => {
  const account = key(),
    request = key();
  await db.query("insert into public.user_profiles(id) values($1)", [account]);
  await claim(account, request);
  await db.query("delete from public.user_profiles where id=$1", [account]);
  const result = await db.query(
    "select request_id from profile_builder_requests where user_id=$1",
    [account],
  );
  expect(result.rows).toHaveLength(0);
});
it("a client cannot erase its request receipts through a public-profile cascade", async () => {
  const request = key();
  await claim(owner, request);
  await expect(
    client("delete from public.user_profiles where id=$1", [owner]),
  ).rejects.toThrow(/request history is server-owned/);
  expect((await claim(owner, request)).rows[0].r.state).toBe("busy");
  expect(
    (await db.query("select id from public.user_profiles where id=$1", [owner]))
      .rows,
  ).toHaveLength(1);
});
it("the migration refuses reapplication without changing existing records", async () => {
  const sql = readFileSync(
    "supabase/migrations/20261012090000_profile_builder_rollout.sql",
    "utf8",
  );
  await expect(db.exec(sql)).rejects.toThrow(/objects already exist/);
  await db.exec("ROLLBACK");
  expect(
    (await db.query("select id from public.user_profiles where id=$1", [owner]))
      .rows,
  ).toHaveLength(1);
});
