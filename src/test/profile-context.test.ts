import { describe, expect, it } from "vitest";
import {
  GENERATION_CONTEXT_VERSION,
  resolveProfileContext,
  toStoredGenerationContext,
} from "@/lib/profile-context";

const biologyProfile = {
  id: "p1",
  profile_name: "Paper 1 Higher",
  exam_board: "aqa",
  educational_tier: "level2",
  assessment_tier: "higher",
};

describe("profile context resolver", () => {
  it("prefers profile values over subject, manual and preference", () => {
    const ctx = resolveProfileContext({
      subjectName: "Biology",
      profile: biologyProfile,
      subjectExamBoard: "ocr",
      manualExamBoard: "edexcel",
      manualEducationalTier: "level3_a_level",
      preferredExamBoard: "wjec",
      preferredEducationalLevel: "level1",
    });
    expect(ctx.examBoard).toBe("aqa");
    expect(ctx.educationalTier).toBe("level2");
    expect(ctx.sources).toEqual({ examBoard: "profile", educationalTier: "profile" });
    expect(ctx.assessmentTier).toBe("higher");
    expect(ctx.courseId).toBe("aqa_gcse_biology");
  });

  it("falls back subject > manual > preference when the profile is silent", () => {
    const subjectLed = resolveProfileContext({
      subjectName: "Biology",
      subjectExamBoard: "ocr",
      manualExamBoard: "edexcel",
      preferredExamBoard: "wjec",
      preferredEducationalLevel: "level2",
    });
    expect(subjectLed.examBoard).toBe("ocr");
    expect(subjectLed.sources.educationalTier).toBe("preference");

    const manualLed = resolveProfileContext({
      subjectName: "Biology",
      manualExamBoard: "edexcel",
      preferredExamBoard: "wjec",
    });
    expect(manualLed.examBoard).toBe("edexcel");
  });

  it("keeps legacy profiles unknown instead of inventing a tier", () => {
    const ctx = resolveProfileContext({
      subjectName: "Biology",
      profile: { ...biologyProfile, assessment_tier: null },
    });
    expect(ctx.assessmentTier).toBeNull();
    expect(ctx.assessmentTierSupported).toBe(true);
  });

  it("drops a stale tier when the course no longer supports tiering", () => {
    const ctx = resolveProfileContext({
      subjectName: "Biology",
      profile: { ...biologyProfile, exam_board: "edexcel" },
    });
    expect(ctx.assessmentTierSupported).toBe(false);
    expect(ctx.assessmentTier).toBeNull();
    expect(ctx.courseId).toBeNull();
  });

  it("round-trips into the stored attempt payload", () => {
    const ctx = resolveProfileContext({
      subjectName: "Biology",
      profile: biologyProfile,
    });
    const stored = toStoredGenerationContext(ctx);
    expect(stored).toMatchObject({
      context_version: GENERATION_CONTEXT_VERSION,
      subject_name: "Biology",
      profile_id: "p1",
      exam_board: "aqa",
      educational_tier: "level2",
      assessment_tier: "higher",
      course_id: "aqa_gcse_biology",
    });
  });
});
