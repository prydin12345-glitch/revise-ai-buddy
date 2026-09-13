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

/** Marks a snapshot the backend itself produced after an ownership check. */
export const SERVER_RESOLVED_MARKER = "server";

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
  resolved_by: SERVER_RESOLVED_MARKER,
  resolved_at: new Date().toISOString(),
});

/**
 * A stored snapshot may only be REUSED when the backend wrote it. Anything a
 * client managed to write is discarded and re-resolved from the owned profile.
 */
export const isServerResolvedContext = (value: unknown): boolean =>
  !!value &&
  typeof value === "object" &&
  (value as Record<string, unknown>).resolved_by === SERVER_RESOLVED_MARKER &&
  (value as Record<string, unknown>).context_version ===
    GENERATION_CONTEXT_VERSION;

/** Reads the tier out of a stored snapshot, ignoring anything client-supplied. */
export const storedAssessmentTier = (value: unknown): AssessmentTier | null => {
  if (!isServerResolvedContext(value)) return null;
  return normaliseAssessmentTier(
    (value as Record<string, unknown>).assessment_tier as string | null,
  );
};

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

/**
 * Establishes the authoritative course snapshot for a practice set.
 *
 * - A snapshot already written BY THE SERVER is reused unchanged, so retries
 *   and later profile edits never change an existing attempt.
 * - Anything else (including JSON a client managed to write) is discarded and
 *   re-resolved from the profile the caller actually owns, then persisted.
 * - `setData.exam_board` / `setData.educational_tier` are aligned to the
 *   resolved values so prompts, stored fields and cache identity all agree.
 */
export const establishGenerationContext = async (
  // deno-lint-ignore no-explicit-any
  supabase: any,
  setId: string,
  userId: string,
  // deno-lint-ignore no-explicit-any
  setData: any,
): Promise<Record<string, unknown> | null> => {
  const existing = setData?.generation_context ?? null;

  if (isServerResolvedContext(existing)) {
    applyContextToSet(setData, existing);
    return existing as Record<string, unknown>;
  }

  if (existing) {
    console.warn(
      `[context] discarding untrusted generation_context on set ${setId} (resolved_by=${
        (existing as Record<string, unknown>).resolved_by ?? "none"
      })`,
    );
  }

  const resolved = await resolveProfileContext(supabase, {
    userId,
    subjectName: setData?.subject_id ?? "",
    profileId: setData?.profile_id ?? null,
    examBoard: setData?.exam_board ?? null,
    educationalTier: setData?.educational_tier ?? null,
  });
  const stored = toStoredGenerationContext(resolved);

  const { error } = await supabase
    .from("practice_question_sets")
    .update({ generation_context: stored })
    .eq("id", setId)
    .eq("user_id", userId);
  if (error) {
    // The column arrives with the assessment-tier migration.
    console.warn("generation_context not stored yet:", error.message);
  }

  applyContextToSet(setData, stored);
  return stored;
};

/** Keeps the in-memory set row in step with the authoritative snapshot. */
// deno-lint-ignore no-explicit-any
const applyContextToSet = (setData: any, ctx: Record<string, unknown> | unknown) => {
  if (!setData || !ctx || typeof ctx !== "object") return;
  const c = ctx as Record<string, unknown>;
  if (typeof c.exam_board === "string" && c.exam_board) {
    setData.exam_board = c.exam_board;
  }
  if (typeof c.educational_tier === "string" && c.educational_tier) {
    setData.educational_tier = c.educational_tier;
  }
};
