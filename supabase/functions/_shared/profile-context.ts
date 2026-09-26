// Backend counterpart of src/lib/profile-context.ts.
//
// The client may claim a profile, a board, a level and a tier. The backend
// never trusts those: it re-reads the profile the caller OWNS and rebuilds the
// context from it, then validates the tier against the course catalogue.

import {
  type AssessmentTier,
  isValidAssessmentTierFor,
  normaliseAssessmentTier,
  supportsAssessmentTier,
} from "./assessment-tier.ts";
import { profileCourseId, resolvePaperSelection, type ResolvedPaperSelection } from './course-selection.ts';

export const GENERATION_CONTEXT_VERSION = 2;

export interface ResolvedGenerationContext extends ResolvedPaperSelection {
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

  const lookup = { subject: subjectName, examBoard, educationalTier, courseId: profileCourseId(profile?.paper_blueprint) };
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

  let selection: ResolvedPaperSelection;
  try { selection = resolvePaperSelection(lookup, supported ? normaliseAssessmentTier(rawTier) : null, profile?.paper_blueprint); }
  catch (error) { throw new ProfileContextError(error instanceof Error ? error.message : 'Invalid course selection'); }
  return {
    contextVersion: GENERATION_CONTEXT_VERSION,
    subjectName,
    profileId: profile?.id ?? null,
    profileName: clean(profile?.profile_name),
    examBoard,
    educationalTier,
    assessmentTier: supported ? normaliseAssessmentTier(rawTier) : null,
    assessmentTierSupported: supported,
    ...selection,
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
  paper_id: ctx.paperId,
  component_code: ctx.componentCode,
  paper_contract: ctx.paperContract,
  ...(ctx.specificationVersion ? {specification_version:ctx.specificationVersion} : {}),
  resolved_by: SERVER_RESOLVED_MARKER,
  resolved_at: new Date().toISOString(),
});

/**
 * A stored snapshot may only be REUSED when the backend wrote it. The JSON
 * marker ALONE does not establish trust: the database also forbids any
 * authenticated client from writing, changing or clearing generation_context
 * (see the guard trigger), and the snapshot must still describe the same
 * profile as the row that carries it.
 */
export const isServerResolvedContext = (value: unknown): boolean =>
  !!value &&
  typeof value === "object" &&
  (value as Record<string, unknown>).resolved_by === SERVER_RESOLVED_MARKER &&
  [1, GENERATION_CONTEXT_VERSION].includes((value as Record<string, unknown>).context_version as number);

/** Does a trusted-looking snapshot actually belong to this row? */
const matchesRow = (
  ctx: Record<string, unknown>,
  // deno-lint-ignore no-explicit-any
  row: any,
): boolean => {
  const rowProfile = row?.profile_id ?? null;
  const ctxProfile = (ctx.profile_id as string | null) ?? null;
  const normalised = rowProfile === "all_topics" ? null : rowProfile;
  return ctxProfile === normalised;
};

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
 * - A snapshot already written BY THE SERVER (marker + matching profile) is
 *   reused unchanged, so retries and later profile edits never change an
 *   existing attempt.
 * - Anything else is discarded and re-resolved from the profile the caller
 *   actually owns, then persisted. Persistence is MANDATORY: if the write
 *   fails, or matches no owned row, generation stops before any AI call.
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
): Promise<Record<string, unknown>> => {
  const existing = setData?.generation_context ?? null;

  if (
    isServerResolvedContext(existing) &&
    matchesRow(existing as Record<string, unknown>, setData)
  ) {
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

  // Mandatory persistence. Without a stored snapshot there is nothing to reuse
  // on a retry, so we must not spend an AI call.
  const { data, error } = await supabase
    .from("practice_question_sets")
    .update({ generation_context: stored })
    .eq("id", setId)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    throw new ProfileContextError(
      `Could not store generation context: ${error.message}`,
      500,
    );
  }
  if (!Array.isArray(data) || data.length === 0) {
    throw new ProfileContextError(
      "Could not store generation context: no owned practice set matched",
      403,
    );
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
