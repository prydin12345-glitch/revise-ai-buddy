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
    expect(supportsAssessmentTier({ ...aqaGcseBiology, examBoard: "wjec" })).toBe(false);
    expect(supportsAssessmentTier({ ...aqaGcseBiology, educationalTier: "level3_a_level" })).toBe(false);
    expect(supportsAssessmentTier({ subject: "Biology", examBoard: "ib", educationalTier: "ib_dp" })).toBe(false);
  });

  it("matches user-named subjects that carry qualification or tier words", () => {
    expect(supportsAssessmentTier({ ...aqaGcseBiology, subject: "Biology Higher" })).toBe(true);
    expect(supportsAssessmentTier({ ...aqaGcseBiology, subject: "GCSE Biology Paper 1" })).toBe(true);
    // Decoration stripping must not turn one subject into another.
    expect(supportsAssessmentTier({ ...aqaGcseBiology, subject: "Combined Science Higher" })).toBe(false);
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
    // Only genuinely absent values are "unknown". An explicit string that is
    // not a tier is rejected rather than silently treated as legacy data.
    expect(isValidAssessmentTierFor(undefined, aqaGcseBiology)).toBe(true);
    expect(isValidAssessmentTierFor("  ", aqaGcseBiology)).toBe(true);
    expect(isValidAssessmentTierFor("banana", aqaGcseBiology)).toBe(false);
  });
});
