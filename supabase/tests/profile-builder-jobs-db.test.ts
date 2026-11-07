// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, it, expect, vi } from "vitest";
import {
  advanceSourceJob,
  answerSourceJob,
  confirmSourceJob,
  createProfileBuilderJobStore,
  sourceJobView,
  type SourceJobRecord,
  type SourceJobData,
  type SourceJobStage,
} from "../functions/_shared/profile-builder-jobs";
import {
  ownerEvidence,
  syllabus,
  templateFixture,
  universityIdentity,
} from "./profile-builder-fixtures";
let db: PGlite;
const owner = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
const proposalPath =
  "docs/pending-migrations/20261104120000_profile_builder_jobs.sql";
const data = (): SourceJobData => ({
  version: 1,
  requestedIdentity: universityIdentity,
  identity: universityIdentity,
  mode: "short_practice",
  documents: [],
  chunks: [],
  cursor: 0,
  partials: [],
  evidence: null,
  needs: [],
});
const rpc = async (name: string, args: Record<string, unknown>) => {
  const params = Object.entries(args);
  const result = await db.query<{ value: any }>(
    `select public.${name}(${params.map(([k], i) => `${k} => $${i + 1}`).join(",")}) value`,
    params.map(([, v]) =>
      typeof v === "object" && v !== null ? JSON.stringify(v) : v,
    ),
  );
  return result.rows[0]?.value;
};
const store = createProfileBuilderJobStore(rpc);
const create = (who = owner) =>
  store.create(
    who,
    crypto.randomUUID(),
    "a".repeat(64),
    "b".repeat(64),
    data(),
    "identifying",
    0,
  );
