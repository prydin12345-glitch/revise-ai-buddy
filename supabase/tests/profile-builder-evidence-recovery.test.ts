// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  advanceSourceJob,
  confirmSourceJob,
  getSourceJob,
  prepareSourceJob,
  type SourceJobDeps,
} from "../functions/_shared/profile-builder-jobs";
import { prepareProfileSave } from "../functions/_shared/profile-builder-service";
import type {
  ProfileTemplate,
  TemplateIdentity,
} from "../functions/_shared/profile-template";
import { ownerEvidence } from "./profile-builder-fixtures";
import { memoryJobStore, ownerKey } from "./profile-builder-jobs-fixtures";

// Original fixtures reproduce the shapes reported by the user. They are not
// copies of the unavailable live model responses or official question content.
const owner = "50000000-0000-4000-8000-000000000001";
const other = "50000000-0000-4000-8000-000000000002";
const version = "Version 1.4 July 2026";
const scope = "Sections 1–5 and 6.1";
const formats =
  "60 marks of short and long answer questions; 25 multiple-choice questions.";
const block = [
  "Paper 1",
  version,
  "What's assessed",
  scope,
  "Written exam: 2 hours",
  "85 marks",
  formats,
  "Mathematical skills",
  "Use calculators to find and use powers, exponential and logarithmic functions.",
].join("\n");
const identity = (
  overrides: Partial<TemplateIdentity> = {},
): TemplateIdentity => ({
  country: "GB",
  educationSystem: "UK",
  stage: "Secondary",
  qualification: "A-level",
  subject: "Physics",
  organisation: "AQA",
  course: "7408",
  component: "7408/1",
  specificationVersion: version,
  tier: "not_tiered",
  ...overrides,
});

function pagesFor(assessment = block) {
  const pages = Array.from(
    { length: 96 },
    (_, i) => `Supporting source material ${i + 1}\n${"x".repeat(900)}`,
  );
  pages[0] = "AQA\nA-level Physics\n7408\n" + version;
  // The later topic-name safety check needs the original subject-content
  // headings as well as the reported numbered overview; the old fixture had
  // omitted those pages entirely.
  pages[1] = [
    "3.1 Measurements and their errors",
    "3.2 Particles and radiation",
    "3.3 Waves",
    "3.4 Mechanics and materials",
    "3.5 Electricity",
    "3.6.1 Periodic motion",
  ].join("\n");
  pages[89] = assessment;
  return pages;
}

function request(assessment = block, selected = identity()) {
  return {
    action: "prepare_source" as const,
    requestId: crypto.randomUUID(),
    identity: selected,
    mode: "full_mock" as const,
    uploads: [
      {
        contentType: "application/pdf" as const,
        // A parser fixture. The separate browser/parser tests use real PDFs.
        base64: Buffer.from("%PDF-1.7\noriginal parser fixture").toString(
          "base64",
        ),
      },
    ],
  };
}

async function extracted(
  payload: any,
  assessment = block,
  tier: null | "not_tiered" = null,
) {
  const supplied = payload.documents[0];
  const page = supplied.pages.find((p: any) => p.text.includes(assessment));
  if (!page)
    throw Error("The complete original assessment fixture was not retrieved.");
  const evidence = await ownerEvidence();
  evidence.identity = { ...payload.identity };
  evidence.documents = [
    {
      ...evidence.documents[0],
      id: supplied.id,
      checksum: supplied.checksum,
      title: "Original synthetic Physics specification",
      version,
      kind: "specification",
      applicableCohort: "Current source fixture",
      locations: [
        {
          id: "overview",
          page: page.page,
          section: "Assessment overview",
          text: assessment,
        },
      ],
    },
  ];
  evidence.facts = {
    marks: 85,
    durationMinutes: 120,
    topics: [scope],
    tier,
    calculator: "unknown",
    selection: "unknown",
    formats: ["mcq_single", "short_answer", "long_form"],
    mathsRequirement: null,
    practicalRequirement: null,
  };
  evidence.claims = [
    ["marks", "85 marks", "mandatory"],
    ["durationMinutes", "Written exam: 2 hours", "observed"],
    ["topics", scope, "observed"],
    ["formats", formats, "mandatory"],
  ].map(([field, quote, rule]) => ({
    field,
    quote,
    rule: rule as "mandatory" | "observed",
    documentId: supplied.id,
    locationId: "overview",
  }));
  return { evidence, identityClaims: [] as any[] };
}

