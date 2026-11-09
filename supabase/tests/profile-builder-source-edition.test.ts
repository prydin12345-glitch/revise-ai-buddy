// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  advanceSourceJob,
  confirmSourceJob,
  prepareSourceJob,
  sourceJobRequestSchema,
  type SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
import { coverSpecificationIssue } from "../functions/_shared/profile-source-version";
import { ownerEvidence, templateFixture } from "./profile-builder-fixtures";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";

const owner = "91000000-0000-4000-8000-000000000001";
const current = "v1.4-july-2026";
const actual = "Version 1.3 1 June 2017";
const identity = (version = current) => ({
  country: "GB",
  educationSystem: "UK",
  stage: "Secondary",
  qualification: "A-level",
  subject: "Physics",
  organisation: "AQA",
  course: "7408",
  component: "7408/1",
  specificationVersion: version,
  tier: "not_tiered" as const,
});
const assessment = [
  "A-level Paper 1 (7408/1)",
  "85 marks; 120 minutes.",
  "Mechanics and Waves.",
  "Short structured answers.",
  "Answer all questions.",
  "A scientific calculator is allowed.",
].join("\n");
const pages = (version = actual) => [
  `AQA\nAS and A-level Physics\n7407 / 7408\nSpecification\n${version}`,
  "A-level (7408) assessment overview\n" + assessment,
  // A change-history line is not the actual issue of this upload.
  "Change history\nVersion 1.4 July 2026",
];
const request = (
  inputPages: string[],
  version = current,
  intent?: "source" | "explicit",
) => ({
  action: "prepare_source" as const,
  requestId: crypto.randomUUID(),
  identity: identity(version),
  ...(intent ? { specificationVersionIntent: intent } : {}),
  mode: "full_mock" as const,
  uploads: [{
    contentType: "application/pdf" as const,
    base64: Buffer.from("%PDF-1.7\n" + JSON.stringify(inputPages)).toString("base64"),
  }],
});
function setup(inputPages = pages()) {
  const memory = memoryJobStore();
  const parsePdf = vi.fn(async () => structuredClone(inputPages));
  const model = vi.fn(async (_system: string, payload: any) => {
    const source = payload.documents[0];
    const page = source.pages.find((page: any) => page.text.includes(assessment));
    if (!page) throw Error("Assessment fixture was not retrieved.");
    const evidence = await ownerEvidence();
    evidence.identity = { ...payload.identity };
    evidence.documents = [{
      ...evidence.documents[0],
      id: source.id,
      checksum: source.checksum,
      kind: "specification",
      version: payload.identity.specificationVersion,
      locations: [{ id: "assessment", page: page.page, section: "Assessment overview", text: assessment }],
    }];
    evidence.facts = {
      marks: 85,
      durationMinutes: 120,
      topics: ["Mechanics", "Waves"],
      tier: null,
      selection: "unknown",
      calculator: "unknown",
      formats: ["short_answer"],
      mathsRequirement: null,
      practicalRequirement: null,
    };
    evidence.claims = [
      ["marks", "85 marks"],
      ["durationMinutes", "120 minutes"],
      ["topics", "Mechanics and Waves"],
      ["formats", "Short structured answers"],
    ].map(([field, quote]) => ({ field, quote, rule: "mandatory" as const, documentId: source.id, locationId: "assessment" }));
    return { value: { evidence, identityClaims: [] }, promptTokens: 7, completionTokens: 5 };
  });
  const deps: SourceJobDeps = { store: memory.store, parsePdf, model };
  return { memory, parsePdf, model, deps };
}

