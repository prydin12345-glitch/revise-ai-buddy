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
      "Mathematical skills\nAcross the qualification, a statement in this source\ncontinues across several\nphysical PDF lines\nand ends with\nequivalent to\nTopic 3: Ecology\nA different topic's private requirement.";
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
      "Mathematical skills\nAcross the qualification, this A-level rule\nspans several lines\nand ends\nwith the words\nequivalent to\nAS\nAS-only alternative data: 70 marks.";
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
      "Mathematical skills\nAcross the qualification, the requirements continue\n" +
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

it.each([
  ["Physics", "7407", "7408"],
  ["Biology", "7401", "7402"],
  ["Chemistry", "7404", "7405"],
  ["Economics", "8EC0", "9EC0"],
])(
  "retains only literal coded %s spans from a combined specification",
  (subject, asCode, alevelCode) => {
    const page = `AS and A-level ${subject}\nAssessment overview\nPaper 1 (${asCode}/01)\n70 marks\n90 minutes\nPaper 1 (${alevelCode}/01)\n85 marks\n120 minutes`;
    const index = indexDocumentPages([page], {
      component: `${alevelCode}/01`,
      componentAliases: ["Paper 1"],
      course: alevelCode,
      qualification: "A-level",
    });
    expect(index.coverage.complete).toBe(true);
    const snippets = index.chunks.flatMap((chunk) => chunk.pages);
    expect(snippets.map((item) => item.text).join("\n")).toContain("85 marks");
    expect(snippets.map((item) => item.text).join("\n")).not.toContain(
      "70 marks",
    );
    for (const item of snippets) {
      expect(item.page).toBe(1);
      expect(page).toContain(item.text);
    }
  },
);

it("uses explicit course headings for separate and combined GCSE science without importing other totals", () => {
  const page =
    "GCSE Biology (8461)\nPaper 1\n100 marks\nGCSE Combined Science (8464)\nPaper 1\n70 marks";
  const index = indexDocumentPages([page], {
    component: "Paper 1",
    qualification: "GCSE",
    course: "8464",
  });
  expect(index.coverage.complete).toBe(true);
  const text = index.chunks
    .flatMap((chunk) => chunk.pages)
    .map((item) => item.text)
    .join("\n");
  expect(text).toContain("70 marks");
  expect(text).not.toContain("100 marks");
});

it("returns a targeted source question for unpartitioned tables instead of assigning AS marks to A-level", () => {
  const page = "AS and A-level Physics\nPaper 1\n70 marks\nPaper 1\n85 marks";
  const index = indexDocumentPages([page], {
    component: "7408/1",
    componentAliases: ["Paper 1"],
    qualification: "A-level",
    course: "7408",
  });
  expect(index.coverage.complete).toBe(false);
  expect(index.chunks).toEqual([]);
  expect(index.resolution).toMatchObject({
    field: "source",
    question: expect.stringContaining("PDF page"),
  });
  expect(index.pages[0].text).toBe(page);
});

it("can focus retained pages only after full-document qualification scoping", () => {
  const pages = [
    "AS and A-level Physics\nPaper 1\n70 marks\nPaper 1\n85 marks",
    "A-level Physics\nPaper 1\n85 marks\n120 minutes",
  ];
  const selection = {
    component: "7408/1",
    componentAliases: ["Paper 1"],
    qualification: "A-level",
    course: "7408",
  };
  expect(indexDocumentPages(pages, selection).coverage.complete).toBe(false);
  const narrowed = indexDocumentPages(pages, {
    ...selection,
    sourcePages: [2],
  });
  expect(narrowed.coverage.complete).toBe(true);
  expect(narrowed.selectedPages).toEqual([2]);
  expect(narrowed.pages.map((page) => page.text)).toEqual(pages);
  expect(narrowed.chunks.flatMap((chunk) => chunk.pages)).toEqual([
    { page: 2, text: pages[1] },
  ]);
  const unresolved = indexDocumentPages(pages, {
    ...selection,
    sourcePages: [1],
  });
  expect(unresolved.coverage.complete).toBe(false);
  expect(unresolved.chunks).toEqual([]);
});

