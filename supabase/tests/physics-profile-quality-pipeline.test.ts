// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extract, boundaryHandler } from "./aqa-alevel-runtime";
import {
  prepareProfileSave,
  type BuilderProposal,
} from "../functions/_shared/profile-builder-service";
import { snapshotTemplate } from "../functions/_shared/profile-template-context";
import {
  compileTemplate,
  checksum,
  type ProfileTemplate,
} from "../functions/_shared/profile-template";
import {
  evidenceFingerprint,
  type ProfileEvidence,
} from "../functions/_shared/profile-evidence";
import {
  canonicalMcqAnswer,
  coerceMcqOptions,
} from "../functions/_shared/model-question-normalization";

// Original small software fixtures. This is an Examly practice layout, not an
// official full-paper blueprint or a claim of generated scientific quality.
const graph = {
  type: "line_chart",
  xAxisLabel: "Time / s",
  yAxisLabel: "Potential difference / V",
  datasets: [
    {
      label: "Discharge",
      data: [
        { x: 0, y: 12 },
        { x: 1, y: 7 },
        { x: 2, y: 4 },
      ],
    },
  ],
};
const identity = {
  country: "GB",
  educationSystem: "UK",
  stage: "Secondary",
  qualification: "A-level",
  subject: "Physics",
  organisation: "AQA",
  course: "7408",
  component: "7408/2",
  specificationVersion: "Version 1.4 July 2026",
  tier: "not_tiered" as const,
};
const tasks: ReadonlyArray<
  readonly [string, string, string, readonly string[]?]
> = [
  [
    "Fields",
    "Define electric potential at a point in an electric field.",
    "Work done per unit positive charge in bringing a test charge from infinity to the point.",
  ],
  [
    "Fields",
    "Using the graph, determine the potential difference across the capacitor at 2 s.",
    "4 V. Award a reading mark and the unit mark.",
  ],
  [
    "Fields",
    "Calculate the energy transferred when 2 C of charge moves through 3 V.",
    "6 J",
    ["6 J", "5 J", "1.5 J", "0.67 J"],
  ],
  [
    "Nuclear physics",
    "A sample has one eighth of its original undecayed nuclei after 6 days. Determine the half-life.",
    "2 days",
    ["2 days", "3 days", "6 days", "18 days"],
  ],
  [
    "Nuclear physics",
    "Which emitted particle decreases the proton number by one while leaving the nucleon number unchanged?",
    "A positron",
    ["A positron", "An alpha particle", "A neutron", "A photon"],
  ],
  [
    "Thermal physics",
    "An ideal gas is heated from 300 K to 600 K at constant volume. Determine the ratio of final pressure to initial pressure.",
    "2",
    ["2", "0.5", "4", "1"],
  ],
  [
    "Assumed knowledge",
    "Calculate the frequency of an oscillation with a period of 0.25 s.",
    "4 Hz",
    ["4 Hz", "0.25 Hz", "2 Hz", "0.5 Hz"],
  ],
  [
    "Nuclear physics",
    "Which equation gives the energy equivalent of a mass change?",
    "$E=mc^2$",
    ["$E=mc^2$", "$E=mc$", "$E=m/c$", "$E=2mc$"],
  ],
  [
    "Nuclear physics",
    "Which quantity is conserved in a balanced nuclear equation?",
    "Total nucleon number",
    [
      "Total nucleon number",
      "Number of atoms",
      "Mass of each nucleus",
      "Binding energy of each nucleus",
    ],
  ],
  [
    "Assumed knowledge",
    "Which instrument measures the potential difference between two points in a circuit?",
    "A voltmeter",
    ["A voltmeter", "An ammeter", "A force meter", "A stopwatch"],
  ],
  [
    "Fields",
    "Calculate the electric field strength when a charge of 2 C experiences a force of 6 N.",
    "3 N C^{-1}",
    ["3 N C^{-1}", "12 N C^{-1}", "0.33 N C^{-1}", "8 N C^{-1}"],
  ],
  [
    "Nuclear physics",
    "Which observation provides evidence for discrete nuclear energy levels?",
    "A gamma-ray line spectrum",
    [
      "A gamma-ray line spectrum",
      "A continuous thermal spectrum",
      "A constant background count",
      "A smooth capacitor-discharge curve",
    ],
  ],
];

