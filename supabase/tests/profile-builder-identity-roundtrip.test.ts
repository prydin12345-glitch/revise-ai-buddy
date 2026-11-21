// @vitest-environment node
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { buildHandlerFixture, handlerRuntime } from "./profile-builder-handler-runtime";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";
import { ownerEvidence, templateFixture } from "./profile-builder-fixtures";
import { invokeProfileBuilder } from "../../src/lib/profile-builder-client";
import { builderInitialIdentity } from "../../src/lib/profile-builder-resolution";
import { normaliseSourceIdentity } from "../functions/_shared/profile-builder-identity";
import { discoverSourceAssessments } from "../functions/_shared/profile-assessment-discovery";
import { checksum, identitySchema } from "../functions/_shared/profile-template";
import { snapshotTemplate, templateSnapshotInstructions } from "../functions/_shared/profile-template-context";
import { assertBiologyPractice } from "../functions/_shared/biology-practice";
import { genericRows } from "./profile-builder-fixtures";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
beforeAll(buildHandlerFixture);
beforeEach(() => { invoke.mockReset(); });
const owner = "synthetic-business-owner";
const text = [
  "Pearson Edexcel A-level Business (9BS0)", "Version 2026",
  "Paper 1 — Marketing and people (9BS0/01)",
  "6 marks; 30 minutes. Topics: Marketing and People.",
  "Short structured answers. Answer all questions. No calculator allowed.",
].join("\n");
const initial = () => builderInitialIdentity({ subject: "Business", board: "Edexcel", level: "level3", region: "GB" });

async function extraction(payload: any) {
  const evidence = await ownerEvidence();
  evidence.identity = { ...payload.identity, course: "9BS0", specificationVersion: "2026", tier: null };
  evidence.documents[0] = {
    ...evidence.documents[0], id: payload.documents[0].id, checksum: payload.documents[0].checksum,
    title: "Synthetic Business brief", locations: [{ id: "brief", page: 1, section: "Assessment", text }],
  };
  evidence.facts.topics = ["Marketing", "People"];
  evidence.facts.tier = null;
  evidence.claims = evidence.claims.filter(claim => claim.field !== "tier").map(claim => ({
    ...claim, documentId: payload.documents[0].id,
    quote: claim.field === "topics" ? "Marketing and People" : claim.quote,
  }));
  return {
    evidence,
    identityClaims: [
      { field: "course", quote: "9BS0" }, { field: "specificationVersion", quote: "Version 2026" },
    ].map(claim => ({ ...claim, documentId: payload.documents[0].id, locationId: "brief" })),
  };
}
function draft(payload: any) {
  const template = templateFixture();
  template.identity = payload.identity;
  template.mode = payload.mode;
  template.topics = ["Marketing", "People"];
  template.sections[0].groups[0].parts.forEach((part, index) => { part.topic = template.topics[index]; });
  return template;
}

function runtime(responses: Parameters<typeof handlerRuntime>[0] = [extraction, draft]) {
  const memory = memoryJobStore();
  const r = handlerRuntime(responses, owner, async (name, args) => {
    const record = () => ({ ...memory.records.get(ownerKey(args.p_owner, args.p_request))!, leaseToken: args.p_token, revision: args.p_revision });
    const change = () => ({ stage: args.p_stage, data: args.p_checkpoint, elapsedMs: args.p_elapsed_ms, ...(args.p_proposal ? { proposal: args.p_proposal } : {}) });
    switch (name) {
      case "read_profile_builder_job": return memory.store.load(args.p_owner, args.p_request);
      case "create_profile_builder_job": return memory.store.create(args.p_owner, args.p_request, args.p_hash, args.p_source_key, args.p_checkpoint, args.p_stage, args.p_elapsed_ms);
      case "cached_profile_builder_source": return memory.store.cached(args.p_owner, args.p_source_key);
      case "acquire_profile_builder_job": return memory.store.acquire(args.p_owner, args.p_request);
      case "commit_profile_builder_job": return memory.store.commit(record(), change());
      case "reserve_profile_builder_job": await memory.store.reserve(record()); return null;
      case "begin_profile_builder_job_call": await memory.store.beginCall(record()); return null;
      case "finish_profile_builder_job_call": {
        const next = await memory.store.finishCall(record(), change(), args.p_usage);
        if (next.stage === "complete") r.receipts.set(args.p_owner + args.p_request, { state: "complete", result: args.p_proposal });
        return next;
      }
      default: throw Error(`Unexpected job RPC ${name}`);
    }
  });
  invoke.mockImplementation(async (_name, { body }) => {
    const result = await r.call(body);
    return result.status < 400 ? { data: result.body, error: null } : {
      data: null, error: { name: "FunctionsHttpError", context: new Response(JSON.stringify(result.body), { status: result.status }) },
    };
  });
  return { ...r, memory };
}