it("cannot make a flattened table qualified by selecting its physical page", () => {
  const page =
    "AS (7407)\nA-level (7408)\nPaper 1 | Paper 1\n70 marks | 85 marks";
  expect(
    indexDocumentPages([page], {
      component: "Paper 1",
      course: "7408",
      qualification: "A-level",
      sourcePages: [1],
    }).coverage.complete,
  ).toBe(false);
});

it("does not inherit a flattened qualification column into the next physical page", () => {
  const pages = [
    "AS (7407)\nA-level (7408)",
    "Paper 1 | Paper 1\n70 marks | 85 marks",
  ];
  for (const sourcePages of [undefined, [2]]) {
    const index = indexDocumentPages(pages, {
      component: "Paper 1",
      qualification: "A-level",
      course: "7408",
      sourcePages,
    });
    expect(index.coverage.complete).toBe(false);
    expect(index.chunks).toEqual([]);
  }
});

it("does not confuse a distant cover qualification with adjacent AS/A-level table columns", () => {
  const pages = [
    "A-level Physics\nCourse 7408\nFor teaching from onwards",
    ...Array.from(
      { length: 8 },
      (_, i) => `Supporting material ${i}\n${"x".repeat(900)}`,
    ),
    "AS\nPaper 1\n70 marks; 90 minutes\nA-level\nPaper 1\n85 marks; 120 minutes",
  ];
  const index = indexDocumentPages(pages, {
    component: "7408/1",
    componentAliases: ["Paper 1"],
    qualification: "A-level",
    course: "7408",
  });
  expect(index.coverage.complete).toBe(true);
  const text = index.chunks
    .flatMap((chunk) => chunk.pages)
    .map((page) => page.text)
    .join("\n");
  expect(text).toContain("85 marks");
  expect(text).not.toContain("70 marks");
});

it.each([[], [0], [2], [1, 1], [1.1]].map((sourcePages) => ({ sourcePages })))(
  "rejects invalid clarification page selection %j",
  ({ sourcePages }) => {
    expect(() =>
      indexDocumentPages(["A-level\nPaper 1\n85 marks"], {
        component: "Paper 1",
        qualification: "A-level",
        sourcePages,
      }),
    ).toThrow(/valid physical PDF pages/);
  },
);
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

