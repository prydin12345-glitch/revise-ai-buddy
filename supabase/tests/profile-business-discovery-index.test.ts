// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  discoverSourceAssessments,
  resolveSourceAssessment,
} from "../functions/_shared/profile-assessment-discovery";
import { indexDocumentPages } from "../functions/_shared/profile-document-index";
import { extractIndexedPdfPages } from "../functions/_shared/profile-document-io";
import type { PdfTextItem } from "../functions/_shared/profile-pdf-layout";

const fixture: {
  source: { sha256: string; physicalPageCount: number; url: string };
  excerpts: Array<{ page: number; text: string }>;
  geometryExcerpts: Array<{ page: number; text: string; items: PdfTextItem[] }>;
} = JSON.parse(readFileSync(new URL("./fixtures/edexcel-alevel-business-official.json", import.meta.url), "utf8"));
const scope = { qualification: "A-level", course: "9BS0", organisation: "Pearson Edexcel", subject: "Business" };
const titles = [
  "Marketing, people and global businesses",
  "Business activities, decisions and strategy",
  "Investigating business in a competitive environment",
];
const source = (pages: string[], id = "business", checksum = fixture.source.sha256) => ({ id, checksum, pages });
const pagesOf = () => {
  const pages = Array<string>(fixture.source.physicalPageCount).fill("");
  for (const excerpt of fixture.excerpts) pages[excerpt.page - 1] = excerpt.text;
  return pages;
};
const snippetsOf = (index: ReturnType<typeof indexDocumentPages>) => index.chunks.flatMap(chunk => chunk.pages);

describe("public Business PDF assessment regressions (offline excerpts)", () => {
  it("replays captured real PDF.js heading/code/sidebar geometry through the current extractor", async () => {
    const extracted = await extractIndexedPdfPages(new TextEncoder().encode("%PDF-fixture"), async () => ({
      numPages: fixture.geometryExcerpts.length,
      getPage: async number => ({ getTextContent: async () => ({ items: fixture.geometryExcerpts[number - 1].items }) }),
      loadingTask: { destroy: async () => {} },
    }));
    expect(extracted).toEqual(fixture.geometryExcerpts.map(excerpt => excerpt.text));
    for (const excerpt of fixture.geometryExcerpts)
      expect(pagesOf()[excerpt.page - 1]).toContain(excerpt.text);
  });

  it("consolidates starred overview codes, weighting rows, wrapped headings and appendix codes into three literal identities", async () => {
    const pages = pagesOf(), before = [...pages];
    const discovery = await discoverSourceAssessments([source(pages)], scope);
    expect(discovery.ambiguous).toBe(false);
    expect(discovery.needsManualEntry).toBe(false);
    expect(discovery.candidates.map(candidate => [candidate.label, candidate.componentCode, candidate.canonicalComponent])).toEqual(
      titles.map((title, i) => [`Paper ${i + 1} — ${title}`, `9BS0/0${i + 1}`, `9BS0/0${i + 1}`]),
    );
    expect(pages).toEqual(before);
    for (const candidate of discovery.candidates) {
      expect(candidate.references.some(reference => reference.page === 67 && reference.quote.includes(candidate.componentCode!))).toBe(true);
      for (const reference of candidate.references) {
        expect(reference.checksum).toBe(fixture.source.sha256);
        expect(pages[reference.page - 1]).toContain(reference.quote);
      }
      expect(candidate.label).not.toMatch(/%|\d\s*–\s*\d/);
      for (const value of [candidate.id, candidate.componentCode!, candidate.label, `${candidate.label} (${candidate.componentCode})`])
        expect(resolveSourceAssessment(discovery.candidates, value)?.id).toBe(candidate.id);
      expect(resolveSourceAssessment(discovery.candidates, `${candidate.label} (9BS0/99)`)).toBeNull();
    }
  });

  it.each([false, true])("indexes each paper's assessment rules and literal theme headings (large source: %s)", async large => {
    const pages = pagesOf();
    // Synthetic supporting material exercises bounded long-source retrieval;
    // it is distinct from the public source excerpts and carries no facts.
    if (large) pages[59] = "Unrelated supporting material\n" + "x".repeat(37_000);
    const discovery = await discoverSourceAssessments([source(pages)], scope);
    for (const [i, candidate] of discovery.candidates.entries()) {
      const index = indexDocumentPages(pages, { ...scope, component: candidate.canonicalComponent, componentAliases: candidate.aliases });
      expect(index.coverage).toEqual({ complete: true });
      expect(index.selectedPages).toEqual(expect.arrayContaining(i === 2 ? [15, 46] : [14, 45]));
      const snippets = snippetsOf(index), text = snippets.map(snippet => snippet.text).join("\n");
      expect(text).toContain("100 marks");
      expect(text).toContain("Duration: 2 hours.");
      expect(text).toContain(candidate.componentCode);
      for (const sibling of discovery.candidates.filter(other => other.id !== candidate.id)) {
        expect(text).not.toContain(sibling.componentCode);
        expect(text).not.toContain(`Paper ${discovery.candidates.indexOf(sibling) + 1}:`);
      }
      if (i !== 2) {
        const selectedThemes = i === 0 ? [17, 39] : [25, 31];
        const siblingThemes = i === 0 ? [25, 31] : [17, 39];
        expect(index.selectedPages).toEqual(expect.arrayContaining(selectedThemes));
        for (const page of siblingThemes) expect(index.selectedPages).not.toContain(page);
      }
      for (const snippet of snippets) expect(pages[snippet.page - 1]).toContain(snippet.text);
      expect(index.chunks.length).toBeLessThanOrEqual(2);
    }
  });

  it.each([0, 1, 2])("keeps the matching overview and duration when focusing paper %s on its later summary", async i => {
    const pages = pagesOf();
    const candidate = (await discoverSourceAssessments([source(pages)], scope)).candidates[i];
    const summaryPage = i === 2 ? 46 : 45, overviewPage = i === 2 ? 15 : 14;
    const index = indexDocumentPages(pages, { ...scope, component: candidate.canonicalComponent, componentAliases: candidate.aliases, sourcePages: [summaryPage] });
    expect(index.coverage).toEqual({ complete: true });
    expect(index.pageDiagnostics).toEqual([{ page: summaryPage, status: "selected" }]);
    expect(index.selectedPages).toEqual(expect.arrayContaining([overviewPage, summaryPage]));
    expect(snippetsOf(index).some(snippet => snippet.page === overviewPage && snippet.text.includes("Duration: 2 hours."))).toBe(true);
    const text = snippetsOf(index).map(snippet => snippet.text).join("\n");
    for (const j of [0, 1, 2].filter(j => j !== i)) expect(text).not.toContain(`9BS0/0${j + 1}`);
    for (const snippet of snippetsOf(index)) expect(pages[snippet.page - 1]).toContain(snippet.text);
  });
});

