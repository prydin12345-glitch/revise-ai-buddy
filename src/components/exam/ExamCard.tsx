import { useNavigate } from "react-router-dom";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";

interface ExamProgress {
  questionsCompleted: number;
  totalQuestions: number;
  percentComplete: number;
  timeRemaining: string;
  lastAccessed: string;
  examState: "not-started" | "in-progress" | "completed";
}

interface Exam {
  id: string;
  title: string;
  subject_id: string;
  created_at: string;
  status: string;
  type: string;
  display_order?: number;
  exam_board?: string | null;
  qualification_level?: string | null;
  exam_topics: Array<{ topic_name: string }>;
}

interface ExamCardProps {
  exam: Exam;
  progress: ExamProgress;
  subjectColor: string;
  isArchived?: boolean;
}

const formatProgress = (value: number): string => `${Math.round(value)}%`;

export const ExamCard = ({
  exam,
  progress,
  subjectColor,
  isArchived = false,
}: ExamCardProps) => {
  const navigate = useNavigate();

  const boardLabel = exam.exam_board ? getBoardDisplayName(exam.exam_board) : null;
  const levelLabel = exam.qualification_level
    ? LEVEL_DISPLAY_NAMES[exam.qualification_level] ?? exam.qualification_level
    : null;
  const allTopics = exam.exam_topics.map((t) => t.topic_name).filter(Boolean);
  const MAX_TOPICS = 5;
  const visibleTopics = allTopics.slice(0, MAX_TOPICS);
  const hiddenTopicsCount = Math.max(0, allTopics.length - MAX_TOPICS);


  return (
    <div className={`group w-full ${isArchived ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={() => {
          if (!isArchived) navigate(`/exam/${exam.id}/cover`);
        }}
        className="relative block w-full rounded-md border border-border bg-card text-left overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ aspectRatio: "1 / 1.414" }}
        aria-label={`Open ${exam.title}`}
      >
        {/* Subject-colour spine */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5"
          style={{ backgroundColor: subjectColor }}
        />

        <div className="flex h-full flex-col px-4 pt-4 pb-3 pl-5">
          {/* Masthead */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white"
                style={{ backgroundColor: subjectColor }}
              >
                E
              </span>
              <span className="text-[10px] font-bold tracking-tight">Examly</span>
            </div>
            <p className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">
              Practice paper
            </p>
          </div>

          {/* Title block */}
          <div className="mt-3 rounded-md border-2 border-foreground/80 p-3">
            <p className="text-[9px] font-semibold text-muted-foreground line-clamp-1">
              {boardLabel ? `Modelled on ${boardLabel}` : "Generic exam style"}
              {levelLabel ? ` · ${levelLabel}` : ""}
            </p>
            <h3 className="font-serif text-lg font-bold leading-tight tracking-tight text-foreground mt-1 line-clamp-2">
              {exam.subject_id || "Subject"}
            </h3>
            <p className="font-serif text-[11px] text-foreground/80 leading-snug mt-1 line-clamp-2">
              {exam.title || "Untitled exam"}
            </p>
          </div>

          {/* Questions / Time strip */}
          <div className="mt-2 flex items-stretch rounded-md border border-border overflow-hidden text-[10px]">
            <div className="flex-1 px-2 py-1.5">
              <p className="text-muted-foreground text-[9px]">Questions</p>
              <p className="font-semibold leading-tight">
                {progress.totalQuestions || "—"}
              </p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 px-2 py-1.5">
              <p className="text-muted-foreground text-[9px]">Time</p>
              <p className="font-semibold leading-tight">
                {progress.timeRemaining && progress.timeRemaining !== "No timer"
                  ? progress.timeRemaining
                  : "None"}
              </p>
            </div>
          </div>

          {/* Topics */}
          {topicLabel && (
            <div className="mt-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/80">
                Topics
              </p>
              <p className="text-[11px] text-foreground/85 leading-snug line-clamp-2 mt-0.5">
                {topicLabel}
                {extraTopics > 0 ? ` +${extraTopics} more` : ""}
              </p>
            </div>
          )}

          <div className="flex-1" />

          {/* Bottom: progress bar with % overlay */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
              <span className="uppercase tracking-wider">Progress</span>
              <span className="font-semibold">{formatProgress(progress.percentComplete)}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, progress.percentComplete))}%`,
                  backgroundColor:
                    progress.examState === "completed"
                      ? "hsl(var(--success))"
                      : subjectColor,
                }}
              />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};