function draft(payload: any): ProfileTemplate {
  return {
    schemaVersion: 1,
    identity: payload.identity,
    mode: payload.mode,
    marks: 85,
    durationMinutes: 120,
    topics: payload.evidence?.facts.topics ?? [scope],
    calculator: "allowed",
    sections: [
      {
        id: "paper",
        title: "Examly development layout",
        groups: [30, 30, 25].map((marks, index) => ({
          id: `group-${index}`,
          parts: [
            {
              id: `part-${index}`,
              topic: payload.evidence?.facts.topics[0] ?? scope,
              marks,
              response: "short_answer",
              demand: "AO1",
              resource: "none",
            },
          ],
        })),
      },
    ],
    warnings: [],
    designDecisions: [
      "Original deterministic test layout, not an official fixed distribution.",
    ],
  };
}

function setup(assessment = block, tier: null | "not_tiered" = null) {
  const memory = memoryJobStore();
  const model = vi.fn(async (_system: string, payload: any) => ({
    value: payload.documents
      ? await extracted(payload, assessment, tier)
      : draft(payload),
    promptTokens: 13,
    completionTokens: 7,
  }));
  const parsePdf = vi.fn(async () => pagesFor(assessment));
  const deps: SourceJobDeps = { store: memory.store, model, parsePdf };
  return { memory, model, parsePdf, deps };
}

async function failReading(
  runtime: ReturnType<typeof setup>,
  input = request(),
) {
  await prepareSourceJob(owner, input, runtime.deps);
  const repairing = await advanceSourceJob(
    owner,
    input.requestId,
    runtime.deps,
  );
  expect(repairing.stage).toBe("identifying");
  const failed = await advanceSourceJob(owner, input.requestId, runtime.deps);
  expect(failed.stage).toBe("failed");
  return failed;
}

