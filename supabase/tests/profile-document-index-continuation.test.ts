// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexDocumentPages, type DocumentSelection } from "../functions/_shared/profile-document-index";

interface PublicExcerpts {
  source: { sha256: string; physicalPageCount: number };
  excerpts: Array<{ page: number; text: string }>;
}
const fixtures = ["official", "scope", "continuation"].map(name => JSON.parse(
  readFileSync(new URL(`./fixtures/edexcel-alevel-business-${name}.json`, import.meta.url), "utf8"),
) as PublicExcerpts);
const selection: DocumentSelection = {
  component: "9BS0/01", componentAliases: ["Paper 1"],
  qualification: "A-level", course: "9BS0", subject: "Business",
};
const publicPages = () => {
  const pages = Array<string>(68).fill("");
  for (const fixture of fixtures) {
    expect(fixture.source.sha256).toBe(fixtures[0].source.sha256);
    for (const excerpt of fixture.excerpts) pages[excerpt.page - 1] = excerpt.text;
  }
  pages[59] = "Supporting material without assessment facts\n" + "x".repeat(37_000);
  return pages;
};
const snippetsOf = (index: ReturnType<typeof indexDocumentPages>) => index.chunks.flatMap(chunk => chunk.pages);
const textOf = (index: ReturnType<typeof indexDocumentPages>) => snippetsOf(index).map(page => page.text).join("\n");
function checkLiteralBounded(pages: string[], index: ReturnType<typeof indexDocumentPages>) {
  for (const snippet of snippetsOf(index)) expect(pages[snippet.page - 1]).toContain(snippet.text);
  expect(index.chunks.length).toBeLessThanOrEqual(2);
  for (const chunk of index.chunks) expect(chunk.characterCount).toBeLessThanOrEqual(18_000);
}

