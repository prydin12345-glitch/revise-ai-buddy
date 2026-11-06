// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  classifySpecificationVersion,
  isSpecificationVersionHint,
  specificationVersionsEquivalent,
} from "../functions/_shared/profile-version-context";

describe("student specification version context", () => {
  it("keeps the reported teaching/exam dates as contextual metadata", () => {
    const value = "First teaching 2015, first exams 2017";
    expect(classifySpecificationVersion(value)).toEqual({
      kind: "timeline",
      value,
      teachingYear: 2015,
      firstAssessmentYear: 2017,
    });
    expect(isSpecificationVersionHint(value)).toBe(true);
  });

  it.each([
    ["For teaching from September 2015 onwards", { teachingYear: 2015 }],
    ["First teaching: September 2015", { teachingYear: 2015 }],
    ["FIRST TAUGHT FROM 2015", { teachingYear: 2015 }],
    ["first assessment in 2017", { firstAssessmentYear: 2017 }],
    ["For first examinations May/June 2017", { firstAssessmentYear: 2017 }],
    [
      "First teaching 2015; first examinations 2017.",
      { teachingYear: 2015, firstAssessmentYear: 2017 },
    ],
    [
      " First teaching 2015\nFirst assessment June 2017 ",
      { teachingYear: 2015, firstAssessmentYear: 2017 },
    ],
    [
      "Teaching from 2015 and first exams 2017",
      { teachingYear: 2015, firstAssessmentYear: 2017 },
    ],
  ])("recognises a complete clear timeline: %s", (value, metadata) => {
    expect(classifySpecificationVersion(value as string)).toMatchObject({
      kind: "timeline",
      value: (value as string).trim(),
      ...(metadata as object),
    });
    expect(isSpecificationVersionHint(value as string)).toBe(true);
  });

  it.each(["", "  ", "Not verified", "UNKNOWN"])(
    "recognises an unspecified placeholder: %s",
    (value) => {
      expect(classifySpecificationVersion(value).kind).toBe("unspecified");
      expect(isSpecificationVersionHint(value)).toBe(true);
    },
  );

  it.each([
    "2015",
    "September 2015",
    "Exams 2017",
    "v1.4-july-2026",
    "Version 1.4; first teaching 2015",
    "First teaching 2015, first exams 2017; Issue 2",
    "Cohort 2015",
    "2015 specification",
    "First teaching 2015 for the 2017 cohort",
    "First teaching 2015, first exams 2017, revised content",
    "For teaching from onwards",
    "First teaching 2015-2017",
    "First teaching 2015; first teaching 2016",
    "First exams 2017; first exams 2018",
    "v1.4",
    "the older course",
  ])("preserves explicit or ambiguous identity text: %s", (value) => {
    expect(classifySpecificationVersion(value)).toEqual({
      kind: "explicit",
      value,
    });
    expect(isSpecificationVersionHint(value)).toBe(false);
  });
});

describe("strict specification version comparison", () => {
  it.each([
    ["v1.4-july-2026", "Version 1.4 July 2026"],
    ["VERSION: 1.4 July 2026", "v 1.4–July–2026"],
    ["v1.4", "1.4"],
    ["Issue 4", "issue-4"],
    ["Edition 2", "EDITION: 2"],
    ["Cohort 2025-2026", "cohort 2025–2026"],
    ["Unregistered course version", " unregistered  course version "],
  ])("accepts only display-equivalent identities: %s / %s", (a, b) => {
    expect(specificationVersionsEquivalent(a, b)).toBe(true);
    expect(specificationVersionsEquivalent(b, a)).toBe(true);
  });

  it.each([
    ["v1.4", "v1.3"],
    ["v1.4", "v14"],
    ["v1-4", "v14"],
    ["v1.4", "v1.40"],
    ["Version 1.4 July 2026", "Version 1.4 July 2025"],
    ["Issue 4", "Version 4"],
    ["Edition 2", "Issue 2"],
    ["Cohort 2025-2026", "Cohort 20252026"],
    ["Cohort 2025", "Cohort 2026"],
    ["2015", "First teaching 2015"],
    ["unknown", "v1.4"],
    ["First teaching 2015, first exams 2017", "v1.4-july-2026"],
    ["First teaching 2015", "First teaching 2016"],
    ["unregistered course version", "unregisteredcourseversion"],
  ])("retains distinct version/edition/cohort constraints: %s / %s", (a, b) => {
    expect(specificationVersionsEquivalent(a, b)).toBe(false);
    expect(specificationVersionsEquivalent(b, a)).toBe(false);
  });

  it("keeps all explicitly unspecified placeholders equivalent", () => {
    expect(specificationVersionsEquivalent("", "Not verified")).toBe(true);
    expect(specificationVersionsEquivalent("UNKNOWN", "")).toBe(true);
  });
});
