import {
  biologyPaperDefinition,
  buildPaperPlan,
  type PaperMode,
} from "@/lib/biology-paper-contract";
import { formatEducationalTier } from "@/lib/level-display";
import { formatAssessmentTier } from "@/lib/assessment-tier";
import {
  profileCourseId,
  profilePaperId,
} from "../../supabase/functions/_shared/course-selection";

export interface ProfileDisplaySource {
  profile_name: string;
  question_count: number;
  educational_tier: string | null;
  assessment_tier?: string | null;
  exam_board?: string | null;
  time_limit_minutes?: number | null;
  question_structure?: string | null;
  paper_blueprint?: unknown;
}

/** Display derived from the saved identity/version; it does not award approval. */
export function examProfileDisplay(profile: ProfileDisplaySource) {
  const blueprint = profile.paper_blueprint as
    | {
        paperContract?: { mode?: string; contractVersion?: number };
        sections?: unknown[];
      }
    | undefined;
  const courseId = profileCourseId(blueprint);
  const paperId = profilePaperId(blueprint);
  const tier =
    profile.assessment_tier === "foundation" ||
    profile.assessment_tier === "higher"
      ? profile.assessment_tier
      : profile.assessment_tier === "not_tiered"
        ? "not_tiered"
        : null;
  const contract = blueprint?.paperContract;
  const definition = biologyPaperDefinition(
    courseId,
    tier,
    paperId,
    contract?.contractVersion,
  );
  let plan = null;
  if (
    courseId &&
    contract &&
    ["full_mock", "short_practice"].includes(contract.mode ?? "")
  ) {
    try {
      plan = buildPaperPlan(
        contract.mode as PaperMode,
        tier,
        courseId,
        paperId,
        contract.contractVersion,
      );
    } catch {
      /* Legacy/unsupported identity: retain stored metrics. */
    }
  }
  const mode =
    contract?.mode === "full_mock"
      ? "Full mock"
      : contract?.mode === "short_practice"
        ? "Short practice"
        : Array.isArray(blueprint?.sections) && blueprint.sections.length
          ? "Custom layout"
          : "Custom";
  const identity = [
    profile.exam_board,
    formatEducationalTier(profile.educational_tier),
    formatAssessmentTier(profile.assessment_tier),
  ]
    .filter(Boolean)
    .join(" · ");
  const minutes = plan?.durationMinutes ?? profile.time_limit_minutes;
  const count = plan?.partCount ?? profile.question_count;
  return {
    mode,
    identity,
    paper:
      definition && (contract || paperId)
        ? [
            definition.displayName,
            definition.componentCode &&
            !definition.displayName.includes(definition.componentCode)
              ? definition.componentCode
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : null,
    countLabel: `${count} ${plan || profile.question_structure === "sub_questions" ? "parts" : "questions"}`,
    timeLabel: minutes != null ? `${minutes} min` : null,
    marksLabel: plan ? `${plan.totalMarks} marks` : null,
  };
}
