import type { ProfileEvidence } from "./profile-evidence.ts";
import type { TemplateIdentity } from "./profile-template.ts";
import {
  isSpecificationVersionHint,
  specificationVersionsEquivalent,
} from "./profile-version-context.ts";

/** Reviewed instructions supplement an identified assessment, never approve a preset. */
export interface ReviewedAssessmentRules {
  id: string;
  version: number;
  documents: ProfileEvidence["documents"];
  facts: { selection: "all_compulsory"; calculator: "allowed" };
  claims: ProfileEvidence["claims"];
}

const sourceId = "aqa-7408-01-june2025-cover-reviewed";
const selection = "Answer all questions.";
const calculator =
  "You are expected to use a scientific calculator where appropriate.";

/**
 * The current public 2025 cover is corroborated by the 2024 cover. Exact URLs,
 * physical pages and both checksums are recorded in
 * docs/profile-builder/evidence-provenance-sources.md. Only instruction facts
 * are retained here; no questions, mark schemes, diagrams or datasets.
 */
const physicsPaper1: ReviewedAssessmentRules = {
  id: "aqa-7408-01-reviewed-cover-rules-v1",
  version: 1,
  documents: [
    {
      id: sourceId,
      checksum:
        "596abcf08ef3cebdafcc6ef377d461259809ebb470f36fc3f4af5d2c85848d73",
      title: "AQA A-level Physics Paper 1 (7408/1), June 2025 cover",
      url: "https://cdn.sanity.io/files/p28bar15/green/c2d052b11c09b8b207fdcb98da24ae0e81515b46.pdf",
      version: "June 2025 sitting",
      kind: "past_paper",
      authority: "official_registered",
      retrievedOn: "2026-11-06",
      state: "active",
      applicableCohort:
        "7408/1; reviewed cover instructions for the current Version 1.4 July 2026 qualification; compare future covers",
      locations: [
        {
          id: "paper1-all-questions",
          page: 1,
          section: "Instructions",
          text: selection,
        },
        {
          id: "paper1-calculator-use",
          page: 1,
          section: "Information",
          text: calculator,
        },
      ],
    },
  ],
  facts: { selection: "all_compulsory", calculator: "allowed" },
  claims: [
    {
      field: "selection",
      documentId: sourceId,
      locationId: "paper1-all-questions",
      quote: selection,
      rule: "mandatory",
    },
    {
      field: "calculator",
      documentId: sourceId,
      locationId: "paper1-calculator-use",
      quote: calculator,
      rule: "mandatory",
    },
  ],
};

const normalise = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase();
const assessmentAlias = (value: string) =>
  normalise(value)
    .replace(/^\((.*)\)$/s, "$1")
    .trim()
    .replace(/[\u2010-\u2015_]/g, " ")
    .replace(/\bpaper\s*(\d+)\b/g, "paper $1")
    .replace(/\s+/g, " ");

/**
 * Resolve only the exact reviewed qualification/component. Source evidence
 * still establishes identity and may contradict these instructions; callers
 * must reject a conflict instead of overwriting an uploaded fact. A date hint
 * does not supply or change a specification version.
 */
/**
 * Paper 2 covers (June 2025, corroborated by June 2024) carry the same two
 * instruction lines on physical page 1. Paper 3 has optional sections and is
 * deliberately excluded.
 */
const paper2SourceId = "aqa-7408-02-june2025-cover-reviewed";
const physicsPaper2: ReviewedAssessmentRules = {
  id: "aqa-7408-02-reviewed-cover-rules-v1",
  version: 1,
  documents: [
    {
      id: paper2SourceId,
      checksum:
        "40c45784bf6d9d8284d910541658dfdfb07572642ed4b173bbe6bcd9e64eadfd",
      title: "AQA A-level Physics Paper 2 (7408/2), June 2025 cover",
      url: "https://cdn.sanity.io/files/p28bar15/green/1c8e44133f577fe928eee7acf56fb667cecd11e1.pdf",
      version: "June 2025 sitting",
      kind: "past_paper",
      authority: "official_registered",
      retrievedOn: "2026-11-07",
      state: "active",
      applicableCohort:
        "7408/2; reviewed cover instructions for the current Version 1.4 July 2026 qualification; compare future covers",
      locations: [
        { id: "paper2-all-questions", page: 1, section: "Instructions", text: selection },
        { id: "paper2-calculator-use", page: 1, section: "Information", text: calculator },
      ],
    },
  ],
  facts: { selection: "all_compulsory", calculator: "allowed" },
  claims: [
    { field: "selection", documentId: paper2SourceId, locationId: "paper2-all-questions", quote: selection, rule: "mandatory" },
    { field: "calculator", documentId: paper2SourceId, locationId: "paper2-calculator-use", quote: calculator, rule: "mandatory" },
  ],
};

export function resolveReviewedAssessmentRules(
  identity: TemplateIdentity,
): ReviewedAssessmentRules | null {
  if (
    !["GB", "UK", "United Kingdom"].includes(identity.country.trim()) ||
    normalise(identity.organisation) !== "aqa" ||
    identity.qualification !== "A-level" ||
    normalise(identity.subject) !== "physics" ||
    !["7408", "aqa_alevel_physics_7408"].includes(normalise(identity.course)) ||
    (identity.tier !== null && identity.tier !== "not_tiered") ||
    (!isSpecificationVersionHint(identity.specificationVersion) &&
      !specificationVersionsEquivalent(
        identity.specificationVersion,
        "v1.4-july-2026",
      ))
  )
    return null;

  const component = assessmentAlias(identity.component);
  if (["paper 1", "7408/1"].includes(component))
    return structuredClone(physicsPaper1);
  if (["paper 2", "7408/2"].includes(component))
    return structuredClone(physicsPaper2);
  return null;
}
