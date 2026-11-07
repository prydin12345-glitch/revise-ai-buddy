// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  indexDocumentPages,
  scopeDocumentQualification,
  INDEXED_DOCUMENT_LIMITS,
} from "../functions/_shared/profile-document-index";

const source = () => {
  const pages = Array.from(
    { length: 100 },
    (_, i) => "Background supporting material " + i + "\n" + "x".repeat(900),
  );
  pages[0] = "Example awarding organisation\nBiology specification\nIssue 4";
  pages[79] =
    "Paper 1: Biological processes\nTopics 1 to 2\nTotal marks: 90\nDuration: 105 minutes\nAnswer all questions";
  pages[81] = "Topic 1: Cells\nContent details below\n" + "c".repeat(3000);
  pages[85] = "Topic 2: Enzymes\nContent details below\n" + "e".repeat(3000);
  pages[83] = "Paper 2: Living systems\nTopics 3 to 4\nTotal marks: 100";
  pages[87] = "Topic 3: Ecology\n" + "q".repeat(3000);
  pages[94] =
    "Mathematical skills\nAt least 10% across the qualification.\nCalculator policy\nA calculator is permitted.";
  return pages;
};

describe("component-aware document indexing", () => {
  it("retains a wrapped mathematical requirement beyond the old five-line window as original text", () => {
    const pages = source();
    const passage = [
      "Mathematical skills",
      "Overall, at least 40% of the marks",
      "across the qualification require",
      "mathematical knowledge and skills",
      "at a standard that is",
      "equivalent to",
      "Level 2 GCSE mathematics or above.",
    ].join("\n");
    pages[94] = passage + "\n\nUnrelated later paragraph.";
    const index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(index.coverage.complete).toBe(true);
    const snippets = index.chunks.flatMap((chunk) => chunk.pages);
    expect(snippets).toContainEqual({ page: 95, text: passage + "\n" });
    const text = snippets.map((page) => page.text).join("\n");
    expect(text).toContain("equivalent to\nLevel 2 GCSE mathematics or above.");
    expect(text).not.toContain("Unrelated later paragraph");
    expect(text).not.toContain("Grade A* mathematics");
    for (const snippet of snippets)
      expect(pages[snippet.page - 1]).toContain(snippet.text);
    for (const chunk of index.chunks)
      expect(chunk.characterCount).toBeLessThanOrEqual(18_000);
  });

  it("does not continue a wrapped rule into another topic heading", () => {
    const pages = source();
    pages[94] =
      "Mathematical skills\nA statement in this source\ncontinues across several\nphysical PDF lines\nand ends with\nequivalent to\nTopic 3: Ecology\nA different topic's private requirement.";
    const index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(index.coverage.complete).toBe(true);
    const text = index.chunks
      .flatMap((chunk) => chunk.pages)
      .map((page) => page.text)
      .join("\n");
    expect(text).toContain("equivalent to");
    expect(text).not.toContain("A different topic's private requirement");
    expect(text).not.toContain("Topic 3: Ecology");
  });

  it.each([
    "Paper 2: Other assessment",
    "Component 3B: Medical physics (7408/3BB)",
  ])(
    "does not extend a selected rule through another assessment heading: %s",
    (heading) => {
      const pages = source();
      pages[94] =
        "Paper 1\nMathematical skills\nA selected rule\ncontinues over\nseveral extracted lines\nand is\nequivalent to\n" +
        heading +
        "\nOther assessment's private continuation.";
      const index = indexDocumentPages(pages, { component: "Paper 1" });
      expect(index.coverage.complete).toBe(true);
      const text = index.chunks
        .flatMap((chunk) => chunk.pages)
        .map((page) => page.text)
        .join("\n");
      expect(text).toContain("equivalent to");
      expect(text).not.toContain("Other assessment's private continuation");
      expect(text).not.toContain(heading);
    },
  );

  it("does not extend a mathematical passage across an AS qualification boundary", () => {
    const pages = source();
    pages[0] = "A-level\nPhysics specification";
    pages[94] =
      "Mathematical skills\nThis A-level rule\nspans several lines\nand ends\nwith the words\nequivalent to\nAS\nAS-only alternative data: 70 marks.";
    const index = indexDocumentPages(pages, {
      component: "Paper 1",
      qualification: "A-level",
    });
    expect(index.coverage.complete).toBe(true);
    const snippets = index.chunks.flatMap((chunk) => chunk.pages);
    expect(snippets.some((page) => page.text.includes("equivalent to"))).toBe(
      true,
    );
    expect(
      snippets.every((page) => !page.text.includes("AS-only alternative data")),
    ).toBe(true);
    for (const snippet of snippets)
      expect(pages[snippet.page - 1]).toContain(snippet.text);
  });

  it("bounds long unfinished rule passages and reports the incomplete retrieval without inventing their ending", () => {
    const pages = source();
    pages[94] =
      "Mathematical skills\n" +
      Array.from(
        { length: 30 },
        (_, index) => `Continuation fragment ${index}`,
      ).join("\n") +
      "\nInvented final grade target.";
    const index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(index.coverage.complete).toBe(true);
    expect(index.warnings.join(" ")).toMatch(
      /passage exceeds the bounded context window/,
    );
    const text = index.chunks
      .flatMap((chunk) => chunk.pages)
      .map((page) => page.text)
      .join("\n");
    expect(text).not.toContain("Invented final grade target");
    expect(index.chunks.length).toBeLessThanOrEqual(2);
  });

  it("finds late component rules and topic names after scanning the entire long source", () => {
    const pages = source(),
      index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(pages.join("").length).toBeGreaterThan(45000);
    expect(index.pages).toHaveLength(100);
    expect(index.pages[94].text).toBe(pages[94]);
    expect(index.coverage).toEqual({ complete: true });
    expect(index.selectedPages).toEqual(
      expect.arrayContaining([1, 80, 82, 86, 95]),
    );
    expect(index.selectedPages).not.toContain(84);
    expect(index.selectedPages).not.toContain(88);
    expect(index.chunks.length).toBeGreaterThan(0);
    expect(index.chunks.length).toBeLessThanOrEqual(2);
    for (const chunk of index.chunks) {
      expect(chunk.characterCount).toBeLessThanOrEqual(18000);
      for (const page of chunk.pages)
        expect(pages[page.page - 1]).toContain(page.text);
    }
  });

  it("preserves an ordinary institution brief whole without needing technical codes", () => {
    const pages = [
        "Example University\nFinal assessment\nCells and enzymes\n6 marks\n30 minutes\nUntiered",
      ],
      index = indexDocumentPages(pages, { component: "Final assessment" });
    expect(index.coverage.complete).toBe(true);
    expect(index.chunks.flatMap((chunk) => chunk.pages)).toEqual([
      { page: 1, text: pages[0] },
    ]);
  });

  it("does not choose a different paper when the requested assessment is absent", () => {
    for (const pages of [
      ["Paper 2\nTotal marks: 90"],
      ["Paper 1\nPaper 2\nTotal marks: 90"],
    ]) {
      const index = indexDocumentPages(pages, {
        component: "Final assessment",
      });
      expect(index.coverage.complete).toBe(false);
      expect(index.coverage.reason).toMatch(/which paper/);
      expect(index.chunks).toEqual([]);
    }
  });

  it("matches Paper 1 as a complete identifier rather than confusing it with Paper 10", () => {
    const pages = source();
    pages[79] = "Paper 10\nTotal marks: 90";
    const index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(index.coverage.complete).toBe(false);
    expect(index.chunks).toEqual([]);
  });

  it("requires a component match for a large document instead of selecting its first characters", () => {
    const pages = source().map((text) =>
        text.replaceAll("Paper 1", "Later assessment"),
      ),
      index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(index.coverage.complete).toBe(false);
    expect(index.chunks).toEqual([]);
    expect(index.pages[99].text).toBe(pages[99]);
  });

  it("keeps every byte of a bounded two-chunk brief even across page boundaries", () => {
    const pages = [
        "Paper 1\n" + "a".repeat(9992),
        "b".repeat(9000),
        "c".repeat(17000),
      ],
      index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(pages.join("").length).toBe(36000);
    expect(index.coverage.complete).toBe(true);
    expect(index.chunks.map((chunk) => chunk.characterCount)).toEqual([
      18000, 18000,
    ]);
    expect(
      index.chunks
        .flatMap((chunk) => chunk.pages)
        .map((page) => page.text)
        .join(""),
    ).toBe(pages.join(""));
  });

  it("fails explicitly if selected evidence cannot fit without dropping required material", () => {
    const index = indexDocumentPages(["Paper 1\n" + "a".repeat(40000)], {
      component: "Paper 1",
    });
    expect(index.coverage.complete).toBe(false);
    expect(index.coverage.reason).toMatch(/bounded build/);
    expect(index.chunks).toEqual([]);
    expect(index.pages[0].text.length).toBe(40008);
  });

  it("follows a printed-page reference while retaining the physical PDF page number", () => {
    const pages = source();
    pages[79] += "\nSee page 4.\n1";
    pages[82] =
      "Supplementary assessment information\nNo calculator may be used.\n4";
    const index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(index.coverage.complete).toBe(true);
    expect(index.selectedPages).toContain(83);
    expect(index.selectedPages).not.toContain(4);
    expect(index.chunks.flatMap((chunk) => chunk.pages)).toContainEqual({
      page: 83,
      text: pages[82],
    });
  });

  it("refuses unresolved and ambiguous references rather than inventing evidence pages", () => {
    const pages = source();
    pages[79] += "\nSee page 999.";
    const index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(index.coverage.complete).toBe(false);
    expect(index.coverage.reason).toMatch(/referenced assessment page/);
    expect(index.chunks).toEqual([]);
    pages[79] = pages[79].replace("999", "4");
    pages[81] += "\n4";
    pages[85] += "\n4";
    expect(
      indexDocumentPages(pages, { component: "Paper 1" }).coverage.complete,
    ).toBe(false);
  });

  it("reports missing referenced topic sections", () => {
    const pages = source();
    pages[79] = pages[79].replace("Topics 1 to 2", "Topics 1 to 4");
    const index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(index.coverage.complete).toBe(false);
    expect(index.coverage.reason).toMatch(/topic sections/);
  });

  it("does not add another component's topics from an overview comparison page", () => {
    const pages = source();
    pages[69] =
      "Assessment overview\nPaper 1\nTopics 1 to 2\n90 marks\nPaper 2\nTopics 3 to 4\n100 marks";
    const index = indexDocumentPages(pages, { component: "Paper 1" });
    expect(index.coverage.complete).toBe(true);
    expect(index.selectedPages).not.toContain(88);
  });

  it("keeps CRLF excerpts as literal spans of the original source", () => {
    const pages = source().map((page) => page.replaceAll("\n", "\r\n")),
      index = indexDocumentPages(pages, { component: "paper_1" });
    expect(index.coverage.complete).toBe(true);
    for (const page of index.chunks.flatMap((chunk) => chunk.pages))
      expect(pages[page.page - 1]).toContain(page.text);
  });

  it("enforces indexed page and text bounds and rejects unreadable sources", () => {
    expect(() =>
      indexDocumentPages(
        Array.from({ length: 241 }, () => "text"),
        { component: "Paper 1" },
      ),
    ).toThrow(/240 pages/);
    expect(() =>
      indexDocumentPages(
        ["x".repeat(INDEXED_DOCUMENT_LIMITS.maxCharacters + 1)],
        { component: "Paper 1" },
      ),
    ).toThrow(/text limit/);
    expect(() =>
      indexDocumentPages(["", "   "], { component: "Paper 1" }),
    ).toThrow(/readable text/);
  });
});

