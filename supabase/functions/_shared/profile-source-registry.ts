import {
  validateEvidence,
  validateSourceUrl,
  type ProfileEvidence,
} from "./profile-evidence.ts";
import {
  EDEXCEL_B_SPEC_URL,
  EDEXCEL_B_P1_TOPICS,
} from "./edexcel-alevel-biology-b-scope.ts";
// Reviewed official-document facts; no questions/images and no runtime arbitrary fetch.
const spec = "pearson-9bi0-issue4",
  paper = "pearson-9bi0-01-june2025";
export const PEARSON_B_P1_EVIDENCE: ProfileEvidence = {
  version: 1,
  identity: {
    country: "GB",
    educationSystem: "England",
    stage: "Secondary",
    qualification: "A-level",
    subject: "Biology",
    organisation: "Pearson Edexcel",
    course: "9BI0",
    component: "9BI0/01",
    specificationVersion: "issue_4_november_2018",
    tier: "not_tiered",
  },
  documents: [
    {
      id: spec,
      checksum:
        "79808a9caf407092b8b870b8876a81f809ad3a3f1b588f17b2151d5416c54387",
      title: "Pearson Edexcel Biology B specification, Issue 4",
      url: EDEXCEL_B_SPEC_URL,
      version: "Issue 4 November 2018",
      kind: "specification",
      authority: "official_registered",
      retrievedOn: "2026-10-11",
      state: "active",
      applicableCohort:
        "9BI0, first teaching September 2015; current linked Issue 4",
      locations: [
        {
          id: "overview",
          page: 13,
          section: "Qualification at a glance / Paper 1",
          text: "9BI0/01; 90 marks; 1 hour 45 minutes. Paper 1 assesses Topics 1 to 7. Multiple-choice, short open, open-response, calculations and extended writing are permitted.",
        },
        {
          id: "topic-scope",
          page: 13,
          section: "Paper 1 content",
          text: EDEXCEL_B_P1_TOPICS.join("; "),
        },
        {
          id: "maths",
          page: 13,
          section: "Qualification mathematical requirement",
          text: "Mathematics at Level 2 or above: minimum 10% of marks across the three papers, not a fixed Paper 1 percentage.",
        },
        {
          id: "practical",
          page: 13,
          section: "Qualification overview",
          text: "Students are expected to carry out the 16 core practical experiments.",
        },
      ],
    },
    {
      id: paper,
      checksum:
        "b6b5efb4d1c973fdc16a8c540f958b8fc71fc919b98d5772aec9fcadfe00c615",
      title: "Official June 2025 Biology B Paper 1 cover",
      url: "https://qualifications.pearson.com/content/dam/pdf/A-Level/Biology/2015/Exam-materials/9bi0-01-que-20250606.pdf",
      version: "June 2025 sitting",
      kind: "past_paper",
      authority: "official_registered",
      retrievedOn: "2026-10-11",
      state: "active",
      applicableCohort: "2025 sitting; compare future covers",
      locations: [
        {
          id: "instructions",
          page: 1,
          section: "Cover instructions",
          text: "Answer all questions. A calculator is required. 90 marks; 1 hour 45 minutes.",
        },
      ],
    },
  ],
  facts: {
    marks: 90,
    durationMinutes: 105,
    topics: [...EDEXCEL_B_P1_TOPICS],
    tier: "not_tiered",
    calculator: "allowed",
    formats: ["mcq_single", "short_answer", "long_form"],
    selection: "all_compulsory",
    mathsRequirement:
      "Across the qualification, at least 10% mathematics at Level 2 or above; no exact Paper 1 quota is claimed.",
    practicalRequirement:
      "16 core practicals support the qualification; this builder does not award the practical endorsement.",
  },
  claims: [
    {
      field: "marks",
      documentId: spec,
      locationId: "overview",
      quote: "90 marks",
      rule: "mandatory",
    },
    {
      field: "durationMinutes",
      documentId: spec,
      locationId: "overview",
      quote: "1 hour 45 minutes",
      rule: "mandatory",
    },
    {
      field: "topics",
      documentId: spec,
      locationId: "topic-scope",
      quote: "Biological Molecules",
      rule: "mandatory",
    },
    {
      field: "tier",
      documentId: spec,
      locationId: "overview",
      quote: "9BI0/01",
      rule: "mandatory",
    },
    {
      field: "formats",
      documentId: spec,
      locationId: "overview",
      quote: "Multiple-choice",
      rule: "mandatory",
    },
    {
      field: "mathsRequirement",
      documentId: spec,
      locationId: "maths",
      quote: "Mathematics",
      rule: "mandatory",
    },
    {
      field: "practicalRequirement",
      documentId: spec,
      locationId: "practical",
      quote: "16 core practical",
      rule: "mandatory",
    },
    {
      field: "calculator",
      documentId: paper,
      locationId: "instructions",
      quote: "calculator",
      rule: "mandatory",
    },
    {
      field: "selection",
      documentId: paper,
      locationId: "instructions",
      quote: "Answer all questions",
      rule: "mandatory",
    },
  ],
  unresolved: [
    "Question counts and parent-group distributions are Examly design choices, not official fixed rules.",
    "Tier is untiered in the reviewed 9BI0 course catalogue. Future official source editions require repository review.",
    "Sample-material retrieval exceeded the research size limit; no additional mandatory layout is inferred.",
  ],
  conflicts: [],
};
export const SOURCE_REGISTRY = [
  {
    id: "pearson-9bi0-01-issue4",
    organisation: "Pearson Edexcel",
    approvedDomain: "qualifications.pearson.com",
    evidence: PEARSON_B_P1_EVIDENCE,
    extractionVersion: 1,
  },
] as const;
export function resolveRegisteredSource(
  id?: string,
  url?: string,
): ProfileEvidence {
  if (url) validateSourceUrl(url);
  const byId = id ? SOURCE_REGISTRY.find((s) => s.id === id) : undefined;
  const byUrl = url
    ? SOURCE_REGISTRY.find((s) =>
        s.evidence.documents.some((d) => d.url === url),
      )
    : undefined;
  if (
    (id && !byId) ||
    (url && !byUrl) ||
    (byId && byUrl && byId.id !== byUrl.id)
  )
    throw Error(
      "This source is not registered. Upload a readable syllabus or request repository review; arbitrary URL fetching is disabled.",
    );
  const entry = byId ?? byUrl;
  if (!entry) throw Error("Select an exact registered source.");
  return validateEvidence(structuredClone(entry.evidence));
}
