// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  prepareSourceJob,
  advanceSourceJob,
  confirmSourceJob,
  getSourceJob,
  sourceJobRequestSchema,
  type SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
import {
  templateFixture,
  universityIdentity,
  ownerEvidence,
  syllabus,
} from "./profile-builder-fixtures";
import { checksum } from "../functions/_shared/profile-template";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";
const owner = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002";
function request(
  text = syllabus,
  identity = universityIdentity,
  mode: "full_mock" | "short_practice" = "short_practice",
) {
  return {
    action: "prepare_source" as const,
    requestId: crypto.randomUUID(),
    identity: structuredClone(identity),
    mode,
    uploads: [{ contentType: "text/plain" as const, base64: btoa(text) }],
  };
}
async function evidenceFor(payload: any, text = syllabus) {
  const e = await ownerEvidence();
  const d = payload.documents[0];
  e.identity = { ...payload.identity };
  e.documents[0].id = d.id;
  e.documents[0].checksum = d.checksum;
  e.documents[0].locations[0].text = text;
  e.claims.forEach((c) => (c.documentId = d.id));
  for (const other of payload.documents.slice(1))
    e.documents.push({
      ...structuredClone(e.documents[0]),
      id: other.id,
      checksum: other.checksum,
      locations: [],
    });
  return { evidence: e, identityClaims: [] as any[] };
}
async function setup() {
  const memory = memoryJobStore();
  const model = vi.fn(async (_system: string, payload: any) => ({
    value: payload.documents
      ? await evidenceFor(payload)
      : {
          ...templateFixture(),
          identity: payload.identity,
          mode: payload.mode,
        },
    promptTokens: 7,
    completionTokens: 3,
  }));
  const deps: SourceJobDeps = {
    store: memory.store,
    parsePdf: vi.fn(async () => []),
    model,
  };
  return { ...memory, memory, deps, model };
}
describe("resumable source-backed profile jobs", () => {
  it("indexes without model use then confirms discovered identity before drafting and saves one existing receipt", async () => {
    const r = await setup(),
      input = request();
    const prepared = await prepareSourceJob(owner, input, r.deps);
    expect(prepared.stage).toBe("identifying");
    expect(r.model).not.toHaveBeenCalled();
    const ready = await advanceSourceJob(owner, prepared.jobId, r.deps);
    expect(ready.stage).toBe("ready");
    expect(r.model).toHaveBeenCalledTimes(1);
    expect((await advanceSourceJob(owner, ready.jobId, r.deps)).stage).toBe(
      "ready",
    );
    expect(r.model).toHaveBeenCalledTimes(1);
    await confirmSourceJob(
      owner,
      ready.jobId,
      { identity: ready.identity!, mode: ready.mode },
      r.deps,
    );
    const finished = await advanceSourceJob(owner, ready.jobId, r.deps);
    expect(finished.stage).toBe("complete");
    expect(finished.proposalId).toBe(input.requestId);
    expect(finished.proposal?.origin).toBe("source_backed_ai");
    expect(r.receipts.get(ownerKey(owner, input.requestId)).result).toEqual(
      finished.proposal,
    );
    expect(r.memory.reservations).toBe(1);
    expect(r.model).toHaveBeenCalledTimes(2);
    expect(r.usage).toEqual([
      { promptTokens: 7, completionTokens: 3, outcome: "provider_success" },
      { promptTokens: 7, completionTokens: 3, outcome: "provider_success" },
    ]);
  });
  it("status and completed replay never expose indexed pages or issue another provider call", async () => {
    const r = await setup(),
      input = request();
    await prepareSourceJob(owner, input, r.deps);
    await advanceSourceJob(owner, input.requestId, r.deps);
    const state = await getSourceJob(owner, input.requestId, r.deps);
    expect(JSON.stringify(state)).not.toContain(syllabus);
    expect(state).not.toHaveProperty("data");
    await prepareSourceJob(owner, input, r.deps);
    expect(r.model).toHaveBeenCalledTimes(1);
    await expect(
      prepareSourceJob(owner, { ...input, mode: "full_mock" }, r.deps),
    ).rejects.toThrow(/different input/);
  });
  it("does not cross account boundaries for status or cached source evidence", async () => {
    const r = await setup(),
      input = request();
    await prepareSourceJob(owner, input, r.deps);
    await advanceSourceJob(owner, input.requestId, r.deps);
    await expect(getSourceJob(other, input.requestId, r.deps)).rejects.toThrow(
      /account/,
    );
    const otherInput = { ...input, requestId: crypto.randomUUID() };
    expect((await prepareSourceJob(other, otherInput, r.deps)).stage).toBe(
      "identifying",
    );
  });
  it("reuses owner evidence without extraction and rechecks full mock requirements", async () => {
    const r = await setup(),
      input = request();
    const original = r.model.getMockImplementation()!;
    r.model.mockImplementation(async (system, payload) => {
      const response = await original(system, payload);
      if (payload.documents) {
        (response.value as any).evidence.facts.marks = null;
        (response.value as any).evidence.facts.durationMinutes = null;
      }
      return response;
    });
    await prepareSourceJob(owner, input, r.deps);
    await advanceSourceJob(owner, input.requestId, r.deps);
    const short = await prepareSourceJob(
      owner,
      { ...input, requestId: crypto.randomUUID() },
      r.deps,
    );
    expect(short.stage).toBe("ready");
    expect(r.model).toHaveBeenCalledTimes(1);
    const full = await prepareSourceJob(
      owner,
      { ...input, requestId: crypto.randomUUID(), mode: "full_mock" },
      r.deps,
    );
    expect(full.stage).toBe("needs_details");
    expect(full.needs?.join(" ")).toMatch(/total marks/);
    expect(r.model).toHaveBeenCalledTimes(1);
  });
  it("allows document-backed course/version discovery only with literal page claims", async () => {
    const r = await setup(),
      text = syllabus + " Version 2026.";
    const identity = {
      ...universityIdentity,
      course: "Undergraduate module Biology",
      specificationVersion: "Not verified",
      tier: null,
    } as any;
    r.model.mockImplementation(async (_system, payload) => {
      const extracted = await evidenceFor(payload, text);
      extracted.evidence.identity = { ...universityIdentity };
      extracted.identityClaims = [
        {
          field: "course",
          documentId: "upload-1",
          locationId: "brief",
          quote: "BIO101",
        },
        {
          field: "specificationVersion",
          documentId: "upload-1",
          locationId: "brief",
          quote: "Version 2026",
        },
        {
          field: "tier",
          documentId: "upload-1",
          locationId: "brief",
          quote: "This assessment is untiered",
        },
      ];
      return { value: extracted, promptTokens: 7, completionTokens: 3 };
    });
    const input = request(text, identity);
    await prepareSourceJob(owner, input, r.deps);
    const ready = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(ready.stage).toBe("ready");
    expect(ready.identity?.course).toBe("BIO101");
    expect(ready.identity?.specificationVersion).toBe("2026");
    await expect(
      confirmSourceJob(
        owner,
        input.requestId,
        {
          identity: { ...ready.identity!, course: "forged" },
          mode: ready.mode,
        },
        r.deps,
      ),
    ).rejects.toThrow(/differ/);
  });
  it("rejects an invented course identity even when a citation location exists", async () => {
    const r = await setup(),
      input = request();
    r.model.mockImplementation(async (_s, payload) => {
      const value = await evidenceFor(payload);
      value.evidence.identity.course = "BIO999";
      value.identityClaims = [
        {
          field: "course",
          documentId: "upload-1",
          locationId: "brief",
          quote: "BIO101",
        },
      ];
      return { value, promptTokens: 7, completionTokens: 3 };
    });
    await prepareSourceJob(owner, input, r.deps);
    expect((await advanceSourceJob(owner, input.requestId, r.deps)).stage).toBe(
      "identifying",
    );
    expect((await advanceSourceJob(owner, input.requestId, r.deps)).stage).toBe(
      "failed",
    );
    expect(r.model).toHaveBeenCalledTimes(2);
  });
  it("bounded extraction repair and drafting share the same three-call budget", async () => {
    const r = await setup(),
      input = request(),
      original = r.model.getMockImplementation()!;
    r.model.mockImplementationOnce(async () => ({
      value: { bad: true } as any,
      promptTokens: 7,
      completionTokens: 3,
    }));
    await prepareSourceJob(owner, input, r.deps);
    expect((await advanceSourceJob(owner, input.requestId, r.deps)).stage).toBe(
      "identifying",
    );
    const ready = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(ready.stage).toBe("ready");
    await confirmSourceJob(
      owner,
      input.requestId,
      { identity: ready.identity!, mode: ready.mode },
      r.deps,
    );
    expect((await advanceSourceJob(owner, input.requestId, r.deps)).stage).toBe(
      "complete",
    );
    expect(r.model).toHaveBeenCalledTimes(3);
    expect(r.memory.reservations).toBe(1);
  });
  it("transport uncertainty consumes one intent and never silently repeats it", async () => {
    const r = await setup(),
      input = request();
    r.model.mockRejectedValue(Error("network"));
    await prepareSourceJob(owner, input, r.deps);
    expect((await advanceSourceJob(owner, input.requestId, r.deps)).stage).toBe(
      "failed",
    );
    await advanceSourceJob(owner, input.requestId, r.deps);
    await prepareSourceJob(owner, input, r.deps);
    expect(r.model).toHaveBeenCalledTimes(1);
    expect(r.usage).toEqual([
      {
        promptTokens: 0,
        completionTokens: 0,
        outcome: "unknown_provider_cost",
      },
    ]);
  });
  it("missing provider setup consumes neither a quota reservation nor an intent", async () => {
    const r = await setup(),
      input = request();
    r.deps.providerReady = () => {
      throw Error("missing provider");
    };
    await prepareSourceJob(owner, input, r.deps);
    const state = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(state.stage).toBe("failed");
    expect(r.memory.reservations).toBe(0);
    expect(r.model).not.toHaveBeenCalled();
    expect(r.usage).toEqual([]);
  });
  it("concurrent advances cannot duplicate a provider call", async () => {
    const r = await setup(),
      input = request();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const original = r.model.getMockImplementation()!;
    r.model.mockImplementation(async (s, p) => {
      await gate;
      return original(s, p);
    });
    await prepareSourceJob(owner, input, r.deps);
    const first = advanceSourceJob(owner, input.requestId, r.deps);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(second.stage).toBe("identifying");
    release();
    expect((await first).stage).toBe("ready");
    expect(r.model).toHaveBeenCalledTimes(1);
  });
  it("multiple small source documents share one bounded extraction stage", async () => {
    const r = await setup(),
      input = request();
    input.uploads.push(
      {
        contentType: "text/plain",
        base64: btoa("Assessment instructions: " + syllabus),
      },
      {
        contentType: "text/plain",
        base64: btoa("Course overview: " + syllabus),
      },
    );
    await prepareSourceJob(owner, input, r.deps);
    const state = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(state.stage).toBe("ready");
    expect(r.model.mock.calls[0][1].documents).toHaveLength(3);
  });
  it("rejects duplicate documents before any paid extraction", async () => {
    const r = await setup(),
      input = request();
    input.uploads.push({ ...input.uploads[0] });
    await expect(prepareSourceJob(owner, input, r.deps)).rejects.toThrow(
      /same document/,
    );
    expect(r.model).not.toHaveBeenCalled();
  });
  it("rejects oversized bundles and forged source job actions before provider work", async () => {
    const r = await setup(),
      input = request();
    input.uploads = [
      { contentType: "text/plain", base64: btoa("x".repeat(3_000_001)) },
    ];
    await expect(prepareSourceJob(owner, input, r.deps)).rejects.toThrow();
    expect(
      sourceJobRequestSchema.safeParse({
        action: "confirm_source",
        jobId: crypto.randomUUID(),
        identity: universityIdentity,
        mode: "short_practice",
        approved: true,
      }).success,
    ).toBe(false);
    expect(r.model).not.toHaveBeenCalled();
  });
  it("claims one cheap receipt before parsing and remembers a rejected PDF", async () => {
    const r = await setup(),
      input = request();
    input.uploads = [
      {
        contentType: "application/pdf" as any,
        base64: btoa("%PDF-1.4 synthetic protected file"),
      },
    ];
    const parser = vi.fn(async () => {
      expect(r.receipts.size).toBe(1);
      throw Error("PDF is encrypted");
    });
    r.deps.parsePdf = parser;
    const rejected = await prepareSourceJob(owner, input, r.deps);
    expect(rejected.stage).toBe("failed");
    expect(rejected.needs?.join(" ")).toMatch(/protected/);
    expect((await prepareSourceJob(owner, input, r.deps)).stage).toBe("failed");
    expect(parser).toHaveBeenCalledTimes(1);
    expect(r.receipts.size).toBe(1);
    expect(r.memory.reservations).toBe(0);
    expect(r.model).not.toHaveBeenCalled();
  });
  it("does not parse when the existing cheap request limit rejects the receipt", async () => {
    const r = await setup(),
      input = request();
    input.uploads = [
      {
        contentType: "application/pdf" as any,
        base64: btoa("%PDF-1.4 synthetic"),
      },
    ];
    r.deps.store.create = vi.fn(async () => {
      throw Error("Builder request limit reached");
    });
    await expect(prepareSourceJob(owner, input, r.deps)).rejects.toThrow(
      /request limit/,
    );
    expect(r.deps.parsePdf).not.toHaveBeenCalled();
    expect(r.model).not.toHaveBeenCalled();
    expect(r.memory.reservations).toBe(0);
  });
  it("concurrent prepares share the intake lease and parse only once", async () => {
    const r = await setup(),
      input = request();
    input.uploads = [
      {
        contentType: "application/pdf" as any,
        base64: btoa("%PDF-1.4 synthetic"),
      },
    ];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    r.deps.parsePdf = vi.fn(async () => {
      await gate;
      return [syllabus];
    });
    const first = prepareSourceJob(owner, input, r.deps);
    await vi.waitFor(() => expect(r.deps.parsePdf).toHaveBeenCalledOnce());
    const again = await prepareSourceJob(owner, input, r.deps);
    expect(again.stage).toBe("reading");
    expect(again.canAdvance).toBe(false);
    expect(
      (await advanceSourceJob(owner, input.requestId, r.deps)).canAdvance,
    ).toBe(false);
    release();
    expect((await first).stage).toBe("identifying");
    expect(r.deps.parsePdf).toHaveBeenCalledOnce();
    expect(r.model).not.toHaveBeenCalled();
  });
  it("an interrupted intake expires through free status without a provider call", async () => {
    const r = await setup(),
      input = request();
    await r.store.create(
      owner,
      input.requestId,
      "a".repeat(64),
      "b".repeat(64),
      {
        version: 1,
        requestedIdentity: input.identity,
        identity: input.identity,
        mode: input.mode,
        documents: [],
        chunks: [],
        cursor: 0,
        partials: [],
        evidence: null,
        needs: [],
        intakePending: true,
      },
      "reading",
      0,
    );
    await r.store.acquire(owner, input.requestId);
    const record = r.records.get(ownerKey(owner, input.requestId))!;
    record.leaseUntil = new Date(Date.now() - 1000).toISOString();
    const state = await getSourceJob(
      owner,
      input.requestId,
      r.deps,
      structuredClone(record),
    );
    expect(state.stage).toBe("failed");
    expect(state.needs?.join(" ")).toMatch(/interrupted/);
    expect(r.model).not.toHaveBeenCalled();
    expect(r.memory.reservations).toBe(0);
    expect(r.usage).toEqual([]);
  });
  it("a cached PDF source claims a receipt but does not reparse the document", async () => {
    const r = await setup(),
      input = request();
    input.uploads = [
      {
        contentType: "application/pdf" as any,
        base64: btoa("%PDF-1.4 synthetic"),
      },
    ];
    r.deps.parsePdf = vi.fn(async () => [syllabus]);
    await prepareSourceJob(owner, input, r.deps);
    await advanceSourceJob(owner, input.requestId, r.deps);
    const cached = await prepareSourceJob(
      owner,
      { ...input, requestId: crypto.randomUUID() },
      r.deps,
    );
    expect(cached.stage).toBe("ready");
    expect(r.deps.parsePdf).toHaveBeenCalledOnce();
    expect(r.receipts.size).toBe(2);
    expect(r.model).toHaveBeenCalledTimes(1);
  });
});