it("separates AS and A-level marks on a shared physical page without inventing excerpts", () => {
  const page =
    "AS and A-level Physics\n2.2 AS\nPaper 1\n70 marks\n90 minutes\n2.3 A-level\nPaper 1\n85 marks\n120 minutes\nTopic 1: Measurements";
  const result = indexDocumentPages([page], {
    component: "7408/1",
    componentAliases: ["Paper 1"],
    qualification: "A-level",
  });
  expect(result.coverage.complete).toBe(true);
  const text = result.chunks
    .flatMap((chunk) => chunk.pages)
    .map((item) => item.text)
    .join(" ");
  expect(text).toContain("85 marks");
  expect(text).not.toContain("70 marks");
  for (const chunk of result.chunks)
    for (const item of chunk.pages) {
      expect(item.page).toBe(1);
      expect(page).toContain(item.text);
    }
});
it("refuses combined assessment totals with no separable qualification headings", () => {
  const page =
    "AS and A-level Physics\nPaper 1: comparison\nAS 70 marks; A-level 85 marks";
  const result = indexDocumentPages([page], {
    component: "Paper 1",
    qualification: "A-level",
  });
  expect(result.coverage.complete).toBe(false);
  expect(result.chunks).toEqual([]);
  expect(result.coverage.reason).toMatch(/separate|combines/);
});
it("does not interpret the ordinary word as or arsenic As as an AS qualification heading", () => {
  const source = [
    "A-level\nPaper 1\nArsenic has the symbol As\nAs\nas\n85 marks",
  ];
  const result = scopeDocumentQualification(source, "A-level");
  expect(result.qualifications).toEqual(["A-level"]);
  expect(result.ambiguous).toBe(false);
});