it("real client → handler saves detailed paper topics and restores them as separate quiz targets", async () => {
  const brief = text.replace("Topics: Marketing and People.", "Questions are drawn from Themes 1 and 4.");
  const roots = ["Theme 1: Marketing and people", "Theme 4: Global business"];
  const detailedText = [brief, roots[0], "1.1 Meeting customer needs",
    "1.1.1 Market research", "a) Primary and secondary research", "b) Market segmentation",
    "1.1.2 Market positioning", "a) Market mapping", "b) Competitive advantage",
    "Theme 2: Managing business activities", "2.1 Finance", "2.1.1 Raising finance", "a) Loans",
    roots[1], "4.1 Globalisation", "4.1.1 Growing economies", "a) Gross Domestic Product (GDP)",
  ].join("\n");
  const read = async (payload: any) => {
    const result = await extraction(payload);
    const evidence = result.evidence;
    evidence.documents[0].locations = [
      { id: "brief", page: 1, section: "Assessment", text: brief },
      ...roots.map((root, index) => ({ id: `root-${index}`, page: 1, section: "Content", text: root })),
    ];
    evidence.facts.topics = roots;
    evidence.claims = evidence.claims.filter(claim => claim.field !== "topics");
    evidence.claims.push(...roots.map((quote, index) => ({
      field: "topics", documentId: evidence.documents[0].id, locationId: `root-${index}`,
      quote, rule: "mandatory" as const,
    })));
    return result;
  };
  const detailedDraft = (payload: any) => {
    const template = draft(payload);
    template.topics = payload.evidence.facts.topics;
    expect(template.topics).toEqual(["1.1.1 Market research", "1.1.2 Market positioning", "4.1.1 Growing economies"]);
    expect(payload.evidence.topicDetails).toBeUndefined();
    template.sections[0].groups[0].parts.forEach((part, index) => { part.topic = template.topics[index]; });
    return template;
  };
  const r = runtime([read, detailedDraft]);
  const requestId = crypto.randomUUID();
  await invokeProfileBuilder({ action: "prepare_source", requestId,
    identity: { ...initial(), course: "", component: "Paper 1", specificationVersion: "", tier: null },
    specificationVersionIntent: "source", mode: "full_mock",
    uploads: [{ contentType: "text/plain", base64: Buffer.from(detailedText).toString("base64") }],
  });
  const ready = (await invokeProfileBuilder({ action: "advance_source", jobId: requestId })).job!;
  expect(ready.stage, JSON.stringify(ready)).toBe("ready");
  expect(r.memory.records.get(ownerKey(owner, requestId))!.data.evidence?.facts.topics)
    .toEqual(["1.1.1 Market research", "1.1.2 Market positioning", "4.1.1 Growing economies"]);
  await invokeProfileBuilder({ action: "confirm_source", jobId: requestId, identity: ready.identity, mode: ready.mode });
  const complete = (await invokeProfileBuilder({ action: "advance_source", jobId: requestId })).job!;
  expect(complete.stage, JSON.stringify(complete)).toBe("complete");
  const proposal = complete.proposal!;
  expect(proposal.evidence?.topicDetails).toHaveLength(3);
  expect(JSON.stringify(proposal.evidence?.topicDetails)).toContain("Market segmentation");
  expect(JSON.stringify(proposal.evidence?.topicDetails)).not.toContain("Raising finance");
  const saved = await invokeProfileBuilder({ action: "save", proposalId: requestId,
    profileName: "Synthetic detailed Business", template: proposal.template });
  expect(saved.profile?.topics).toEqual(proposal.template.topics);
  expect(saved.profile?.profile_template.evidence.topicDetails).toEqual(proposal.evidence?.topicDetails);
  const restored = (await invokeProfileBuilder({ action: "source_status", jobId: requestId })).job!;
  expect(restored.proposal?.evidence?.topicDetails).toEqual(proposal.evidence?.topicDetails);
  const frozen = snapshotTemplate(saved.profile!);
  expect(JSON.stringify(frozen)).not.toContain("Market segmentation");
  expect(JSON.stringify(frozen)).not.toContain("upload-1");
  const context = { profile_template: frozen };
  const selected = proposal.template.topics[2]; // Not sampled by either saved plan part.
  expect(templateSnapshotInstructions(context)).toContain(selected);
  const rows = genericRows().map(row => ({ ...row, subtopic: selected, topic_tag: selected }));
  expect(() => assertBiologyPractice(rows, context, [selected])).not.toThrow();
  expect(() => assertBiologyPractice([{ ...rows[0], subtopic: proposal.template.topics[0] }], context, [selected]))
    .toThrow("outside the selected quiz topics");
  expect(r.provider).toHaveLength(2);
});

