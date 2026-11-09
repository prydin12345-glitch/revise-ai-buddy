import { describe, expect, it } from "vitest";
import type { PaperPlan } from "../functions/_shared/paper-contract-types";
import type { ProfileEvidence } from "../functions/_shared/profile-evidence";
import { canonical } from "../functions/_shared/profile-template";
import {
  buildPhysicsPaperPlan,
  physicsPaperPlanPrompt,
  physicsPaperPlanIssues,
} from "../functions/_shared/physics-paper-plan";

// Original software fixture: the 10-mark layout is not an official blueprint.
const plan: PaperPlan = {
  courseId: "profile_template:7408", paperId: "7408/2", mode: "short_practice",
  contractVersion: 1, tier: "not_tiered", totalMarks: 10, durationMinutes: 15,
  parentCount: 2, partCount: 3, label: "Physics · original fixture",
  specificationVersion: "Version 1.4 July 2026",
  parts: [
    { partId: "f-recall", questionNumber: "1(a)", parentId: "1", topic: "Fields", marks: 2, responseType: "short_answer", demand: "AO1", resource: "none" },
    { partId: "f-reason", questionNumber: "1(b)", parentId: "1", topic: "Fields", marks: 4, responseType: "short_answer", demand: "AO3", resource: "none" },
    { partId: "t-apply", questionNumber: "2", parentId: "2", topic: "Thermal", marks: 4, responseType: "short_answer", demand: "AO2", resource: "none" },
  ],
};
function evidence(options: { practical?: string; weights?: string; authority?: "official_registered" | "owner_supplied" } = {}): ProfileEvidence {
  const practical = options.practical ?? null;
  const weights = options.weights ?? "This paper.\nFields: 60%; Thermal: 40%";
  const source = `Version 1.4 July 2026. Fields; Thermal.\n${weights}\n${practical ?? ""}`;
  return {
    version: 1,
    identity: {
      country: "GB", educationSystem: "UK", stage: "Secondary", qualification: "A-level", subject: "Physics",
      organisation: "AQA", course: "7408", component: "7408/2", specificationVersion: "Version 1.4 July 2026", tier: "not_tiered",
    },
    documents: [{ id: "fixture-source", checksum: "a".repeat(64), title: "Original fixture", url: null, version: "Version 1.4 July 2026", kind: "specification", authority: options.authority ?? "official_registered", retrievedOn: "2026-11-09", state: "active", applicableCohort: "Current fixture", locations: [{ id: "assessment", page: 1, section: "Assessment overview", text: source }] }],
    facts: { marks: null, durationMinutes: null, topics: ["Fields", "Thermal"], tier: null, calculator: "unknown", formats: [], selection: "unknown", mathsRequirement: null, practicalRequirement: practical },
    claims: [
      { field: "topics", documentId: "fixture-source", locationId: "assessment", quote: "Fields; Thermal", rule: "mandatory" },
      { field: "topicWeights", documentId: "fixture-source", locationId: "assessment", quote: weights, rule: "mandatory" },
      ...(practical ? [{ field: "practicalRequirement", documentId: "fixture-source", locationId: "assessment", quote: practical, rule: "mandatory" as const }] : []),
    ],
    conflicts: [], unresolved: [],
  };
}
const rows = () => [
  { id: "a", question_number: "1(a)", marks: 2, question_text: "Define electric potential at a point." },
  { id: "b", question_number: "1(b)", marks: 4, question_text: "Explain how measurements of voltage can be used to investigate the electric field, and evaluate one source of uncertainty." },
  { id: "c", question_number: "2", marks: 4, question_text: "Calculate the rms speed of molecules in an ideal gas at 350 K." },
];