describe("allocated topic content across physical PDF pages", () => {
  it("retrieves literal subtopic titles after a mixed paper introduction in a large specification", () => {
    const pages = publicPages(), before = [...pages];
    const index = indexDocumentPages(pages, selection), text = textOf(index);
    expect(index.coverage).toEqual({ complete: true });
    expect(index.selectedPages).toEqual(expect.arrayContaining([17, 18, 19, 39, 40, 41]));
    for (const title of ["1.1 Meeting customer needs", "The market", "Market research", "4.1 Globalisation", "Growing economies", "International trade"])
      expect(text).toContain(title);
    for (const sibling of ["Paper 2", "Paper 3", "9BS0/02", "9BS0/03", "2.1 Raising finance", "3.1 Business objectives and strategy"])
      expect(text).not.toContain(sibling);
    expect(text).not.toContain("Themes 1, 2, 3 and 4");
    expect(pages).toEqual(before);
    checkLiteralBounded(pages, index);
  });

  it.each([[18], [40], [18, 40], [17, 18, 39, 40]].map(sourcePages => ({ sourcePages })))("accepts focused continuation pages $sourcePages using the source's paper allocation", ({ sourcePages }) => {
    const pages = publicPages();
    const index = indexDocumentPages(pages, { ...selection, sourcePages }), text = textOf(index);
    expect(index.coverage).toEqual({ complete: true });
    expect(index.pageDiagnostics).toEqual(sourcePages.map(page => ({ page, status: "selected" })));
    expect(text).toContain("9BS0/01");
    expect(text).toContain("Themes 1 and 4");
    if (sourcePages.includes(18)) {
      expect(text).toContain("1.1 Meeting customer needs");
      expect(text).toContain("a)   Mass markets and niche markets:");
      expect(text).toContain("Theme 1: Marketing and people");
    }
    if (sourcePages.includes(40)) {
      expect(text).toContain("4.1 Globalisation");
      expect(text).toContain("Foreign direct investment (FDI)");
      expect(text).toContain("Theme 4: Global business");
    }
    expect(text).not.toMatch(/Paper [23]|9BS0\/0[23]/);
    expect(index.selectedPages).not.toEqual(expect.arrayContaining([26, 32]));
    checkLiteralBounded(pages, index);
  });

  it.each([26, 32])("does not authorize a sibling's continuation on physical page %i", page => {
    const pages = publicPages();
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [page] });
    expect(index.coverage.complete).toBe(false);
    expect(index.chunks).toEqual([]);
    expect(index.pageDiagnostics?.[0].status).toBe("not_matched");
  });

  const brief = "A-level Business (9BS0)\nPaper 1: Marketing (9BS0/01)\nThemes 1 and 4\n80 marks\n120 minutes\nPaper 2: Finance (9BS0/02)\nThemes 2 and 3\n90 marks";
  const padding = "Supporting material\n" + "x".repeat(37_000);
  it("keeps actual focused prose without requiring a paper, theme or numbered heading on that page", () => {
    const pages = [brief, "Subject content\nTheme 1: Marketing\n1.1 Customer needs", "Businesses adapt to their customers.\nThey investigate changing demand.", "Theme 2: Finance\n2.1 Raising finance", "Sibling finance continuation.", "Theme 4: Global business", padding];
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [3] });
    expect(index.coverage).toEqual({ complete: true });
    expect(textOf(index)).toContain(pages[2]);
    expect(textOf(index)).toContain("Theme 1: Marketing");
    expect(textOf(index)).toContain("1.1 Customer needs");
    expect(textOf(index)).not.toContain("Sibling finance continuation");
    checkLiteralBounded(pages, index);
  });

  it("does not accept a sibling theme's running header as continuation content", () => {
    const pages = publicPages();
    const index = indexDocumentPages(pages, {
      ...selection, component: "9BS0/02", componentAliases: ["Paper 2"], sourcePages: [39],
    });
    expect(index.coverage.complete).toBe(false);
    expect(index.chunks).toEqual([]);
    expect(index.pageDiagnostics?.[0].status).toBe("not_matched");
  });

  it.each([
    "AS Business (8BS0)\nTheme 1: AS marketing",
    "A-level Business (OTHER1)\nTheme 1: Different course",
    "Paper 2: Finance (9BS0/02)",
    "Theme 2: Finance",
    "Theme 1: Marketing   Theme 2: Finance",
    "2.1 Raising finance",
    "Assessment objectives",
    "Contents\nTheme 1: Navigation entry",
  ])("stops continuation ownership at a literal scope boundary: %s", boundary => {
    const pages = [brief, "Subject content\nTheme 1: Marketing\n1.1 Customer needs", boundary, "Unselected continuation must stay unavailable.", "A-level Business (9BS0)\nTheme 4: Global business", padding];
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [4] });
    expect(index.coverage.complete).toBe(false);
    expect(index.chunks).toEqual([]);
    expect(index.pageDiagnostics?.[0].status).toBe("not_matched");
  });

  it("cannot use a repeated qualification heading to revive ownership after an AS section", () => {
    const pages = [brief, "Subject content\nTheme 1: Marketing", "AS Business (8BS0)\nAS-only material.", "A-level Business (9BS0)\nUnallocated A-level continuation.", "Theme 4: Global business", padding];
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [4] });
    expect(index.coverage.complete).toBe(false);
    expect(index.chunks).toEqual([]);
  });

  it("requires a literal selected-paper allocation before using continuation content", () => {
    const pages = [brief.replace("Themes 1 and 4", "Selected content is described elsewhere."), "Subject content\nTheme 1: Marketing", "1.1 Customer needs\nUnproven allocation.", padding];
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [3] });
    expect(index.coverage.complete).toBe(false);
    expect(index.chunks).toEqual([]);
  });

  it("does not turn a sibling comparison on an inherited page into selected rules", () => {
    const pages = [brief, "Subject content\nTheme 1: Marketing", "This discussion compares Paper 3: 200 marks.\n1.1 Customer needs\nLiteral selected learning content.", "Theme 4: Global business", padding];
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [3] });
    expect(index.coverage).toEqual({ complete: true });
    expect(textOf(index)).toContain("Literal selected learning content");
    expect(textOf(index)).not.toContain("200 marks");
  });

  it("fails closed when focused allocated content exceeds the existing evidence budget", () => {
    const pages = [brief, "Subject content\nTheme 1: Marketing", "1.1 Customer needs\n" + "Detailed content. ".repeat(2400), "Theme 4: Global business"];
    const index = indexDocumentPages(pages, { ...selection, sourcePages: [3] });
    expect(index.coverage).toMatchObject({ complete: false, code: "evidence_capacity" });
    expect(index.chunks).toEqual([]);
  });
});
