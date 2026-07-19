import { useNavigate } from "react-router-dom";
import { ChevronRight, Pencil } from "lucide-react";
import { formatEducationalTier } from "@/lib/level-display";

interface ExamProfileCardProps {
  profile: {
    id: string;
    profile_name: string;
    topics: string[];
    question_count: number;
    educational_tier: string | null;
    exam_board?: string | null;
    paper_blueprint?: any;
  };
  subjectName: string;
  onEdit: () => void;
}

export const ExamProfileCard = ({ profile, subjectName, onEdit }: ExamProfileCardProps) => {
  const navigate = useNavigate();
  const tierLabel = formatEducationalTier(profile.educational_tier);
  const hasBlueprint = Array.isArray(profile.paper_blueprint?.sections) && profile.paper_blueprint.sections.length > 0;

  return (
    <div className="group relative rounded-2xl border border-[hsl(220_6%_20%)] bg-[hsl(220_8%_13%)]/60 hover:border-[hsl(220_6%_28%)] hover:bg-[hsl(220_8%_14%)] transition-colors">
      <button
        onClick={() => navigate(`/my-subjects/${encodeURIComponent(subjectName)}/${profile.id}`)}
        className="w-full text-left p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-semibold text-foreground leading-tight truncate">
            {profile.profile_name}
          </h3>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <Badge>{profile.question_count} questions</Badge>
          {profile.topics.length > 0 && <Badge>{profile.topics.length} topics</Badge>}
          {tierLabel && <Badge>{tierLabel}</Badge>}
          {hasBlueprint && <Badge accent>Custom layout</Badge>}
        </div>

        {profile.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {profile.topics.slice(0, 4).map((topic) => (
              <span
                key={topic}
                className="px-2.5 py-1 rounded-full bg-white/[0.04] text-[11.5px] text-foreground/80 border border-white/[0.06]"
              >
                {topic}
              </span>
            ))}
            {profile.topics.length > 4 && (
              <span className="px-2.5 py-1 rounded-full text-[11.5px] text-muted-foreground">
                +{profile.topics.length - 4} more
              </span>
            )}
          </div>
        )}
      </button>

      <div className="flex items-center justify-between px-5 py-2.5 border-t border-[hsl(220_6%_20%)]/60">
        <span className="text-[11px] text-muted-foreground">Tap to view exam history</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
    </div>
  );
};

function Badge({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
        accent
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-white/[0.03] text-muted-foreground border-white/[0.06]"
      }`}
    >
      {children}
    </span>
  );
}
