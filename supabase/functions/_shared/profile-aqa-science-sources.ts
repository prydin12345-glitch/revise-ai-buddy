import type { ProfileEvidence } from "./profile-evidence.ts";
import {
  REVIEWED_ASSESSMENT_COURSES,
  reviewedAssessmentIdentity,
} from "./profile-assessment-catalogue.ts";

// Concise reviewed factual excerpts only. No paper questions, answers or diagrams.
// Physical PDF page numbers; retrieved from the current official AQA links on 2026-11-04.
const reviewed = {
  "8463": {
    subject: "Physics",
    specUrl:
      "https://cdn.sanity.io/files/p28bar15/green/e96b2cef624c0970b0f90d9678a438580aed0f65.pdf",
    version: "Version 1.1, 30 September 2019",
    checksum:
      "b0ece1dba5a0f5d5aa1d72dda48ec8846773fee4e00f8cebde98fbc554e36bb1",
    mathsPage: 85,
    practicalPage: 87,
    primaryTopics: [
      ["Energy", "Electricity", "Particle model of matter", "Atomic structure"],
      ["Forces", "Waves", "Magnetism and electromagnetism", "Space physics"],
    ],
    foundationTopics: [
      "Energy changes and transfers due to heating, mechanical and electrical work; energy conservation",
    ],
    overview: [
      "Paper 1: What's assessed Topics 1-4: Energy; Electricity; Particle model of matter; and Atomic structure. How it's assessed • Written exam: 1 hour 45 minutes • Foundation and Higher Tier • 100 marks • 50% of GCSE Questions • Multiple choice, structured, closed short answer and open response.",
      "Paper 2: What's assessed Topics 5-8: Forces; Waves; Magnetism and electromagnetism; and Space physics. Questions in paper 2 may draw on an understanding of energy changes and transfers due to heating, mechanical and electrical work and the concept of energy conservation from Energy (page 17) and Electricity (page 23). How it's assessed • Written exam: 1 hour 45 minutes • Foundation and Higher Tier • 100 marks • 50% of GCSE Questions • Multiple choice, structured, closed short answer and open response.",
    ],
    tierRules:
      "Content that is only applicable to Higher Tier is indicated by (HT only) either next to the topic heading where it applies to the whole topic or immediately preceding each paragraph or bullet point as applicable.",
    maths:
      "Questions will target maths skills at a level of demand appropriate to each subject.",
    practical:
      "These questions will count for at least 15% of the overall marks for the qualification.",
    paper2Foundations:
      "Questions in paper 2 may draw on an understanding of energy changes and transfers due to heating, mechanical and electrical work and the concept of energy conservation from Energy (page 17) and Electricity (page 23).",
    covers: {
      "1F": {
        url: "https://cdn.sanity.io/files/p28bar15/green/b71e7d990f82c61022434f38b0a663ba4d651af7.pdf",
        checksum:
          "a0f9a1fb700236bd3cdc5be00eb2c9d1286b041a0a14cfa7660564e40644b9d5",
      },
      "2F": {
        url: "https://cdn.sanity.io/files/p28bar15/green/ca4b44fab62012a77816f6ba1c0c06010bc9621d.pdf",
        checksum:
          "0c82950d9148721ab5f455e403536f4667c6dc496ad252cf0f6d960bb7809c6c",
      },
      "1H": {
        url: "https://cdn.sanity.io/files/p28bar15/green/c08bff2dd77ec7384f09d3a6db77a4bde9435176.pdf",
        checksum:
          "f78d541823e17988a7dc0bd1401121214eefa950af056837aa36dca9dd4c989a",
      },
      "2H": {
        url: "https://cdn.sanity.io/files/p28bar15/green/c7fea85a8a1fbd9c801e6f075bf3919a721d4d82.pdf",
        checksum:
          "6036ed41c9b5e22f9f17333aa50f28f82f357b0bd77ae7f7c106b2b2c7c941a8",
      },
    },
  },
  "8462": {
    subject: "Chemistry",
    specUrl:
      "https://cdn.sanity.io/files/p28bar15/green/4b1d5e819ad08a3b6d2ee6d8ed3514487c2255b4.pdf",
    version: "Version 1.2, 16 January 2026",
    checksum:
      "e73a5320c62b589c691823cd235a5790c106c246f12762b72b94e06b1bf6ca1c",
    mathsPage: 99,
    practicalPage: 101,
    primaryTopics: [
      [
        "Atomic structure and the periodic table",
        "Bonding, structure, and the properties of matter",
        "Quantitative chemistry",
        "Chemical changes",
        "Energy changes",
      ],
      [
        "The rate and extent of chemical change",
        "Organic chemistry",
        "Chemical analysis",
        "Chemistry of the atmosphere",
        "Using resources",
      ],
    ],
    foundationTopics: [
      "Atomic structure and the periodic table",
      "Bonding, structure, and the properties of matter",
      "Quantitative chemistry",
    ],
    overview: [
      "Paper 1: What's assessed Topics 1–5: Atomic structure and the periodic table; Bonding, structure, and the properties of matter; Quantitative chemistry, Chemical changes; and Energy changes. How it's assessed • Written exam: 1 hour 45 minutes • Foundation and Higher Tier • 100 marks • 50% of GCSE Questions Multiple choice, structured, closed short answer and open response.",
      "Paper 2: What's assessed Topics 6–10: The rate and extent of chemical change; Organic chemistry; Chemical analysis, Chemistry of the atmosphere; and Using resources. Questions in Paper 2 may draw on fundamental concepts and principles from sections 4.1 to 4.3. How it's assessed • Written exam: 1 hour 45 minutes • Foundation and Higher Tier • 100 marks • 50% of GCSE Questions Multiple choice, structured, closed short answer and open response.",
    ],
    tierRules:
      "Content that is only applicable to Higher Tier is indicated by (HT only) either next to the topic heading where it applies to the whole topic or immediately preceding each paragraph or bullet point as applicable.",
    maths:
      "Questions will target maths skills at a level of demand appropriate to each subject.",
    practical:
      "These questions will count for at least 15% of the overall marks for the qualification.",
    paper2Foundations:
      "Questions in Paper 2 may draw on fundamental concepts and principles from sections 4.1 to 4.3.",
    covers: {
      "2H": {
        url: "https://cdn.sanity.io/files/p28bar15/green/ee1dfa784f0721caeee2b5f2e317ed68491a4baa.pdf",
        checksum:
          "f19ff74a8c4c84b26c831ac09c52bb4a16b94301a2b3a6947eb5a543bd3137ea",
      },
      "1F": {
        url: "https://cdn.sanity.io/files/p28bar15/green/bbf4010e2228c480edeb21fc13c957b5a35ea6dd.pdf",
        checksum:
          "31b9031fd7d5240d553174a20fd8efd87b092a4c3a5135bc6aa52cb2c31d1007",
      },
      "1H": {
        url: "https://cdn.sanity.io/files/p28bar15/green/60cf3dec8a26a4d774305ddc558cec5fcf5bb264.pdf",
        checksum:
          "0447fba372b8fe061f72d84924ae2eb5fa4acbaa38b130cac82d577e8c5763bd",
      },
      "2F": {
        url: "https://cdn.sanity.io/files/p28bar15/green/24f66d775f51a60954ca49eb85f7c281cd87d722.pdf",
        checksum:
          "c98cb8034fd95964ebcc65e80364da3b24ed1fcdd7e0f5ed267eff25e35d7060",
      },
    },
  },
} as const;

