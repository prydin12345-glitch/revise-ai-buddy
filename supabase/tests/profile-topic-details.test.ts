// @vitest-environment node
import { describe, expect, it } from "vitest";
import { expandDetailedTopics, TOPIC_DETAIL_CAPACITY_WARNING } from "../functions/_shared/profile-topic-details";
import { ownerEvidence } from "./profile-builder-fixtures";
import type { ProfileEvidence } from "../functions/_shared/profile-evidence";

const businessSelection = { component: "9BS0/01", componentAliases: ["Paper 1"], course: "9BS0", qualification: "A-level" };
const brief = "A-level Business (9BS0)\nPaper 1: Marketing (9BS0/01)\nThemes 1 and 4\n100 marks\n120 minutes";

async function business(topics = ["Marketing", "Global business"]): Promise<ProfileEvidence> {
  const evidence = await ownerEvidence();
  evidence.identity = { ...evidence.identity, qualification: "A-level", subject: "Business", course: "9BS0", component: "9BS0/01" };
  evidence.documents[0].kind = "specification";
  evidence.documents[0].locations = [{ id: "brief", page: 1, section: "Assessment", text: brief }];
  evidence.facts.topics = topics;
  evidence.claims = [{ field: "topics", documentId: "owner-doc", locationId: "brief", quote: "Themes 1 and 4", rule: "mandatory" }];
  return evidence;
}

function documents(pages: string[]) {
  return [{ id: "owner-doc", pages: pages.map((text, index) => ({ page: index + 1, text })) }];
}

function selectedPages(first = "a) Primary research", last = "a) Gross Domestic Product") {
  return [brief, "Subject content\nTheme 1: Marketing\n1.1 Customers\n1.1.1\nMarket research\n" + first,
    "Theme 2: Finance\n2.1 Finance\n2.1.1 Loans\na) Borrowing",
    "Theme 4: Global business\n4.1 Globalisation\n4.1.1 Growing economies\n" + last];
}

