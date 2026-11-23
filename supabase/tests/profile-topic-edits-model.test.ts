// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  builderRequestSchema,
  proposeProfile,
  type BuilderDeps,
  type BuilderProposal,
} from "../functions/_shared/profile-builder-service";
import {
  advanceSourceJob,
  confirmSourceJob,
  prepareSourceJob,
  type SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
import { canonical, parseModelTemplate } from "../functions/_shared/profile-template";
import { fingerprint } from "../functions/_shared/profile-fingerprint";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";
import { ownerEvidence, syllabus, templateFixture } from "./profile-builder-fixtures";

const owner = "synthetic-topic-editor-owner";
const maliciousMetadata = [
  [{ topic: "Cells", label: "Forged user label", notes: "Forged private instruction" }],
  [{ topic: "Cells", label: "First" }, { topic: "Cells", label: "Duplicate" }],
  [{ topic: "Invented topic", notes: "Outside the source" }],
  { invalid: "not even an array" },
];

describe("model topic metadata has no user authority", () => {
  it.each(maliciousMetadata.map(topicEdits => ({ topicEdits })))("strips arbitrary model metadata before parsing %j", ({ topicEdits }) => {
    const raw = { ...templateFixture(), topicEdits, addedTopics: { invalid: true } };
    expect(parseModelTemplate(raw)).toEqual(templateFixture());
    expect(raw).toHaveProperty("topicEdits", topicEdits);
    expect(() => parseModelTemplate({ ...raw, forgedAuthority: true })).toThrow();
  });

  it.each([false, true])("synchronous proposal ingestion strips metadata, repair=%s", async repair => {
    const evidence = await ownerEvidence();
    const original: BuilderProposal = {
      proposalVersion: 1, promptVersion: 1, template: templateFixture(), origin: "source_backed_ai",
      evidence, evidenceVersion: fingerprint(canonical(evidence)), presetId: null, profileSettings: null,
    };
    const model = vi.fn(async (_system: string, payload: unknown) => {
      const template = templateFixture();
      if (repair && model.mock.calls.length === 1) template.marks = 7;
      return {
        value: { ...template, topicEdits: maliciousMetadata[1], addedTopics: ["Invented topic"] },
        promptTokens: 1, completionTokens: 1,
      };
    });
    const finish = vi.fn<BuilderDeps["finish"]>(async () => {});
    const deps: BuilderDeps = {
      claim: async () => ({ state: "claimed" }), reserve: async () => {}, beginCall: async () => {},
      usage: async () => {}, finish, model, parsePdf: async () => [], loadProposal: async () => original,
    };
    const input = builderRequestSchema.parse({
      action: "propose", requestId: crypto.randomUUID(), identity: templateFixture().identity,
      mode: "short_practice", fromProposalId: crypto.randomUUID(), unverified: false,
    });
    const result = await proposeProfile(owner, input, deps);
    expect(result.template).toEqual(templateFixture());
    expect(result.template).not.toHaveProperty("topicEdits");
    expect(result.template).not.toHaveProperty("addedTopics");
    expect(finish).toHaveBeenLastCalledWith(owner, expect.any(String), "complete", result);
    expect(model).toHaveBeenCalledTimes(repair ? 2 : 1);
    if (repair) expect(model.mock.calls[1][1]).toHaveProperty("invalidDraft");
  });

  it.each([false, true])("source jobs strip duplicate model metadata on drafting and repair, repair=%s", async repair => {
    const memory = memoryJobStore();
    let drafts = 0;
    const model = vi.fn(async (_system: string, payload: any) => {
      if (payload.documents) {
        const evidence = await ownerEvidence();
        evidence.identity = { ...payload.identity };
        evidence.documents[0].id = payload.documents[0].id;
        evidence.documents[0].checksum = payload.documents[0].checksum;
        evidence.claims.forEach(claim => { claim.documentId = payload.documents[0].id; });
        return { value: { evidence, identityClaims: [] }, promptTokens: 1, completionTokens: 1 };
      }
      drafts++;
      const template = templateFixture();
      template.identity = payload.identity;
      template.mode = payload.mode;
      if (repair && drafts === 1) template.marks = 7;
      return {
        value: { ...template, topicEdits: maliciousMetadata[1], addedTopics: ["Invented topic"] },
        promptTokens: 1, completionTokens: 1,
      };
    });
    const deps: SourceJobDeps = { store: memory.store, model, parsePdf: async () => [] };
    const input = {
      action: "prepare_source" as const, requestId: crypto.randomUUID(),
      identity: templateFixture().identity, mode: "short_practice" as const,
      uploads: [{ contentType: "text/plain" as const, base64: Buffer.from(syllabus).toString("base64") }],
    };
    await prepareSourceJob(owner, input, deps);
    const ready = await advanceSourceJob(owner, input.requestId, deps);
    expect(ready.stage).toBe("ready");
    await confirmSourceJob(owner, input.requestId, { identity: ready.identity!, mode: ready.mode }, deps);
    let result = await advanceSourceJob(owner, input.requestId, deps);
    if (repair) {
      expect(result.stage).toBe("drafting");
      result = await advanceSourceJob(owner, input.requestId, deps);
    }
    expect(result.stage).toBe("complete");
    expect(result.proposal?.template).not.toHaveProperty("topicEdits");
    expect(result.proposal?.template).not.toHaveProperty("addedTopics");
    expect(result.proposal?.template.topics).toEqual(["Cells", "Enzymes"]);
    expect(memory.receipts.get(ownerKey(owner, input.requestId)).result).toEqual(result.proposal);
    expect(model).toHaveBeenCalledTimes(repair ? 3 : 2);
    if (repair) expect(model.mock.calls[2][1]).toHaveProperty("invalidDraft");
  });
});