it.each(["", "A-level Business", "9BS0"])("real client → handler prepares course %j, confirms, saves and restores with separate catalogue tier provenance", async course => {
  const r = runtime();
  const identity = { ...initial(), course, component: "Paper 1", specificationVersion: "" };
  const discovered = await discoverSourceAssessments([{ id: "upload-1", checksum: await checksum(text), pages: [text] }], normaliseSourceIdentity(identity));
  const selected = discovered.candidates.find(candidate => candidate.componentCode === "9BS0/01")!;
  expect(selected).toBeDefined();
  const requestId = crypto.randomUUID();
  const input = { action: "prepare_source", requestId, identity, selectedAssessmentId: selected.id,
    specificationVersionIntent: "source", mode: "short_practice", uploads: [{ contentType: "text/plain", base64: Buffer.from(text).toString("base64") }] };
  const prepared = await invokeProfileBuilder(input);
  expect(prepared.job).toMatchObject({ stage: "identifying", assessmentConfirmed: true, identity: { course: "9BS0", tier: "not_tiered", component: "9BS0/01" } });
  expect(r.provider).toHaveLength(0);
  const replay = await invokeProfileBuilder(input);
  expect(replay.job?.jobId).toBe(requestId);
  const ready = (await invokeProfileBuilder({ action: "advance_source", jobId: requestId })).job!;
  expect(ready).toMatchObject({ stage: "ready", identity: { course: "9BS0", tier: "not_tiered", specificationVersion: "2026" } });
  await invokeProfileBuilder({ action: "confirm_source", jobId: requestId, identity: ready.identity, mode: ready.mode });
  const complete = (await invokeProfileBuilder({ action: "advance_source", jobId: requestId })).job!;
  expect(complete.stage).toBe("complete");
  const saved = await invokeProfileBuilder({ action: "save", proposalId: requestId, profileName: "Synthetic Business", template: complete.proposal!.template });
  expect(saved.approval?.status).toBe("not_approved");
  expect(saved.profile?.profile_template.template.identity).toEqual(ready.identity);
  const restored = (await invokeProfileBuilder({ action: "source_status", jobId: requestId })).job!;
  expect(restored.proposal?.template).toEqual(complete.proposal!.template);
  expect(r.provider).toHaveLength(2);
  expect(r.memory.reservations).toBe(1);
});

it("real client → handler builds the full Business profile without a practice downgrade or PDF-tier quote", async () => {
  const r = runtime();
  const requestId = crypto.randomUUID();
  await invokeProfileBuilder({ action: "prepare_source", requestId,
    identity: { ...initial(), course: "9BS0", component: "Paper 1", specificationVersion: "", tier: null },
    specificationVersionIntent: "source", mode: "full_mock",
    uploads: [{ contentType: "text/plain", base64: Buffer.from(text).toString("base64") }],
  });
  const ready = (await invokeProfileBuilder({ action: "advance_source", jobId: requestId })).job!;
  expect(ready).toMatchObject({ stage: "ready", mode: "full_mock", identity: { tier: "not_tiered" },
    reviewedFacts: { tier: { source: "assessment_catalogue", courseId: "pearson_alevel_business_9bs0" } } });
  expect(ready.missingItems).toBeUndefined();
  expect(r.provider).toHaveLength(1);
  await invokeProfileBuilder({ action: "confirm_source", jobId: requestId, identity: ready.identity, mode: ready.mode });
  const complete = (await invokeProfileBuilder({ action: "advance_source", jobId: requestId })).job!;
  expect(complete.stage).toBe("complete");
  expect(complete.proposal?.evidence?.facts.tier).toBe("not_tiered");
  expect(complete.proposal?.evidence?.claims.some(claim => claim.field === "tier")).toBe(false);
  const saved = await invokeProfileBuilder({ action: "save", proposalId: requestId, profileName: "Synthetic full Business profile", template: complete.proposal!.template });
  expect(saved.profile?.profile_template.template.mode).toBe("full_mock");
  expect(saved.profile?.profile_template.template.identity.tier).toBe("not_tiered");
  expect(saved.approval?.status).toBe("not_approved");
  expect(r.provider).toHaveLength(2);
  expect(r.memory.reservations).toBe(1);
});

