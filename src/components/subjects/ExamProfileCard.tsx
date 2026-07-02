import { useNavigate } from "react-router-dom";
import { ChevronRight, Pencil, FileText, Hash, ListChecks } from "lucide-react";

interface ExamProfileCardProps {
  profile: {
    id: string;
    profile_name: string;
    topics: string[];
    question_count: number;
    educational_tier: string | null;
    exam_board?: string | null;
  };
  subjectName: string;
  onEdit: () => void;
}

export const ExamProfileCard = ({ profile, subjectName, onEdit }: ExamProfileCardProps) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-200 overflow-hidden">
      <button
        onClick={() =>
          navigate(`/my-subjects/${encodeURIComponent(subjectName)}/${profile.id}`)
        }
        className="w-full text-left p-4 group"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="text-[14px] font-semibold text-foreground truncate">{profile.profile_name}</h3>
            </div>

            <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground pl-9">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {profile.question_count} questions
              </span>
              {profile.topics.length > 0 && (
                <span className="flex items-center gap-1">
                  <ListChecks className="w-3 h-3" />
                  {profile.topics.length} topics
                </span>
              )}
              {profile.educational_tier && (
                <span className="uppercase tracking-wider text-[10px]">
                  {profile.educational_tier}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>

        {profile.topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pl-9">
            {profile.topics.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="px-2 py-0.5 rounded-md bg-muted text-[10.5px] text-muted-foreground"
              >
                {topic}
              </span>
            ))}
            {profile.topics.length > 3 && (
              <span className="px-2 py-0.5 rounded-md text-[10.5px] text-muted-foreground">
                +{profile.topics.length - 3} more
              </span>
            )}
          </div>
        )}
      </button>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/50 bg-muted/20">
        <span className="text-[10.5px] text-muted-foreground">Click card to view exam history</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        >
          <Pencil className="w-3 h-3" />
          Edit profile
        </button>
      </div>
    </div>
  );
};