describe("Physics generation plan without changing the reviewed contract", () => {
  it("retains every fixed topic, mark and identity and explicitly labels unsourced balancing as advisory", () => {
    const before = canonical(plan), sidecar = buildPhysicsPaperPlan(plan)!;
    expect(canonical(plan)).toBe(before);
    expect(sidecar.totalMarks).toBe(10);
    expect(sidecar.topics).toEqual([
      { topic: "Fields", marks: 6, plannedPercent: 60 },
      { topic: "Thermal", marks: 4, plannedPercent: 40 },
    ]);
    expect(sidecar.topicAllocationBasis).toBe("reviewed_layout_advisory");
    expect(sidecar.practical.status).toBe("unknown");
    expect(sidecar.practical.extendedParentId).toBeNull();
    expect(sidecar.parts.map(part => [part.partId, part.marks])).toEqual(plan.parts.map(part => [part.partId, part.marks]));
    expect(physicsPaperPlanPrompt(sidecar)).toContain("advisory");
    expect(physicsPaperPlanPrompt(sidecar)).toContain("do not fill the paper with definition recall");
  });
  it("uses complete literal per-paper topic percentages only from validated official evidence", () => {
    const source = evidence(), before = canonical(source), sidecar = buildPhysicsPaperPlan(plan, { evidence: source })!;
    expect(canonical(source)).toBe(before);
    expect(sidecar.topicAllocationBasis).toBe("official_source");
    expect(sidecar.topics.map(topic => topic.officialPercent)).toEqual([60, 40]);
    expect(sidecar.topics[0].sourceReferences).toEqual(["fixture-source:assessment"]);
  });
  it.each([
    { weights: "This paper.\nFields: 80%" },
    { weights: "This paper.\nFields: 60%; Thermal: 60%" },
    { weights: "Fields: 60%; Thermal: 40%" },
    { weights: "This paper.\nAO1: 60%; AO2: 40%" },
    { authority: "owner_supplied" as const },
  ])("does not promote incomplete, non-topic, unscoped or owner percentages to official weights: %j", options => {
    expect(buildPhysicsPaperPlan(plan, { evidence: evidence(options) })!.topicAllocationBasis).toBe("reviewed_layout_advisory");
  });
  it("exposes a source/layout difference without reallocating approved marks", () => {
    const sidecar = buildPhysicsPaperPlan(plan, { evidence: evidence({ weights: "This paper.\nFields: 40%; Thermal: 60%" }) })!;
    expect(sidecar.topics.map(topic => topic.marks)).toEqual([6, 4]);
    expect(sidecar.advisories.join(" ")).toContain("Preserve the approved marks");
  });
  it.each(["invalid-reference", "superseded", "different-paper", "conflicted"])("invalid/stale/different evidence cannot impose requirements: %s", kind => {
    const source = evidence({ practical: "Practical skills are assessed in this paper." });
    if (kind === "invalid-reference") source.claims[0].locationId = "missing";
    if (kind === "superseded") source.documents[0].state = "superseded";
    if (kind === "different-paper") source.identity.component = "7408/1";
    if (kind === "conflicted") source.conflicts.push("Unresolved practical scope");
    const sidecar = buildPhysicsPaperPlan(plan, { evidence: source })!;
    expect(sidecar.practical.status).toBe("unknown");
    expect(sidecar.topicAllocationBasis).toBe("reviewed_layout_advisory");
  });
  it("reserves one existing extended parent only when practical assessment applies to this paper", () => {
    const sidecar = buildPhysicsPaperPlan(plan, { evidence: evidence({ practical: "Practical skills are assessed in this paper." }) })!;
    expect(sidecar.practical.status).toBe("required");
    expect(sidecar.practical.extendedParentId).toBe("1");
    expect(sidecar.parts.filter(part => part.practical).map(part => part.questionNumber)).toEqual(["1(a)", "1(b)"]);
    expect(physicsPaperPlanIssues(rows(), plan, sidecar)).toEqual([]);
    const broken = rows();
    broken[1].question_text = "State Faraday's law.";
    expect(physicsPaperPlanIssues(broken, plan, sidecar).map(issue => issue.code)).toContain("plan_mismatch");
  });
  it("does not invent a per-paper extended quota from a qualification-wide practical minimum", () => {
    const sidecar = buildPhysicsPaperPlan(plan, { evidence: evidence({ practical: "At least 15% of marks across the qualification assess practical skills." }) })!;
    expect(sidecar.practical.status).toBe("advisory");
    expect(sidecar.practical.extendedParentId).toBeNull();
  });
  it.each(["No practical assessment is included in this paper.", "This paper does not assess practical skills."])("honours an explicit practical prohibition: %s", practical => {
    const authored = structuredClone(plan); authored.parts[1].practicalMarks = 2;
    const sidecar = buildPhysicsPaperPlan(authored, { evidence: evidence({ practical }) })!;
    expect(sidecar.practical.status).toBe("forbidden");
    expect(sidecar.practical.extendedParentId).toBeNull();
    expect(sidecar.parts.every(part => !part.practical)).toBe(true);
  });
  it("does not create an extended group when the fixed layout cannot support it", () => {
    const small = structuredClone(plan); small.parts[0].parentId = "3";
    const sidecar = buildPhysicsPaperPlan(small, { evidence: evidence({ practical: "Practical skills are assessed in this paper." }) })!;
    expect(sidecar.practical.status).toBe("required");
    expect(sidecar.practical.extendedParentId).toBeNull();
    expect(sidecar.advisories.join(" ")).toContain("cannot be added");
  });
  it("carries the whole-paper coverage but only the requested batch intents into its prompt", () => {
    const prompt = physicsPaperPlanPrompt(buildPhysicsPaperPlan(plan), [plan.parts[2]]);
    expect(prompt).toContain('"topic":"Fields","marks":6');
    expect(prompt).toContain('"partId":"t-apply"');
    expect(prompt).not.toContain('"partId":"f-reason"');
  });
  it("checks substantial explicit recall against reviewed application demands, allowing a deeper application", () => {
    const candidate = rows();
    candidate[2].question_text = "State two assumptions of the ideal gas model.";
    expect(physicsPaperPlanIssues(candidate, plan).map(issue => issue.partId)).toEqual(["c"]);
    candidate[2].question_text = "Explain which ideal-gas assumption is no longer valid at high pressure.";
    expect(physicsPaperPlanIssues(candidate, plan)).toEqual([]);
  });
  it("uses whole-paper semantic repetition and can defer it to the caller's existing check", () => {
    const candidate = rows(); candidate[2].marks = 1;
    candidate[2].question_text = "Which statement correctly defines electric potential at a point?";
    expect(physicsPaperPlanIssues(candidate, plan).some(issue => issue.code === "repeated_concept")).toBe(true);
    const sidecar = buildPhysicsPaperPlan(plan)!; sidecar.parts[2].marks = 1;
    expect(physicsPaperPlanIssues(candidate, plan, sidecar, { checkRepetition: false })).toEqual([]);
  });
  it("does not apply Physics guidance to another subject", () => {
    const other = { ...plan, label: "Biology" };
    expect(buildPhysicsPaperPlan(other)).toBeNull();
    expect(physicsPaperPlanPrompt(null)).toBe("");
  });
});
