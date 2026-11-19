// @vitest-environment node
import { expect, it, vi } from "vitest";
import { advanceSourceJob, answerSourceJob, confirmSourceJob, prepareSourceJob, getSourceJob, type SourceJobDeps } from "../functions/_shared/profile-builder-jobs";
import { type TemplateIdentity } from "../functions/_shared/profile-template";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";
import { ownerEvidence, templateFixture } from "./profile-builder-fixtures";

const owner = "94000000-0000-4000-8000-000000000001";
const brief = "Pearson Edexcel A-level Business (9BS0)\nPaper 1: Marketing (9BS0/01)\n6 marks; 30 minutes.\nMarketing and People.\nShort structured answers.\nAnswer all questions.\nNo calculator allowed.";
const identity: TemplateIdentity = { country: "GB", educationSystem: "UK", stage: "Secondary", qualification: "A-level", subject: "Business", organisation: "Pearson Edexcel", course: "9BS0", component: "Paper 1", specificationVersion: "Not verified", tier: null };

async function setup(selected: TemplateIdentity["tier"] = null, modelTier: TemplateIdentity["tier"] = "not_tiered", mode: "short_practice" | "full_mock" = "short_practice", sourceTier: TemplateIdentity["tier"] = null) {
  const memory = memoryJobStore();
  const text = brief + (sourceTier === "not_tiered" ? "\nThis assessment is untiered." : sourceTier ? `\nThis assessment uses the ${sourceTier} tier.` : "");
  const model = vi.fn<SourceJobDeps["model"]>(async (_system, raw: any) => {
    if (!raw.documents) {
      const template = templateFixture();
      template.identity = { ...raw.identity, tier: modelTier };
      template.mode = raw.mode;
      template.topics = ["Marketing", "People"];
      template.sections[0].groups[0].parts.forEach((part, index) => { part.topic = template.topics[index]; });
      return { value: template, promptTokens: 1, completionTokens: 1 };
    }
    const evidence = await ownerEvidence();
    evidence.identity = { ...raw.identity, tier: modelTier };
    evidence.documents[0] = { ...evidence.documents[0], id: raw.documents[0].id, checksum: raw.documents[0].checksum, title: "Synthetic Business assessment", version: raw.identity.specificationVersion, locations: [{ id: "brief", page: 1, section: "Assessment", text }] };
    evidence.facts.topics = ["Marketing", "People"];
    evidence.facts.tier = sourceTier;
    evidence.claims = evidence.claims.filter(claim => claim.field !== "tier").map(claim => ({ ...claim, documentId: raw.documents[0].id, quote: claim.field === "topics" ? "Marketing and People" : claim.quote }));
    if (sourceTier) evidence.claims.push({ field: "tier", documentId: raw.documents[0].id, locationId: "brief", quote: sourceTier === "not_tiered" ? "This assessment is untiered." : `This assessment uses the ${sourceTier} tier.`, rule: "mandatory" });
    return { value: { evidence, identityClaims: [] }, promptTokens: 1, completionTokens: 1 };
  });
  const deps: SourceJobDeps = { store: memory.store, model };
  const requestId = crypto.randomUUID();
  await prepareSourceJob(owner, { action: "prepare_source", requestId, identity: { ...identity, tier: selected }, specificationVersionIntent: "source", mode, uploads: [{ contentType: "text/plain", base64: Buffer.from(text).toString("base64") }] }, deps);
  return { deps, model, memory, requestId };
}

it.each(["not_tiered", "higher", "foundation"] as const)("does not promote an unreferenced model tier guess %s over an unknown selection", async guess => {
  const r = await setup(null, guess);
  const ready = await advanceSourceJob(owner, r.requestId, r.deps);
  expect(ready.stage, JSON.stringify(ready)).toBe("ready");
  expect(ready.identity?.tier).toBeNull();
  expect(ready.validationIssues).toBeUndefined();
  expect(r.model).toHaveBeenCalledOnce();
  const evidence = r.memory.records.get(ownerKey(owner, r.requestId))!.data.evidence!;
  expect(evidence.facts.tier).toBeNull();
  expect(evidence.catalogueFacts).toBeUndefined();
  expect(evidence.claims.some(claim => claim.field === "tier")).toBe(false);
  await confirmSourceJob(owner, r.requestId, { identity: ready.identity!, mode: ready.mode }, r.deps);
  const complete = await advanceSourceJob(owner, r.requestId, r.deps);
  expect(complete.stage, JSON.stringify(complete)).toBe("complete");
  expect(complete.proposal?.template.identity.tier).toBeNull();
  expect(r.model).toHaveBeenCalledTimes(2);
});

