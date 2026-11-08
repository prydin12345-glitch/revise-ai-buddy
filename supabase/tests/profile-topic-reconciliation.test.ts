// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  advanceSourceJob,
  answerSourceJob,
  prepareSourceJob,
  type SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
import type { TemplateIdentity } from "../functions/_shared/profile-template";
import { sourceTextIncludes } from "../functions/_shared/source-text-match";
import { sourceValidationRecord } from "../functions/_shared/profile-builder-diagnostics";
import { resolveReviewedAssessmentRules } from "../functions/_shared/profile-reviewed-assessment-rules";
import { validateEvidence } from "../functions/_shared/profile-evidence";
import { ownerEvidence, templateFixture } from "./profile-builder-fixtures";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";

// Original synthetic fixtures shaped like the reported AQA 7408 issue 1.3
// specification: the paper block names only "Sections 1 - 5 and 6.1", while
// the contents and subject-content pages hold the real topic headings.
const owner = "80000000-0000-4000-8000-000000000001";
const version = "Version 1.3 1 June 2017";
const scope = "Sections 1 - 5 and 6.1 (Periodic motion)";
const formats =
  "60 marks of short and long answer questions and 25 multiple choice questions on content.";
const identity = (): TemplateIdentity => ({
  country: "GB",
  educationSystem: "UK",
  stage: "Secondary",
  qualification: "A-level",
  subject: "Physics",
  organisation: "AQA",
  course: "7408",
  component: "7408/1",
  specificationVersion: "v1.3-july-2017",
  tier: "not_tiered",
});
const blockWith = (withFormats: boolean) =>
  [
    "A-level",
    "Assessments",
    "Paper 1",
    "What's assessed",
    scope,
    "Assessed",
    "written exam: 2 hours",
    "85 marks",
    "34% of A-level",
    ...(withFormats ? ["Questions", formats] : []),
  ].join("\n");
function pages(withFormats = true) {
  const out = Array.from(
    { length: 96 },
    (_, i) => `Supporting source material ${i + 1}\n${"x".repeat(900)}`,
  );
  out[0] = `AQA\nA-level Physics\n7408\n${version}`;
  out[2] = [
    "Contents",
    "3.1 Measurements and their errors   11",
    "3.2 Particles and radiation   12",
    "3.3 Waves   18",
    "3.4 Mechanics and materials   21",
    "3.5 Electricity   27",
    "3.6 Further mechanics and thermal physics (A-level only)   29",
  ].join("\n");
  out[29] = "3.6.1   Periodic motion   (A-level only)\nCircular motion content";
  out[8] = blockWith(withFormats);
  // A later "questions" page the student can point to for the formats.
  out[9] = `A-level Paper 1 questions\nQuestions\n${formats}`;
  return out;
}
const request = (content: string[]) => ({
  action: "prepare_source" as const,
  requestId: crypto.randomUUID(),
  identity: identity(),
  mode: "full_mock" as const,
  uploads: [
    {
      contentType: "application/pdf" as const,
      base64: Buffer.from(`%PDF-1.7\n${content.length}`).toString("base64"),
    },
  ],
});
const named = [
  "Measurements and their errors",
  "Particles and radiation",
  "Waves",
  "Mechanics and materials",
  "Electricity",
  "Periodic motion",
];

/** The model names topics but only quotes the assessment block (the reported shape). */
async function unquotedTopicRead(payload: any, extra: string[] = []) {
  const doc = payload.documents[0];
  const page =
    doc.pages.find((p: any) => p.text.includes("What's assessed")) ??
    doc.pages.find((p: any) => p.text.includes("multiple choice"));
  const evidence = await ownerEvidence();
  evidence.identity = { ...payload.identity };
  const isBlock = page.text.includes("What's assessed");
  evidence.documents = [
    {
      ...evidence.documents[0],
      id: doc.id,
      checksum: doc.checksum,
      version,
      kind: "specification",
      locations: [
        { id: "loc", page: page.page, section: "Assessment", text: page.text },
      ],
    },
  ];
  evidence.facts = {
    marks: isBlock ? 85 : null,
    durationMinutes: isBlock ? 120 : null,
    topics: [...named, ...extra],
    tier: null,
    calculator: "unknown",
    selection: "unknown",
    formats: page.text.includes(formats)
      ? ["short_answer", "long_form", "mcq_single"]
      : [],
    mathsRequirement: null,
    practicalRequirement: null,
  };
  evidence.claims = [
    ...(isBlock
      ? [
          ["marks", "85 marks"],
          ["durationMinutes", "written exam: 2 hours"],
          // Curly apostrophe: typography only, the wording is identical.
          ["topics", `What\u2019s assessed\n${scope}`],
        ]
      : [["topics", "Questions"]]),
    ...(page.text.includes(formats) ? [["formats", formats]] : []),
  ].map(([field, quote]) => ({
    field,
    quote,
    documentId: doc.id,
    locationId: "loc",
    rule: "mandatory" as const,
  }));
  return { evidence, identityClaims: [] };
}
function setup(content: string[], extra: string[] = []) {
  const memory = memoryJobStore();
  const parsePdf = vi.fn(async () => content);
  const model = vi.fn(async (_system: string, payload: any) => {
    if (payload.documents)
      return {
        value: await unquotedTopicRead(payload, extra),
        promptTokens: 10,
        completionTokens: 5,
      };
    const template = templateFixture();
    template.identity = payload.identity;
    template.topics = payload.evidence.facts.topics;
    template.calculator = "allowed";
    return { value: template, promptTokens: 10, completionTokens: 5 };
  });
  const deps: SourceJobDeps = { store: memory.store, parsePdf, model };
  return { memory, parsePdf, model, deps };
}

