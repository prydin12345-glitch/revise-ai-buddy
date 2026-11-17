// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  validateEvidence,
  type ProfileEvidence,
} from "../functions/_shared/profile-evidence";
import { fillFormatsFromCitedBlock } from "../functions/_shared/profile-builder-jobs";
import { sourceTextIncludes } from "../functions/_shared/source-text-match";
import { ownerEvidence } from "./profile-builder-fixtures";
import { businessFormatExcerpts } from "./fixtures/business-response-format-evidence";

type Formats = ProfileEvidence["facts"]["formats"];
// Synthetic minimal brief; only the Business format sentences above are public
// source excerpts. Tests never read student data, call a model or fetch a URL.
async function brief(text: string, formats: Formats = [], quote = text) {
  const e = await ownerEvidence();
  e.identity.tier = null;
  e.documents[0].locations = [{
    id: "assessment", page: 14, section: "Assessment overview",
    text: `100 marks; 2 hours.\n${text}`,
  }];
  e.facts = {
    marks: 100, durationMinutes: 120, topics: [], tier: null,
    calculator: "unknown", selection: "unknown", formats,
    mathsRequirement: null, practicalRequirement: null,
  };
  e.claims = [
    { field: "marks", quote: "100 marks" },
    { field: "durationMinutes", quote: "2 hours" },
    ...(formats.length ? [{ field: "formats", quote }] : []),
  ].map((claim) => ({
    ...claim, documentId: "owner-doc", locationId: "assessment",
    rule: "mandatory" as const,
  }));
  return e;
}

const supported: Array<{ text: string; formats: Formats }> = [
  ...businessFormatExcerpts.map(({ text }) => ({
    text, formats: ["short_answer", "long_form"] as Formats,
  })),
  { text: "Multi-part data-response questions.", formats: ["short_answer"] },
  { text: "Source-based questions divided into multiple parts.", formats: ["short_answer"] },
  { text: "Multi-part case-study questions.", formats: ["short_answer"] },
  { text: "Questions based on case studies with three parts.", formats: ["short_answer"] },
  { text: "Data response questions with several parts.", formats: ["short_answer"] },
  { text: "Essay questions.", formats: ["long_form"] },
  { text: "Extended open-response questions.", formats: ["long_form"] },
  { text: "Extended writing.", formats: ["long_form"] },
  { text: "Long-form answers.", formats: ["long_form"] },
  { text: "Short structured answers and calculations.", formats: ["short_answer"] },
  { text: "Short and long answer questions; multiple-choice questions.", formats: ["short_answer", "long_form", "mcq_single"] },
  { text: "Short–answer and extended open–response questions.", formats: ["short_answer", "long_form"] },
];

const unsupported: Array<{ text: string; format: Formats[number] }> = [
  { text: "Data-response questions.", format: "short_answer" },
  { text: "Source-based questions.", format: "short_answer" },
  { text: "Case-study questions.", format: "short_answer" },
  { text: "Several case studies are used to teach business.", format: "short_answer" },
  { text: "The extended curriculum covers business strategy.", format: "long_form" },
  { text: "A short course with structured teaching.", format: "short_answer" },
  { text: "No short-answer questions are assessed.", format: "short_answer" },
  { text: "Multiple-choice questions are excluded.", format: "mcq_single" },
  { text: "This paper does not include essay questions.", format: "long_form" },
  { text: "Extended open-response questions are not included.", format: "long_form" },
  { text: "This paper is without long-answer questions.", format: "long_form" },
  { text: "No multi-part data-response questions are assessed.", format: "short_answer" },
  { text: "Source-based questions are not divided into multiple parts.", format: "short_answer" },
  { text: "Multi-part case-study questions are used in teaching.", format: "short_answer" },
  { text: "Teachers may use short-answer questions in lessons.", format: "short_answer" },
  { text: "Students practise extended open-response questions.", format: "long_form" },
  { text: "Revision includes essay questions.", format: "long_form" },
  { text: "Multiple-choice questions are classroom activities.", format: "mcq_single" },
  { text: "Students learn calculations in lessons.", format: "short_answer" },
  { text: "Students learn essay writing.", format: "long_form" },
  { text: "This paper won’t include essay questions.", format: "long_form" },
  { text: "This paper does not include:\n• Short-answer questions.", format: "short_answer" },
  { text: "Teaching activities:\n• Essay questions.", format: "long_form" },
];