describe("source edition intent", () => {
  it.each([current, "Not verified"])("resolves auto %s from the literal June 2017 cover before any model call", async (version) => {
    const runtime = setup(), input = request(pages(), version, "source");
    const prepared = await prepareSourceJob(owner, input, runtime.deps);
    expect(prepared.stage).toBe("identifying");
    expect(prepared.identity?.specificationVersion).toBe(actual);
    expect(runtime.model).not.toHaveBeenCalled();
    expect(runtime.memory.reservations).toBe(0);
    const record = runtime.memory.records.get(ownerKey(owner, input.requestId))!;
    expect(record.data.requestedIdentity).toEqual(input.identity);
    expect(record.data.sourceVersionEvidence).toEqual([{ documentId: "upload-1", page: 1, value: actual }]);
    const ready = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(ready.stage).toBe("ready");
    expect(ready.identity?.specificationVersion).toBe(actual);
    expect(ready.reviewedFacts?.assessmentInstructions).toBeDefined();
    expect(runtime.model.mock.calls[0][1].identity.specificationVersion).toBe(actual);
    expect(runtime.memory.usage).toHaveLength(1);
  });

  it.each([undefined, "explicit"] as const)("keeps %s requests constrained to their selected issue with no model call", async (intent) => {
    const runtime = setup(), input = request(pages(), current, intent);
    const prepared = await prepareSourceJob(owner, input, runtime.deps);
    expect(prepared.stage).toBe("needs_details");
    expect(prepared.missingItems?.[0].field).toBe("source");
    expect(prepared.needs?.join(" ")).toMatch(/1.3.*1.4/);
    expect(runtime.model).not.toHaveBeenCalled();
    expect(runtime.memory.reservations).toBe(0);
    await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(runtime.model).not.toHaveBeenCalled();
  });

  it("cannot reuse an automatic source receipt as an explicit edition request", async () => {
    const runtime = setup(), input = request(pages(), current, "source");
    await prepareSourceJob(owner, input, runtime.deps);
    await expect(prepareSourceJob(owner, { ...input, specificationVersionIntent: "explicit" }, runtime.deps)).rejects.toThrow(/different input/);
    expect(runtime.parsePdf).toHaveBeenCalledOnce();
  });

  it("separates source and explicit cache identities and reuses only the actual source issue", async () => {
    const runtime = setup(), input = request(pages(), current, "source");
    await prepareSourceJob(owner, input, runtime.deps);
    await advanceSourceJob(owner, input.requestId, runtime.deps);
    const again = await prepareSourceJob(owner, { ...input, requestId: crypto.randomUUID() }, runtime.deps);
    expect(again.identity?.specificationVersion).toBe(actual);
    expect(again.stage).toBe("ready");
    expect(runtime.model).toHaveBeenCalledOnce();
    expect(runtime.parsePdf).toHaveBeenCalledOnce();
    const explicit = await prepareSourceJob(owner, { ...input, requestId: crypto.randomUUID(), specificationVersionIntent: "explicit" }, runtime.deps);
    expect(explicit.stage).toBe("needs_details");
    expect(runtime.parsePdf).toHaveBeenCalledTimes(2);
    expect(runtime.model).toHaveBeenCalledOnce();
  });

  it("keeps source intent unknown when the upload has no literal cover edition", async () => {
    const inputPages = pages();
    inputPages[0] = "AQA A-level Physics specification\n7408\nFor teaching from onwards";
    inputPages[2] = "Change history with no literal issue line";
    const runtime = setup(inputPages), input = request(inputPages, current, "source");
    const prepared = await prepareSourceJob(owner, input, runtime.deps);
    expect(prepared.identity?.specificationVersion).toBe("Not verified");
    expect(runtime.memory.records.get(ownerKey(owner, input.requestId))!.data.sourceVersionEvidence).toEqual([]);
    expect(runtime.model).not.toHaveBeenCalled();
  });

  it("accepts a current edition as literal source identity too", async () => {
    const inputPages = pages("Version 1.4 July 2026"), runtime = setup(inputPages), input = request(inputPages, current, "source");
    const prepared = await prepareSourceJob(owner, input, runtime.deps);
    expect(prepared.identity?.specificationVersion).toBe("Version 1.4 July 2026");
    expect((await advanceSourceJob(owner, input.requestId, runtime.deps)).stage).toBe("ready");
  });

  it("repairs stale AI edition metadata from this upload's literal cover without another read", async () => {
    const runtime = setup(), input = request(pages(), current, "source");
    const normal = runtime.model.getMockImplementation()!;
    runtime.model.mockImplementation(async (system, payload) => {
      const reply = await normal(system, payload);
      reply.value.evidence.identity.specificationVersion = "Version 1.4 July 2026";
      reply.value.evidence.documents[0].version = "Version 1.4 July 2026";
      return reply;
    });
    await prepareSourceJob(owner, input, runtime.deps);
    const ready = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(ready.stage).toBe("ready");
    expect(ready.identity?.specificationVersion).toBe(actual);
    const evidence = runtime.memory.records.get(ownerKey(owner, input.requestId))!.data.evidence!;
    expect(evidence.identity.specificationVersion).toBe(actual);
    expect(evidence.documents.find((document) => document.id === "upload-1")?.version).toBe(actual);
    expect(evidence.documents.find((document) => document.id === "upload-1")?.locations).toContainEqual(expect.objectContaining({
      page: 1, section: "Specification cover edition", text: actual,
    }));
    expect(JSON.stringify(evidence)).not.toContain("1.4");
    expect(runtime.parsePdf).toHaveBeenCalledOnce();
    expect(runtime.model).toHaveBeenCalledOnce();
  });

  it("keeps the confirmed literal edition and its source quote when the draft copies a stale catalogue version", async () => {
    const runtime = setup(), input = request(pages(), current, "source");
    await prepareSourceJob(owner, input, runtime.deps);
    const ready = await advanceSourceJob(owner, input.requestId, runtime.deps);
    await confirmSourceJob(owner, input.requestId, { identity: ready.identity!, mode: "full_mock" }, runtime.deps);
    runtime.model.mockImplementationOnce(async (_system, payload): Promise<any> => {
      const template = templateFixture();
      template.identity = { ...payload.identity, specificationVersion: "Version 1.4 July 2026" };
      template.mode = "full_mock";
      template.marks = 85;
      template.durationMinutes = 120;
      template.topics = ["Mechanics", "Waves"];
      template.calculator = "allowed";
      template.sections[0].groups[0].parts = [
        { ...template.sections[0].groups[0].parts[0], id: "mechanics", topic: "Mechanics", marks: 30 },
        { ...template.sections[0].groups[0].parts[0], id: "waves", topic: "Waves", marks: 30 },
        { ...template.sections[0].groups[0].parts[0], id: "mechanics-extra", topic: "Mechanics", marks: 25 },
      ];
      return { value: template, promptTokens: 7, completionTokens: 5 };
    });
    const done = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(done.stage).toBe("complete");
    expect(done.proposal?.template.identity.specificationVersion).toBe(actual);
    expect(done.proposal?.evidence?.documents.find((document) => document.id === "upload-1")?.locations).toContainEqual(expect.objectContaining({ page: 1, text: actual }));
    expect(JSON.stringify(done.proposal)).not.toContain("1.4");
    expect(runtime.model).toHaveBeenCalledTimes(2);
    expect(runtime.parsePdf).toHaveBeenCalledOnce();
  });

  it("does not repair unsupported assessment marks while normalising edition metadata", async () => {
    const runtime = setup(), input = request(pages(), current, "source");
    const normal = runtime.model.getMockImplementation()!;
    runtime.model.mockImplementation(async (system, payload) => {
      const reply = await normal(system, payload);
      reply.value.evidence.identity.specificationVersion = "Version 1.4 July 2026";
      reply.value.evidence.documents[0].version = "Version 1.4 July 2026";
      reply.value.evidence.facts.marks = 80;
      return reply;
    });
    await prepareSourceJob(owner, input, runtime.deps);
    expect((await advanceSourceJob(owner, input.requestId, runtime.deps)).stage).toBe("identifying");
    const rejected = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(rejected.stage).toBe("failed");
    expect(runtime.memory.records.get(ownerKey(owner, input.requestId))!.data.evidence).toBeNull();
    expect(runtime.model).toHaveBeenCalledTimes(2);
  });

  it("reserves a cover location without dropping the model's allowed fact references", async () => {
    const runtime = setup(), input = request(pages(), current, "source");
    const normal = runtime.model.getMockImplementation()!;
    runtime.model.mockImplementation(async (system, payload) => {
      const reply = await normal(system, payload);
      const document = reply.value.evidence.documents[0];
      expect(payload.evidenceLimits.maxLocationsPerDocument).toBe(39);
      document.locations = Array.from({ length: 39 }, (_, index) => ({
        ...document.locations[0], id: index ? `fact-${index}` : "assessment",
      }));
      return reply;
    });
    await prepareSourceJob(owner, input, runtime.deps);
    expect((await advanceSourceJob(owner, input.requestId, runtime.deps)).stage).toBe("ready");
    const document = runtime.memory.records.get(ownerKey(owner, input.requestId))!.data.evidence!.documents.find((document) => document.id === "upload-1")!;
    expect(document.locations).toHaveLength(40);
    expect(document.locations.filter((location) => location.page === 2)).toHaveLength(39);
    expect(document.locations.find((location) => location.page === 1)?.text).toBe(actual);
  });

  it("does not choose between two uploaded specifications declaring different issues", async () => {
    const runtime = setup(), input = request(pages(), current, "source");
    runtime.parsePdf
      .mockResolvedValueOnce(pages())
      .mockResolvedValueOnce(pages("Version 1.4 July 2026"));
    input.uploads.push({ contentType: "application/pdf", base64: Buffer.from("%PDF-1.7 second source").toString("base64") });
    const blocked = await prepareSourceJob(owner, input, runtime.deps);
    expect(blocked.stage).toBe("needs_details");
    expect(blocked.missingItems?.[0].field).toBe("source");
    expect(blocked.needs?.join(" ")).toMatch(/1.4.*1.3/);
    expect(runtime.model).not.toHaveBeenCalled();
    expect(runtime.memory.reservations).toBe(0);
  });

  it("rejects unknown intent values rather than silently discarding the constraint", () => {
    expect(() => sourceJobRequestSchema.parse({ ...request(pages()), specificationVersionIntent: "ignore" })).toThrow();
  });
});

describe("literal cover edition extraction", () => {
  it("returns the exact first declaration and physical page", () => {
    expect(coverSpecificationIssue(pages().map((text, index) => ({ page: index + 1, text })))).toEqual({ value: actual, page: 1, issue: { family: "version", identifier: "1.3" } });
  });
  it("does not turn a question-booklet print version into a specification issue", () => {
    expect(coverSpecificationIssue([{ page: 1, text: "Question paper\nFor specification 7408\nVersion 1.0" }])).toBeNull();
  });
});