describe("typography-only quote matching", () => {
  it("accepts curly quotes, dash variants, ligatures and line-break hyphenation", () => {
    expect(sourceTextIncludes("What's assessed", "What\u2019s assessed")).toBe(true);
    expect(sourceTextIncludes("Sections 1 - 5", "Sections 1 \u2013 5")).toBe(true);
    expect(sourceTextIncludes("AS AND A- LEVEL", "AS and A-level")).toBe(true);
    expect(sourceTextIncludes("\ufb01eld lines", "field lines")).toBe(true);
    expect(sourceTextIncludes("elec-\ntricity", "electricity")).toBe(true);
  });
  it("still rejects different wording or numbers", () => {
    expect(sourceTextIncludes("Measurements and their errors", "Measurement errors")).toBe(false);
    expect(sourceTextIncludes("Sections 1 - 5", "Sections 15")).toBe(false);
    expect(sourceTextIncludes("85 marks", "80 marks")).toBe(false);
  });
});

describe("reviewed cover rules by specification issue", () => {
  it("applies the reviewed Paper 1 and Paper 2 cover rules to issue 1.3", () => {
    for (const component of ["7408/1", "7408/2"]) {
      const rules = resolveReviewedAssessmentRules({ ...identity(), component });
      expect(rules?.facts).toMatchObject({
        selection: "all_compulsory",
        calculator: "allowed",
      });
    }
  });
  it("still refuses an unreviewed issue and Paper 3", () => {
    expect(
      resolveReviewedAssessmentRules({
        ...identity(),
        specificationVersion: "Version 1.1 May 2015",
      }),
    ).toBeNull();
    expect(
      resolveReviewedAssessmentRules({ ...identity(), component: "7408/3" }),
    ).toBeNull();
  });
});

describe("initial read with unquoted topic names", () => {
  it("swaps each name for the specification heading, drops an invented one, and needs no page question", async () => {
    const content = pages(true),
      r = setup(content, ["Quantum gravity"]),
      input = request(content);
    await prepareSourceJob(owner, input, r.deps);
    const ready = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(ready.stage).toBe("ready");
    expect(ready.missingItems ?? []).toEqual([]);
    const evidence = r.memory.records.get(ownerKey(owner, input.requestId))!
      .data.evidence!;
    expect(evidence.facts.topics).toEqual([
      "Measurements and their errors",
      "Particles and radiation",
      "Waves",
      "Mechanics and materials",
      "Electricity",
      // Quoted literally in the paper block "(Periodic motion)", so kept as is.
      "Periodic motion",
    ]);
    expect(evidence.facts.topics).not.toContain("Quantum gravity");
    expect(evidence.unresolved.join(" ")).toMatch(/topic .*removed/i);
    expect(JSON.stringify(ready)).not.toContain("Quantum gravity");
    // Reviewed issue-1.3 cover rules fill the facts the specification omits.
    expect(evidence.facts).toMatchObject({
      selection: "all_compulsory",
      calculator: "allowed",
    });
    // Every kept topic is literally quote-backed; the normal validator agrees.
    expect(() => validateEvidence(evidence)).not.toThrow();
    for (const topic of evidence.facts.topics)
      expect(
        evidence.claims.some((c) => {
          const loc = evidence.documents
            .flatMap((d) => d.locations)
            .find((l) => l.id === c.locationId);
          return c.field === "topics" && loc && sourceTextIncludes(loc.text, topic);
        }),
      ).toBe(true);
    expect(r.model).toHaveBeenCalledOnce();
  });
});

describe("follow-up page read with unquoted topic names", () => {
  it("completes a follow-up read that previously failed the topic check", async () => {
    const content = pages(false),
      r = setup(content),
      input = request(content);
    await prepareSourceJob(owner, input, r.deps);
    const first = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(first.stage).toBe("needs_details");
    expect(first.missingItems?.[0].field).toBe("source_pages");
    const asked = await answerSourceJob(
      owner,
      input.requestId,
      { revision: first.revision, answers: { source_pages: "10" } },
      r.deps,
    );
    expect(asked.stage).toBe("identifying");
    const second = await advanceSourceJob(owner, input.requestId, r.deps);
    expect(second.stage).toBe("ready");
    const data = r.memory.records.get(ownerKey(owner, input.requestId))!.data;
    expect(data.validationIssues ?? []).toEqual([]);
    expect(data.evidence!.facts.formats.sort()).toEqual(
      ["long_form", "mcq_single", "short_answer"],
    );
    expect(second.missingItems ?? []).toEqual([]);
    expect(data.evidence!.facts.topics).toContain("Periodic motion");
    expect(data.evidence!.facts.topics.some((t) => /^Sections/.test(t))).toBe(false);
    expect(r.model).toHaveBeenCalledTimes(2);
  });
});

describe("topic diagnostics", () => {
  it("records the failing topic privately without echoing it to the student", () => {
    const record = sourceValidationRecord(
      Error('A topic is not supported by extracted syllabus text: "Quantum gravity"'),
      "extraction",
      2,
    );
    expect(record.detail).toContain("Quantum gravity");
    expect(record.message).not.toContain("Quantum gravity");
    expect(record.field).toBe("topics");
  });
});
