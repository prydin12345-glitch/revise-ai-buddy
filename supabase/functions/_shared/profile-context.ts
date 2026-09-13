// Backend counterpart of src/lib/profile-context.ts.
//
// The client may claim a profile, a board, a level and a tier. The backend
// never trusts those: it re-reads the profile the caller OWNS and rebuilds the
// context from it, then validates the tier against the course catalogue.

import {
  type AssessmentTier,
  getCourseCapability,
  isValidAssessmentTierFor,
  normaliseAssessmentTier,
  supportsAssessmentTier,
} from "./assessment-tier.ts";

export const GENERATION_CONTEXT_VERSION = 1;

export interface ResolvedGenerationContext {
  contextVersion: number;
  subjectName: string;
  profileId: string | null;
  profileName: string | null;
  examBoard: string | null;
  educationalTier: string | null;
  assessmentTier: AssessmentTier | null;
  assessmentTierSupported: boolean;
  courseId: string | null;
}

export class ProfileContextError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProfileContextError";
    this.status = status;
  }
}

const clean = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

export interface ResolveArgs {
  userId: string;
  subjectName: string;
  /** Optional: a profile the caller claims. Must belong to the caller. */
  profileId?: string | null;
  /** Client-supplied fallbacks, used only when the profile has no value. */
  examBoard?: string | null;
  educationalTier?: string | null;
  assessmentTier?: string | null;
}

/**
 * Loads the owned profile (if any), merges the context and validates the tier.
 * Throws ProfileContextError for a foreign/unknown profile or an illegal tier.
 */
export const resolveProfileContext = async (
  // deno-lint-ignore no-explicit-any
  supabase: any,
  args: ResolveArgs,
): Promise<ResolvedGenerationContext> => {
  // deno-lint-ignore no-explicit-any
  let profile: any = null;

  if (args.profileId && args.profileId !== "all_topics") {
    const { data, error } = await supabase
      .from("subject_exam_profiles")
      .select("*")
      .eq("id", args.profileId)
      .eq("user_id", args.userId)
      .maybeSingle();
    if (error) throw new ProfileContextError("Could not load exam profile", 500);
    if (!data) throw new ProfileContextError("Exam profile not found", 404);
    profile = data;
  }

  const subjectName = clean(profile?.subject_name) ?? args.subjectName;
  const examBoard = clean(profile?.exam_board) ?? clean(args.examBoard);
  const educationalTier =
    clean(profile?.educational_tier) ?? clean(args.educationalTier);

  const lookup = { subject: subjectName, examBoard, educationalTier };
  const supported = supportsAssessmentTier(lookup);

  // `assessment_tier` may be absent until its migration has been applied.
  const rawTier = profile
    ? (profile.assessment_tier as string | null | undefined) ?? null
    : args.assessmentTier ?? null;

  if (!isValidAssessmentTierFor(rawTier, lookup)) {
    throw new ProfileContextError(
      `Assessment tier "${rawTier}" is not valid for this course`,
      400,
    );
  }

  return {
    contextVersion: GENERATION_CONTEXT_VERSION,
    subjectName,
    profileId: profile?.id ?? null,
    profileName: clean(profile?.profile_name),
    examBoard,
    educationalTier,
    assessmentTier: supported ? normaliseAssessmentTier(rawTier) : null,
    assessmentTierSupported: supported,
    courseId: getCourseCapability(lookup)?.id ?? null,
  };
};

export const toStoredGenerationContext = (
  ctx: ResolvedGenerationContext,
): Record<string, unknown> => ({
  context_version: ctx.contextVersion,
  subject_name: ctx.subjectName,
  profile_id: ctx.profileId,
  profile_name: ctx.profileName,
  exam_board: ctx.examBoard,
  educational_tier: ctx.educationalTier,
  assessment_tier: ctx.assessmentTier,
  course_id: ctx.courseId,
  resolved_at: new Date().toISOString(),
});

/** Prompt fragment so the model actually honours the tier. */
export const assessmentTierPrompt = (
  ctx: Pick<ResolvedGenerationContext, "assessmentTier" | "courseId">,
): string => {
  if (ctx.assessmentTier === "foundation") {
    return "ASSESSMENT TIER: Foundation. Stay within Foundation-tier content and demand; do not use Higher-tier-only material. Grade range 1-5.";
  }
  if (ctx.assessmentTier === "higher") {
    return "ASSESSMENT TIER: Higher. Use Higher-tier content and demand, including Higher-only material. Grade range 4-9.";
  }
  return "";
};
