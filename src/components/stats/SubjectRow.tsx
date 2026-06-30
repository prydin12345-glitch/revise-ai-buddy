import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useSubjectAverage } from "@/hooks/useSubjectAverage";

interface SubjectRowProps {
  subject: { id: string; subject_name: string; subject_color: string; exam_board?: string | null };
  profileCount: number;
  topicCount: number;
}

export const SubjectRow = ({ subject, profileCount, topicCount }: SubjectRowProps) => {
  const { percentage, loading } = useSubjectAverage(subject.subject_name);
  const pct = percentage ?? 0;
  const hasScore = percentage !== null;

  return (
    <Link
      to={`/my-subjects/${encodeURIComponent(subject.subject_name)}`}
      className="group flex items-center gap-4 px-4 sm:px-5 py-4 hover:bg-muted/40 transition-colors"
    >
      {/* Dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: subject.subject_color }}
        aria-hidden="true"
      />

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">
            {subject.subject_name}
          </h3>
          {subject.exam_board && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
              {subject.exam_board}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {profileCount} {profileCount === 1 ? "profile" : "profiles"} · {topicCount} {topicCount === 1 ? "topic" : "topics"}
        </p>
      </div>

      {/* Score + bar (hidden on very narrow) */}
      <div className="hidden xs:flex sm:flex flex-col items-end gap-1 w-[110px] sm:w-[160px] shrink-0">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {loading ? "…" : hasScore ? `${pct}%` : "—"}
        </span>
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: hasScore ? subject.subject_color : "transparent",
            }}
          />
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
    </Link>
  );
};