export const AQA_SCIENCE_SOURCES = REVIEWED_ASSESSMENT_COURSES.flatMap(
  (course) => {
    const source = reviewed[course.courseCode as keyof typeof reviewed];
    return course.papers.flatMap((paper, paperIndex) =>
      course.tiers.map((tier) => {
        const identity = reviewedAssessmentIdentity(course.id, paper.id, tier)!;
        const specId = `aqa-${course.courseCode}-spec-${course.specificationVersion}`;
        const paperId = `aqa-${course.courseCode}-${paperIndex + 1}${tier === "foundation" ? "f" : "h"}-june2025`;
        const cover =
          source.covers[
            `${paperIndex + 1}${tier === "foundation" ? "F" : "H"}` as keyof typeof source.covers
          ];
        const claim = (
          field: string,
          locationId: string,
          quote: string,
          documentId = specId,
        ): ProfileEvidence["claims"][number] => ({
          field,
          documentId,
          locationId,
          quote,
          rule: "mandatory",
        });
        const evidence: ProfileEvidence = {
          version: 1,
          identity,
          documents: [
            {
              id: specId,
              checksum: source.checksum,
              title: `AQA GCSE ${course.subject} ${course.courseCode} specification`,
              url: source.specUrl,
              version: source.version,
              kind: "specification",
              authority: "official_registered",
              retrievedOn: "2026-11-04",
              state: "active",
              applicableCohort: `${course.courseCode}; GCSE exams 2018 onwards; reviewed current linked specification`,
              locations: [
                {
                  id: "assessment",
                  page: paperIndex + 9,
                  section: `2.2 Assessments / Paper ${paperIndex + 1}`,
                  text: source.overview[paperIndex],
                },
                {
                  id: "tier-rules",
                  page: 17,
                  section: "4 Subject content / Higher Tier content",
                  text: source.tierRules,
                },
                {
                  id: "mathematics",
                  page: source.mathsPage,
                  section: "7 Mathematical requirements",
                  text: source.maths,
                },
                {
                  id: "practical",
                  page: source.practicalPage,
                  section: "8 Practical assessment",
                  text: source.practical,
                },
                ...(paperIndex === 1
                  ? [
                      {
                        id: "shared-foundations",
                        page: 10,
                        section: "2.2 Assessments / Paper 2 shared foundations",
                        text: source.paper2Foundations,
                      },
                    ]
                  : []),
              ],
            },
            {
              id: paperId,
              checksum: cover.checksum,
              title: `AQA GCSE ${course.subject} Paper ${paperIndex + 1} ${tier === "foundation" ? "Foundation" : "Higher"}, June 2025 cover`,
              url: cover.url,
              version: "June 2025; published 10 July 2026",
              kind: "past_paper",
              authority: "official_registered",
              retrievedOn: "2026-11-04",
              state: "active",
              applicableCohort:
                "Observed June 2025 assessment instructions; future covers need review",
              locations: [
                {
                  id: "identity",
                  page: 1,
                  section: "Component and tier",
                  text: `${identity.component}; ${tier === "foundation" ? "Foundation" : "Higher"} Tier; Paper ${paperIndex + 1}`,
                },
                {
                  id: "instructions",
                  page: 1,
                  section: "Materials, Instructions and Information",
                  text: "a scientific calculator; Answer all questions in the spaces provided.; The maximum mark for this paper is 100.; Time allowed: 1 hour 45 minutes",
                },
              ],
            },
          ],
          facts: {
            marks: 100,
            durationMinutes: 105,
            topics: [
              ...source.primaryTopics[paperIndex],
              ...(paperIndex === 1 ? source.foundationTopics : []),
            ],
            tier,
            calculator: "allowed",
            formats: ["mcq_single", "short_answer", "long_form"],
            selection: "all_compulsory",
            mathsRequirement: source.maths,
            practicalRequirement: source.practical,
          },
          claims: [
            claim("marks", "assessment", "100 marks"),
            claim("durationMinutes", "assessment", "1 hour 45 minutes"),
            claim("topics", "assessment", "What's assessed"),
            claim(
              "formats",
              "assessment",
              "Multiple choice, structured, closed short answer and open response.",
            ),
            claim(
              "tier",
              "identity",
              `${tier === "foundation" ? "Foundation" : "Higher"} Tier`,
              paperId,
            ),
            claim(
              "calculator",
              "instructions",
              "a scientific calculator",
              paperId,
            ),
            claim("selection", "instructions", "Answer all questions", paperId),
            claim("mathsRequirement", "mathematics", "maths skills"),
            claim(
              "practicalRequirement",
              "practical",
              "at least 15% of the overall marks for the qualification",
            ),
            ...(paperIndex === 1
              ? [
                  claim(
                    "topics",
                    "shared-foundations",
                    course.courseCode === "8462"
                      ? "sections 4.1 to 4.3"
                      : "energy changes and transfers",
                  ),
                ]
              : []),
          ],
          unresolved: [
            "The question count, mark distribution and parent-group arrangement are Examly development choices, not a fixed official layout.",
            "This is separate GCSE science, not Combined Science. Higher-Tier-only specification content must be excluded from Foundation questions.",
            "The practical minimum applies across the qualification, not as an exact quota for this paper.",
            ...(paperIndex === 1
              ? [
                  course.courseCode === "8462"
                    ? "Paper 2 can draw on the fundamental concepts in sections 4.1–4.3; this does not add Paper 1 Chemical changes or Energy changes as standalone Paper 2 topics."
                    : "Paper 2 shared Energy/Electricity scope is limited to energy changes and transfers through heating and mechanical/electrical work, and energy conservation.",
                ]
              : []),
            ...(course.courseCode === "8463"
              ? [
                  "The observed 2025 cover supplies a Physics Equations Sheet. A generated calculation must provide the formula information it needs; this evidence pack does not include or reproduce that sheet.",
                ]
              : []),
            ...(course.courseCode === "8462"
              ? [
                  "The observed 2025 cover supplies a periodic table. A generated question requiring element/atomic data must supply that information within supported resources; do not refer to a missing sheet.",
                ]
              : []),
            "This evidence pack describes assessment identity and structure. It does not approve an Examly layout or certify generated questions; reviewed diagram/passage assets still require the shared supported adapters.",
          ],
          conflicts: [],
        };
        return {
          id: paper.sources[tier],
          organisation: course.organisation,
          approvedDomain: "cdn.sanity.io",
          evidence,
          extractionVersion: 1,
        };
      }),
    );
  },
);
