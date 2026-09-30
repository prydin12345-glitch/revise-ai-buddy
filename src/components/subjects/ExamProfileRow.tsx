import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { formatEducationalTier } from "@/lib/level-display";
import { formatAssessmentTier } from "@/lib/assessment-tier";

interface ExamProfileRowProps {
  profile: {
    id: string;
    profile_name: string;
    question_count: number;
    educational_tier: string | null;
    assessment_tier?: string | null;
    paper_blueprint?: any;
  };
  subjectName: string;
  subjectColor?: string | null;
  onEdit: () => void;
}

/**
 * The phone version of a profile: one slim row instead of a 200px card.
 * The colour bar carries the subject identity that the card's header band
 * does on larger screens. Whole row opens history; the pencil is its own
 * 44px target, so the two never share a tap.
 */
export const ExamProfileRow = ({ profile, subjectName, subjectColor, onEdit }: ExamProfileRowProps) => {
  const navigate = useNavigate();
  const tierLabel = formatEducationalTier(profile.educational_tier);
  const assessmentLabel = formatAssessmentTier(profile.assessment_tier);
  const mockLabel = profile.paper_blueprint?.paperContract
    ? profile.paper_blueprint.paperContract.mode === "full_mock" ? "Full mock" : "Short practice"
    : null;

  const meta = [assessmentLabel || tierLabel, mockLabel, `${profile.question_count} questions`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center">
      <button
        onClick={() => navigate(`/my-subjects/${encodeURIComponent(subjectName)}/${profile.id}`)}
        className="flex-1 min-w-0 flex items-center gap-3 py-2.5 pl-3.5 text-left active:bg-foreground/[0.03] transition-colors"
      >
        <span
          aria-hidden
          className="w-1 h-9 rounded-full shrink-0"
          style={{ backgroundColor: subjectColor || "hsl(var(--primary))" }}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-15 font-semibold text-foreground truncate">
            {profile.profile_name}
          </span>
          <span className="block text-xs text-muted-foreground mt-0.5 truncate">{meta}</span>
        </span>
      </button>
      <button
        onClick={onEdit}
        aria-label={`Edit ${profile.profile_name}`}
        className="w-11 h-11 shrink-0 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
};