describe("source response format validation", () => {
  it.each(supported)("accepts direct format evidence: $text", async ({ text, formats }) => {
    const e = await brief(text, formats);
    expect(validateEvidence(e).facts.formats).toEqual(formats);
    e.claims.find((c) => c.field === "formats")!.rule = "observed";
    expect(validateEvidence(e).facts.formats).toEqual(formats);
  });

  it.each(unsupported)("rejects an unsupported format: $text", async ({ text, format }) => {
    const e = await brief(text, [format]);
    expect(() => validateEvidence(e)).toThrow(/Response format/);
  });

  it.each([
    ["No essay questions are included.", "essay questions", "long_form"],
    ["Short-answer questions are not assessed.", "Short-answer questions", "short_answer"],
    ["Teachers use multi-part case-study questions in lessons.", "multi-part case-study questions", "short_answer"],
    ["Students practise multiple-choice questions.", "multiple-choice questions", "mcq_single"],
  ] as const)("rejects a cropped quote from %s", async (text, quote, format) => {
    const e = await brief(text, [format], quote);
    expect(() => validateEvidence(e)).toThrow(/Response format/);
  });

  it("requires multipart wording in the quote, rather than elsewhere in the passage", async () => {
    const e = await brief(businessFormatExcerpts[0].text, ["short_answer"], "data response question");
    expect(() => validateEvidence(e)).toThrow(/Response format/);
    e.claims.push({ ...e.claims[2], quote: "a number of parts" });
    expect(() => validateEvidence(e)).toThrow(/Response format/);
  });

  it("cannot broaden an uploaded quote using other formats in its location", async () => {
    const e = await brief("Short-answer questions. Essay questions.", ["short_answer", "long_form"], "Short-answer questions");
    expect(() => validateEvidence(e)).toThrow(/Response format/);
    e.claims.push({ ...e.claims[2], quote: "Essay questions" });
    expect(validateEvidence(e).facts.formats).toEqual(["short_answer", "long_form"]);
  });

  it("keeps the literal-reference gate for invented or paraphrased quotes", async () => {
    const e = await brief(businessFormatExcerpts[0].text, ["short_answer", "long_form"], "Multi-part case-study and essay questions");
    expect(() => validateEvidence(e)).toThrow(/reference does not resolve/);
  });

  it("a model-labelled assessment heading cannot turn teaching into evidence", async () => {
    const e = await brief("Teachers use essay questions in lessons.", ["long_form"], "essay questions");
    e.documents[0].locations[0].section = "Official examination question formats";
    expect(() => validateEvidence(e)).toThrow(/Response format/);
  });

  it.each([
    ["This paper does not include:\n• Short-answer questions.", "Short-answer questions", "short_answer"],
    ["Teaching activities:\n• Essay questions.", "Essay questions", "long_form"],
  ] as const)("retains prefix heading context outside the quote: %s", async (text, quote, format) => {
    const e = await brief(text, [format], quote);
    expect(() => validateEvidence(e)).toThrow(/Response format/);
  });
});

