// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  expandSectionTopics,
  reconcileTopics,
} from "../functions/_shared/profile-topic-sections";
import { sourceTextIncludes } from "../functions/_shared/source-text-match";
import { ownerEvidence } from "./profile-builder-fixtures";

// Adjacent qualification columns lose their associations in extracted text.
const ambiguousOverview = [
  "AS 7407 | A-level 7408",
  "Assessment overview",
  "Paper 1 | Paper 1",
  "7407/1 | 7408/1",
  "70 marks | 85 marks",
  "90 minutes | 120 minutes",
  "AS-only topics | A-level topics",
].join("\n");

async function selectedPaper(topics: string[]) {
  const evidence = await ownerEvidence();
  evidence.identity = {
    ...evidence.identity,
    qualification: "A-level",
    subject: "Physics",
    organisation: "AQA",
    course: "7408",
    component: "7408/1",
  };
  evidence.facts.topics = topics;
  const passage = "A-level\nPaper 1\nWhat's assessed\nSections 1 - 2";
  evidence.documents[0].locations = [
    { id: "assessment", page: 9, section: "Assessment", text: passage },
  ];
  evidence.claims = [{
    field: "topics",
    documentId: evidence.documents[0].id,
    locationId: "assessment",
    quote: "Sections 1 - 2",
    rule: "mandatory",
  }];
  return { evidence, passage };
}