describe("reported A-level specification evidence failures", () => {
  it.each([null, "not_tiered"] as const)(
    "builds a full mock when a real specification has no tier or question-choice sentence (model tier %s)",
    async (tier) => {
      expect(block).not.toMatch(
        /untiered|not[ -]tiered|answer all|calculators? (?:are )?allowed/i,
      );
      const runtime = setup(block, tier),
        input = request();
      const prepared = await prepareSourceJob(owner, input, runtime.deps);
      expect(prepared.stage).toBe("identifying");
      expect(runtime.model).not.toHaveBeenCalled();
      const ready = await advanceSourceJob(
        owner,
        input.requestId,
        runtime.deps,
      );
      expect(ready.stage).toBe("ready");
      expect(runtime.model).toHaveBeenCalledOnce();
      const evidence = runtime.memory.records.get(
        ownerKey(owner, input.requestId),
      )!.data.evidence!;
      expect(evidence.facts).toMatchObject({
        marks: 85,
        durationMinutes: 120,
        tier: "not_tiered",
        selection: "all_compulsory",
        calculator: "allowed",
      });
      expect(evidence.catalogueFacts).toEqual([
        {
          version: 1,
          field: "tier",
          source: "assessment_catalogue",
          courseId: "aqa_alevel_physics_7408",
          value: "not_tiered",
        },
      ]);
      expect(evidence.claims.some((claim) => claim.field === "tier")).toBe(
        false,
      );
      const cover = evidence.documents.find(
        (document) => document.authority === "official_registered",
      )!;
      expect(cover.url).toMatch(/^https:\/\/cdn\.sanity\.io\//);
      expect(cover.locations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ page: 1, text: "Answer all questions." }),
        ]),
      );
      expect(
        evidence.claims
          .filter((claim) => ["selection", "calculator"].includes(claim.field))
          .every((claim) => claim.documentId === cover.id),
      ).toBe(true);
      expect(
        evidence.claims.find((claim) => claim.field === "topics")?.rule,
      ).toBe("observed");
      expect(ready.reviewedFacts?.tier?.source).toBe("assessment_catalogue");
      expect(ready.reviewedFacts?.assessmentInstructions?.sourceUrls).toContain(
        cover.url,
      );

      await confirmSourceJob(
        owner,
        input.requestId,
        { identity: ready.identity!, mode: ready.mode },
        runtime.deps,
      );
      const complete = await advanceSourceJob(
        owner,
        input.requestId,
        runtime.deps,
      );
      expect(complete.stage).toBe("complete");
      expect(complete.proposal?.origin).toBe("source_backed_ai");
      expect(complete.proposal?.presetId).toBeNull();
      expect(complete.proposal?.template).toMatchObject({
        marks: 85,
        durationMinutes: 120,
      });
      const saved = prepareProfileSave(
        complete.proposal!,
        complete.proposal!.template,
      );
      expect(saved.approval.status).toBe("not_approved");
      expect(saved.context.resolved_by).toBe("server");
      expect(runtime.model).toHaveBeenCalledTimes(2);
      expect(runtime.memory.reservations).toBe(1);
    },
  );

  it.each(["catalogueFacts", "official document"])(
    "does not let a model nominate trusted authority: %s",
    async (attack) => {
      const runtime = setup(),
        input = request();
      runtime.model.mockImplementation(async (_system, payload) => {
        const value = await extracted(payload);
        if (attack === "catalogueFacts")
          (value.evidence as any).catalogueFacts = [
            {
              version: 1,
              field: "tier",
              source: "assessment_catalogue",
              courseId: "aqa_alevel_physics_7408",
              value: "not_tiered",
            },
          ];
        else {
          value.evidence.documents[0].authority = "official_registered";
          value.evidence.documents[0].url =
            "https://example.edu/forged-official.pdf";
        }
        return { value, promptTokens: 13, completionTokens: 7 };
      });
      await failReading(runtime, input);
      expect(
        runtime.memory.records.get(ownerKey(owner, input.requestId))!.data
          .evidence,
      ).toBeNull();
      expect(runtime.model).toHaveBeenCalledTimes(2);
    },
  );

  it("does not consume the next line's mark total as additional minutes in a mandatory duration quote", async () => {
    const runtime = setup(),
      input = request();
    runtime.model.mockImplementation(async (_system, payload) => {
      const value = await extracted(payload);
      value.evidence.claims.find(
        (claim) => claim.field === "durationMinutes",
      )!.rule = "mandatory";
      return { value, promptTokens: 13, completionTokens: 7 };
    });
    await prepareSourceJob(owner, input, runtime.deps);
    const ready = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(ready.stage).toBe("ready");
    expect(
      runtime.memory.records.get(ownerKey(owner, input.requestId))!.data
        .evidence?.facts.durationMinutes,
    ).toBe(120);
    expect(runtime.model).toHaveBeenCalledOnce();
  });

  it("keeps wrong marks and an unsupported topic strict, retaining both safe rejection reasons", async () => {
    const runtime = setup(),
      input = request();
    runtime.model.mockImplementation(async (_system, payload) => {
      const value = await extracted(payload);
      if (runtime.model.mock.calls.length === 1)
        value.evidence.facts.marks = 86;
      else value.evidence.facts.topics = ["Unquoted thermodynamics"];
      return { value, promptTokens: 13, completionTokens: 7 };
    });
    const failed = await failReading(runtime, input);
    expect(failed.validationIssues).toHaveLength(2);
    expect(
      failed.validationIssues?.map((issue) => [
        issue.attempt,
        issue.stage,
        issue.field,
      ]),
    ).toEqual([
      [1, "extraction", "marks"],
      [2, "extraction", "topics"],
    ]);
    expect(failed.needs?.[0]).toBe(failed.validationIssues?.[1].message);
    expect(failed.needs?.join(" ")).not.toMatch(
      /Check the specification version/,
    );
    const privateRecord = runtime.memory.records.get(
      ownerKey(owner, input.requestId),
    )!;
    expect(
      privateRecord.data.validationIssues?.every(
        (issue) => issue.detail.length > 0,
      ),
    ).toBe(true);
    expect(privateRecord.data.validationIssues?.[1].detail).toMatch(
      /topic.*not supported/i,
    );
    expect(privateRecord.data.invalidExtraction).toBeDefined();
    const publicText = JSON.stringify(failed);
    expect(publicText).not.toContain('"detail"');
    expect(publicText).not.toContain("invalidExtraction");
    expect(publicText).not.toContain(block);
    expect(publicText).not.toContain("Unquoted thermodynamics");
    for (let i = 0; i < 3; i++)
      await getSourceJob(owner, input.requestId, runtime.deps);
    expect(runtime.model).toHaveBeenCalledTimes(2);
    expect(runtime.memory.usage).toHaveLength(2);
    await expect(
      getSourceJob(other, input.requestId, runtime.deps),
    ).rejects.toThrow(/not found in your account/);
  });

  it("does not accept a full sentence invented beyond a truncated literal source passage", async () => {
    const runtime = setup(),
      input = request();
    runtime.model.mockImplementation(async (_system, payload) => {
      const value = await extracted(payload);
      value.evidence.claims.find((claim) => claim.field === "topics")!.quote =
        scope + " and unsupported section 12";
      return { value, promptTokens: 13, completionTokens: 7 };
    });
    const failed = await failReading(runtime, input);
    expect(
      failed.validationIssues?.every(
        (issue) => issue.code === "unmatched_quote",
      ),
    ).toBe(true);
    expect(runtime.model).toHaveBeenCalledTimes(2);
  });

  it.each(["calculator", "selection"] as const)(
    "preserves a contrary uploaded %s fact and blocks rather than overwriting it",
    async (field) => {
      const contrary =
        field === "calculator"
          ? "No calculator allowed."
          : "Choose one question from Section B.";
      const source = block + "\n" + contrary;
      const runtime = setup(source),
        input = request(source);
      runtime.model.mockImplementation(async (_system, payload) => {
        const value = await extracted(payload, source);
        if (field === "calculator")
          value.evidence.facts.calculator = "not_allowed";
        else value.evidence.facts.selection = "optional";
        value.evidence.claims.push({
          field,
          quote: contrary,
          documentId: payload.documents[0].id,
          locationId: "overview",
          rule: "mandatory",
        });
        return { value, promptTokens: 13, completionTokens: 7 };
      });
      await prepareSourceJob(owner, input, runtime.deps);
      const state = await advanceSourceJob(
        owner,
        input.requestId,
        runtime.deps,
      );
      expect(state.stage).toBe("needs_details");
      const evidence = runtime.memory.records.get(
        ownerKey(owner, input.requestId),
      )!.data.evidence!;
      expect(evidence.facts[field]).toBe(
        field === "calculator" ? "not_allowed" : "optional",
      );
      expect(evidence.conflicts.join(" ")).toMatch(
        /conflicts with the reviewed instructions/,
      );
      expect(state.proposal).toBeUndefined();
      expect(runtime.model).toHaveBeenCalledOnce();
    },
  );

  it("does not default Paper 3's actual optional section to all questions", async () => {
    const source =
      block.replace("Paper 1", "Paper 3") +
      "\nAstrophysics\nChoose one question from Section B.";
    const runtime = setup(source),
      input = request(
        source,
        identity({ component: "7408/3", module: "Astrophysics" }),
      );
    runtime.model.mockImplementation(async (_system, payload) => {
      const value = await extracted(payload, source);
      value.evidence.facts.selection = "optional";
      value.evidence.claims.push({
        field: "selection",
        quote: "Choose one question from Section B.",
        documentId: payload.documents[0].id,
        locationId: "overview",
        rule: "mandatory",
      });
      return { value, promptTokens: 13, completionTokens: 7 };
    });
    await prepareSourceJob(owner, input, runtime.deps);
    const state = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(state.stage).toBe("needs_details");
    expect(state.needs?.join(" ")).toMatch(
      /question choices.*reviewed Examly adapter/,
    );
    const evidence = runtime.memory.records.get(
      ownerKey(owner, input.requestId),
    )!.data.evidence!;
    expect(evidence.facts.selection).toBe("optional");
    expect(
      evidence.documents.every(
        (document) => document.authority === "owner_supplied",
      ),
    ).toBe(true);
    expect(state.reviewedFacts?.assessmentInstructions).toBeUndefined();
    expect(runtime.model).toHaveBeenCalledOnce();
  });

  it("does not promote a maths-skills calculator example on an unknown institutional course", async () => {
    const selected = identity({
      country: "US",
      educationSystem: "Institution",
      stage: "University",
      qualification: "Undergraduate module",
      organisation: "Example University",
      course: "PHY101",
      component: "Final assessment",
      tier: null,
    });
    const source = block.replace("Paper 1", "Final assessment");
    const runtime = setup(source),
      input = request(source, selected);
    runtime.model.mockImplementation(async (_system, payload) => {
      const value = await extracted(payload, source);
      value.evidence.facts.calculator = "allowed";
      value.evidence.documents[0].locations[0].section = "Mathematical skills";
      value.evidence.claims.push({
        field: "calculator",
        quote:
          "Use calculators to find and use powers, exponential and logarithmic functions.",
        documentId: payload.documents[0].id,
        locationId: "overview",
        rule: "mandatory",
      });
      return { value, promptTokens: 13, completionTokens: 7 };
    });
    const failed = await failReading(runtime, input);
    expect(
      failed.validationIssues?.every((issue) => issue.field === "calculator"),
    ).toBe(true);
    expect(
      runtime.memory.records.get(ownerKey(owner, input.requestId))!.data
        .evidence,
    ).toBeNull();
  });

  it("preserves both rejected draft reasons within the one overall three-call budget", async () => {
    const runtime = setup(),
      input = request();
    runtime.model.mockImplementation(async (_system, payload) => {
      if (payload.documents)
        return {
          value: await extracted(payload),
          promptTokens: 13,
          completionTokens: 7,
        };
      const value = draft(payload);
      if (runtime.model.mock.calls.length === 2)
        value.sections[0].groups[0].parts[0].marks = 29;
      else {
        value.topics = ["Unquoted topic"];
        value.sections[0].groups.forEach((group) =>
          group.parts.forEach((part) => (part.topic = "Unquoted topic")),
        );
      }
      return { value, promptTokens: 13, completionTokens: 7 };
    });
    await prepareSourceJob(owner, input, runtime.deps);
    const ready = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(ready.stage).toBe("ready");
    await confirmSourceJob(
      owner,
      input.requestId,
      { identity: ready.identity!, mode: ready.mode },
      runtime.deps,
    );
    const repairing = await advanceSourceJob(
      owner,
      input.requestId,
      runtime.deps,
    );
    expect(repairing.stage).toBe("drafting");
    const failed = await advanceSourceJob(owner, input.requestId, runtime.deps);
    expect(failed.stage).toBe("failed");
    expect(
      failed.validationIssues?.map((issue) => [issue.attempt, issue.stage]),
    ).toEqual([
      [2, "draft"],
      [3, "draft"],
    ]);
    expect(failed.validationIssues?.[1].field).toBe("topics");
    const record = runtime.memory.records.get(
      ownerKey(owner, input.requestId),
    )!;
    expect(record.data.validationIssues).toHaveLength(2);
    expect(record.callIntents).toBe(3);
    expect(failed.proposal).toBeUndefined();
    expect(JSON.stringify(failed)).not.toContain("Unquoted topic");
    await advanceSourceJob(owner, input.requestId, runtime.deps);
    await getSourceJob(owner, input.requestId, runtime.deps);
    expect(runtime.model).toHaveBeenCalledTimes(3);
    expect(runtime.memory.usage).toHaveLength(3);
  });
});
