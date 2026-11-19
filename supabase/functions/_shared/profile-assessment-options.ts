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
  subjectAliases?: readonly string[];
  board: string;
  qualification: string;
  country: string;
  courseCode: string;
  /** Explicit reviewed course fact; never infer this from qualification text. */
  tier: TemplateIdentity["tier"];
  /** Reviewed regulator wording linked to this exact qualification record. */
  tierSource?: {
    url: string;
    title: string;
    quote: string;
    checksum: string;
    accessedOn: string;
  };
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
      id: "pearson_alevel_business_9bs0",
      label: "Pearson Edexcel A-level Business",
      subject: "Business",
      subjectAliases: ["Business Studies"],
      board: "Pearson Edexcel",
      qualification: "A-level",
      country: "GB",
      courseCode: "9BS0",
      tier: "not_tiered",
      tierSource: {
        url: "https://www.gov.uk/government/news/publication-of-gcse-and-a-level-assessment-arrangements-for-2017",
        title: "Ofqual: Publication of GCSE and A level assessment arrangements for 2017",
        quote: "In line with current practice, all reformed AS and A levels will be untiered.",
        checksum: "f242ceb77d74d31d425543f320b4a9acc76d26438b2955137fcceb22792dc7aa",
        accessedOn: "2026-11-19",
      },
      specificationVersion: "Issue 1 September 2014",
      assessmentKind: "Paper",
      papers: [
        "Marketing, people and global businesses",
        "Business activities, decisions and strategy",
        "Investigating business in a competitive environment",
      ].map((title, index) => ({
        id: `paper_${index + 1}`,
        label: `Paper ${index + 1} — ${title}`,
        kind: "Paper" as const,
        componentCode: `9BS0/0${index + 1}`,
        aliases: [`Paper ${index + 1}`, `Paper${index + 1}`, title, `9BS0/0${index + 1}`],
      })),
      source: {
        url: "https://qualifications.pearson.com/content/dam/pdf/A%20Level/Business%20Studies/2015/specification-and-sample-assessment-materials/9781446914694-gce2015-a-bus-web.pdf",
        title: "Pearson Edexcel Level 3 Advanced GCE in Business specification",
        version: "Issue 1 September 2014",
        accessedOn: "2026-11-19",
        physicalPages: [1, 14, 15, 45, 46, 67],
        checksum: "8d66018d0a9d826cdb9729c78012d73f5e7ab32bd8946f9eb9fd501827c9829f",
      },
    },
    {
      id: "aqa_alevel_physics_7408",
      label: "AQA A-level Physics",
      subject: "Physics",
      board: "AQA",
      qualification: "A-level",
      country: "GB",
      courseCode: "7408",
      tier: "not_tiered",
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
      tier: "not_tiered",
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
      (!identity.stage || identity.stage === "Secondary") &&
      [course.subject, ...(course.subjectAliases ?? [])].some(subject => subject.toLowerCase() === identity.subject?.trim().toLowerCase()) &&
      course.board.toLowerCase() ===
        identity.organisation?.trim().toLowerCase().replace(/^edexcel$/, "pearson edexcel") &&
      course.qualification === identity.qualification,
  );
}