describe("topic recovery preserves the selected paper scope", () => {
  it("does not rescue a topic merely because another paper covers it", async () => {
    const { evidence, passage } = await selectedPaper([
      "Measurements and their errors", "Particles and radiation", "Nuclear physics",
    ]);
    const documents = [{
      id: evidence.documents[0].id,
      pages: [
        { page: 9, text: passage },
        { page: 11, text: "A-level\n3.1 Measurements and their errors\n3.2 Particles and radiation\n3.8 Nuclear physics" },
      ],
    }];
    const result = reconcileTopics(evidence, documents, { qualification: "A-level", course: "7408" });
    expect(expandSectionTopics(result.evidence, documents).facts.topics).toEqual([
      "Measurements and their errors", "Particles and radiation",
    ]);
    expect(result.dropped).toEqual(["Nuclear physics"]);
    expect(result.evidence.claims.some((claim) => claim.quote === "Nuclear physics")).toBe(false);
  });

  it("keeps unresolved literal pointers instead of replacing partial scope with one heading", async () => {
    const { evidence, passage } = await selectedPaper(["Sections 1 - 2", "Measurements and their errors"]);
    const documents = [{
      id: evidence.documents[0].id,
      pages: [{ page: 9, text: passage }, { page: 11, text: "A-level\n3.1 Measurements and their errors" }],
    }];
    const result = reconcileTopics(evidence, documents, { qualification: "A-level", course: "7408" });
    expect(result.evidence.facts.topics).toEqual(["Sections 1 - 2"]);
    expect(result.dropped).toEqual(["Measurements and their errors"]);
  });

  it("does not turn an AS-only heading into an A-level paper topic", async () => {
    const { evidence, passage } = await selectedPaper(["AS-only measurements"]);
    const qualifiedPassage = passage.replace("A-level", "A-level Physics (7408)");
    evidence.documents[0].locations[0].text = qualifiedPassage;
    evidence.claims[0].quote = "Sections 1 - 2";
    const documents = [{
      id: evidence.documents[0].id,
      pages: [
        { page: 5, text: "AS Physics (7407)\n3.1 AS-only measurements\n3.2 AS-only particles" },
        { page: 9, text: qualifiedPassage },
        { page: 11, text: "A-level Physics (7408)\n3.1 Measurements and their errors\n3.2 Particles and radiation" },
      ],
    }];
    const result = reconcileTopics(evidence, documents, { qualification: "A-level", course: "7408" });
    expect(expandSectionTopics(result.evidence, documents).facts.topics).toEqual(["Sections 1 - 2"]);
    expect(result.dropped).toEqual(["AS-only measurements"]);
  });

  it("a named subset cannot truncate the whole cited paper scope", async () => {
    const { evidence, passage } = await selectedPaper(["Measurements and their errors"]);
    const documents = [{
      id: evidence.documents[0].id,
      pages: [
        { page: 9, text: passage },
        { page: 11, text: "A-level\n3.1 Measurements and their errors 11\n3.2 Particles and radiation 12" },
      ],
    }];
    const result = reconcileTopics(evidence, documents, { qualification: "A-level", course: "7408" });
    expect(result.evidence.facts.topics).toContain("Sections 1 - 2");
    expect(expandSectionTopics(result.evidence, documents).facts.topics).toEqual([
      "Measurements and their errors", "Particles and radiation",
    ]);
  });

  it("a literal heading quote cannot broaden a paper's governing section range", async () => {
    const { evidence, passage } = await selectedPaper(["Measurements and their errors", "Nuclear physics"]);
    evidence.documents[0].locations.push({
      id: "unselected", page: 60, section: "Content", text: "3.8 Nuclear physics",
    });
    evidence.claims.push({
      field: "topics", documentId: evidence.documents[0].id,
      locationId: "unselected", quote: "Nuclear physics", rule: "mandatory",
    });
    const documents = [{
      id: evidence.documents[0].id,
      pages: [
        { page: 9, text: passage },
        { page: 11, text: "A-level\n3.1 Measurements and their errors\n3.2 Particles and radiation\n3.8 Nuclear physics" },
      ],
    }];
    const result = reconcileTopics(evidence, documents, { qualification: "A-level", course: "7408" });
    expect(expandSectionTopics(result.evidence, documents).facts.topics).toEqual([
      "Measurements and their errors", "Particles and radiation",
    ]);
    expect(result.dropped).toContain("Nuclear physics");
  });

  it("a quoted prefix cannot truncate the complete scope in its cited assessment passage", async () => {
    const { evidence, passage } = await selectedPaper(["Measurements and their errors"]);
    evidence.claims[0].quote = "Sections 1";
    const documents = [{
      id: evidence.documents[0].id,
      pages: [
        { page: 9, text: passage },
        { page: 11, text: "A-level\n3.1 Measurements and their errors\n3.2 Particles and radiation" },
      ],
    }];
    const result = reconcileTopics(evidence, documents, { qualification: "A-level", course: "7408" });
    expect(result.evidence.facts.topics).toContain("Sections 1 - 2");
    expect(expandSectionTopics(result.evidence, documents).facts.topics).toEqual([
      "Measurements and their errors", "Particles and radiation",
    ]);
  });

  it("keeps complementary pointers in the assessed-content block when the quote names only one", async () => {
    const { evidence } = await selectedPaper(["Measurements and their errors"]);
    const passage = "A-level\nPaper 1\nWhat's assessed\nSection 1\nSection 2\nInstructions\nSee Section 8 for calculator guidance";
    evidence.documents[0].locations[0].text = passage;
    evidence.claims[0].quote = "Section 1";
    const documents = [{ id: evidence.documents[0].id, pages: [
      { page: 9, text: passage },
      { page: 11, text: "A-level\n3.1 Measurements and their errors\n3.2 Particles and radiation\n3.8 Nuclear physics" },
    ] }];
    const result = reconcileTopics(evidence, documents, { qualification: "A-level", course: "7408" });
    expect(expandSectionTopics(result.evidence, documents).facts.topics).toEqual([
      "Measurements and their errors", "Particles and radiation",
    ]);
  });

  it("an observed scope cannot be promoted into mandatory topic-heading evidence", async () => {
    const { evidence, passage } = await selectedPaper(["Measurements and their errors"]);
    evidence.claims[0].rule = "observed";
    const result = reconcileTopics(evidence, [{
      id: evidence.documents[0].id,
      pages: [
        { page: 9, text: passage },
        { page: 11, text: "A-level\n3.1 Measurements and their errors\n3.2 Particles and radiation" },
      ],
    }], { qualification: "A-level", course: "7408" });
    expect(result.evidence.facts.topics).toEqual([]);
    expect(result.evidence.claims.every((claim) => claim.rule === "observed")).toBe(true);
  });

  it("different mandatory scopes stay unresolved instead of becoming an inferred union", async () => {
    const { evidence, passage } = await selectedPaper(["Measurements and their errors", "Nuclear physics"]);
    evidence.documents[0].locations.push({
      id: "other-paper", page: 10, section: "Assessment", text: "Paper 2\nSections 7 - 8\nNuclear physics",
    });
    evidence.claims.push({
      field: "topics", documentId: evidence.documents[0].id,
      locationId: "other-paper", quote: "Sections 7 - 8", rule: "mandatory",
    });
    const result = reconcileTopics(evidence, [{
      id: evidence.documents[0].id,
      pages: [{ page: 9, text: passage }],
    }], { qualification: "A-level", course: "7408" });
    expect(result.evidence.conflicts.join(" ")).toMatch(/different mandatory section ranges/i);
    expect(result.evidence.facts.topics).toContain("Sections 1 - 2");
  });

  it("expands complementary cited ranges from the same selected-assessment passage", async () => {
    const { evidence } = await selectedPaper(["Measurements and their errors"]);
    const passage = "A-level\nPaper 1\nWhat's assessed\nSection 1\nSection 2";
    evidence.documents[0].locations[0].text = passage;
    evidence.claims[0].quote = "Section 1";
    evidence.claims.push({ ...evidence.claims[0], quote: "Section 2" });
    const documents = [{
      id: evidence.documents[0].id,
      pages: [
        { page: 9, text: passage },
        { page: 11, text: "A-level\n3.1 Measurements and their errors\n3.2 Particles and radiation" },
      ],
    }];
    const result = reconcileTopics(evidence, documents, { qualification: "A-level", course: "7408" });
    expect(result.evidence.conflicts).toEqual([]);
    expect(expandSectionTopics(result.evidence, documents).facts.topics).toEqual([
      "Measurements and their errors", "Particles and radiation",
    ]);
  });

  it("uses qualified selected heading and assessment pages despite an unrelated ambiguous table", async () => {
    const { evidence } = await selectedPaper(["Measurements and their errors"]);
    const passage = "A-level Physics (7408)\nPaper 1\nWhat's assessed\nSections 1 - 2";
    evidence.documents[0].locations[0] = { id: "assessment", page: 90, section: "Assessment", text: passage };
    const documents = [{
      id: evidence.documents[0].id,
      pages: [
        { page: 2, text: ambiguousOverview },
        { page: 30, text: "A-level Physics (7408)\n3.1 Measurements and their errors\n3.2 Particles and radiation" },
        { page: 90, text: passage },
      ],
    }];
    const sourcePages = { [evidence.documents[0].id]: [30, 90] };
    const result = reconcileTopics(evidence, documents, {
      qualification: "A-level", course: "7408", sourcePages,
    });
    expect(expandSectionTopics(result.evidence, documents, sourcePages).facts.topics).toEqual([
      "Measurements and their errors", "Particles and radiation",
    ]);
    expect(expandSectionTopics(result.evidence, documents).facts.topics).toContain("Sections 1 - 2");
  });

  it("keeps a pointer unresolved when a multi-upload follow-up selects only another document", async () => {
    const { evidence, passage } = await selectedPaper(["Sections 1 - 2"]);
    const documentId = evidence.documents[0].id;
    const documents = [
      {
        id: documentId,
        pages: [
          { page: 9, text: passage },
          { page: 11, text: "A-level\n3.1 Measurements and their errors\n3.2 Particles and radiation" },
        ],
      },
      {
        id: "other-upload",
        pages: [{ page: 1, text: "A-level Physics (7408)\nPaper 1\nAnswer all questions." }],
      },
    ];
    const sourcePages = { [documentId]: [], "other-upload": [1] };
    const result = reconcileTopics(evidence, documents, {
      qualification: "A-level", course: "7408", sourcePages,
    });
    expect(expandSectionTopics(result.evidence, documents, sourcePages).facts.topics)
      .toEqual(["Sections 1 - 2"]);
    expect(result.evidence.conflicts).toEqual([]);
    expect(expandSectionTopics(evidence, documents).facts.topics).toEqual([
      "Measurements and their errors", "Particles and radiation",
    ]);
  });

  it("selected pages cannot turn AS headings into A-level topic evidence", async () => {
    const { evidence } = await selectedPaper(["Measurements and their errors"]);
    const passage = "A-level Physics (7408)\nPaper 1\nWhat's assessed\nSections 1 - 2";
    evidence.documents[0].locations[0] = { id: "assessment", page: 90, section: "Assessment", text: passage };
    const documents = [{
      id: evidence.documents[0].id,
      pages: [
        { page: 2, text: ambiguousOverview },
        { page: 30, text: "AS Physics (7407)\n3.1 Measurements and their errors\n3.2 Particles and radiation" },
        { page: 90, text: passage },
      ],
    }];
    const sourcePages = { [evidence.documents[0].id]: [30, 90] };
    const result = reconcileTopics(evidence, documents, {
      qualification: "A-level", course: "7408", sourcePages,
    });
    expect(expandSectionTopics(result.evidence, documents, sourcePages).facts.topics).toEqual(["Sections 1 - 2"]);
    expect(result.dropped).toContain("Measurements and their errors");
  });
});

describe("typography normalization preserves wording", () => {
  it("only removes hyphens established as physical line wraps", () => {
    expect(sourceTextIncludes("elec-\ntricity", "electricity")).toBe(true);
    expect(sourceTextIncludes("elec-\ntricity", "elec-tricity")).toBe(true);
    expect(sourceTextIncludes("electricity", "elec-\ntricity")).toBe(true);
    expect(sourceTextIncludes("re-sign", "resign")).toBe(false);
    expect(sourceTextIncludes("re-form", "reform")).toBe(false);
    expect(sourceTextIncludes("Sections 1–5", "Sections 15")).toBe(false);
    expect(sourceTextIncludes("85 marks", "80 marks")).toBe(false);
  });
});