describe("server-only detailed syllabus expansion", () => {
  it("extracts split numbered titles and outcomes, excluding sibling paper themes", async () => {
    const original = await business(), before = structuredClone(original), pages = selectedPages();
    const result = expandDetailedTopics(original, documents(pages), businessSelection);
    expect(result.facts.topics).toEqual(["1.1.1 Market research", "4.1.1 Growing economies"]);
    expect(result.topicDetails?.[0].path).toEqual(["Theme 1: Marketing", "1.1 Customers"]);
    expect(JSON.stringify(result.topicDetails)).not.toContain("Borrowing");
    for (const detail of result.topicDetails!) for (const source of detail.sources)
      expect(pages[source.page - 1]).toContain(source.text);
    expect(original).toEqual(before);
    expect(result.claims).toBe(original.claims);
    expect(result.documents).toBe(original.documents);
  });

  it("resolves a long Physics paper's governing section pointer before expanding named roots", async () => {
    const evidence = await business(["Measurements and their errors", "Particles and radiation"]);
    evidence.identity = { ...evidence.identity, subject: "Physics", organisation: "AQA", course: "7408", component: "7408/1" };
    const assessment = "A-level Physics (7408)\nPaper 1 (7408/1)\nWhat's assessed\nSections 1 - 2\n85 marks\n120 minutes";
    const pages = [assessment,
      "A-level Physics (7408)\nSubject content\n3.1 Measurements and their errors\n3.1.1 SI units\nStudents should be able to use SI units.\n3.1.2 Uncertainty\nStudents should estimate measurement uncertainty.",
      "3.2 Particles and radiation\n3.2.1 Quarks\nStudents should describe quark composition.",
      "3.8 Nuclear physics\n3.8.1 Radioactivity\nStudents should calculate half-life.", "Supporting material\n" + "x".repeat(37_000)];
    evidence.documents[0].locations = [{ id: "assessment", page: 1, section: "Assessment", text: assessment },
      { id: "measurements", page: 2, section: "Content", text: "3.1 Measurements and their errors" },
      { id: "particles", page: 3, section: "Content", text: "3.2 Particles and radiation" }];
    evidence.claims = [{ field: "topics", documentId: "owner-doc", locationId: "assessment", quote: "Sections 1 - 2", rule: "mandatory" },
      { field: "topics", documentId: "owner-doc", locationId: "measurements", quote: "Measurements and their errors", rule: "mandatory" },
      { field: "topics", documentId: "owner-doc", locationId: "particles", quote: "Particles and radiation", rule: "mandatory" }];
    const result = expandDetailedTopics(evidence, documents(pages), { component: "7408/1", componentAliases: ["Paper 1"], qualification: "A-level", course: "7408" });
    expect(result.facts.topics).toEqual(["3.1.1 SI units", "3.1.2 Uncertainty", "3.2.1 Quarks"]);
    expect(JSON.stringify(result.topicDetails)).not.toContain("half-life");
  });

  it("never takes an AS-only heading or another course's outcomes", async () => {
    const evidence = await business();
    const pages = [brief, "Theme 1: Marketing\n1.1 Customers\n1.1.1 Research\na) Sampling",
      "AS Business (8BS0)\nTheme 1: AS marketing\n1.1 AS customers\n1.1.1 AS-only research\na) Private AS outcome",
      "A-level Business (9BS0)\nTheme 4: Global business\n4.1 Globalisation\n4.1.1 Growth\na) Trade"];
    const result = expandDetailedTopics(evidence, documents(pages), businessSelection);
    expect(result.facts.topics).toEqual(["1.1.1 Research", "4.1.1 Growth"]);
    expect(JSON.stringify(result.topicDetails)).not.toContain("Private AS");
    expect(expandDetailedTopics(evidence, documents(pages), { ...businessSelection, course: "OTHER1" })).toBe(evidence);
  });

  it("retains numeric table rows, scientific notation and paragraph spacing literally", async () => {
    const body = "a) Calculate E = mc² and H₂O concentration\n\nMass / kg\n1 Mass\n2\n0.001\n3.0 × 10⁸\n\nb) Compare values";
    const evidence = await business(), pages = selectedPages(body);
    const result = expandDetailedTopics(evidence, documents(pages), businessSelection);
    expect(result.topicDetails?.[0].sources).toHaveLength(1);
    expect(result.topicDetails?.[0].sources[0].text).toContain(body);
    expect(result.facts.topics).toHaveLength(2);
  });

  it("keeps the original scope and warns when an excerpt or topic count exceeds capacity", async () => {
    const evidence = await business(), before = structuredClone(evidence);
    const oversized = expandDetailedTopics(evidence, documents(selectedPages("a) " + "x".repeat(7300))), businessSelection);
    expect(oversized.facts.topics).toEqual(evidence.facts.topics);
    expect(oversized.topicDetails).toBeUndefined();
    expect(oversized.unresolved).toContain(TOPIC_DETAIL_CAPACITY_WARNING);
    const many = Array.from({ length: 401 }, (_, i) => `1.${Math.floor(i / 99) + 1}.${i % 99 + 1} Concept ${i}\na) Learning outcome`).join("\n");
    const tooMany = expandDetailedTopics(evidence, documents([brief, `Theme 1: Marketing\n${many}`, "Theme 4: Global business\n4.1.1 Growth\na) Trade"]), businessSelection);
    expect(tooMany.facts.topics).toEqual(evidence.facts.topics);
    expect(tooMany.unresolved).toContain(TOPIC_DETAIL_CAPACITY_WARNING);
    expect(evidence).toEqual(before);
  });

  it("preserves unexpanded roots from a second active document and leaves plain sources unchanged", async () => {
    const evidence = await business(["Marketing", "Global business", "Ethics"]);
    evidence.documents.push({ ...structuredClone(evidence.documents[0]), id: "other", locations: [] });
    const result = expandDetailedTopics(evidence, [...documents(selectedPages()),
      { id: "other", pages: [{ page: 1, text: "Paper 1 (9BS0/01)\nEthics\nDiscuss ethical business." }] }], businessSelection);
    expect(result).toBe(evidence);
    expect(expandDetailedTopics(evidence, documents([brief, "Unnumbered learning material"]), businessSelection)).toBe(evidence);
  });

  it("rejects conflicting coded titles atomically and pads sparse physical pages", async () => {
    const evidence = await business();
    const pages = selectedPages();
    const conflicting = [...pages, "Theme 4: Global business\n4.1 Globalisation\n4.1.1 Conflicting title\na) Other content"];
    expect(expandDetailedTopics(evidence, documents(conflicting), businessSelection)).toBe(evidence);
    const sparse = [{ id: "owner-doc", pages: [
      { page: 1, text: pages[0] }, { page: 18, text: pages[1] }, { page: 40, text: pages[3] },
    ] }];
    const result = expandDetailedTopics(evidence, sparse, businessSelection);
    expect(result.topicDetails?.map(detail => detail.sources[0].page)).toEqual([18, 40]);
  });

  it("bounds hierarchy work before descendant comparisons", async () => {
    const evidence = await business();
    const many = Array.from({ length: 2001 }, (_, i) => `1.${Math.floor(i / 90) + 1}.${i % 90 + 1} Concept ${i}\na) Outcome`).join("\n");
    const result = expandDetailedTopics(evidence, documents([brief, `Theme 1: Marketing\n${many}`,
      "Theme 4: Global business\n4.1.1 Growth\na) Trade"]), businessSelection);
    expect(result.facts.topics).toEqual(evidence.facts.topics);
    expect(result.unresolved).toContain(TOPIC_DETAIL_CAPACITY_WARNING);
  });

  it("leaves ambiguous or model-only fallback roots unchanged", async () => {
    const evidence = await ownerEvidence();
    evidence.facts.topics = ["Cells"];
    const assessment = "Final assessment\nTopics assessed\nCells\n6 marks\n30 minutes";
    evidence.documents[0].locations = [{ id: "assessment", page: 1, section: "Assessment", text: assessment }];
    evidence.claims = [{ field: "topics", documentId: "owner-doc", locationId: "assessment", quote: "Cells", rule: "mandatory" }];
    const selection = { component: "Final", qualification: evidence.identity.qualification, course: evidence.identity.course };
    const ambiguous = [assessment, "1 Cells\n1.1 Membranes\na) Diffusion\n2 Cells\n2.1 Organelles\na) Respiration"];
    expect(expandDetailedTopics(evidence, documents(ambiguous), selection)).toBe(evidence);
    const modelOnly = structuredClone(evidence);
    modelOnly.facts.topics = ["Imaginary source root"];
    expect(expandDetailedTopics(modelOnly, documents([assessment, "1 Cells\n1.1 Membranes\na) Diffusion"]), selection)).toBe(modelOnly);
  });
});
