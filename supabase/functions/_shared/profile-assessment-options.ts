import type { TemplateIdentity } from "./profile-template.ts";

/** UI assessment identities only. These records do not approve a paper layout,
 * provide curriculum facts for AI drafting, or enable a course adapter. */
export type AssessmentKind = "Paper" | "Unit" | "Component" | "Assessment";
export interface AssessmentModuleOption {
  id: string;
  label: string;
  /** Printed question-paper section codes; the parent remains one assessment. */
  componentCodes?: readonly string[];
}
export interface AssessmentOption {
  id: string;
  label: string;
  kind: AssessmentKind;
  componentCode: string;
  aliases: readonly string[];
  requiredOptions?: readonly AssessmentModuleOption[];
}
export interface AssessmentMetadataCourse {
  id: string;
  label: string;
  subject: string;
  board: string;
  qualification: string;
  country: string;
  courseCode: string;
  specificationVersion: string;
  assessmentKind: AssessmentKind;
  papers: readonly AssessmentOption[];
  source: {
    url: string;
    title: string;
    version: string;
    accessedOn: string;
    physicalPages: readonly number[];
    checksum: string;
  };
}

const paper = (
  code: string,
  number: number,
  label = `Paper ${number}`,
): AssessmentOption => ({
  id: `paper_${number}`,
  label,
  kind: "Paper",
  componentCode: `${code}/${number}`,
  aliases: [`Paper ${number}`, `Paper${number}`, `${code}/${number}`],
});

const physicsPaper3: AssessmentOption = {
  ...paper("7408", 3),
  requiredOptions: [
    { id: "astrophysics", label: "Astrophysics", componentCodes: ["7408/3BA"] },
    {
      id: "medical_physics",
      label: "Medical physics",
      componentCodes: ["7408/3BB"],
    },
    {
      id: "engineering_physics",
      label: "Engineering physics",
      componentCodes: ["7408/3BC"],
    },
    {
      id: "turning_points",
      label: "Turning points in physics",
      componentCodes: ["7408/3BD"],
    },
    { id: "electronics", label: "Electronics", componentCodes: ["7408/3BE"] },
  ],
};

export const ASSESSMENT_METADATA_COURSES: readonly AssessmentMetadataCourse[] =
  [
    {
      id: "aqa_alevel_physics_7408",
      label: "AQA A-level Physics",
      subject: "Physics",
      board: "AQA",
      qualification: "A-level",
      country: "GB",
      courseCode: "7408",
      specificationVersion: "v1.4-july-2026",
      assessmentKind: "Paper",
      papers: [paper("7408", 1), paper("7408", 2), physicsPaper3],
      source: {
        url: "https://cdn.sanity.io/files/p28bar15/green/85944e7114a6a88e8a769b108949133ce30d3cba.pdf",
        title: "AQA AS and A-level Physics specification",
        version: "Version 1.4 July 2026",
        accessedOn: "2026-11-06",
        physicalPages: [1, 8, 9, 10],
        checksum:
          "c39f3a9e4b2fe06ed1160884334c3a6670e814ef23fb03dec8cd1707f2d5c907",
      },
    },
    {
      id: "aqa_alevel_chemistry_7405",
      label: "AQA A-level Chemistry",
      subject: "Chemistry",
      board: "AQA",
      qualification: "A-level",
      country: "GB",
      courseCode: "7405",
      specificationVersion: "v1.2-july-2026",
      assessmentKind: "Paper",
      papers: [
        paper("7405", 1, "Paper 1 — Inorganic and physical chemistry"),
        paper("7405", 2, "Paper 2 — Organic and physical chemistry"),
        paper("7405", 3),
      ],
      source: {
        url: "https://cdn.sanity.io/files/p28bar15/green/973606f23930d71231deed8180ee15c17d464b92.pdf",
        title: "AQA AS and A-level Chemistry specification",
        version: "Version 1.2 July 2026",
        accessedOn: "2026-11-06",
        physicalPages: [1, 10, 11],
        checksum:
          "7b62a52889214554ced73f6ebb4b23757bd66e3ada2d7103654bbb18a897a6f1",
      },
    },
  ];

/** Display aliases are deterministic and cannot cross country/board/qualification. */
export function assessmentMetadataCourses(identity: Partial<TemplateIdentity>) {
  return ASSESSMENT_METADATA_COURSES.filter(
    (course) =>
      ["GB", "UK", "United Kingdom"].includes(identity.country ?? "") &&
      course.subject.toLowerCase() === identity.subject?.trim().toLowerCase() &&
      course.board.toLowerCase() ===
        identity.organisation?.trim().toLowerCase() &&
      course.qualification === identity.qualification,
  );
}