describe("source identity and manual-reference boundaries", () => {
  it("links an appendix-only code to its unique named paper, keeping late code evidence within the citation limit", async () => {
    const pages = Array.from({ length: 20 }, () => "A-level Business\nPaper 1: Marketing and people\n100 marks");
    pages.push("Paper 1: 9BS0/01");
    const discovery = await discoverSourceAssessments([source(pages)], scope);
    expect(discovery.ambiguous).toBe(false);
    expect(discovery.candidates).toHaveLength(1);
    const candidate = discovery.candidates[0];
    expect(candidate).toMatchObject({ label: "Paper 1 — Marketing and people", componentCode: "9BS0/01" });
    expect(candidate.references).toHaveLength(8);
    expect(candidate.references).toContainEqual(expect.objectContaining({ page: 21, quote: "Paper 1: 9BS0/01" }));
  });

  it("does not borrow a previous paper's standalone or starred code for the next named paper", async () => {
    for (const codeLine of ["9BS0/01", "*Paper code: 9BS0/01"]) {
      const discovery = await discoverSourceAssessments([source([`A-level Business\nPaper 1: Marketing\n${codeLine}\nPaper 2: Strategy\n100 marks`])], scope);
      expect(discovery.candidates.map(candidate => candidate.componentCode)).toEqual(["9BS0/01", undefined]);
      expect(resolveSourceAssessment(discovery.candidates, "Paper 2 — Strategy (9BS0/01)")).toBeNull();
    }
  });

  it("never turns a confirmed user code or the requested course into source code evidence", async () => {
    const discovery = await discoverSourceAssessments([source(["A-level Business\nPaper 1: Marketing\n100 marks"])], scope);
    expect(discovery.candidates[0].componentCode).toBeUndefined();
    expect(discovery.candidates[0].canonicalComponent).toBe("Paper 1");
    expect(resolveSourceAssessment(discovery.candidates, "9BS0/01")).toBeNull();
    expect(resolveSourceAssessment(discovery.candidates, "Paper 1 — Marketing (9BS0/01)")).toBeNull();
  });

  it("preserves a genuine edition disagreement even when the title and code are identical", async () => {
    const discovery = await discoverSourceAssessments([
      source(["A-level Business\nSpecification – Issue 1 – September 2014\nPaper 1: Marketing (9BS0/01)\n80 marks"], "old", "a".repeat(64)),
      source(["A-level Business\nSpecification – Issue 2 – September 2016\nPaper 1: Marketing (9BS0/01)\n100 marks"], "new", "b".repeat(64)),
    ], scope);
    expect(discovery.candidates).toHaveLength(2);
    expect(discovery.ambiguous).toBe(true);
    expect(new Set(discovery.candidates.map(candidate => candidate.id)).size).toBe(2);
    for (const value of ["Paper 1", "9BS0/01", "Paper 1 — Marketing (9BS0/01)"])
      expect(resolveSourceAssessment(discovery.candidates, value)).toBeNull();
  });

  it("keeps conflicting appendix codes unresolved instead of attaching one to the named paper", async () => {
    const discovery = await discoverSourceAssessments([source([
      "A-level Business\nPaper 1: Marketing\n100 marks",
      "Paper 1: 9BS0/01\nPaper 1: 9BS0/02",
    ])], scope);
    expect(discovery.ambiguous).toBe(true);
    expect(discovery.candidates).toHaveLength(3);
    expect(discovery.candidates.find(candidate => candidate.label.includes("Marketing"))?.componentCode).toBeUndefined();
    expect(resolveSourceAssessment(discovery.candidates, "Paper 1")).toBeNull();
  });

  it("does not join appendix and title evidence from unrelated source documents", async () => {
    const discovery = await discoverSourceAssessments([
      source(["A-level Business\nPaper 1: Marketing\n100 marks"], "title", "a".repeat(64)),
      source(["A-level Business\nPaper 1: 9BS0/01"], "code", "b".repeat(64)),
    ], scope);
    expect(discovery.ambiguous).toBe(true);
    expect(discovery.candidates).toHaveLength(2);
    expect(discovery.candidates.find(candidate => candidate.label.includes("Marketing"))?.componentCode).toBeUndefined();
  });
});
