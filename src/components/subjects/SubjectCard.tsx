import { useNavigate } from "react-router-dom";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useSubjectAverage } from "@/hooks/useSubjectAverage";
import { getBoardDisplayName } from "@/lib/board-scrubber";

interface SubjectCardProps {
  subject: {
    id: string;
    subject_name: string;
    subject_color?: string | null;
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

  return (
    <button
      onClick={() => navigate(`/my-subjects/${encodeURIComponent(subject.subject_name)}`)}
      className="group w-full text-left rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-foreground truncate">{displayName}</h3>
            {boardLabel ? (
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{boardLabel}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground/70 mt-1 italic">No exam board set</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {loading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : average !== null ? (
              <>
                <div className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{Math.round(average)}%</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">average score</div>
              </>
            ) : (
              <div className="text-[12px] text-muted-foreground">No attempts yet</div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            {trend && trend !== "neutral" && (
              <div className={`flex items-center gap-1 text-[11px] font-medium ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                <span>{trend === "up" ? "Improving" : "Needs work"}</span>
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">
              {profileCount} {profileCount === 1 ? "profile" : "profiles"}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};