async function fixture(linkedFinalGroup = false) {
  const topics = [...new Set(tasks.map((task) => task[0]))];
  const template: ProfileTemplate = {
    schemaVersion: 1,
    identity,
    mode: "short_practice",
    marks: 14,
    durationMinutes: 20,
    topics,
    calculator: "allowed",
    sections: [
      {
        id: "practice",
        title: "Original software practice layout",
        groups: tasks.map((task, index) => ({
          id: `group-${index + 1}`,
          parts: [
            {
              id: `part-${index + 1}`,
              topic: task[0],
              marks: index < 2 ? 2 : 1,
              response: index < 2 ? "short_answer" : "mcq_single",
              demand: index < 2 ? "AO1" : "AO2",
              resource: index === 1 ? "graph" : "none",
            },
          ],
        })),
      },
    ],
    warnings: [],
    designDecisions: [
      "Original development practice layout; not an official fixed structure.",
    ],
  };
  if (linkedFinalGroup) {
    const groups = template.sections[0].groups;
    const last = groups.splice(-2);
    groups.push({
      id: "linked-final",
      parts: last.flatMap((group) => group.parts),
    });
  }
  const source = `Original synthetic assessment brief. ${identity.specificationVersion}. 85 marks; 120 minutes. This assessment is untiered. Fields; Nuclear physics; Thermal physics; Assumed knowledge. Short structured answers and multiple-choice questions. Answer all questions. A scientific calculator is allowed.`;
  const evidence: ProfileEvidence = {
    version: 1,
    identity,
    documents: [
      {
        id: "owned-source",
        checksum: await checksum(source),
        title: "Original private software fixture",
        url: null,
        version: identity.specificationVersion,
        kind: "specification",
        authority: "owner_supplied",
        retrievedOn: "2026-11-07",
        state: "active",
        applicableCohort: "Current fixture",
        locations: [
          {
            id: "overview",
            page: 1,
            section: "Assessment overview",
            text: source,
          },
        ],
      },
    ],
    facts: {
      marks: 85,
      durationMinutes: 120,
      topics,
      tier: "not_tiered",
      calculator: "allowed",
      selection: "all_compulsory",
      formats: ["short_answer", "mcq_single"],
      mathsRequirement: null,
      practicalRequirement: null,
    },
    claims: [
      ["marks", "85 marks"],
      ["durationMinutes", "120 minutes"],
      ["topics", "Fields; Nuclear physics; Thermal physics; Assumed knowledge"],
      ["tier", "untiered"],
      ["calculator", "A scientific calculator is allowed"],
      ["selection", "Answer all questions"],
      ["formats", "Short structured answers and multiple-choice questions"],
    ].map(([field, quote]) => ({
      field,
      quote,
      documentId: "owned-source",
      locationId: "overview",
      rule: "mandatory",
    })),
    unresolved: [],
    conflicts: [],
  };
  const proposal: BuilderProposal = {
    proposalVersion: 1,
    promptVersion: 1,
    template,
    origin: "source_backed_ai",
    evidence,
    evidenceVersion: await evidenceFingerprint(evidence),
    presetId: null,
    profileSettings: null,
  };
  const saved = prepareProfileSave(proposal, template),
    profile = { ...saved.settings, profile_template: saved.context },
    plan = compileTemplate(template);
  const rows = plan.parts.map((part, index) => ({
    id: part.partId,
    question_number: part.questionNumber,
    root_question_number: part.parentId,
    parent_question_number: part.parentId,
    task: tasks[index][1],
    question_text: tasks[index][1],
    correct_answer: tasks[index][2],
    marks: part.marks,
    topic_tag: part.topic,
    question_type: index < 2 ? "short_answer" : "mcq",
    ...(index < 2 ? {} : { options: [...tasks[index][3]!] }),
    ...(index === 1 ? { diagram_config: structuredClone(graph) } : {}),
  }));
  return {
    plan,
    rows,
    snapshot: {
      context_version: 2,
      resolved_by: "server",
      profile_id: "profile",
      subject_name: "Physics",
      exam_board: "AQA",
      educational_tier: "A-level",
      assessment_tier: "not_tiered",
      course_id: plan.courseId,
      paper_id: plan.paperId,
      component_code: plan.componentCode,
      paper_contract: null,
      profile_template: snapshotTemplate(profile),
    },
  };
}
const duplicateDefinition = (rows: any[]) => {
  rows[10].question_text =
    "Which statement correctly defines electric potential at a point?";
  rows[10].task = rows[10].question_text;
  rows[10].options = [
    "Work done per unit positive charge from infinity",
    "Force per unit charge",
    "Energy per unit mass",
    "Charge per unit time",
  ];
  rows[10].correct_answer = rows[10].options[0];
};
const prompt = (request: any) =>
  request.messages.map((message: any) => message.content).join("\n");