it.each(["short_practice", "full_mock"] as const)("offers an explicit local practice alternative when %s cannot verify a selected tier", async mode => {
  const r = await setup("not_tiered", null, mode);
  const question = await advanceSourceJob(owner, r.requestId, r.deps);
  expect(question.stage, JSON.stringify(question)).toBe("needs_details");
  expect(question.missingItems?.[0]).toMatchObject({ field: "tier", choices: [{ value: "unknown_practice" }] });
  expect(question.identity?.tier).toBe("not_tiered");
  expect(question.validationIssues).toBeUndefined();
  const before = r.memory.records.get(ownerKey(owner, r.requestId))!.data.evidence!;
  const ready = await answerSourceJob(owner, r.requestId, { revision: question.revision!, answers: { tier: "unknown_practice" } }, r.deps);
  expect(ready).toMatchObject({ stage: "ready", mode: "short_practice", identity: { tier: null } });
  expect(r.model).toHaveBeenCalledOnce();
  const after = r.memory.records.get(ownerKey(owner, r.requestId))!.data.evidence!;
  expect(after.facts).toEqual(before.facts);
  expect(after.documents).toEqual(before.documents);
  expect(after.claims).toEqual(before.claims);
  await answerSourceJob(owner, r.requestId, { revision: question.revision!, answers: { tier: "unknown_practice" } }, r.deps);
  await getSourceJob(owner, r.requestId, r.deps);
  expect(r.model).toHaveBeenCalledOnce();
  await confirmSourceJob(owner, r.requestId, { identity: ready.identity!, mode: ready.mode }, r.deps);
  const complete = await advanceSourceJob(owner, r.requestId, r.deps);
  expect(complete.stage, JSON.stringify(complete)).toBe("complete");
  expect(complete.proposal?.template.warnings.join(" ")).toMatch(/tier.*unverified/i);
  expect(r.model).toHaveBeenCalledTimes(2);
});

it("does not treat two different concrete tiers as missing information", async () => {
  const r = await setup("higher", "foundation");
  await advanceSourceJob(owner, r.requestId, r.deps);
  const failed = await advanceSourceJob(owner, r.requestId, r.deps);
  expect(failed.stage).toBe("failed");
  expect(failed.validationIssues?.[0]).toMatchObject({ field: "tier", code: "identity_conflict" });
});

it("cannot apply the practice alternative before the server asks it", async () => {
  const r = await setup();
  await expect(answerSourceJob(owner, r.requestId, { revision: 1, answers: { tier: "unknown_practice" } }, r.deps)).rejects.toThrow();
  expect(r.model).not.toHaveBeenCalled();
});

it.each([null, "not_tiered"] as const)("uses a quote-verified tier when model identity omits it (selected %s)", async selected => {
  const r = await setup(selected, null, "short_practice", "not_tiered");
  const ready = await advanceSourceJob(owner, r.requestId, r.deps);
  expect(ready.stage, JSON.stringify(ready)).toBe("ready");
  expect(ready.identity?.tier).toBe("not_tiered");
  expect(ready.missingItems).toBeUndefined();
  expect(r.model).toHaveBeenCalledOnce();
});

it("keeps a real cited tier contradiction blocked", async () => {
  const r = await setup("higher", null, "short_practice", "foundation");
  await advanceSourceJob(owner, r.requestId, r.deps);
  const failed = await advanceSourceJob(owner, r.requestId, r.deps);
  expect(failed.stage).toBe("failed");
  expect(failed.proposal).toBeUndefined();
});
