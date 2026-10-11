import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import {
  examProfileDisplay,
  type ProfileDisplaySource,
} from "@/lib/exam-profile-display";

interface ExamProfileRowProps {
  profile: ProfileDisplaySource & { id: string };
  subjectName: string;
  subjectColor?: string | null;
  onEdit: () => void;
}

export const ExamProfileRow = ({
  profile,
  subjectName,
  subjectColor,
  onEdit,
}: ExamProfileRowProps) => {
  const navigate = useNavigate();
  const display = examProfileDisplay(profile);
  return (
    <div className="flex items-center gap-1 px-3">
      <button
        type="button"
        onClick={() =>
          navigate(
            `/my-subjects/${encodeURIComponent(subjectName)}/${profile.id}`,
          )
        }
        className="min-w-0 flex-1 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: subjectColor || "hsl(var(--primary))" }}
          />
          <span className="truncate text-sm font-semibold text-foreground">
            {profile.profile_name}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {display.identity}
        </span>
        {display.paper && (
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {display.paper}
          </span>
        )}
        <span className="mt-1.5 block text-xs text-muted-foreground">
          {[display.mode, display.countLabel, display.timeLabel]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${profile.profile_name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
};
