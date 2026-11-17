// @vitest-environment node
import { beforeAll, it, expect } from "vitest";
import { APPROVAL_REGISTRY } from "../functions/_shared/preset-approval";
import { templateFromPreset } from "../functions/_shared/profile-builder-service";
import {
  templateFixture,
  pearsonTemplate,
  syllabus,
  ownerEvidence,
} from "./profile-builder-fixtures";
import { SOURCE_REGISTRY } from "../functions/_shared/profile-source-registry";
import { buildHandlerFixture, handlerRuntime as runtime } from "./profile-builder-handler-runtime";
beforeAll(buildHandlerFixture);
it("real handler authenticates before accepting catalogue or paid requests", async () => {
  const r = runtime(),
    result = await r.call({ action: "propose" }, "invalid-token");
  expect(result.status).toBe(401);
  expect(r.provider).toHaveLength(0);
});
it("real catalogue propose → save → reopen → duplicate re-evaluates approval with zero provider calls", async () => {
  const e = APPROVAL_REGISTRY.find(
      (e) => e.component === "H420/03" && e.mode === "short_practice",
    )!,
    p = templateFromPreset(e.id),
    r = runtime(),
    requestId = crypto.randomUUID();
  const proposal = await r.call({
    action: "propose",
    requestId,
    identity: p.template.identity,
    mode: p.template.mode,
  });
  expect(proposal.status).toBe(200);
  expect(proposal.body.proposal.presetId).toBe(e.id);
  const save = await r.call({
    action: "save",
    proposalId: requestId,
    profileName: "Unified",
    template: p.template,
  });
  expect(save.status).toBe(200);
  expect(save.body.approval.status).toBe("approved");
  const stored = r.profiles.get(save.body.profile.id);
  expect(stored.profile_template.template.marks).toBe(20);
  const copy = await r.call({
    action: "duplicate",
    requestId: crypto.randomUUID(),
    profileId: stored.id,
    profileName: "Copy",
  });
  expect(copy.status).toBe(200);
  expect(copy.body.profile.id).not.toBe(stored.id);
  expect(copy.body.approval.status).toBe("approved");
  expect(r.quotas).toBe(0);
  expect(r.provider).toHaveLength(0);
});
it("real source-backed example uses quota/cost accounting, saves a compiled draft and retains no approval", async () => {
  const t = pearsonTemplate(),
    r = runtime([t]),
    requestId = crypto.randomUUID();
  const p = await r.call({
    action: "propose",
    requestId,
    identity: t.identity,
    mode: t.mode,
    sourceId: SOURCE_REGISTRY[0].id,
  });
  expect(p.status).toBe(200);
  expect(r.quotas).toBe(1);
  expect(r.costs).toHaveLength(2);
  const result = await r.call({
    action: "save",
    proposalId: requestId,
    profileName: "Pearson evidence draft",
    template: t,
  });
  expect(result.status).toBe(200);
  expect(result.body.approval.status).toBe("not_approved");
  expect(result.body.profile.profile_template.evidenceVersion).toMatch(
    /^[a-f0-9]{64}$/,
  );
  expect(result.body.profile.paper_blueprint).toBe(null);
});
it("real institutional upload keeps checksum-bound owner evidence and ignores embedded approval instructions", async () => {
  const t = templateFixture(),
    r = runtime([await ownerEvidence(), t]),
    requestId = crypto.randomUUID(),
    result = await r.call({
      action: "propose",
      requestId,
      identity: t.identity,
      mode: t.mode,
      upload: {
        contentType: "text/plain",
        base64: Buffer.from(syllabus).toString("base64"),
      },
    });
  expect(result.status).toBe(200);
  expect(result.body.proposal.origin).toBe("source_backed_ai");
  expect(result.body.proposal.presetId).toBe(null);
  expect(r.provider[0].messages[0].content).toContain("UNTRUSTED DATA");
});
it("client-forged origin/approval and foreign proposal save are rejected by the actual handler", async () => {
  const r = runtime();
  expect(
    (
      await r.call({
        action: "save",
        proposalId: crypto.randomUUID(),
        profileName: "Forged",
        template: templateFixture(),
        approval: "approved",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await r.call({
        action: "save",
        proposalId: crypto.randomUUID(),
        profileName: "Foreign",
        template: templateFixture(),
      })
    ).status,
  ).toBe(404);
  expect(r.profiles.size).toBe(0);
});

it("new source-job actions authenticate before reading uploads or invoking any job RPC", async () => {
  let reads = 0;
  const r = runtime([], "owner", () => {
    reads++;
    return null;
  });
  const result = await r.call(
    { action: "prepare_source", requestId: crypto.randomUUID() },
    "invalid-token",
  );
  expect(result.status).toBe(401);
  expect(reads).toBe(0);
  expect(r.provider).toHaveLength(0);
});
it("job status is owner-scoped and never returns source text, accounting or internal checkpoints", async () => {
  const jobId = crypto.randomUUID(),
    identity = templateFixture().identity;
  const calls: any[] = [];
  const r = runtime([], "authenticated-owner", (name, args) => {
    calls.push({ name, args });
    expect(name).toBe("read_profile_builder_job");
    return {
      owner: "authenticated-owner",
      id: jobId,
      stage: "identifying",
      revision: 1,
      leaseToken: null,
      quotaReserved: true,
      callIntents: 1,
      activeMs: 123,
      data: {
        version: 1,
        requestedIdentity: identity,
        identity,
        mode: "short_practice",
        documents: [
          {
            id: "private-doc",
            checksum: "a".repeat(64),
            pages: [{ page: 1, text: "PRIVATE SYLLABUS TEXT" }],
          },
        ],
        chunks: [
          {
            id: "chunk1",
            documentId: "private-doc",
            pages: [{ page: 1, text: "PRIVATE SYLLABUS TEXT" }],
            characterCount: 21,
          },
        ],
        cursor: 0,
        partials: [],
        evidence: null,
        needs: [],
      },
    };
  });
  const result = await r.call({ action: "source_status", jobId });
  expect(result.status).toBe(200);
  expect(result.body.job).toMatchObject({
    jobId,
    stage: "identifying",
    mode: "short_practice",
  });
  expect(calls).toEqual([
    {
      name: "read_profile_builder_job",
      args: { p_owner: "authenticated-owner", p_request: jobId },
    },
  ]);
  expect(JSON.stringify(result.body)).not.toMatch(
    /PRIVATE SYLLABUS|leaseToken|callIntents|checkpoint|documents/,
  );
  expect(r.provider).toHaveLength(0);
  expect(r.quotas).toBe(0);
});
it("client-provided owners and extra job context are rejected by the authenticated handler", async () => {
  let calls = 0;
  const r = runtime([], "authenticated-owner", () => {
    calls++;
    return null;
  });
  const result = await r.call({
    action: "source_status",
    jobId: crypto.randomUUID(),
    owner: "another-account",
    checkpoint: { stage: "complete" },
  });
  expect(result.status).toBe(400);
  expect(calls).toBe(0);
  expect(r.provider).toHaveLength(0);
});
it("a receipt belonging to another account is unavailable without a model call", async () => {
  const r = runtime([], "authenticated-owner", () => null);
  const result = await r.call({
    action: "source_status",
    jobId: crypto.randomUUID(),
  });
  expect(result.status).toBe(404);
  expect(result.body.error).toMatch(/not found in your account/);
  expect(r.provider).toHaveLength(0);
});

it("restores a completed legacy proposal from its owned receipt without another model request", async () => {
  const r = runtime([], "owner", () => null),
    id = crypto.randomUUID();
  const entry = APPROVAL_REGISTRY.find(
    (e) => e.component === "H420/03" && e.mode === "full_mock",
  )!;
  const proposal = templateFromPreset(entry.id);
  r.receipts.set("owner" + id, { state: "complete", result: proposal });
  const result = await r.call({ action: "source_status", jobId: id });
  expect(result.status).toBe(200);
  expect(result.body.job).toMatchObject({
    stage: "complete",
    canAdvance: false,
    proposalId: id,
    proposal: { presetId: entry.id },
  });
  expect(r.provider).toHaveLength(0);
  expect(r.quotas).toBe(0);
});
it("checking an unfinished legacy request cannot rerun its provider call", async () => {
  const r = runtime([], "owner", () => null),
    id = crypto.randomUUID();
  r.receipts.set("owner" + id, { state: "running", result: null });
  const result = await r.call({ action: "source_status", jobId: id });
  expect(result.status).toBe(200);
  expect(result.body.job).toMatchObject({
    stage: "drafting",
    canAdvance: false,
  });
  expect(result.body.job.proposal).toBeUndefined();
  expect(r.provider).toHaveLength(0);
  expect(r.quotas).toBe(0);
});

it("legacy receipt recovery works if the additive job RPC has not been installed yet", async () => {
  const r = runtime([], "owner", () => ({ __rpcError: { code: "42883" } })),
    id = crypto.randomUUID();
  const entry = APPROVAL_REGISTRY.find(
    (e) => e.component === "H420/03" && e.mode === "full_mock",
  )!;
  r.receipts.set("owner" + id, {
    state: "complete",
    result: templateFromPreset(entry.id),
  });
  const result = await r.call({ action: "source_status", jobId: id });
  expect(result.status).toBe(200);
  expect(result.body.job).toMatchObject({
    stage: "complete",
    canAdvance: false,
    proposalId: id,
  });
  expect(r.provider).toHaveLength(0);
});
it("other job RPC failures cannot be mistaken for successful legacy recovery", async () => {
  const r = runtime([], "owner", () => ({ __rpcError: { code: "08006" } })),
    id = crypto.randomUUID();
  const result = await r.call({ action: "source_status", jobId: id });
  expect(result.status).toBe(503);
  expect(result.body.job).toBeUndefined();
  expect(r.provider).toHaveLength(0);
});
