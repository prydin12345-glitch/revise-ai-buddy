import { describe, expect, it, vi } from "vitest";
import {
  isMissingColumnError,
  persistAssessmentTier,
} from "@/hooks/useSubjectProfiles";

const baseProfile: any = {
  id: "p1",
  profile_name: "Paper 1 Higher",
  subject_name: "Biology",
  exam_board: "aqa",
  educational_tier: "level2",
  assessment_tier: null,
};

/** Fake query builder returning a fixed result for the tier update. */
const clientReturning = (result: { data?: any; error?: any }) => {
  const update = vi.fn();
  const client = {
    from: () => {
      const b: any = {
        update: (payload: any) => { update(payload); return b; },
        eq: () => b,
        select: () => b,
        maybeSingle: () => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }),
      };
      return b;
    },
  } as any;
  return { client, update };
};

describe("assessment tier persistence", () => {
  it("does nothing when the tier has not changed", async () => {
    const { client, update } = clientReturning({ data: baseProfile });
    const res = await persistAssessmentTier("p1", null, baseProfile, client);
    expect(res.status).toBe("unchanged");
    expect(update).not.toHaveBeenCalled();
  });

  it("saves a changed tier and returns the fresh row", async () => {
    const saved = { ...baseProfile, assessment_tier: "higher" };
    const { client, update } = clientReturning({ data: saved });
    const res = await persistAssessmentTier("p1", "higher", baseProfile, client);
    expect(update).toHaveBeenCalledWith({ assessment_tier: "higher" });
    expect(res.status).toBe("saved");
    expect(res.profile.assessment_tier).toBe("higher");
  });

  it("reports a missing column as unsupported, not as success", async () => {
    const { client } = clientReturning({
      error: { code: "42703", message: 'column "assessment_tier" does not exist' },
    });
    const res = await persistAssessmentTier("p1", "higher", baseProfile, client);
    expect(res.status).toBe("unsupported");
    expect(res.profile.assessment_tier).toBeNull();
  });

  it("reports a genuine write failure as failed", async () => {
    const { client } = clientReturning({
      error: { code: "42501", message: "permission denied" },
    });
    const res = await persistAssessmentTier("p1", "higher", baseProfile, client);
    expect(res.status).toBe("failed");
    expect(res.message).toBe("permission denied");
  });

  it("reports a missing row as failed rather than saved", async () => {
    const { client } = clientReturning({ data: null });
    const res = await persistAssessmentTier("p1", "higher", baseProfile, client);
    expect(res.status).toBe("failed");
  });

  it("distinguishes a missing column from other database errors", () => {
    expect(isMissingColumnError(null)).toBe(false);
    expect(isMissingColumnError({ code: "PGRST204", message: "" })).toBe(true);
    expect(isMissingColumnError({ code: "42501", message: "permission denied" })).toBe(false);
  });
});