it.each([
  "AS Physics",
  "AS PHYSICS",
  "AS Chemistry",
  "AS Biology",
  "AS Assessment Overview",
  "AS-level Physics",
])(
  "keeps the uppercase AS identity while matching the rest of %s case-insensitively",
  (heading) => {
    const page = `${heading}\nPaper 1\n70 marks\n90 minutes`;
    const alevel = indexDocumentPages([page], {
      component: "Paper 1",
      qualification: "A-level",
    });
    expect(alevel.coverage.complete).toBe(false);
    expect(alevel.coverage.reason).toMatch(/qualification does not match/);
    expect(alevel.chunks).toEqual([]);
    const as = indexDocumentPages([page], {
      component: "Paper 1",
      qualification: "AS",
    });
    expect(as.coverage.complete).toBe(true);
    expect(as.chunks.flatMap((chunk) => chunk.pages)).toEqual([
      { page: 1, text: page },
    ]);
  },
);

it.each(["(Paper 1)", " (paper1) ", "paper_1", "（Paper 1）"])(
  "resolves the exact legacy numbered selection %s without selecting another paper",
  (component) => {
    const pages = source();
    const index = indexDocumentPages(pages, { component });
    expect(index.coverage.complete).toBe(true);
    expect(index.selectedPages).toContain(80);
    expect(index.selectedPages).not.toContain(84);
    for (const chunk of index.chunks)
      for (const item of chunk.pages)
        expect(pages[item.page - 1]).toContain(item.text);
  },
);

