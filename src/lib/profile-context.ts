// One resolver for "which course am I generating for?".
//
// Precedence (matches the project rule Profile > Subject > Manual > Preference):
//   exam board        profile.exam_board > subject board > manual > preference
//   qualification     profile.educational_tier > manual > preference
//   assessment tier   profile.assessment_tier (only when the course supports it)
//
// The result is a plain object that is both fed to generation and stored on
// the attempt, so later profile edits never rewrite past attempts.

import {
  type AssessmentTier,
  getCourseCapability,
  normaliseAssessmentTier,
  supportsAssessmentTier,
} from "./assessment-tier";
import { profileCourseId, resolvePaperSelection, type ResolvedPaperSelection } from '../../supabase/functions/_shared/course-selection.ts';

export const GENERATION_CONTEXT_VERSION = 2;

export interface ProfileContextProfile {
  id: string;
  profile_name?: string | null;
  exam_board?: string | null;
  educational_tier?: string | null;
  assessment_tier?: string | null;
  paper_blueprint?: unknown;
}

export interface ProfileContextInput {
  subjectName: string;
  profile?: ProfileContextProfile | null;
  subjectExamBoard?: string | null;
  manualExamBoard?: string | null;
  manualEducationalTier?: string | null;
  preferredExamBoard?: string | null;
  preferredEducationalLevel?: string | null;
}

export type ContextSource =
  | "profile"
  | "subject"
  | "manual"
  | "preference"
  | "none";

export interface ResolvedGenerationContext extends ResolvedPaperSelection {
  contextVersion: number;
  subjectName: string;
  profileId: string | null;
  profileName: string | null;
  examBoard: string | null;
  educationalTier: string | null;
  /** null means "unknown / not recorded" — never inferred. */
  assessmentTier: AssessmentTier | null;
  assessmentTierSupported: boolean;
  courseId: string | null;
  configurationError: string | null;
  sources: { examBoard: ContextSource; educationalTier: ContextSource };
}

const clean = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

const pick = (
  candidates: Array<[ContextSource, string | null]>,
): [ContextSource, string | null] =>
  candidates.find(([, v]) => v !== null) ?? ["none", null];

export const resolveProfileContext = (
  input: ProfileContextInput,
): ResolvedGenerationContext => {
  const profile = input.profile ?? null;

  const [boardSource, examBoard] = pick([
    ["profile", clean(profile?.exam_board)],
    ["subject", clean(input.subjectExamBoard)],
    ["manual", clean(input.manualExamBoard)],
    ["preference", clean(input.preferredExamBoard)],
  ]);

  const [levelSource, educationalTier] = pick([
    ["profile", clean(profile?.educational_tier)],
    ["manual", clean(input.manualEducationalTier)],
    ["preference", clean(input.preferredEducationalLevel)],
  ]);

  const lookup = {
    subject: input.subjectName,
    examBoard,
    educationalTier,
    courseId: profileCourseId(profile?.paper_blueprint),
  };
  const supported = supportsAssessmentTier(lookup);
  const stored = normaliseAssessmentTier(profile?.assessment_tier);
  let selection: ResolvedPaperSelection = {courseId: getCourseCapability(lookup)?.id ?? null, paperId: null, componentCode: null, paperContract: null};
  let configurationError: string | null = null;
  try { selection = resolvePaperSelection(lookup, supported ? stored : null, profile?.paper_blueprint); }
  catch (error) { configurationError = error instanceof Error ? error.message : 'Check the saved course and paper.'; }

  return {
    contextVersion: GENERATION_CONTEXT_VERSION,
    subjectName: input.subjectName,
    profileId: profile?.id ?? null,
    profileName: clean(profile?.profile_name),
    examBoard,
    educationalTier,
    // A stored tier is only honoured while the course still supports tiering.
    assessmentTier: supported ? stored : null,
    assessmentTierSupported: supported,
    ...selection,
    configurationError,
    sources: { examBoard: boardSource, educationalTier: levelSource },
  };
};

/**
 * Compact payload describing an attempt's course context.
 *
 * The browser NEVER persists this: the authoritative snapshot is created by the
 * backend after an ownership check and carries `resolved_by: "server"`. This
 * client copy is marked accordingly and is only used for display and for the
 * request payload, so a backend will always discard and re-resolve it.
 */
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
  resolved_by: "client",
  resolved_at: new Date().toISOString(),
});
