// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  answerSourceJob,
  advanceSourceJob,
  confirmSourceJob,
  getSourceJob,
  prepareSourceJob,
  sourceJobRequestSchema,
  type SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
import type { TemplateIdentity } from "../functions/_shared/profile-template";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";
import { ownerEvidence, templateFixture } from "./profile-builder-fixtures";

const owner = "70000000-0000-4000-8000-000000000001";
const other = "70000000-0000-4000-8000-000000000002";
const version = "Version 1.4 July 2026";
const identity = (component = "7408/1"): TemplateIdentity => ({
  country: "GB",
  educationSystem: "UK",
  stage: "Secondary",
  qualification: "A-level",
  subject: "Physics",
  organisation: "AQA",
  course: "7408",
  component,
  specificationVersion: version,
  tier: "not_tiered",
});
const block = (paper = 2) =>
  `Paper ${paper} (7408/${paper})\n${version}\n85 marks; 120 minutes.\nThis assessment is untiered.\nMechanics and Waves.\nShort structured answers.\nAnswer all questions.\nA scientific calculator is allowed.`;
function pages(text = block()) {
  const out = Array.from(
    { length: 96 },
    (_, i) => `Supporting material ${i + 1}\n${"x".repeat(900)}`,
  );
  out[0] = `AQA AS and A-level Physics\n7407 and 7408\n${version}`;
  out[88] =
    "AS Physics (7407)\nPaper 2 (7407/2)\n70 marks; 90 minutes.\nAS-only scope.";
  out[89] = `A-level Physics (7408)\n${text}`;
  return out;
}
function request(selected = identity(), content = pages()) {
  return {
    action: "prepare_source" as const,
    requestId: crypto.randomUUID(),
    identity: selected,
    mode: "short_practice" as const,
    uploads: [
      {
        contentType: "application/pdf" as const,
        base64: Buffer.from("%PDF-1.7\noriginal fixture").toString("base64"),
      },
    ],
  };
}
async function extracted(payload: any) {
  const evidence = await ownerEvidence(),
    doc = payload.documents[0];
  const page = doc.pages.find((page: any) => page.text.includes("85 marks"));
  evidence.identity = { ...payload.identity };
  evidence.facts.marks = 85;
  evidence.facts.durationMinutes = 120;
  evidence.facts.topics = ["Mechanics", "Waves"];
  evidence.facts.calculator = "allowed";
  evidence.documents = [
    {
      ...evidence.documents[0],
      id: doc.id,
      checksum: doc.checksum,
      version,
      kind: "specification",
      locations: [
        {
          id: "assessment",
          page: page.page,
          section: "Assessment overview",
          text: page.text,
        },
      ],
    },
  ];
  evidence.claims = [
    ["marks", "85 marks"],
    ["durationMinutes", "120 minutes"],
    ["topics", "Mechanics and Waves"],
    ["tier", "untiered"],
    ["calculator", "A scientific calculator is allowed"],
    ["formats", "Short structured answers"],
    ["selection", "Answer all questions"],
  ].map(([field, quote]) => ({
    field,
    quote,
    documentId: doc.id,
    locationId: "assessment",
    rule: "mandatory",
  }));
  return { evidence, identityClaims: [] };
}
function setup(source = pages()) {
  const memory = memoryJobStore();
  const parsePdf = vi.fn(async () => source);
  const model = vi.fn(async (_system: string, payload: any) => {
    if (payload.documents)
      return {
        value: await extracted(payload),
        promptTokens: 10,
        completionTokens: 5,
      };
    const template = templateFixture();
    template.identity = payload.identity;
    template.topics = ["Mechanics", "Waves"];
    template.calculator = "allowed";
    template.sections[0].groups[0].parts.forEach((part, i) => {
      part.topic = template.topics[i];
      part.resource = "none";
    });
    return { value: template, promptTokens: 10, completionTokens: 5 };
  });
  const deps: SourceJobDeps = { store: memory.store, parsePdf, model };
  return { memory, parsePdf, model, deps };
}
const answer = (job: any, value: string, field = "assessment") => ({
  revision: job.revision,
  answers: { [field]: value },
});

