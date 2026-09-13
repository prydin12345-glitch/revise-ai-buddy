import { describe, expect, it } from "vitest";
import {
  formatAssessmentTier,
  getAssessmentTierOptions,
  getCourseCapability,
  isValidAssessmentTierFor,
  normaliseAssessmentTier,
  supportsAssessmentTier,
} from "@/lib/assessment-tier";

const aqaGcseBiology = {
  subject: "Biology",
  examBoard: "aqa",
  educationalTier: "level2",
};

describe("assessment tier catalogue", () => {
  it("offers Foundation/Higher only for supported courses", () => {
    expect(getAssessmentTierOptions(aqaGcseBiology)).toEqual([
      "foundation",
      "higher",
    ]);
    expect(getCourseCapability(aqaGcseBiology)?.id).toBe("aqa_gcse_biology");
  });

  it("does not add tiers to other GCSEs, boards or levels", () => {
    expect(supportsAssessmentTier({ ...aqaGcseBiology, subject: "History" })).toBe(false);
    expect(supportsAssessmentTier({ ...aqaGcseBiology, examBoard: "edexcel" })).toBe(false);
    expect(supportsAssessmentTier({ ...aqaGcseBiology, educationalTier: "level3_a_level" })).toBe(false);
    expect(supportsAssessmentTier({ subject: "Biology", examBoard: "ib", educationalTier: "ib_dp" })).toBe(false);
  });

  it("treats a missing tier as unknown rather than guessing one", () => {
    expect(normaliseAssessmentTier(null)).toBeNull();
    expect(normaliseAssessmentTier("")).toBeNull();
    expect(normaliseAssessmentTier("Higher")).toBe("higher");
    expect(formatAssessmentTier(null)).toBeNull();
    expect(formatAssessmentTier("not_tiered")).toBe("Not tiered");
  });

  it("validates tier values against the course", () => {
    expect(isValidAssessmentTierFor("higher", aqaGcseBiology)).toBe(true);
    expect(isValidAssessmentTierFor(null, aqaGcseBiology)).toBe(true);
    expect(isValidAssessmentTierFor("not_tiered", aqaGcseBiology)).toBe(false);
    expect(isValidAssessmentTierFor("higher", { ...aqaGcseBiology, subject: "Physics" })).toBe(false);
    expect(isValidAssessmentTierFor("banana", aqaGcseBiology)).toBe(true); // unparsable => unknown
  });
});
