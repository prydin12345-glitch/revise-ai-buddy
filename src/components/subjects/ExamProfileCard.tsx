import {ProfileApprovalBadge} from "@/components/profiles/ExamlyApprovalBadge";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Pencil } from "lucide-react";
import {
  examProfileDisplay,
  type ProfileDisplaySource,
} from "@/lib/exam-profile-display";

interface ExamProfileCardProps {
  profile: ProfileDisplaySource & { id: string; topics: string[] };
  subjectName: string;
  subjectColor?: string | null;
  onEdit: () => void;
}

export const ExamProfileCard = ({
  profile,
  subjectName,
  subjectColor,
  onEdit,
}: ExamProfileCardProps) => {
  const navigate = useNavigate();
  const display = examProfileDisplay(profile);
  const view = () =>
    navigate(`/my-subjects/${encodeURIComponent(subjectName)}/${profile.id}`);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border-strong">
      <div className="px-5 pt-4"><ProfileApprovalBadge profile={profile}/></div>
      <button
        type="button"
        onClick={view}
        className="min-w-0 flex-1 p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: subjectColor || "hsl(var(--primary))" }}
            />
            {display.mode}
          </span>
          <span className="tabular-nums">{profile.topics.length} topics</span>
        </div>
        <h3 className="line-clamp-2 font-serif text-xl font-semibold leading-snug text-foreground">
          {profile.profile_name}
        </h3>
        {display.identity && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {display.identity}
          </p>
        )}
        {display.paper && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {display.paper}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-foreground">
          <span>{display.countLabel}</span>
          {display.marksLabel && <span>{display.marksLabel}</span>}
          {display.timeLabel && <span>{display.timeLabel}</span>}
        </div>
      </button>
      <div className="flex items-center justify-between border-t border-border px-4 py-1.5">
        <button
          type="button"
          onClick={view}
          className="flex min-h-10 items-center gap-1.5 text-xs font-medium text-foreground"
        >
          View exams
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${profile.profile_name}`}
          className="flex min-h-11 items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </div>
  );
};
