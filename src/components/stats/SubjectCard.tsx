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
    : average >= 70 ? "text-success"
    : average >= 50 ? "text-warning"
    : "text-danger";

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-success"
    : trend === "down" ? "text-danger"
    : "text-muted-foreground";

  return (
    <button
      onClick={() => navigate(`/my-subjects/${encodeURIComponent(subject.subject_name)}`)}
      className="group w-full text-left rounded-2xl border border-border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/25 hover:border-border-strong overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className="h-1.5 w-full transition-all duration-200 opacity-80 group-hover:opacity-100 group-hover:h-2"
        style={{ backgroundColor: color }}
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-15 font-semibold text-foreground truncate">{displayName}</h3>
            <p className="text-10 uppercase tracking-[0.12em] text-muted-foreground/80 mt-1">
              {boardLabel ?? "Board not set"}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-0.5" />
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {loading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <>
                <div className={`text-2xl font-bold tabular-nums leading-none ${average !== null ? scoreColor : "text-muted-foreground/40"}`}>
                  {average !== null ? `${Math.round(average)}%` : "—"}
                </div>
                <div className="text-10 text-muted-foreground mt-1.5">
                  {average !== null ? "average score" : "no attempts recorded"}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {trend && trend !== "neutral" && (
              <span className={`inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] border border-border px-2 py-0.5 text-10 font-medium ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                {trend === "up" ? "Improving" : "Needs work"}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-foreground/[0.04] border border-border px-2 py-0.5 text-10 font-medium text-muted-foreground tabular-nums">
              {profileCount} {profileCount === 1 ? "profile" : "profiles"}
            </span>
          </div>
        </div>

        <div className="mt-4 h-1 w-full rounded-full bg-foreground/[0.06] overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${average !== null ? Math.max(4, Math.min(100, average)) : 0}%`, backgroundColor: color, opacity: 0.85 }}
          />
        </div>
      </div>
    </button>
  );
};
