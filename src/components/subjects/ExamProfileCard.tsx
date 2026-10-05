import { useNavigate } from "react-router-dom";
import { Pencil, FileText } from "lucide-react";
import { formatEducationalTier } from "@/lib/level-display";
import { profileCourseId, profilePaperId } from "../../../supabase/functions/_shared/course-selection";
import { biologyPaperDefinition } from "@/lib/biology-paper-contract";
import { formatAssessmentTier } from "@/lib/assessment-tier";

interface ExamProfileCardProps {
  profile: {
    id: string;
    profile_name: string;
    topics: string[];
    question_count: number;
    educational_tier: string | null;
    exam_board?: string | null;
    assessment_tier?: string | null;
    paper_blueprint?: any;
  };
  subjectName: string;
  /** Subject's own colour, reused as the card's header band so a profile
   *  visually belongs to its subject at a glance — same colour as the dot
   *  next to the subject name. */
  subjectColor?: string | null;
  onEdit: () => void;
}

export const ExamProfileCard = ({ profile, subjectName, subjectColor, onEdit }: ExamProfileCardProps) => {
  const navigate = useNavigate();
  const tierLabel = formatEducationalTier(profile.educational_tier);
  const assessmentLabel = formatAssessmentTier(profile.assessment_tier);
  const paper = biologyPaperDefinition(profileCourseId(profile.paper_blueprint), profile.assessment_tier === "foundation" || profile.assessment_tier === "higher" ? profile.assessment_tier : null, profilePaperId(profile.paper_blueprint));
  const hasBlueprint = Array.isArray(profile.paper_blueprint?.sections) && profile.paper_blueprint.sections.length > 0;
  const mockLabel = profile.paper_blueprint?.paperContract
    ? profile.paper_blueprint.paperContract.mode === "full_mock" ? "Full mock" : "Short practice"
    : null;

  // One line of the two most useful facts for deciding "is this the paper I
  // want" — everything else moves to the small caption below instead of
  // stacking as its own row of pills.
  const bandTags = [assessmentLabel || tierLabel, mockLabel].filter(Boolean);
  const captionParts = [paper?.componentCode, hasBlueprint ? "Custom layout" : null].filter(Boolean);
  const accent = subjectColor || "hsl(var(--primary))";

  return (
    <div className="group relative rounded-lg border border-border bg-card overflow-hidden hover:border-border-strong transition-colors h-full flex flex-col">
      <button
        onClick={() => navigate(`/my-subjects/${encodeURIComponent(subjectName)}/${profile.id}`)}
        className="text-left flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div
          className="profile-header relative px-4 pt-4 pb-3.5 border-b border-border"
          style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 65%, black))` }}
        >
          {profile.topics.length > 0 && (
            <span className="absolute top-3 right-3 text-11 font-medium px-2 py-0.5 rounded-md bg-card text-foreground border border-border">
              {profile.topics.length} {profile.topics.length === 1 ? "topic" : "topics"}
            </span>
          )}
          <h3 className="text-base font-semibold text-foreground leading-snug pr-16 line-clamp-2">
            {profile.profile_name}
          </h3>
          {bandTags.length > 0 && (
            <span className="inline-block mt-2.5 text-11 px-2.5 py-1 rounded-md bg-card text-foreground border border-border">
              {bandTags.join(" · ")}
            </span>
          )}
        </div>

        <div className="px-4 pt-3 pb-3">
          {captionParts.length > 0 && (
            <div className="flex items-center gap-1.5 text-11 text-muted-foreground mb-2.5">
              <FileText className="w-3 h-3 shrink-0" />
              <span className="truncate">{captionParts.join(" · ")}</span>
            </div>
          )}
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-11 font-medium bg-foreground/[0.04] text-muted-foreground border border-foreground/[0.06]">
            {profile.question_count} questions
          </span>
        </div>
      </button>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/60">
        <span className="text-11 text-muted-foreground">Tap to view exam history</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex min-h-10 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
    </div>
  );
};