it("real handler returns schema field labels without rejected input and keeps save identities strict", async () => {
  const r = runtime([]);
  const input = { action: "prepare_source", requestId: crypto.randomUUID(), identity: { ...initial(), course: "", component: "", tier: "PRIVATE_REJECTED_TIER" }, mode: "short_practice", uploads: [{ contentType: "text/plain", base64: Buffer.from(text).toString("base64") }] };
  const result = await r.call(input);
  expect(result.body).toMatchObject({ code: "INVALID_PROFILE_INPUT", fields: ["identity.component", "identity.tier"] });
  expect(JSON.stringify(result.body)).not.toContain("PRIVATE_REJECTED_TIER");
  await expect(invokeProfileBuilder(input)).rejects.toThrow(/Check: assessment, tier/);
  expect(identitySchema.safeParse(initial()).success).toBe(false);
  expect(r.memory.records.size).toBe(0);
  expect(r.provider).toHaveLength(0);
});

it("normalises only intake placeholders and explicit reviewed course facts", () => {
  expect(normaliseSourceIdentity(initial())).toMatchObject({ course: "9BS0", specificationVersion: "Not verified", tier: "not_tiered" });
  for (const course of ["", "A-level Physics", "7408", "aqa_alevel_physics_7408"]) {
    expect(normaliseSourceIdentity({ ...initial(), subject: "Physics", organisation: "AQA", course })).toMatchObject({ course: "7408", tier: "not_tiered" });
  }
  expect(normaliseSourceIdentity({ ...initial(), subject: "Physics", organisation: "AQA", course: "unreviewed", tier: null }).tier).toBeNull();
  expect(normaliseSourceIdentity({ ...initial(), qualification: "GCSE", subject: "Physics", organisation: "AQA", course: "", tier: "higher" })).toMatchObject({ course: "8463", tier: "higher" });
});

it("reviewed Physics cannot normalise away malformed or conflicting explicit tiers", async () => {
  const r = runtime([]);
  for (const tier of ["PRIVATE_REJECTED_TIER", "higher", "foundation"]) {
    const identity = { ...initial(), subject: "Physics", organisation: "AQA", course: "7408", component: "Paper 1", tier };
    expect((normaliseSourceIdentity(identity as any) as any).tier).toBe(tier);
    if (tier === "PRIVATE_REJECTED_TIER") {
      const result = await r.call({ action: "prepare_source", requestId: crypto.randomUUID(), identity,
        mode: "short_practice", uploads: [{ contentType: "text/plain", base64: Buffer.from(text).toString("base64") }] });
      expect(result.body).toMatchObject({ code: "INVALID_PROFILE_INPUT", fields: ["identity.tier"] });
      expect(JSON.stringify(result.body)).not.toContain(tier);
    }
  }
  expect(r.memory.records.size).toBe(0);
});

it("failed extraction exposes owned paper/page context but never rejected model values", async () => {
  const r = runtime([{ PRIVATE_REJECTED_MODEL_JSON: "secret" }, { PRIVATE_REJECTED_MODEL_JSON: "secret" }]);
  const prepared = await invokeProfileBuilder({ action: "prepare_source", requestId: crypto.randomUUID(), identity: { ...initial(), component: "Paper 1" }, mode: "short_practice", uploads: [{ contentType: "text/plain", base64: Buffer.from(text).toString("base64") }] });
  await invokeProfileBuilder({ action: "advance_source", jobId: prepared.job!.jobId });
  const result = await invokeProfileBuilder({ action: "advance_source", jobId: prepared.job!.jobId });
  expect(result.job).toMatchObject({ stage: "failed", validationContext: { component: "9BS0/01", documents: [{ document: 1, pages: [1] }] } });
  expect(result.job!.validationIssues).toHaveLength(2);
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_REJECTED_MODEL_JSON|secret|invalidExtraction|detail|checksum/);
});
