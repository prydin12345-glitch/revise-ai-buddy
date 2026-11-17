// @vitest-environment node
import { expect, it } from "vitest";
import { readablePdfText, MAX_LAYOUT_ITEMS, type PdfTextItem } from "../functions/_shared/profile-pdf-layout";
import { sourceTextIncludes } from "../functions/_shared/source-text-match";
import { getDocumentProxy } from "unpdf";
import { jsPDF } from "jspdf";
import { extractIndexedPdfPages } from "../functions/_shared/profile-document-io";
import { indexDocumentPages } from "../functions/_shared/profile-document-index";

function item(str: string, x: number, y: number, w = 110, h = 10): PdfTextItem {
  return { str, transform: [h, 0, 0, h, x, y], width: w, height: h, hasEOL: true };
}
function columns() {
  return [item("Assessment overview", 20, 780, 500),
    item("Paper 1: Marketing", 20, 740), item("Paper 2: Strategy", 320, 740),
    item("100 marks", 20, 720), item("90 marks", 320, 720),
    item("Duration: 2 hours", 20, 700), item("Duration: 1 hour", 320, 700),
    item("Qualification content", 20, 650, 500)];
}
it("reads interleaved columns as complete assessment blocks while retaining every visible item", () => {
  const items = columns(), text = readablePdfText(items);
  expect(text).toContain("Paper 1: Marketing\n100 marks\nDuration: 2 hours\nPaper 2: Strategy\n90 marks\nDuration: 1 hour");
  for (const p of items) expect(text.split(p.str!)).toHaveLength(2);
  expect(sourceTextIncludes(text, "Paper 1: Marketing 90 marks")).toBe(false);
  expect(sourceTextIncludes(text, "Paper 1: Marketing 100 marks")).toBe(true);
});
it("separates a real PDF's interleaved text before selected-paper indexing and literal quote checks", async () => {
  const pdf = new jsPDF({ unit: "pt", format: [600, 800] });
  pdf.setFontSize(10);
  pdf.text("Paper 1: Marketing", 20, 60);
  pdf.text("Paper 2: Strategy", 320, 60);
  pdf.text("100 marks", 20, 80);
  pdf.text("90 marks", 320, 80);
  pdf.text("Duration: 120 minutes", 20, 100);
  pdf.text("Duration: 60 minutes", 320, 100);
  const pages = await extractIndexedPdfPages(new Uint8Array(pdf.output("arraybuffer")), getDocumentProxy as any);
  expect(pages[0]).toContain("Paper 1: Marketing\n100 marks\nDuration: 120 minutes\nPaper 2: Strategy");
  const selected = indexDocumentPages(pages, { component: "Paper 1", subject: "Business" });
  const selectedText = selected.chunks.flatMap((chunk) => chunk.pages).map((page) => page.text).join("\n");
  expect(selectedText).toContain("100 marks");
  expect(selectedText).not.toContain("90 marks");
  expect(sourceTextIncludes(selectedText, "Duration: 120 minutes")).toBe(true);
  expect(sourceTextIncludes(selectedText, "Duration: 60 minutes")).toBe(false);
});
it("retains small raised and lowered glyphs, including a visible item without its own line ending", () => {
  const items = columns();
  items.splice(4, 0, item("m", 20, 680, 8), { ...item("²", 28, 684, 4, 6), hasEOL: false }, item("CO", 50, 680, 15), item("₂", 65, 676, 4, 6));
  const text = readablePdfText(items);
  expect(text).toBe(items.map((p) => p.str + (p.hasEOL ? "\n" : " ")).join(""));
  expect(text).toContain("90 marks");
});
it.each([6, 8, 10])("preserves original scientific fragment order at glyph height %s instead of guessing a base", (height) => {
  const items = columns();
  items.splice(6, 0, item("m", 20, 690, 8), item("²", 30, 694, 4, height));
  const text = readablePdfText(items);
  expect(text).toBe(items.map((p) => p.str + (p.hasEOL ? "\n" : " ")).join(""));
  expect(text).not.toContain("hours²");
});
it.each(["A-", "A-Level", "A LEVEL", "A‑level"])("keeps fragmented %s qualification boundaries and text-valued labelled tables in original order", (boundary) => {
  const fragmented = columns();
  fragmented.splice(4, 0, item(boundary, 20, 710, 295), item("level assessment", 320, 710, 180));
  const table = [item("Paper 1", 200, 740, 60), item("Paper 2", 400, 740, 60),
    item("Duration", 20, 720, 80), item("2 hours", 200, 720, 60), item("1 hour", 400, 720, 60),
    item("Total marks", 20, 700, 80), item("100 marks", 200, 700, 60), item("90 marks", 400, 700, 60)];
  for (const items of [fragmented, table])
    expect(readablePdfText(items)).toBe(items.map((p) => p.str + (p.hasEOL ? "\n" : " ")).join(""));
});
it("does not move AS evidence across a full-width A-level boundary", () => {
  const as = columns().map((p) => ({ ...p, str: p.str?.replace("Paper 1: Marketing", "AS assessment").replace("Paper 2: Strategy", "A-level assessment") }));
  const lower = columns().map((p) => ({ ...p, transform: p.transform!.map((v, i) => i === 5 ? v - 200 : v), str: p.str?.replace("100 marks", "Lower-section facts") }));
  const text = readablePdfText([...as, ...lower]);
  expect(text.indexOf("Qualification content")).toBeLessThan(text.indexOf("Lower-section facts"));
  expect(text.indexOf("A-level assessment")).toBeLessThan(text.indexOf("Lower-section facts"));
});
it.each(["missing", "rotated", "nonfinite", "oversized", "table"])("keeps the original stream for uncertain %s layout", (mode) => {
  let items = columns();
  if (mode === "missing") items.push({ str: "unpositioned visible item" });
  if (mode === "rotated") items[3].transform![1] = 10;
  if (mode === "nonfinite") items[3].width = NaN;
  if (mode === "oversized") items = Array.from({ length: MAX_LAYOUT_ITEMS + 1 }, (_, n) => item(String(n), 20, 500));
  if (mode === "table") items.splice(3, 0, ...Array.from({ length: 12 }, (_, i) => item(String(i), i % 2 ? 320 : 20, 680 - i)));
  const expected = items.map((p) => (p.str ?? "") + (p.hasEOL ? "\n" : " ")).join("");
  expect(readablePdfText(items)).toBe(expected);
});
it("does not infer columns from ordinary paragraphs, repeated headings or an item spanning the gutter", () => {
  for (const changed of [
    columns().map((p) => ({ ...p, str: p.str?.replace(/Paper [12]: /, "Paragraph ") })),
    columns().map((p) => ({ ...p, str: p.str?.replace("Paper 2: Strategy", "Paper 1: Marketing") })),
    [...columns(), item("Visible wide text across both assessments", 20, 730, 500)],
  ]) {
    expect(readablePdfText(changed)).toBe(changed.map((p) => p.str + (p.hasEOL ? "\n" : " ")).join(""));
  }
});