describe("same-build source questions", () => {
  it("accepts exactly one allowlisted answer instead of requiring every possible field", () => {
    const base = {
      action: "answer_source",
      jobId: crypto.randomUUID(),
      revision: 1,
    };
    expect(
      sourceJobRequestSchema.safeParse({
        ...base,
        answers: { assessment: "choice" },
      }).success,
    ).toBe(true);
    for (const answers of [
      {},
      { assessment: "x", module: "y" },
      { marks: "85" },
      { assessment: "" },
    ])
      expect(
        sourceJobRequestSchema.safeParse({ ...base, answers }).success,
      ).toBe(false);
  });
  it("reselects source Paper2 within one receipt, retains parsing and budgets, then saves the same protected proposal", async () => {
    const r = setup(),
      input = request();
    const question = await prepareSourceJob(owner, input, r.deps);
    expect(question.stage).toBe("needs_details");
    expect(question.missingItems?.map((x) => x.field)).toEqual(["assessment"]);
    expect(question.assessmentChoices).toHaveLength(1);
    const stored = r.memory.records.get(ownerKey(owner, input.requestId))!;
    expect(stored.stage).toBe("ready");
    const original = structuredClone(stored.data.requestedIdentity);
    const response = await answerSourceJob(
      owner,
      input.requestId,
      answer(question, question.assessmentChoices![0].id),
      r.deps,
    );
    expect(response.stage).toBe("identifying");
    expect(response.jobId).toBe(question.jobId);
    expect(response.identity?.component).toBe("7408/2");
    expect(r.parsePdf).toHaveBeenCalledOnce();
    expect(r.model).not.toHaveBeenCalled();
    expect(r.memory.reservations).toBe(0);
    const ready = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(ready.stage).toBe("ready");
    expect(JSON.stringify(r.model.mock.calls[0][1])).not.toMatch(
      /70 marks|90 minutes|AS-only/,
    );
    await confirmSourceJob(
      owner,
      input.requestId,
      { identity: ready.identity!, mode: ready.mode },
      r.deps,
    );
    const result = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(result.stage).toBe("complete");
    expect(result.proposalId).toBe(input.requestId);
    expect(result.proposal?.template.identity.component).toBe("7408/2");
    expect(
      r.memory.records.get(ownerKey(owner, input.requestId))!.data
        .requestedIdentity,
    ).toEqual(original);
    expect(r.parsePdf).toHaveBeenCalledOnce();
    expect(r.model).toHaveBeenCalledTimes(2);
    expect(r.memory.reservations).toBe(1);
    expect(
      r.memory.records.get(ownerKey(owner, input.requestId))!.data,
    ).not.toHaveProperty("retainedDocuments");
  });
  it.each(["forged-id", "forged-field", "other-owner"])(
    "rejects %s without changing the receipt, reading or paid budget",
    async (kind) => {
      const r = setup(),
        input = request(),
        q = await prepareSourceJob(owner, input, r.deps);
      const before = structuredClone(
        r.memory.records.get(ownerKey(owner, input.requestId))!,
      );
      const choice = q.assessmentChoices![0].id;
      await expect(
        answerSourceJob(
          kind === "other-owner" ? other : owner,
          input.requestId,
          kind === "forged-field"
            ? answer(q, "all_compulsory", "selection")
            : answer(q, kind === "forged-id" ? "invented" : choice),
          r.deps,
        ),
      ).rejects.toThrow();
      expect(r.memory.records.get(ownerKey(owner, input.requestId))).toEqual(
        before,
      );
      expect(r.parsePdf).toHaveBeenCalledOnce();
      expect(r.model).not.toHaveBeenCalled();
    },
  );
  it("makes repeated/stale answers status-only and cannot confirm an unanswered question", async () => {
    const r = setup(),
      input = request(),
      q = await prepareSourceJob(owner, input, r.deps);
    await expect(
      confirmSourceJob(
        owner,
        input.requestId,
        { identity: q.identity!, mode: q.mode },
        r.deps,
      ),
    ).rejects.toThrow(/before confirming/);
    const inputAnswer = answer(q, q.assessmentChoices![0].id);
    const first = await answerSourceJob(
      owner,
      input.requestId,
      inputAnswer,
      r.deps,
    );
    const duplicate = await answerSourceJob(
      owner,
      input.requestId,
      inputAnswer,
      r.deps,
    );
    expect(duplicate).toEqual(first);
    expect(r.model).not.toHaveBeenCalled();
    await getSourceJob(owner, input.requestId, r.deps);
    expect(r.model).not.toHaveBeenCalled();
    expect(
      r.memory.records.get(ownerKey(owner, input.requestId))!.leaseToken,
    ).toBeNull();
  });
  it("does not serve reselected Paper2 evidence from the immutable Paper1 cache key", async () => {
    const r = setup(),
      input = request(),
      q = await prepareSourceJob(owner, input, r.deps);
    await answerSourceJob(
      owner,
      input.requestId,
      answer(q, q.assessmentChoices![0].id),
      r.deps,
    );
    await advanceSourceJob(owner, input.requestId, r.deps);
    const again = await prepareSourceJob(
      owner,
      { ...input, requestId: crypto.randomUUID() },
      r.deps,
    );
    expect(again.stage).toBe("needs_details");
    expect(again.identity?.component).toBe("7408/1");
    expect(again.missingItems?.[0].field).toBe("assessment");
    expect(r.model).toHaveBeenCalledOnce();
    expect(r.parsePdf).toHaveBeenCalledTimes(2);
  });
  it("asks for a safely anchored page when a combined comparison is undecidable and resolves a later literal overview", async () => {
    const source = pages(block(1));
    source[1] = "AS\nA-level\nPaper 1\n70 marks\n85 marks";
    const r = setup(source),
      input = request(identity(), source),
      q = await prepareSourceJob(owner, input, r.deps);
    expect(q.missingItems?.[0].field).toBe("source_pages");
    const clarified = await answerSourceJob(
      owner,
      input.requestId,
      answer(q, "1:90", "source_pages"),
      r.deps,
    );
    expect(clarified.stage).toBe("identifying");
    const ready = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(ready.stage).toBe("ready");
    expect(r.parsePdf).toHaveBeenCalledOnce();
    expect(JSON.stringify(r.model.mock.calls[0][1])).not.toMatch(
      /70 marks|90 minutes|AS-only/,
    );
  });
  it("cannot turn a chosen unpartitionable table into evidence and requests only the relevant source", async () => {
    const source = ["AS\nA-level\nPaper 1\n70 marks\n85 marks"],
      r = setup(source),
      input = request(identity(), source);
    const q = await prepareSourceJob(owner, input, r.deps);
    expect(q.stage).toBe("needs_details");
    expect(q.missingItems?.[0].field).toBe("source_pages");
    const next = await answerSourceJob(
      owner,
      input.requestId,
      answer(q, "1:1", "source_pages"),
      r.deps,
    );
    expect(next.stage).toBe("needs_details");
    expect(next.missingItems?.[0].field).toBe("source");
    expect(r.parsePdf).toHaveBeenCalledOnce();
    expect(r.model).not.toHaveBeenCalled();
    await expect(
      answerSourceJob(
        owner,
        input.requestId,
        answer(next, "85 marks; answer all questions", "source"),
        r.deps,
      ),
    ).rejects.toThrow(/cannot replace source/);
  });
  it("keeps raw source text private in every question/status response", async () => {
    const source = pages();
    source[40] = "Private original course notes must not leave checkpoint";
    const r = setup(source),
      input = request(identity(), source),
      q = await prepareSourceJob(owner, input, r.deps);
    const status = await getSourceJob(owner, input.requestId, r.deps);
    for (const value of [q, status]) {
      expect(value).not.toHaveProperty("data");
      expect(JSON.stringify(value)).not.toContain(source[40]);
      expect(JSON.stringify(value)).not.toContain("Supporting material");
    }
  });
  it("retains valid extraction and the same quota when a missing fact needs one focused page", async () => {
    const r = setup(pages(block(1))),
      input = { ...request(identity()), mode: "full_mock" as const };
    const original = r.model.getMockImplementation()!;
    r.model.mockImplementation(async (system, payload) => {
      const result = await original(system, payload);
      if (payload.documents && r.model.mock.calls.length === 1)
        (result.value as any).evidence.facts.marks = null;
      return result;
    });
    await prepareSourceJob(owner, input, r.deps);
    const q = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(q.stage).toBe("needs_details");
    expect(q.missingItems?.[0].field).toBe("source_pages");
    const prior = r.memory.records.get(ownerKey(owner, input.requestId))!;
    expect(prior.callIntents).toBe(1);
    expect(prior.data.partials).toHaveLength(1);
    const partial = structuredClone(prior.data.partials[0]);
    const continued = await answerSourceJob(
      owner,
      input.requestId,
      answer(q, "1:90", "source_pages"),
      r.deps,
    );
    expect(continued.stage).toBe("identifying");
    const after = r.memory.records.get(ownerKey(owner, input.requestId))!;
    expect(after.data.partials[0]).toEqual(partial);
    expect(after.callIntents).toBe(1);
    expect(after.activeMs).toBeGreaterThanOrEqual(prior.activeMs);
    const ready = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(ready.stage).toBe("ready");
    expect(ready.identity?.component).toBe("7408/1");
    expect(
      r.memory.records.get(ownerKey(owner, input.requestId))!.data.evidence
        ?.facts.marks,
    ).toBe(85);
    expect(r.parsePdf).toHaveBeenCalledOnce();
    expect(r.model).toHaveBeenCalledTimes(2);
    expect(r.memory.reservations).toBe(1);
  });
  it("keeps a usable page question when a new request reuses incomplete cached evidence", async () => {
    const r = setup(pages(block(1))),
      input = { ...request(identity()), mode: "full_mock" as const };
    const original = r.model.getMockImplementation()!;
    r.model.mockImplementation(async (system, payload) => {
      const result = await original(system, payload);
      if (payload.documents) (result.value as any).evidence.facts.marks = null;
      return result;
    });
    await prepareSourceJob(owner, input, r.deps);
    await advanceSourceJob(owner, input.requestId, r.deps);
    const cached = await prepareSourceJob(
      owner,
      { ...input, requestId: crypto.randomUUID() },
      r.deps,
    );
    expect(cached.stage).toBe("needs_details");
    expect(cached.missingItems?.[0].field).toBe("source_pages");
    const record = r.memory.records.get(ownerKey(owner, cached.jobId))!;
    expect(record.data.retainedDocuments?.[0].pages).toHaveLength(96);
    expect(record.data.partials).toHaveLength(1);
    expect(record.callIntents).toBe(0);
    expect(r.model).toHaveBeenCalledOnce();
    expect(r.parsePdf).toHaveBeenCalledTimes(2);
  });
  it("reports selected pages excluded from a follow-up instead of silently dropping them", async () => {
    const source = pages(block(1));
    source[90] = `A-level Physics (7408)\n${block(2)}\nPaper 2 only`;
    const r = setup(source),
      input = { ...request(identity(), source), mode: "full_mock" as const };
    const original = r.model.getMockImplementation()!;
    r.model.mockImplementation(async (system, payload) => {
      const result = await original(system, payload);
      if (payload.documents && r.model.mock.calls.length === 1)
        (result.value as any).evidence.facts.marks = null;
      return result;
    });
    await prepareSourceJob(owner, input, r.deps);
    const question = await advanceSourceJob(owner, input.requestId, r.deps);
    const continued = await answerSourceJob(
      owner,
      input.requestId,
      answer(question, "90–91", "source_pages"),
      r.deps,
    );
    expect(continued.stage).toBe("identifying");
    expect(continued.pageReview).toEqual([
      { document: 1, requestedPages: [90, 91], readPages: [90], skippedPages: [91] },
    ]);
    expect(r.model).toHaveBeenCalledOnce();
    expect(r.parsePdf).toHaveBeenCalledOnce();
    const ready = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(ready.stage).toBe("ready");
    expect(ready.pageReview).toEqual(continued.pageReview);
    expect(JSON.stringify(r.model.mock.calls[1][1])).not.toContain("Paper 2 only");
    expect((await getSourceJob(owner, input.requestId, r.deps)).pageReview).toEqual(
      continued.pageReview,
    );
  });

  it("does not claim an unmatched selected page was read or spend a call on it", async () => {
    const source = pages(block(1));
    source[90] = `A-level Physics (7408)\n${block(2)}\nPaper 2 only`;
    const r = setup(source),
      input = { ...request(identity(), source), mode: "full_mock" as const };
    const original = r.model.getMockImplementation()!;
    r.model.mockImplementation(async (system, payload) => {
      const result = await original(system, payload);
      if (payload.documents) (result.value as any).evidence.facts.marks = null;
      return result;
    });
    await prepareSourceJob(owner, input, r.deps);
    const question = await advanceSourceJob(owner, input.requestId, r.deps);
    const continued = await answerSourceJob(
      owner,
      input.requestId,
      answer(question, "91", "source_pages"),
      r.deps,
    );
    expect(continued.stage).toBe("needs_details");
    expect(continued.missingItems?.[0].field).toBe("source");
    expect(continued.pageReview).toEqual([
      { document: 1, requestedPages: [91], readPages: [], skippedPages: [91] },
    ]);
    expect(r.model).toHaveBeenCalledOnce();
    expect(r.parsePdf).toHaveBeenCalledOnce();
    expect(r.memory.reservations).toBe(1);
  });

  it("asks for a focused new source without another paid call when reference capacity is exhausted", async () => {
    const r = setup(pages(block(1))),
      input = { ...request(identity()), mode: "full_mock" as const };
    const original = r.model.getMockImplementation()!;
    r.model.mockImplementation(async (system, payload) => {
      const result = await original(system, payload);
      if (payload.documents) {
        const evidence = (result.value as any).evidence;
        evidence.facts.marks = null;
        const location = evidence.documents[0].locations[0];
        evidence.documents[0].locations.push(
          ...Array.from({ length: 39 }, (_, i) => ({
            ...location,
            id: `extra-${i}`,
          })),
        );
      }
      return result;
    });
    await prepareSourceJob(owner, input, r.deps);
    const q = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(q.stage).toBe("needs_details");
    expect(q.missingItems?.[0].field).toBe("source");
    await advanceSourceJob(owner, input.requestId, r.deps);
    expect(r.model).toHaveBeenCalledOnce();
    expect(r.memory.reservations).toBe(1);
  });
});
