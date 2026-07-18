import { useNavigate } from "react-router-dom";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useSubjectAverage } from "@/hooks/useSubjectAverage";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { resolveSubjectIcon } from "@/lib/subjectIcons";

interface SubjectCardProps {
  subject: {
    id: string;
    subject_name: string;
    subject_color?: string | null;
    subject_icon?: string | null;
    exam_board?: string | null;
    custom_name?: string | null;
  };
  profileCount: number;
}

export const SubjectCard = ({ subject, profileCount }: SubjectCardProps) => {
  const navigate = useNavigate();
  const { average, trend, loading } = useSubjectAverage(subject.subject_name);

  const displayName = subject.custom_name || subject.subject_name;
  const boardLabel = subject.exam_board ? getBoardDisplayName(subject.exam_board) : null;
  const color = subject.subject_color || "#3B82F6";

  const scoreColor =
    average === null ? "text-muted-foreground"
    : average >= 70 ? "text-green-500"
    : average >= 50 ? "text-amber-500"
    : "text-red-500";

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-green-500"
    : trend === "down" ? "text-red-500"
    : "text-muted-foreground";

  const Icon = resolveSubjectIcon(subject.subject_icon, subject.subject_name);

  return (
    <button
      onClick={() => navigate(`/my-subjects/${encodeURIComponent(subject.subject_name)}`)}
      className="group w-full flex flex-col items-center text-center px-4 py-6 rounded-2xl transition-colors duration-200 hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.04] shadow-lg shadow-black/20"
        style={{ backgroundColor: color }}
      >
        <Icon className="w-10 h-10 sm:w-12 sm:h-12 text-white" strokeWidth={1.5} />
      </div>

      <h3 className="mt-5 text-[16px] font-semibold text-foreground tracking-tight">{displayName}</h3>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {boardLabel ?? "No board set"}
      </p>

      <p className="mt-2 text-[11px] text-muted-foreground/70 tabular-nums h-4">
        {loading ? "" : average !== null
          ? `${Math.round(average)}% avg · ${profileCount} ${profileCount === 1 ? "profile" : "profiles"}`
          : profileCount > 0
            ? `${profileCount} ${profileCount === 1 ? "profile" : "profiles"}`
            : ""}
      </p>

      <span
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition-all duration-200 group-hover:brightness-110"
        style={{ backgroundColor: color }}
      >
        Explore {displayName.split(" ")[0]}
        <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
      </span>
    </button>
  );
};