describe("source-backed assessment blocks and focused page diagnostics", () => {
  const business = [
    "Paper 1 – Marketing, people and global businesses",
    "Paper code: 9BS0/01",
    "Total marks: 100",
    "Duration: 120 minutes",
    "Topics 1 to 2",
    "Content overview",
    "The selected content continues over several wrapped lines",
    "and ends with this literal selected-paper sentence.",
    "Paper 2 – Business activities, decisions and strategy",
    "Paper code: 9BS0/02",
    "Total marks: 90",
    "Duration: 105 minutes",
    "Topics 3 to 4",
    "Other-paper-only content must not be assessed here.",
    "14",
  ].join("\n");
  const selection = {
    component: "9BS0/01",
    componentAliases: ["Paper 1"],
    qualification: "A-level",
    course: "9BS0",
  };
  const textOf = (index: ReturnType<typeof indexDocumentPages>) =>
    index.chunks.flatMap((chunk) => chunk.pages).map((page) => page.text).join("\n");

  it.each([false, true])("scopes a shared Business overview into literal paper blocks (long document: %s)", (long) => {
    const pages = [
      "Pearson Edexcel Level 3 Advanced GCE in Business (9BS0)",
      business,
      "Topic 1: Marketing\nTopic 2: People\nTopic 3: Finance\nTopic 4: Strategy",
      "Mathematical skills\nAcross the qualification, at least 10% uses quantitative skills.",
      ...(long ? Array.from({ length: 50 }, (_, i) => `Supporting material ${i}\n${"x".repeat(1000)}`) : []),
    ];
    const index = indexDocumentPages(pages, selection);
    expect(index.coverage).toEqual({ complete: true });
    const text = textOf(index);
    expect(text).toContain("100");
    expect(text).toContain("120 minutes");
    expect(text).toContain("literal selected-paper sentence.");
    expect(text).not.toContain("Paper 2");
    expect(text).not.toContain("90");
    expect(text).not.toContain("105 minutes");
    expect(text).not.toContain("Topics 3 to 4");
    expect(text).not.toContain("Topic 3: Finance");
    expect(text).not.toContain("Topic 4: Strategy");
    expect(text).not.toContain("Other-paper-only");
    expect(text).toContain("quantitative skills");
    for (const snippet of index.chunks.flatMap((chunk) => chunk.pages))
      expect(pages[snippet.page - 1]).toContain(snippet.text);
  });

  it("does not demand a new identity proof when focusing an already-unambiguous document", () => {
    const pages = ["An institution's Business assessment specification", business.replace(/Paper code: 9BS0\/0[12]\n/g, "")];
    const initial = indexDocumentPages(pages, { component: "Paper 1", qualification: "A-level" });
    const followup = indexDocumentPages(pages, { component: "Paper 1", qualification: "A-level", sourcePages: [2] });
    expect(initial.coverage.complete).toBe(true);
    expect(followup.coverage.complete).toBe(true);
    expect(textOf(followup)).toContain("100");
    expect(textOf(followup)).not.toContain("Paper 2");
    expect(followup.pageDiagnostics).toEqual([{ page: 2, printedPage: 14, status: "selected" }]);
  });

  it("recognizes Pearson's Advanced GCE title and retains the literal cover anchor for a focused page", () => {
    const cover = "Pearson Edexcel Level 3 Advanced GCE in Business (9BS0)";
    const pages = [cover, ...Array.from({ length: 12 }, () => "Supporting material"), business];
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [14] });
    expect(index.coverage).toEqual({ complete: true });
    expect(textOf(index)).toContain(cover);
    expect(textOf(index)).not.toContain("Paper 2");
    expect(index.selectedPages).toEqual([1, 14]);
    expect(index.pageDiagnostics).toEqual([{ page: 14, printedPage: 14, status: "selected" }]);
  });

  it("keeps Advanced Subsidiary GCE and Advanced GCE papers separate", () => {
    const pages = [
      "Pearson Edexcel Level 3 Advanced Subsidiary GCE in Business (8BS0)\nPaper 1\nPaper code: 8BS0/01\n70 marks\n90 minutes",
      "Pearson Edexcel Level 3 Advanced GCE in Business (9BS0)\n" + business,
    ];
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [2] });
    expect(index.coverage.complete).toBe(true);
    expect(textOf(index)).toContain("100");
    expect(textOf(index)).not.toContain("70 marks");
    expect(textOf(index)).not.toContain("8BS0");
    expect(textOf(index)).not.toContain("Paper 2");
  });

  it("keeps source qualification contradictions blocked instead of trusting a selected page", () => {
    const index = indexDocumentPages([
      "Pearson Edexcel Level 3 Advanced Subsidiary GCE in Business (8BS0)\nPaper 1\n70 marks",
    ], { ...selection, sourcePages: [1] });
    expect(index.coverage).toMatchObject({ complete: false, code: "qualification_scope" });
    expect(index.chunks).toEqual([]);
    expect(index.pageDiagnostics?.[0].status).not.toBe("selected");
  });

  it("reports unsplittable assessment columns as an ambiguity rather than inventing their row ownership", () => {
    const index = indexDocumentPages([
      "A-level Business\nPaper 1 | Paper 2\n100 marks | 90 marks\n120 minutes | 105 minutes",
    ], { component: "Paper 1", qualification: "A-level", sourcePages: [1] });
    expect(index.coverage).toMatchObject({ complete: false, code: "assessment_boundary_ambiguous" });
    expect(index.chunks).toEqual([]);
    expect(index.pageDiagnostics?.[0]).toMatchObject({ code: "assessment_boundary_ambiguous", status: "blocked" });
  });

  it("uses the component code beside its own heading, without borrowing a neighbouring paper's code", () => {
    const page = "A-level Business\nPaper 2\nPaper code: 9BS0/02\nPaper 1\nPaper code: 9BS0/01\n100 marks";
    const index = indexDocumentPages([page], { component: "9BS0/01", qualification: "A-level", course: "9BS0" });
    expect(index.coverage.complete).toBe(true);
    expect(textOf(index)).toContain("Paper 1");
    expect(textOf(index)).not.toContain("Paper 2");
    expect(textOf(index)).not.toContain("9BS0/02");
  });

  it("separates numbered unit blocks without relying on a paper-specific catalogue", () => {
    const page = "A-level Example\nUnit 1: Research\n40 marks\n80 minutes\nUnit 2: Evaluation\n60 marks\n90 minutes";
    const index = indexDocumentPages([page], { component: "Unit 1", qualification: "A-level" });
    expect(index.coverage.complete).toBe(true);
    expect(textOf(index)).toContain("40 marks");
    expect(textOf(index)).not.toContain("Unit 2");
    expect(textOf(index)).not.toContain("60 marks");
  });

  it("retrieves only explicitly allocated Business themes without inventing topic scope", () => {
    const pages = [
      "Pearson Edexcel Level 3 Advanced GCE in Business (9BS0)",
      "Paper 1: Marketing, people and global businesses\nThemes 1 and 4\n100 marks\nPaper 2: Business activities\nThemes 2 and 3\n90 marks",
      "Theme 1: Marketing and people\nSelected marketing content.\nTheme 2: Managing business activities\nUnselected finance content.\nTheme 3: Business decisions and strategy\nUnselected strategy content.\nTheme 4: Global business\nSelected global content.",
    ];
    const index = indexDocumentPages(pages, { component: "Paper 1", qualification: "A-level", course: "9BS0" });
    expect(index.coverage.complete).toBe(true);
    expect(textOf(index)).toContain("Selected marketing content.");
    expect(textOf(index)).toContain("Selected global content.");
    expect(textOf(index)).not.toContain("Unselected finance content.");
    expect(textOf(index)).not.toContain("Unselected strategy content.");
  });

  it("does not let a familiar paper label override a different literal component code", () => {
    const index = indexDocumentPages([
      "A-level Business (9BS0)\nPaper 1: Familiar label\n9BS0/02\n90 marks",
    ], { ...selection, sourcePages: [1] });
    expect(index.coverage).toMatchObject({ complete: false, code: "assessment_not_found" });
    expect(index.chunks).toEqual([]);
  });

  it("keeps adjacent named assessment blocks separate", () => {
    const index = indexDocumentPages([
      "A-level Business\nAssessment: Research project\n9BS0/02\nAssessment: Written project\n9BS0/01\n100 marks",
    ], { component: "9BS0/01", qualification: "A-level", course: "9BS0" });
    expect(index.coverage.complete).toBe(true);
    expect(textOf(index)).toContain("Written project");
    expect(textOf(index)).not.toContain("Research project");
    expect(textOf(index)).not.toContain("9BS0/02");
  });

  it("reports an unresolved cross-reference without pretending the matching overview page was absent", () => {
    const page = "A-level Business\nPaper 1\n100 marks\nSee page 99\n7";
    const index = indexDocumentPages([page], { component: "Paper 1", qualification: "A-level", sourcePages: [1] });
    expect(index.coverage).toMatchObject({ complete: false, code: "referenced_page_unresolved" });
    expect(index.pageDiagnostics).toEqual([{
      page: 1, printedPage: 7, status: "blocked", code: "referenced_page_unresolved", reason: expect.stringContaining("referenced"),
    }]);
  });

  it.each([false, true])("carries a sibling paper's ownership across physical page breaks (long source: %s)", (long) => {
    const pages = [
      "A-level Business (9BS0)\nPaper 1: Marketing\n80 marks\n120 minutes\nPaper 2: Strategy\n100 marks",
      "150 minutes\nCalculator allowed\nAnswer all questions\nPaper 3: Investigation\n120 marks",
      "Mathematical skills\nAt least 10% across the qualification.\nCalculator policy\nA calculator is permitted.",
      ...(long ? Array.from({ length: 50 }, (_, i) => `Supporting material ${i}\n${"x".repeat(1000)}`) : []),
    ];
    const index = indexDocumentPages(pages, selection);
    expect(index.coverage.complete).toBe(true);
    const text = textOf(index);
    expect(text).toContain("80 marks");
    expect(text).toContain("120 minutes");
    expect(text).not.toContain("150 minutes");
    expect(text).not.toContain("Calculator allowed");
    expect(text).not.toContain("Answer all questions");
    expect(text).not.toContain("Paper 3");
    expect(text).not.toContain("120 marks");
    expect(text).toContain("At least 10% across the qualification.");
    expect(text).toContain("A calculator is permitted.");
  });

  it("does not turn an unlabelled sibling continuation page into shared evidence when the user selects it", () => {
    const pages = [
      "A-level Business (9BS0)\nPaper 1\n80 marks\nPaper 2\n100 marks",
      "150 minutes\nCalculator allowed\nAnswer all questions",
    ];
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [2] });
    expect(index.coverage).toMatchObject({ complete: false, code: "assessment_not_found" });
    expect(index.chunks).toEqual([]);
    expect(index.pageDiagnostics?.[0].status).toBe("not_matched");
  });

  it.each([false, true])("retains the selected assessment's own continuation before the next paper (long source: %s)", (long) => {
    const pages = [
      "A-level Business (9BS0)\nPaper 1: Marketing\n80 marks",
      "120 minutes\nCalculator allowed\nAnswer all questions\nPaper 2: Strategy\n100 marks\n150 minutes",
      ...(long ? Array.from({ length: 50 }, (_, i) => `Supporting material ${i}\n${"x".repeat(1000)}`) : []),
    ];
    const index = indexDocumentPages(pages, selection);
    expect(index.coverage.complete).toBe(true);
    const text = textOf(index);
    expect(text).toContain("120 minutes");
    expect(text).toContain("Calculator allowed");
    expect(text).toContain("Answer all questions");
    expect(text).not.toContain("Paper 2");
    expect(text).not.toContain("100 marks");
    expect(text).not.toContain("150 minutes");
  });

  it("keeps a selected continuation's course heading as a single literal span", () => {
    const cover = "Pearson Edexcel Level 3 Advanced GCE in Business (9BS0)";
    const index = indexDocumentPages([cover, "Paper 1\n80 marks", "120 minutes\nAnswer all questions"], {
      ...selection, sourcePages: [3],
    });
    expect(index.coverage.complete).toBe(true);
    const snippets = index.chunks.flatMap((chunk) => chunk.pages);
    expect(snippets.filter((snippet) => snippet.page === 1)).toEqual([{ page: 1, text: cover }]);
    expect(textOf(index)).toContain("120 minutes");
  });

  it("does not declare a sibling paper's skills section shared without course-wide source wording", () => {
    const index = indexDocumentPages([
      "A-level Business (9BS0)\nPaper 1\n80 marks\nPaper 2\n100 marks",
      "Practical skills\nCalculator allowed\nAnswer all questions\nA paper-specific investigation.",
    ], selection);
    expect(index.coverage.complete).toBe(true);
    expect(textOf(index)).not.toContain("Practical skills");
    expect(textOf(index)).not.toContain("Calculator allowed");
    expect(textOf(index)).not.toContain("A paper-specific investigation");
  });

  it("does not allocate an unrelated content topic merely because its prose mentions the selected paper", () => {
    const index = indexDocumentPages([
      "A-level Business (9BS0)\nPaper 1\nTopics 1 and 2\n80 marks\nPaper 2\nTopics 3 and 4\n100 marks",
      "Subject content\nTopic 1: Marketing\nSelected content.\nTopic 2: People\nSelected people content.\nTopic 3: Finance\nThis topic mentions Paper 1 in a comparison, without assigning it to that paper.",
    ], selection);
    expect(index.coverage.complete).toBe(true);
    expect(textOf(index)).not.toContain("Topic 3: Finance");
    expect(textOf(index)).not.toContain("without assigning it");
  });

  it.each(["Topic", "Theme", "Module"].flatMap(kind => [false, true].map(long => [kind, long] as const)))(
    "does not make an unallocated %s heading shared across a sibling page break (long source: %s)",
    (kind, long) => {
      const filler = long ? Array.from({ length: 50 }, (_, i) => `Supporting material ${i}\n${"x".repeat(1000)}`) : [];
      const sibling = indexDocumentPages([
        "A-level Business (9BS0)\nPaper 1: Marketing\n80 marks\n120 minutes\nPaper 2: Strategy\n100 marks",
        `${kind} 7\nStrategy decision analysis\n120 marks\nDuration\n180 minutes`,
        ...filler,
      ], selection);
      expect(sibling.coverage.complete).toBe(true);
      expect(textOf(sibling)).toContain("80 marks");
      expect(textOf(sibling)).not.toContain(`${kind} 7`);
      expect(textOf(sibling)).not.toContain("Strategy decision analysis");
      expect(textOf(sibling)).not.toContain("120 marks");
      expect(textOf(sibling)).not.toContain("180 minutes");

      const selected = indexDocumentPages([
        "A-level Business (9BS0)\nPaper 1: Marketing\n80 marks",
        `${kind} 7\nSelected continuation\nDuration\n120 minutes`,
        "Paper 2: Strategy\n100 marks\n180 minutes",
        ...filler,
      ], selection);
      expect(selected.coverage.complete).toBe(true);
      expect(textOf(selected)).toContain("Selected continuation");
      expect(textOf(selected)).toContain("120 minutes");
      expect(textOf(selected)).not.toContain("180 minutes");
    },
  );

  it.each(["Paper 1 can", "A-level Paper 1 must", "AS Paper 1 requires"].flatMap(prefix => [false, true].map(long => [prefix, long] as const)))(
    "does not turn running prose '%s' into a selected assessment heading (long source: %s)",
    (prefix, long) => {
      const as = prefix.startsWith("AS ");
      const qualification = as ? "AS" : "A-level";
      const index = indexDocumentPages([
        `${qualification} Business (9BS0)\nPaper 1: Marketing\n80 marks\n120 minutes\nPaper 2: Strategy\n100 marks`,
        `${prefix} provide background knowledge for this assessment.\n180 minutes\nCalculator allowed`,
        ...(long ? Array.from({ length: 50 }, (_, i) => `Supporting material ${i}\n${"x".repeat(1000)}`) : []),
      ], { ...selection, qualification });
      expect(index.coverage.complete).toBe(true);
      expect(textOf(index)).toContain("80 marks");
      expect(textOf(index)).not.toContain("provide background knowledge");
      expect(textOf(index)).not.toContain("180 minutes");
      expect(textOf(index)).not.toContain("Calculator allowed");
    },
  );

  it.each([false, true])("does not treat a paper's percentage of the qualification as course-wide skills proof (long source: %s)", (long) => {
    const index = indexDocumentPages([
      "A-level Business (9BS0)\nPaper 1: Marketing\n80 marks\n120 minutes\nPaper 2: Strategy\n100 marks",
      "Mathematical skills\nThis paper accounts for 5% of the qualification.\nCalculator allowed\n180 minutes",
      ...(long ? Array.from({ length: 50 }, (_, i) => `Supporting material ${i}\n${"x".repeat(1000)}`) : []),
    ], selection);
    expect(index.coverage.complete).toBe(true);
    expect(textOf(index)).toContain("80 marks");
    expect(textOf(index)).not.toContain("Mathematical skills");
    expect(textOf(index)).not.toContain("5% of the qualification");
    expect(textOf(index)).not.toContain("Calculator allowed");
    expect(textOf(index)).not.toContain("180 minutes");
  });
});
