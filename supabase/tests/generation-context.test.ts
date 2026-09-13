// @vitest-environment node
//
// Batch 1 correction pass: the stored generation context is authoritative.
// These tests pin the behaviours a client must not be able to bend:
//   - a client-written snapshot is discarded and re-resolved server-side
//   - a server-written snapshot is reused on retries, so a later profile edit
//     never changes an existing attempt
//   - board / qualification used downstream come from the resolved snapshot
//   - an explicit invalid tier is rejected; only genuinely absent = unknown
import { beforeEach, describe, expect, it } from 'vitest';
import {
  establishGenerationContext,
  isServerResolvedContext,
  ProfileContextError,
  resolveProfileContext,
  storedAssessmentTier,
  toStoredGenerationContext,
} from '../functions/_shared/profile-context.ts';
import { isValidAssessmentTierFor } from '../functions/_shared/assessment-tier.ts';

const USER = 'user-1';
const OTHER = 'user-2';
const SET = 'set-1';

const aqaBiologyHigher = {
  id: 'p1',
  user_id: USER,
  profile_name: 'Paper 1 Higher',
  subject_name: 'Biology',
  exam_board: 'aqa',
  educational_tier: 'level2',
  assessment_tier: 'higher',
};

/** Minimal stand-in for the supabase client used by the resolver. */
function makeClient(
  profiles: Record<string, any>,
  writeOutcome: { error?: { message: string } | null; rows?: any[] } = {},
) {
  const updates: any[] = [];
  const client = {
    updates,
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder: any = {
        _payload: null as any,
        _selected: false,
        select() { builder._selected = true; return builder; },
        update(payload: any) { builder._payload = payload; return builder; },
        eq(col: string, val: unknown) { filters[col] = val; return builder; },
        maybeSingle() {
          const row = profiles[String(filters.id)];
          if (!row || row.user_id !== filters.user_id) {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: row, error: null });
        },
        then(resolve: (v: any) => void) {
          updates.push({ table, filters, payload: builder._payload });
          const error = writeOutcome.error ?? null;
          const data = error
            ? null
            : writeOutcome.rows ?? [{ id: filters.id }];
          return Promise.resolve({ data, error }).then(resolve);
        },
      };
      return builder;
    },
  };
  return client;
}


describe('server-authoritative generation context', () => {
  let client: ReturnType<typeof makeClient>;
  beforeEach(() => {
    client = makeClient({ p1: { ...aqaBiologyHigher } });
  });

  it('discards a client-written snapshot and re-resolves from the owned profile', async () => {
    const setData: any = {
      profile_id: 'p1',
      subject_id: 'Biology',
      exam_board: 'edexcel',
      educational_tier: 'level3_a_level',
      // Forged by the browser: claims Foundation and a different course.
      generation_context: {
        context_version: 1,
        resolved_by: 'client',
        assessment_tier: 'foundation',
        exam_board: 'edexcel',
        educational_tier: 'level3_a_level',
      },
    };

    const ctx = await establishGenerationContext(client, SET, USER, setData);

    expect(ctx?.resolved_by).toBe('server');
    expect(ctx?.assessment_tier).toBe('higher');
    expect(ctx?.exam_board).toBe('aqa');
    // Downstream prompt builders read setData — it must match the snapshot.
    expect(setData.exam_board).toBe('aqa');
    expect(setData.educational_tier).toBe('level2');
    expect(client.updates.at(-1)?.filters.user_id).toBe(USER);
  });

  it('reuses a server snapshot on retry, so later profile edits cannot change the attempt', async () => {
    const setData: any = { profile_id: 'p1', subject_id: 'Biology' };
    const first = await establishGenerationContext(client, SET, USER, setData);
    expect(first?.assessment_tier).toBe('higher');

    // The user now edits the profile to Foundation / a different board.
    client = makeClient({
      p1: { ...aqaBiologyHigher, assessment_tier: 'foundation', exam_board: 'ocr' },
    });
    const retryData: any = { profile_id: 'p1', subject_id: 'Biology', generation_context: first };
    const second = await establishGenerationContext(client, SET, USER, retryData);

    expect(second).toEqual(first);
    expect(second?.assessment_tier).toBe('higher');
    expect(retryData.exam_board).toBe('aqa');
    expect(client.updates).toHaveLength(0); // nothing rewritten
  });

  it('refuses a profile the caller does not own', async () => {
    const setData: any = { profile_id: 'p1', subject_id: 'Biology' };
    await expect(establishGenerationContext(client, SET, OTHER, setData))
      .rejects.toBeInstanceOf(ProfileContextError);
  });

  it('never lets a quiz difficulty control move the tier', async () => {
    const setData: any = {
      profile_id: 'p1',
      subject_id: 'Biology',
      difficulty_level: 'hard',
      difficulty_mode: 'manual',
    };
    const ctx = await establishGenerationContext(client, SET, USER, setData);
    expect(ctx?.assessment_tier).toBe('higher');
    expect(Object.keys(ctx ?? {})).not.toContain('difficulty_level');
  });

  it('treats only a server-marked, current-version snapshot as trusted', () => {
    expect(isServerResolvedContext(null)).toBe(false);
    expect(isServerResolvedContext({ resolved_by: 'client', context_version: 1 })).toBe(false);
    expect(isServerResolvedContext({ resolved_by: 'server', context_version: 99 })).toBe(false);
    expect(isServerResolvedContext({ resolved_by: 'server', context_version: 1 })).toBe(true);
  });

  it('reads the tier only from a trusted snapshot', () => {
    expect(storedAssessmentTier({ resolved_by: 'client', context_version: 1, assessment_tier: 'higher' })).toBeNull();
    expect(storedAssessmentTier({ resolved_by: 'server', context_version: 1, assessment_tier: 'higher' })).toBe('higher');
    expect(storedAssessmentTier(undefined)).toBeNull();
  });
});

describe('tier validation', () => {
  const course = { subject: 'Biology', examBoard: 'aqa', educationalTier: 'level2' };

  it('accepts absent values as unknown legacy data', () => {
    expect(isValidAssessmentTierFor(null, course)).toBe(true);
    expect(isValidAssessmentTierFor(undefined, course)).toBe(true);
    expect(isValidAssessmentTierFor('   ', course)).toBe(true);
  });

  it('rejects an explicit value that is not a real tier', () => {
    expect(isValidAssessmentTierFor('banana', course)).toBe(false);
  });

  it('rejects a real tier the course does not offer', () => {
    expect(isValidAssessmentTierFor('not_tiered', course)).toBe(false);
    expect(isValidAssessmentTierFor('higher', { ...course, subject: 'History' })).toBe(false);
  });

  it('marks a server-resolved snapshot and keeps the tier out of untiered courses', async () => {
    const client = makeClient({
      p1: { id: 'p1', user_id: USER, subject_name: 'History', exam_board: 'aqa', educational_tier: 'level2', assessment_tier: null },
    });
    const ctx = await resolveProfileContext(client, { userId: USER, subjectName: 'History', profileId: 'p1' });
    expect(ctx.assessmentTier).toBeNull();
    expect(ctx.assessmentTierSupported).toBe(false);
    expect(toStoredGenerationContext(ctx).resolved_by).toBe('server');
  });
});