const acquire = (r: SourceJobRecord) => store.acquire(r.owner, r.id);
async function client(sql: string, args: unknown[] = []) {
  await db.exec(`set role authenticated;set "request.jwt.sub"='${owner}';`);
  try {
    return await db.query(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create schema auth;create role anon;create role authenticated;create role service_role;
    create function auth.role() returns text language sql stable as $$select current_user::text$$;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.sub',true),'')::uuid$$;
    create table public.user_profiles(id uuid primary key);insert into public.user_profiles values('${owner}'),('${other}');
    create table public.subject_exam_profiles(id uuid primary key default gen_random_uuid(),user_id uuid not null,subject_name text not null,profile_name text not null,topics text[] not null,question_count integer not null check(question_count between 1 and 50),educational_tier text,assessment_tier text,exam_board text,time_limit_minutes integer,mcq_count integer,written_question_count integer,mcq_options_count integer,question_structure text,parent_question_count integer,max_parts_per_question integer,mcq_position text,mark_distribution jsonb,include_extended boolean,extended_marks integer,difficulty_progression text,calculator_policy text,include_graphs boolean,include_tables boolean,paper_blueprint jsonb);
    grant usage on schema public,auth to authenticated,service_role;grant select,insert,update,delete on subject_exam_profiles to authenticated,service_role;
    create table public.ai_request_settings(id boolean primary key default true,enabled boolean not null default true,global_daily_limit integer not null default 1000);
    insert into public.ai_request_settings(id) values(true);
    create table public.ai_request_reservations(user_id uuid,feature text,created_at timestamptz default now());`);
  const quota = readFileSync(
    "supabase/migrations/20260913090000_launch_foundations.sql",
    "utf8",
  );
  const start = quota.indexOf(
    "CREATE OR REPLACE FUNCTION public.reserve_ai_request(",
  );
  const end = quota.indexOf("-- Old tutor counters", start);
  await db.exec(quota.slice(start, end));
  await db.exec(
    readFileSync(
      "supabase/migrations/20261012090000_profile_builder_rollout.sql",
      "utf8",
    ),
  );
  await db.exec(readFileSync(proposalPath, "utf8"));
});
beforeEach(async () => {
  await db.exec(
    "delete from ai_request_reservations;update ai_request_settings set enabled=true",
  );
});
afterAll(async () => {
  await db.close();
});
it("keeps source checkpoints and every mutation RPC inaccessible to browser roles", async () => {
  const r = await create();
  await expect(
    client("select checkpoint from profile_builder_jobs"),
  ).rejects.toThrow(/permission/);
  await expect(
    client("update profile_builder_jobs set stage='ready'"),
  ).rejects.toThrow(/permission/);
  await expect(
    client("select read_profile_builder_job($1,$2)", [owner, r.id]),
  ).rejects.toThrow(/permission/);
  await expect(
    client("select acquire_profile_builder_job($1,$2)", [owner, r.id]),
  ).rejects.toThrow(/permission/);
});
it("binds source jobs to their original owner and immutable request hash", async () => {
  const r = await create();
  expect(await store.load(other, r.id)).toBeNull();
  expect(await store.cached(other, "b".repeat(64))).toBeNull();
  await expect(
    store.create(
      owner,
      r.id,
      "c".repeat(64),
      "b".repeat(64),
      data(),
      "identifying",
      0,
    ),
  ).rejects.toThrow(/different input/);
  const again = await store.create(
    owner,
    r.id,
    "a".repeat(64),
    "",
    data(),
    "ready",
    0,
  );
  expect(again.stage).toBe("identifying");
  expect(again.revision).toBe(0);
});
it("allows only one active lease and rejects stale checkpoints", async () => {
  const first = await acquire(await create()),
    second = await acquire(first);
  expect(first.leaseToken).toBeTruthy();
  expect(second.leaseToken).toBeNull();
  const saved = await store.commit(first, {
    stage: "ready",
    data: first.data,
    elapsedMs: 1,
  });
  expect(saved.revision).toBe(1);
  await expect(
    store.commit(first, { stage: "drafting", data: first.data, elapsedMs: 1 }),
  ).rejects.toThrow(/lease/);
});
it("reserves the existing feature quota once across resumable calls", async () => {
  const r = await acquire(await create());
  await store.reserve(r);
  await store.reserve(r);
  const counts = await db.query<{ n: number }>(
    "select count(*)::int n from ai_request_reservations where user_id=$1 and feature='profile_builder'",
    [owner],
  );
  expect(counts.rows[0].n).toBe(1);
  const q = await store.load(owner, r.id);
  expect(q?.quotaReserved).toBe(true);
});
it("all extraction/draft/repair phases share the existing three-intent limit", async () => {
  let r = await create();
  for (let i = 0; i < 3; i++) {
    r = await acquire(r);
    await store.reserve(r);
    await store.beginCall(r);
    r = await store.finishCall(
      r,
      { stage: "identifying", data: r.data, elapsedMs: 2 },
      { promptTokens: 9, completionTokens: 5, outcome: "provider_success" },
    );
  }
  expect(r.callIntents).toBe(3);
  const fourth = await acquire(r);
  await expect(store.beginCall(fourth)).rejects.toThrow(/budget/);
  const receipt = await db.query<{
    call_intents: number;
    provider_usage: any[];
  }>(
    "select call_intents,provider_usage from profile_builder_requests where user_id=$1 and request_id=$2",
    [owner, r.id],
  );
  expect(receipt.rows[0].call_intents).toBe(3);
  expect(receipt.rows[0].provider_usage).toHaveLength(3);
});
it("atomically records usage with its next source checkpoint while result remains null", async () => {
  const r = await acquire(await create());
  await store.reserve(r);
  await store.beginCall(r);
  const checkpoint = { ...r.data, cursor: 1 };
  const saved = await store.finishCall(
    r,
    { stage: "ready", data: checkpoint, elapsedMs: 45 },
    { promptTokens: 12, completionTokens: 4, outcome: "provider_success" },
  );
  expect(saved.stage).toBe("ready");
  expect(saved.data.cursor).toBe(1);
  expect(saved.activeMs).toBe(45);
  const receipt = await db.query<any>(
    "select state,result,provider_usage from profile_builder_requests where user_id=$1 and request_id=$2",
    [owner, r.id],
  );
  expect(receipt.rows[0].state).toBe("running");
  expect(receipt.rows[0].result).toBeNull();
  expect(receipt.rows[0].provider_usage).toHaveLength(1);
  await expect(
    store.finishCall(
      r,
      { stage: "ready", data: checkpoint, elapsedMs: 45 },
      { promptTokens: 12, completionTokens: 4, outcome: "provider_success" },
    ),
  ).rejects.toThrow(/lease/);
});
it("a lost in-flight response fails closed after lease expiry and cannot issue another paid call", async () => {
  const r = await acquire(await create());
  await store.reserve(r);
  await store.beginCall(r);
  await db.query(
    "update profile_builder_jobs set lease_until=now()-interval '1 second' where user_id=$1 and request_id=$2",
    [owner, r.id],
  );
  const recovered = await acquire(r);
  expect(recovered.stage).toBe("failed");
  expect(recovered.leaseToken).toBeNull();
  expect(recovered.callIntents).toBe(1);
  const receipt = await db.query<any>(
    "select state,provider_usage from profile_builder_requests where user_id=$1 and request_id=$2",
    [owner, r.id],
  );
  expect(receipt.rows[0].state).toBe("failed");
  expect(receipt.rows[0].provider_usage).toEqual([
    { promptTokens: 0, completionTokens: 0, outcome: "unknown_provider_cost" },
  ]);
  expect((await acquire(r)).stage).toBe("failed");
});
it("a lease lost before transport can be resumed without a duplicate reservation", async () => {
  const r = await acquire(await create());
  await store.reserve(r);
  await db.query(
    "update profile_builder_jobs set lease_until=now()-interval '1 second' where user_id=$1 and request_id=$2",
    [owner, r.id],
  );
  const recovered = await acquire(r);
  expect(recovered.stage).toBe("identifying");
  expect(recovered.leaseToken).not.toBe(r.leaseToken);
  await store.reserve(recovered);
  await store.beginCall(recovered);
  const count = await db.query<{ n: number }>(
    "select count(*)::int n from ai_request_reservations",
  );
  expect(count.rows[0].n).toBe(1);
});
it("rechecks the global AI pause before a resumed transport even after quota reservation", async () => {
  const r = await acquire(await create());
  await store.reserve(r);
  await db.exec("update ai_request_settings set enabled=false");
  await expect(store.beginCall(r)).rejects.toThrow(/paused/);
  expect((await store.load(owner, r.id))?.callIntents).toBe(0);
});
it("writes the final checked proposal to the original legacy receipt in the same transaction", async () => {
  const r = await acquire(await create());
  await store.reserve(r);
  await store.beginCall(r);
  const proposal = {
    proposalVersion: 1,
    promptVersion: 1,
    origin: "source_backed_ai" as const,
    template: templateFixture(),
    evidence: null,
    evidenceVersion: null,
    presetId: null,
    profileSettings: null,
  };
  const saved = await store.finishCall(
    r,
    {
      stage: "complete",
      data: { ...r.data, proposal },
      elapsedMs: 10,
      proposal,
    },
    { promptTokens: 7, completionTokens: 3, outcome: "provider_success" },
  );
  expect(saved.stage).toBe("complete");
  const receipt = await db.query<any>(
    "select state,result from profile_builder_requests where user_id=$1 and request_id=$2",
    [owner, r.id],
  );
  expect(receipt.rows[0]).toEqual({ state: "complete", result: proposal });
});
it("expired source-cache entries never cross owners or survive their expiry", async () => {
  const r = await acquire(await create());
  const evidence = { private: "owner-only" };
  await store.commit(r, {
    stage: "ready",
    data: { ...r.data, evidence: evidence as any },
    elapsedMs: 0,
  });
  expect(await store.cached(owner, "b".repeat(64))).toEqual(evidence);
  expect(await store.cached(other, "b".repeat(64))).toBeNull();
  await db.query(
    "update profile_builder_jobs set expires_at=now()-interval '1 second' where user_id=$1 and request_id=$2",
    [owner, r.id],
  );
  expect(await store.cached(owner, "b".repeat(64))).toBeNull();
});
it("the proposal refuses reapplication and leaves existing saved profiles untouched", async () => {
  await expect(db.exec(readFileSync(proposalPath, "utf8"))).rejects.toThrow(
    /already exist/,
  );
  await db.exec("rollback");
  const columns = await db.query<any>(
    "select column_name from information_schema.columns where table_name='subject_exam_profiles' and column_name='profile_template'",
  );
  expect(columns.rows).toHaveLength(1);
});
it("reading intake uses the unchanged cheap 120-request daily receipt limit", async () => {
  const limited = "10000000-0000-4000-8000-000000000003";
  await db.query("insert into user_profiles(id) values($1)", [limited]);
  await db.query(
    "insert into profile_builder_requests(user_id,request_id,payload_hash,state) select $1,gen_random_uuid(),$2,'failed' from generate_series(1,120)",
    [limited, "a".repeat(64)],
  );
  await expect(
    store.create(
      limited,
      crypto.randomUUID(),
      "a".repeat(64),
      "b".repeat(64),
      { ...data(), intakePending: true },
      "reading",
      0,
    ),
  ).rejects.toThrow(/request limit/);
  const count = await db.query<{ n: number }>(
    "select count(*)::int n from profile_builder_jobs where user_id=$1",
    [limited],
  );
  expect(count.rows[0].n).toBe(0);
});

it("persists a targeted question as a resumable ready checkpoint with an ordinary SQL lease", async () => {
  const initial = await create();
  const leased = await acquire(initial);
  await store.reserve(leased);
  await store.beginCall(leased);
  const checkpoint = {
    ...leased.data,
    cursor: 1,
    missingItems: [
      {
        field: "assessment",
        question: "Which assessment are you preparing for?",
        choices: [{ value: "final", label: "Final assessment" }],
      },
    ],
  } as SourceJobData;
  const saved = await store.finishCall(
    leased,
    { stage: "ready", data: checkpoint, elapsedMs: 3 },
    { promptTokens: 11, completionTokens: 7, outcome: "provider_success" },
  );

  expect(saved.stage).toBe("ready");
  expect(saved.revision).toBe(1);
  expect(sourceJobView(saved)).toMatchObject({
    stage: "needs_details",
    revision: 1,
    missingItems: checkpoint.missingItems,
    canAdvance: false,
  });
  const answering = await acquire(saved);
  expect(answering.leaseToken).toBeTruthy();
  expect(answering.revision).toBe(1);
  expect(answering.data.missingItems).toEqual(checkpoint.missingItems);
  expect((await acquire(saved)).leaseToken).toBeNull();

  const resumed = await store.commit(answering, {
    stage: "identifying",
    data: { ...answering.data, missingItems: [] },
    elapsedMs: 1,
  });
  expect(resumed.id).toBe(initial.id);
  expect(resumed.revision).toBe(2);
  expect(resumed.callIntents).toBe(1);
  expect(resumed.quotaReserved).toBe(true);
  expect(resumed.activeMs).toBe(4);
  expect(resumed.data.cursor).toBe(1);
  const reservations = await db.query<{ count: number }>(
    "select count(*)::int count from ai_request_reservations where user_id=$1",
    [owner],
  );
  expect(reservations.rows[0].count).toBe(1);
  const receipt = await db.query<{ state: string; result: unknown }>(
    "select state,result from profile_builder_requests where user_id=$1 and request_id=$2",
    [owner, initial.id],
  );
  expect(receipt.rows[0]).toEqual({ state: "running", result: null });
});

it("cannot confirm a ready checkpoint that still has a targeted question, even with valid-looking evidence", async () => {
  const leased = await acquire(await create());
  const checkpoint = {
    ...leased.data,
    evidence: await ownerEvidence(),
    missingItems: [
      {
        field: "assessment",
        question: "Which assessment are you preparing for?",
        choices: [{ value: "final", label: "Final assessment" }],
      },
    ],
  } as SourceJobData;
  const saved = await store.commit(leased, {
    stage: "ready",
    data: checkpoint,
    elapsedMs: 0,
  });
  const deps = {
    store,
    parsePdf: vi.fn(async () => []),
    model: vi.fn(async () => {
      throw Error("A targeted-question checkpoint must not call the provider.");
    }),
  };
  await expect(
    confirmSourceJob(
      owner,
      saved.id,
      { identity: saved.data.identity, mode: saved.data.mode },
      deps,
    ),
  ).rejects.toThrow(/answer|question|detail|source/i);
  const after = await store.load(owner, saved.id);
  expect(after?.stage).toBe("ready");
  expect(after?.revision).toBe(saved.revision);
  expect(after?.callIntents).toBe(0);
  expect(after?.data.missingItems).toEqual(checkpoint.missingItems);
  expect(deps.model).not.toHaveBeenCalled();
  expect(deps.parsePdf).not.toHaveBeenCalled();
});

it("keeps legacy needs_details terminal and private under the unchanged production RPCs", async () => {
  const leased = await acquire(await create());
  const saved = await store.commit(leased, {
    stage: "needs_details",
    data: { ...leased.data, needs: ["Add the qualification-specific overview."] },
    elapsedMs: 0,
  });
  expect((await acquire(saved)).leaseToken).toBeNull();
  expect((await acquire(saved)).revision).toBe(saved.revision);
  await expect(
    store.commit(saved, {
      stage: "identifying",
      data: saved.data,
      elapsedMs: 0,
    }),
  ).rejects.toThrow(/lease/);
  expect(await store.load(other, saved.id)).toBeNull();
  await expect(store.acquire(other, saved.id)).rejects.toThrow();
  expect((await store.load(owner, saved.id))?.stage).toBe("needs_details");
  await expect(
    client("select commit_profile_builder_job($1,$2,$3,$4,$5,$6,$7,$8)", [
      owner,
      saved.id,
      null,
      saved.revision,
      "identifying",
      JSON.stringify(saved.data),
      0,
      null,
    ]),
  ).rejects.toThrow(/permission/);
});

/** A competing operation commits after the service reads, before it acquires. */
function racingStore(
  change: (record: SourceJobRecord) => {
    stage: SourceJobStage;
    data: SourceJobData;
  },
) {
  let raced = false;
  return {
    ...store,
    async acquire(who: string, id: string) {
      if (!raced) {
        raced = true;
        const competing = await store.acquire(who, id);
        expect(competing.leaseToken).toBeTruthy();
        await store.commit(competing, { ...change(competing), elapsedMs: 0 });
      }
      return store.acquire(who, id);
    },
  };
}

function unpaidDeps(jobStore = store) {
  return {
    store: jobStore,
    parsePdf: vi.fn(async () => []),
    model: vi.fn(async () => {
      throw Error("A local question transition must not call the provider.");
    }),
  };
}

it("releases a newly acquired SQL lease when a competing answer already advanced the question revision", async () => {
  const leased = await acquire(await create());
  const checkpoint: SourceJobData = {
    ...leased.data,
    retainedDocuments: [
      {
        id: "upload-1",
        checksum: "e".repeat(64),
        pages: [{ page: 1, text: syllabus }],
      },
    ],
    assessmentChoices: [{ id: "final", label: "Final", kind: "assessment" }],
    missingItems: [
      {
        field: "assessment",
        question: "Which assessment are you preparing for?",
        choices: [{ value: "final", label: "Final" }],
      },
    ],
  };
  const saved = await store.commit(leased, {
    stage: "ready",
    data: checkpoint,
    elapsedMs: 0,
  });
  const deps = unpaidDeps(
    racingStore((record) => ({
      stage: "identifying",
      data: { ...record.data, missingItems: [], needs: [] },
    })),
  );
  const view = await answerSourceJob(
    owner,
    saved.id,
    { revision: saved.revision, answers: { assessment: "final" } },
    deps,
  );
  expect(view.stage).toBe("identifying");
  expect(view.revision).toBe(saved.revision + 2);
  const after = await store.load(owner, saved.id);
  expect(after?.stage).toBe("identifying");
  expect(after?.leaseToken).toBeNull();
  expect(after?.callIntents).toBe(0);
  expect((await store.acquire(owner, saved.id)).leaseToken).toBeTruthy();
  expect(deps.model).not.toHaveBeenCalled();
  expect(deps.parsePdf).not.toHaveBeenCalled();
});

it("a stale confirmation cannot skip a new targeted question or retain its SQL lease", async () => {
  const leased = await acquire(await create());
  const saved = await store.commit(leased, {
    stage: "ready",
    data: { ...leased.data, evidence: await ownerEvidence() },
    elapsedMs: 0,
  });
  const deps = unpaidDeps(
    racingStore((record) => ({
      stage: "ready",
      data: {
        ...record.data,
        missingItems: [
          { field: "source_pages", question: "Which page has the assessment overview?" },
        ],
      },
    })),
  );
  const view = await confirmSourceJob(
    owner,
    saved.id,
    { identity: saved.data.identity, mode: saved.data.mode },
    deps,
  );
  expect(view.stage).toBe("needs_details");
  expect(view.missingItems?.[0].field).toBe("source_pages");
  expect((await store.load(owner, saved.id))?.leaseToken).toBeNull();
  expect((await store.acquire(owner, saved.id)).leaseToken).toBeTruthy();
  expect(deps.model).not.toHaveBeenCalled();
});

it("a confirmation uses the same identity snapshot after acquiring its real SQL lease", async () => {
  const leased = await acquire(await create());
  const saved = await store.commit(leased, {
    stage: "ready",
    data: { ...leased.data, evidence: await ownerEvidence() },
    elapsedMs: 0,
  });
  const deps = unpaidDeps(
    racingStore((record) => ({
      stage: "ready",
      data: { ...record.data, mode: "custom" },
    })),
  );
  const view = await confirmSourceJob(
    owner,
    saved.id,
    { identity: saved.data.identity, mode: saved.data.mode },
    deps,
  );
  expect(view.stage).toBe("ready");
  expect(view.mode).toBe("custom");
  expect((await store.load(owner, saved.id))?.leaseToken).toBeNull();
  expect((await store.acquire(owner, saved.id)).leaseToken).toBeTruthy();
  expect(deps.model).not.toHaveBeenCalled();
});

it("an advance racing a question checkpoint releases its SQL lease without starting a call", async () => {
  const initial = await create();
  const deps = unpaidDeps(
    racingStore((record) => ({
      stage: "ready",
      data: {
        ...record.data,
        missingItems: [{ field: "source", question: "Can you add the assessment overview?" }],
      },
    })),
  );
  const view = await advanceSourceJob(owner, initial.id, deps);
  expect(view.stage).toBe("needs_details");
  expect((await store.load(owner, initial.id))?.leaseToken).toBeNull();
  expect((await store.acquire(owner, initial.id)).leaseToken).toBeTruthy();
  expect(deps.model).not.toHaveBeenCalled();
  expect(deps.parsePdf).not.toHaveBeenCalled();
});