describe("actual AI-profile physics generation/publication quality gates", () => {
  it("passes a healthy source-backed practice paper and carries earlier tasks into later parent batches", async () => {
    const f = await fixture(),
      r = await extract(false, "short_practice", "paper_1", f);
    expect(String(r.error ?? "")).toBe("");
    expect(r.exam.extraction_status).toBe("completed");
    expect(r.generationCalls).toHaveLength(2);
    expect(r.repairCalls).toHaveLength(0);
    expect(prompt(r.generationCalls[1])).toContain("electric potential");
    expect(prompt(r.generationCalls[1])).toContain("ALREADY WRITTEN");
    const published = await boundaryHandler(
      "publish-exam",
      r.drafts,
      "short_practice",
      "paper_1",
      f.snapshot,
    );
    const response = await published.run({ draftId: "exam" });
    expect(response.status, await response.clone().text()).toBe(200);
  });
  it.each(["definition", "graph"])(
    "refuses unresolved cross-parent %s repetitions after the bounded repair allowance",
    async (kind) => {
      const f = await fixture(),
        r = await extract(
          {
            mutate: (rows) => {
              if (kind === "definition") duplicateDefinition(rows);
              else {
                rows[11].question_text =
                  "Using the graph, determine the potential difference across the capacitor at 2 s.";
                rows[11].task = rows[11].question_text;
                rows[11].chart_data = structuredClone(graph);
                rows[11].options = ["4 V", "7 V", "12 V", "2 V"];
                rows[11].correct_answer = "4 V";
              }
            },
          },
          "short_practice",
          "paper_1",
          f,
        );
      expect(String(r.error)).toContain("repeated_concept");
      expect(r.exam.extraction_status).toBe("failed");
      expect(r.repairCalls.length).toBeGreaterThan(0);
      expect(r.repairCalls.length).toBeLessThanOrEqual(2);
    },
  );
  it("accepts a complete repeated-MCQ rewrite only with a new aligned key, retaining every unaffected row and figure", async () => {
    const f = await fixture(true),
      number = f.rows[10].question_number,
      rewritten = {
        question_number: number,
        context: "",
        task: "Which unit is equivalent to a joule?",
        question_text: "Which unit is equivalent to a joule?",
        correct_answer: "$N\\,m$",
        options: ["$N\\,m$", "$N/m$", "$N\\,s$", "$kg\\,m$"],
        diagram_config: null,
      };
    const healthy = await extract(false, "short_practice", "paper_1", f);
    const sibling = { ...f.rows[11], diagram_config: null };
    const r = await extract(
      {
        mutate: duplicateDefinition,
        repair: () => ({ parts: [rewritten, sibling] }),
      },
      "short_practice",
      "paper_1",
      f,
    );
    expect(String(r.error ?? "")).toBe("");
    expect(r.exam.extraction_status).toBe("completed");
    expect(r.repairCalls).toHaveLength(1);
    expect(prompt(r.repairCalls[0])).toContain("electric potential");
    expect(prompt(r.repairCalls[0])).toContain("11(b)");
    const target = r.drafts.find((row) => row.question_number === number)!;
    expect(target.question_text).toBe(rewritten.task);
    expect(coerceMcqOptions(target)).toEqual(rewritten.options);
    expect(
      canonicalMcqAnswer(target.correct_answer, coerceMcqOptions(target)),
    ).toBe(rewritten.options[0]);
    const publicAndKey = (row: any) =>
      Object.fromEntries(
        [
          "question_number",
          "root_question_number",
          "parent_question_number",
          "question_text",
          "correct_answer",
          "options",
          "diagram_config",
          "table_data",
          "marks",
          "topic_tag",
          "question_type",
        ].map((key) => [
          key,
          ["table_data", "diagram_config"].includes(key)
            ? (row[key] ?? null)
            : row[key],
        ]),
      );
    for (const before of healthy.drafts.filter(
      (row) => row.question_number !== number,
    ))
      expect(
        publicAndKey(
          r.drafts.find(
            (row) => row.question_number === before.question_number,
          ),
        ),
      ).toEqual(publicAndKey(before));
    expect(r.drafts.reduce((sum, row) => sum + row.marks, 0)).toBe(14);
    const publish = await boundaryHandler(
      "publish-exam",
      r.drafts,
      "short_practice",
      "paper_1",
      f.snapshot,
    );
    const response = await publish.run({ draftId: "exam" });
    expect(response.status, await response.clone().text()).toBe(200);
  });
  it("rejects a repeated-MCQ rewrite with a key that does not match its replacement options", async () => {
    const f = await fixture(),
      r = await extract(
        {
          mutate: duplicateDefinition,
          repair: () => ({
            parts: [
              {
                question_number: "11",
                task: "Which unit is equivalent to a joule?",
                question_text: "Which unit is equivalent to a joule?",
                correct_answer: "A tesla",
                options: [
                  "A newton metre",
                  "A newton per metre",
                  "A newton second",
                  "A kilogram metre",
                ],
                diagram_config: null,
              },
            ],
          }),
        },
        "short_practice",
        "paper_1",
        f,
      );
    expect(r.exam.extraction_status).toBe("failed");
    expect(String(r.error)).toContain("repeated_concept");
    expect(r.repairCalls.length).toBeLessThanOrEqual(2);
    const unchanged = r.drafts.find((row) => row.question_number === "11")!;
    expect(unchanged.question_text).toContain("defines electric potential");
    expect(unchanged.correct_answer).not.toContain("tesla");
  });
  it("rejects a decorative circuit substituted for a required graph in actual extraction and publication", async () => {
    const f = await fixture();
    const circuit = {
      type: "circuit",
      nodes: [{ id: "a" }, { id: "b" }],
      components: [
        { type: "battery", id: "source", from: "a", to: "b", value: "12 V" },
        { type: "capacitor", id: "C", from: "b", to: "a", value: "80 μF" },
      ],
    };
    const r = await extract(
      {
        mutate: (rows) => {
          rows[1].chart_data = circuit;
        },
      },
      "short_practice",
      "paper_1",
      f,
    );
    expect(r.exam.extraction_status).toBe("failed");
    expect(String(r.error)).toMatch(
      /invalid_resource|missing_required_resource/,
    );
    expect(r.repairCalls.length).toBeLessThanOrEqual(8);
    const stored = structuredClone(f.rows);
    stored[1].diagram_config = circuit as any;
    const publish = await boundaryHandler(
      "publish-exam",
      stored,
      "short_practice",
      "paper_1",
      f.snapshot,
    );
    const response = await publish.run({ draftId: "exam" });
    expect(response.status, await response.clone().text()).toBe(422);
    expect(await response.text()).toContain("topology");
    expect(
      publish.writes.some((write) => write.table === "exam_questions"),
    ).toBe(false);
  });
  it.each([
    {
      name: "uncertainty",
      task: "A specific heat capacity is 977 J kg^-1 K^-1 with a percentage uncertainty of 4.42%. Calculate its absolute uncertainty.",
      key: "Uncertainty = ±30 J kg^-1 K^-1.\nWorking:\nUncertainty = ±43 J kg^-1 K^-1.\nAccept ±40 to ±45.",
    },
    {
      name: "orbital mass",
      task: "An orbital measurement gives r cubed divided by T squared as 3.21 × 10^15 m^3 s^-2. Calculate the planet mass using G = 6.67 × 10^-11 N m^2 kg^-2.",
      key: "R = 2.91 × 10^15 m^3 s^-2; M = 1.72 × 10^27 kg.\nWorking:\nR = 3.21 × 10^15 m^3 s^-2; M = 1.90 × 10^27 kg.",
    },
  ])(
    "blocks an explicitly contradictory $name headline and working at independent publication",
    async ({ task, key }) => {
      const f = await fixture(),
        rows = structuredClone(f.rows);
      Object.assign(rows[0], {
        task,
        question_text: task,
        correct_answer: key,
      });
      const publish = await boundaryHandler(
        "publish-exam",
        rows,
        "short_practice",
        "paper_1",
        f.snapshot,
      );
      const response = await publish.run({ draftId: "exam" });
      expect(response.status, await response.clone().text()).toBe(422);
      expect(await response.text()).toContain("contradictory_mark_scheme");
      expect(
        publish.writes.some((write) => write.table === "exam_questions"),
      ).toBe(false);
    },
  );
  it("the independent publication handler rejects a saved duplicate even if extraction was marked completed", async () => {
    const f = await fixture(),
      rows = structuredClone(f.rows);
    duplicateDefinition(rows);
    const publish = await boundaryHandler(
      "publish-exam",
      rows,
      "short_practice",
      "paper_1",
      f.snapshot,
    );
    const response = await publish.run({ draftId: "exam" });
    expect(response.status, await response.clone().text()).toBe(422);
    expect(await response.text()).toContain("repeated_concept");
    expect(
      publish.writes.some((write) => write.table === "exam_questions"),
    ).toBe(false);
  });
});