describe("format recovery from an already cited assessment block", () => {
  it.each(supported)("recovers complete quote-backed formats: $text", async ({ text, formats }) => {
    const e = await brief(text), before = structuredClone(e);
    const recovered = fillFormatsFromCitedBlock(e);
    expect(new Set(recovered.facts.formats)).toEqual(new Set(formats));
    expect(e).toEqual(before);
    const claims = recovered.claims.filter((c) => c.field === "formats");
    expect(claims.length).toBeGreaterThan(0);
    for (const claim of claims) {
      expect(claim).toMatchObject({ documentId: "owner-doc", locationId: "assessment", rule: "mandatory" });
      expect(claim.quote.length).toBeLessThanOrEqual(200);
      expect(sourceTextIncludes(e.documents[0].locations[0].text, claim.quote)).toBe(true);
    }
    expect(validateEvidence(recovered)).toEqual(recovered);
    expect(fillFormatsFromCitedBlock(recovered)).toBe(recovered);
  });

  it.each(unsupported)("leaves unsupported formats unknown: $text", async ({ text }) => {
    const e = await brief(text);
    expect(fillFormatsFromCitedBlock(e)).toBe(e);
  });

  it("ignores a negated sentence and recovers a separate positive sentence", async () => {
    const e = await brief("No multiple-choice questions. Short-answer questions; extended open-response questions.");
    const recovered = fillFormatsFromCitedBlock(e);
    expect(recovered.facts.formats).toEqual(["short_answer", "long_form"]);
    expect(recovered.claims.filter((c) => c.field === "formats")).toHaveLength(2);
  });

  it("does not cut a long clause before its prohibition or copy unrelated leading text", async () => {
    const text = `Short-answer questions ${"and supporting examples ".repeat(10)}are not assessed.`;
    const e = await brief(text);
    expect(fillFormatsFromCitedBlock(e)).toBe(e);
    const longPositive = await brief(`Essay questions ${"with supporting evidence ".repeat(10)}are assessed.`);
    expect(fillFormatsFromCitedBlock(longPositive)).toBe(longPositive);
    const laterPositive = await brief(`${"Unrelated introductory material ".repeat(9)}. Essay questions.`);
    const recovered = fillFormatsFromCitedBlock(laterPositive);
    expect(recovered.facts.formats).toEqual(["long_form"]);
    expect(recovered.claims.at(-1)!.quote).toBe("Essay questions.");
  });

  it("ignores uncited locations and documents even when their location IDs match", async () => {
    const e = await brief("Written examination.");
    e.documents[0].locations.push({ ...e.documents[0].locations[0], id: "uncited", text: businessFormatExcerpts[0].text });
    e.documents.push({ ...e.documents[0], id: "other-document", locations: [{ ...e.documents[0].locations[0], text: "Essay questions." }] });
    expect(fillFormatsFromCitedBlock(e)).toBe(e);
  });

  it.each(["official_registered", "superseded", "unknown", "teaching"] as const)(
    "does not recover from ineligible %s evidence", async (reason) => {
      const e = await brief(businessFormatExcerpts[0].text);
      if (reason === "official_registered") e.documents[0].authority = reason;
      if (reason === "superseded") e.documents[0].state = reason;
      if (reason === "unknown") e.claims.forEach((c) => { c.rule = "unknown"; });
      if (reason === "teaching") e.documents[0].locations[0].section = "Teaching activities";
      expect(fillFormatsFromCitedBlock(e)).toBe(e);
    },
  );

  it("retains existing formats without silently adding others", async () => {
    const e = await brief(businessFormatExcerpts[0].text, ["long_form"]);
    expect(fillFormatsFromCitedBlock(e)).toBe(e);
    expect(e.facts.formats).toEqual(["long_form"]);
  });

  it("does not duplicate claims when a format description is repeated", async () => {
    const e = await brief(`${businessFormatExcerpts[0].text}\n${businessFormatExcerpts[0].text}`);
    const recovered = fillFormatsFromCitedBlock(e);
    expect(recovered.facts.formats).toEqual(["short_answer", "long_form"]);
    expect(recovered.claims.filter((c) => c.field === "formats")).toHaveLength(1);
  });

  it.each(["mandatory", "observed"] as const)("reuses an existing %s claim when only the format facts were omitted", async (rule) => {
    const e = await brief("Essay questions.", ["long_form"], "Essay questions");
    e.facts.formats = [];
    e.claims[2].rule = rule;
    const recovered = fillFormatsFromCitedBlock(e);
    expect(recovered.facts.formats).toEqual(["long_form"]);
    expect(recovered.claims).toEqual(e.claims);
    expect(validateEvidence(recovered)).toEqual(recovered);
  });

  it("cannot repair another unsupported fact or mutate the rejected input", async () => {
    const e = await brief(businessFormatExcerpts[0].text);
    e.facts.marks = 101;
    const before = structuredClone(e);
    expect(fillFormatsFromCitedBlock(e)).toBe(e);
    expect(e).toEqual(before);
  });
});
