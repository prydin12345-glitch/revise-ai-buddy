// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexDocumentPages } from "../functions/_shared/profile-document-index";

interface PublicExcerpts {
  source: { sha256: string; physicalPageCount: number };
  excerpts: Array<{ page: number; text: string }>;
}
const readExcerpts = (file: string): PublicExcerpts => JSON.parse(
  readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8"),
);
const identityFixture = readExcerpts("edexcel-alevel-business-official.json");
const scopeFixture = readExcerpts("edexcel-alevel-business-scope.json");
const selection = {
  component: "9BS0/01", componentAliases: ["Paper 1"],
  qualification: "A-level", course: "9BS0", subject: "Business",
};
const publicPages = (large: boolean) => {
  const pages = Array<string>(identityFixture.source.physicalPageCount).fill("");
  for (const excerpt of [...identityFixture.excerpts, ...scopeFixture.excerpts])
    pages[excerpt.page - 1] = excerpt.text;
  if (large) pages[59] = "Supporting material without assessment facts\n" + "x".repeat(37_000);
  return pages;
};
const snippetsOf = (index: ReturnType<typeof indexDocumentPages>) => index.chunks.flatMap(chunk => chunk.pages);

describe("selected Business paper evidence boundaries", () => {
  it.each([false, true])("excludes qualification theme tables and sibling rules from Paper 1 (large source: %s)", large => {
    expect(scopeFixture.source.sha256).toBe(identityFixture.source.sha256);
    const pages = publicPages(large), before = [...pages];
    const index = indexDocumentPages(pages, selection);
    expect(index.coverage).toEqual({ complete: true });
    expect(index.selectedPages).toEqual(expect.arrayContaining([1, 14, 17, 39, 45, 48, 67]));
    const snippets = snippetsOf(index), text = snippets.map(snippet => snippet.text).join("\n");
    expect(text).toContain("9BS0/01");
    expect(text).toContain("drawn from Themes 1 and 4");
    expect(text).toContain("Duration: 2 hours.");
    expect(text).toContain("100 marks");
    expect(text).toContain("Students must complete all assessment in May/June in any single year.");
    for (const sibling of ["Paper 2", "Paper 3", "9BS0/02", "9BS0/03", "Managing business activities", "Business decisions and strategy"])
      expect(text).not.toContain(sibling);
    expect(text).not.toContain("Themes 1, 2, 3 and 4");
    for (const page of [11, 13])
      expect(snippets.filter(snippet => snippet.page === page).map(snippet => snippet.text).join("\n")).not.toMatch(/Theme\s+\d/i);
    for (const [page, title] of [[17, "Theme 1: Marketing and people"], [39, "Theme 4: Global business"]] as const)
      expect(snippets.filter(snippet => snippet.page === page).map(snippet => snippet.text.trim())).toEqual([title]);
    expect(pages).toEqual(before);
    for (const snippet of snippets) expect(pages[snippet.page - 1]).toContain(snippet.text);
    expect(index.chunks.length).toBeLessThanOrEqual(2);
  });

  it("does not use contents entries or a qualification table in place of missing allocated content sections", () => {
    const pages = publicPages(true);
    pages[16] = pages[38] = "";
    const index = indexDocumentPages(pages, selection);
    expect(index.coverage.complete).toBe(false);
    expect(index.coverage.reason).toMatch(/topic sections/);
    expect(index.chunks).toEqual([]);
  });

  it("keeps actual paper blocks after a qualification overview on the same physical page", () => {
    const page = [
      "A-level Business (9BS0)", "Qualification at a glance",
      "Theme 1: Marketing   Theme 2: Finance", "Shared qualification content table.",
      "Paper 1: Marketing (9BS0/01)", "Themes 1 and 4", "80 marks", "120 minutes",
      "Paper 2: Finance (9BS0/02)", "Themes 2 and 3", "90 marks", "150 minutes",
    ].join("\n");
    const index = indexDocumentPages([page], selection);
    expect(index.coverage).toEqual({ complete: true });
    const text = snippetsOf(index).map(snippet => snippet.text).join("\n");
    expect(text).toContain("80 marks");
    expect(text).toContain("120 minutes");
    expect(text).not.toContain("Shared qualification content table");
    expect(text).not.toContain("Theme 2: Finance");
    expect(text).not.toContain("90 marks");
    for (const snippet of snippetsOf(index)) expect(page).toContain(snippet.text);
  });

  it.each([false, true])("keeps explicitly shared qualification rules after metadata (large source: %s)", large => {
    const pages = publicPages(large);
    pages[60] = "Mathematical skills\nAcross the qualification, at least 10% uses quantitative skills.";
    const index = indexDocumentPages(pages, selection);
    expect(index.coverage).toEqual({ complete: true });
    expect(snippetsOf(index).map(snippet => snippet.text).join("\n")).toContain("Across the qualification, at least 10% uses quantitative skills.");
  });

  it("preserves explicit shared rules and assessment blocks after mixed topic prose on the same page", () => {
    const pages = [
      "A-level Business (9BS0)\nPaper 1: Marketing (9BS0/01)\nThemes 1 and 4\n80 marks",
      [
        "Subject content", "Theme 1: Marketing and people",
        "This theme supports Paper 1 and Paper 3, whose other rules differ.",
        "Mathematical skills", "Across the qualification, at least 10% uses quantitative skills.",
        "Theme 4: Global business", "Paper 1: Marketing (9BS0/01)", "120 minutes",
        "Paper 2: Finance (9BS0/02)", "150 minutes",
      ].join("\n"),
    ];
    const index = indexDocumentPages(pages, selection);
    expect(index.coverage).toEqual({ complete: true });
    const text = snippetsOf(index).map(snippet => snippet.text).join("\n");
    expect(text).toContain("Across the qualification, at least 10% uses quantitative skills.");
    expect(text).toContain("120 minutes");
    expect(text).not.toContain("other rules differ");
    expect(text).not.toContain("150 minutes");
    for (const snippet of snippetsOf(index)) expect(pages[snippet.page - 1]).toContain(snippet.text);
  });

  it.each([11, 13])("cannot turn focused qualification metadata on page %s into allocated topic evidence", page => {
    const pages = publicPages(true);
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [page] });
    const text = snippetsOf(index).map(snippet => snippet.text).join("\n");
    expect(text).not.toMatch(/Theme\s+\d/i);
    expect(text).not.toContain("raising finance");
    expect(text).not.toContain("business objectives and strategy");
    for (const snippet of snippetsOf(index)) expect(pages[snippet.page - 1]).toContain(snippet.text);
  });

  const policyCases = [
    ["Calculator policy", "A calculator is permitted in all papers."],
    ["Calculator policy", "Calculators are not permitted in all papers."],
    ["Calculator policy", "Calculators not permitted in all papers."],
    ["Command words", "The following command words apply to all papers."],
  ] as const;
  const policyPages = (heading: string, passage: string, large: boolean) => [
    "A-level Business\nPaper 1: Marketing\n80 marks\n120 minutes\nPaper 2: Finance\n90 marks",
    ["Qualification at a glance", "Theme 2: Finance", "Metadata before the policy.",
      heading, passage, "Theme 3: Strategy", "Metadata after the policy."].join("\n"),
    ...(large ? ["Supporting material\n" + "x".repeat(37_000)] : []),
  ];
  it.each(policyCases.flatMap(([heading, passage]) => [false, true].map(large => ({ heading, passage, large }))))(
    "retains explicit shared $heading including prohibitions without unmasking topic metadata (large: $large)",
    ({ heading, passage, large }) => {
      const pages = policyPages(heading, passage, large);
      const index = indexDocumentPages(pages, { component: "Paper 1", qualification: "A-level" });
      expect(index.coverage).toEqual({ complete: true });
      const text = snippetsOf(index).map(snippet => snippet.text).join("\n");
      expect(text).toContain(`${heading}\n${passage}`);
      expect(text).not.toContain("Metadata before the policy");
      expect(text).not.toContain("Metadata after the policy");
      expect(text).not.toMatch(/Theme [23]:/);
      for (const snippet of snippetsOf(index)) expect(pages[snippet.page - 1]).toContain(snippet.text);
    },
  );

  it.each([
    ["Calculator policy", "This policy does not apply to all papers."],
    ["Calculator policy", "This policy isn't intended for all papers."],
    ["Command words", "These command words are not used in all assessments."],
    ["Calculator policy", "For teaching only, calculators are used across the qualification."],
    ["Command words", "These command words are examples for teaching all papers, not assessment instructions."],
  ])("does not promote false shared scope under %s: %s", (heading, passage) => {
    const pages = policyPages(heading, passage, false);
    const index = indexDocumentPages(pages, { component: "Paper 1", qualification: "A-level" });
    expect(index.coverage).toEqual({ complete: true });
    expect(snippetsOf(index).map(snippet => snippet.text).join("\n")).not.toContain(passage);
  });

  it.each(["AS\nAll papers permit calculators.", "Theme 2: Finance\nAll papers permit calculators.",
    "Final assessment\nAll papers permit calculators.",
    "Background context\n".repeat(14) + "All papers permit calculators.",
    "Background ".repeat(110) + "All papers permit calculators."])(
    "does not borrow shared-policy proof across a scope boundary or an unbounded window: %s", continuation => {
      const pages = policyPages("Calculator policy", continuation, false);
      const index = indexDocumentPages(pages, { component: "Paper 1", qualification: "A-level" });
      expect(index.coverage).toEqual({ complete: true });
      expect(snippetsOf(index).map(snippet => snippet.text).join("\n")).not.toContain("All papers permit calculators.");
    },
  );

  it.each([false, true])("retains a plain named assessment after an overview and excludes its sibling (large: %s)", large => {
    const pages = [["A-level Business", "Specification overview", "Theme 2: Qualification metadata",
      "Final assessment", "80 marks", "120 minutes", "Answer all questions",
      "Mid-term assessment", "90 marks", "150 minutes"].join("\r\n"),
      ...(large ? ["Supporting material\n" + "x".repeat(37_000)] : [])];
    const index = indexDocumentPages(pages, { component: "Final assessment", qualification: "A-level" });
    expect(index.coverage).toEqual({ complete: true });
    const text = snippetsOf(index).map(snippet => snippet.text).join("\n");
    expect(text).toContain("Final assessment\r\n80 marks\r\n120 minutes");
    expect(text).not.toContain("Qualification metadata");
    expect(text).not.toContain("Mid-term assessment");
    expect(text).not.toContain("90 marks");
    for (const snippet of snippetsOf(index)) expect(pages[snippet.page - 1]).toContain(snippet.text);
  });

  it("does not mistake running prose or a contents entry for a named assessment block", () => {
    for (const [title, entry] of [
      ["Contents", "Final assessment"],
      ["Specification overview", "Final assessment will use different rules."],
      ["Specification overview", "Final assessment\nTheme 2: Finance"],
      ["Specification overview", "Final assessment\n" + "Context\n".repeat(5)],
      ["Specification overview", "Final assessment\n" + "Context ".repeat(150)],
    ]) {
      const pages = [`A-level Business\nPaper 1: Marketing\n80 marks\nPaper 2: Finance\n90 marks`,
        `${title}\n${entry}\n150 minutes\nTheme 2: Finance`];
      const index = indexDocumentPages(pages, { component: "Paper 1", qualification: "A-level" });
      expect(index.coverage).toEqual({ complete: true });
      expect(snippetsOf(index).map(snippet => snippet.text).join("\n")).not.toContain("150 minutes");
    }
  });
});