it.each([
  "AS and A-level Physics\nAS Paper 1 70 marks\nA-level Paper 1 85 marks",
  "AS/A-level\nAS Paper 1: 70 marks | A-level Paper 1: 85 marks",
  "A-level and AS\nAS\nA-level\nPaper 1 | Paper 1\n70 marks | 85 marks",
  "AS | A-level\nPaper 1 | Paper 1\n70 marks | 85 marks",
  "AS    A-level\nPaper 1 | Paper 1\n70 marks | 85 marks",
])("fails closed for flattened combined qualification rows: %s", (page) => {
  const result = indexDocumentPages([page], {
    component: "7408/1",
    componentAliases: ["Paper 1"],
    qualification: "A-level",
  });
  expect(result.coverage.complete).toBe(false);
  expect(result.coverage.reason).toMatch(/separate|separated|combines/);
  expect(result.chunks).toEqual([]);
});

it("does not use an inline AS paper row for an A-level selection", () => {
  const result = indexDocumentPages(["AS Paper 1\n70 marks\n90 minutes"], {
    component: "Paper 1",
    qualification: "A-level",
  });
  expect(result.coverage.complete).toBe(false);
  expect(result.coverage.reason).toMatch(/AS\/A-level.*separated/);
  expect(result.chunks).toEqual([]);
});

it("requires an explicit AS/A-level selection for a combined column overview", () => {
  const result = indexDocumentPages(
    ["AS | A-level\nPaper 1 | Paper 1\n70 marks | 85 marks"],
    { component: "Paper 1" },
  );
  expect(result.coverage.complete).toBe(false);
  expect(result.coverage.reason).toMatch(/Choose AS or A-level/);
  expect(result.chunks).toEqual([]);
});

it("does not let a prior A-level heading scope a later flattened AS/A-level comparison", () => {
  const pages = source();
  pages[0] = "A-level Physics\nSpecification";
  pages[79] =
    "Assessment overview\nAS Paper 1 70 marks\nA-level Paper 1 85 marks";
  const result = indexDocumentPages(pages, {
    component: "7408/1",
    componentAliases: ["Paper 1"],
    qualification: "A-level",
  });
  expect(result.coverage.complete).toBe(false);
  expect(result.coverage.reason).toMatch(/AS\/A-level.*separated/);
  expect(result.chunks).toEqual([]);
});

it("keeps explicitly separated qualified rows literal and excludes the other qualification", () => {
  const page =
    "AS and A-level Physics\n2.2 AS\nAS Paper 1\n70 marks\n2.3 A-level\nA-level Paper 1\n85 marks";
  const result = indexDocumentPages([page], {
    component: "7408/1",
    componentAliases: ["Paper 1"],
    qualification: "A-level",
  });
  expect(result.coverage.complete).toBe(true);
  const selected = result.chunks.flatMap((chunk) => chunk.pages);
  expect(selected.map((item) => item.text).join("\n")).toContain("85 marks");
  expect(selected.map((item) => item.text).join("\n")).not.toContain(
    "70 marks",
  );
  for (const item of selected) expect(page).toContain(item.text);
});

it("requires an exact named option code and never treats its parent code as a suffix wildcard", () => {
  const pages = source();
  pages[79] = "A-level\nAstrophysics\n7408/3BA\n35 marks";
  pages[83] = "Medical physics\n7408/3BB\nTotal marks: 35";
  const selected = indexDocumentPages(pages, {
    component: "7408/3BA",
    qualification: "A-level",
  });
  expect(selected.coverage.complete).toBe(true);
  expect(selected.selectedPages).toContain(80);
  expect(selected.selectedPages).not.toContain(84);
  for (const component of ["7408/3", "7408/3A", "7408/3BC"]) {
    const rejected = indexDocumentPages(pages, {
      component,
      qualification: "A-level",
    });
    expect(rejected.coverage.complete).toBe(false);
    expect(rejected.chunks).toEqual([]);
  }
});

it.each([
  { component: "7408/3BA", componentAliases: ["Astrophysics"] },
  {
    component: "7408/3",
    componentAliases: ["Paper 3", "Astrophysics", "7408/3BA"],
  },
])(
  "excludes an unselected option's labelled page even when it has a shared parent heading: %s",
  (selection) => {
    const pages = source();
    pages[79] = "A-level\nPaper 3\nAstrophysics\n7408/3BA\nTotal marks: 35";
    pages[83] = "Paper 3\nMedical physics\n7408/3BB\nTotal marks: 35";
    const index = indexDocumentPages(pages, {
      ...selection,
      qualification: "A-level",
      excludedComponentCodes: ["7408/3BB", "7408/3BC", "7408/3BD", "7408/3BE"],
    });
    expect(index.coverage.complete).toBe(true);
    expect(index.selectedPages).toContain(80);
    expect(index.selectedPages).not.toContain(84);
    const text = index.chunks
      .flatMap((chunk) => chunk.pages)
      .map((page) => page.text)
      .join("\n");
    expect(text).toContain("7408/3BA");
    expect(text).not.toContain("7408/3BB");
    expect(text).not.toContain("Medical physics");
    for (const page of index.chunks.flatMap((chunk) => chunk.pages))
      expect(pages[page.page - 1]).toContain(page.text);
  },
);

it("does not retrieve a combined selected/unselected option page as verified evidence", () => {
  const page =
    "A-level\nPaper 3\nAstrophysics 7408/3BA 35 marks\nMedical physics 7408/3BB 35 marks";
  const index = indexDocumentPages([page], {
    component: "7408/3BA",
    componentAliases: ["Astrophysics"],
    excludedComponentCodes: ["7408/3BB"],
    qualification: "A-level",
  });
  expect(index.coverage.complete).toBe(false);
  expect(index.coverage.reason).toMatch(
    /selected and unselected optional sections/,
  );
  expect(index.chunks).toEqual([]);
});

it("asks for the selected option source instead of choosing a different option", () => {
  const index = indexDocumentPages(
    ["A-level\nPaper 3\nMedical physics\n7408/3BB\nTotal marks: 35"],
    {
      component: "7408/3",
      componentAliases: ["Paper 3", "Astrophysics", "7408/3BA"],
      excludedComponentCodes: ["7408/3BB"],
      qualification: "A-level",
    },
  );
  expect(index.coverage.complete).toBe(false);
  expect(index.coverage.reason).toMatch(/different optional topic/);
  expect(index.chunks).toEqual([]);
});
