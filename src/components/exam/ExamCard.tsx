import { FavouriteControl, type FavouriteProps } from "@/components/shared/FavouriteControl";
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
  favourite?: FavouriteProps;
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
  favourite,
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
        className="relative block w-full rounded-md border border-border bg-card text-left overflow-hidden transition-colors duration-200 hover:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ minHeight: "340px" }}
        aria-label={`Open ${exam.title}`}
      >
        {/* Subject-colour spine */}
        <div
          className="absolute left-4 top-5 h-2 w-2 rounded-full"
          style={{ backgroundColor: subjectColor }}
        />

        <div className="flex h-full flex-col px-4 pt-4 pb-4">
          {/* Masthead */}
          <div className="flex items-center justify-between gap-2 pl-4">
            <div className="flex items-center gap-1.5">
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded text-xs font-bold text-white"
                style={{ backgroundColor: subjectColor }}
              >
                E
              </span>
              <span className="text-xs font-bold tracking-tight">Examly</span>
            </div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Practice paper
            </p>
          </div>

          {/* Title block — exam name is the prominent line */}
          <div className="mt-4 border-y border-border py-3">

            <p className="text-xs font-semibold text-muted-foreground line-clamp-1">
              {boardLabel ? `Modelled on ${boardLabel}` : "Generic exam style"}
              {levelLabel ? ` · ${levelLabel}` : ""}
            </p>
            <h3 className="font-serif text-lg font-bold leading-tight tracking-tight text-foreground mt-1 break-words">
              {exam.title || "Untitled exam"}
            </h3>
            <p className="font-serif text-xs text-foreground/80 leading-snug mt-1 line-clamp-1">
              {exam.subject_id || "Subject"}
            </p>
          </div>

          {/* Questions / Time strip */}
          <div className="mt-2 flex items-stretch rounded-md border border-border overflow-hidden text-xs">
            <div className="flex-1 px-2 py-1.5">
              <p className="text-muted-foreground text-xs">Questions</p>
              <p className="font-semibold leading-tight">
                {progress.totalQuestions || "—"}
              </p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 px-2 py-1.5">
              <p className="text-muted-foreground text-xs">Time</p>
              <p className="font-semibold leading-tight">
                {progress.timeRemaining && progress.timeRemaining !== "No timer"
                  ? progress.timeRemaining
                  : "None"}
              </p>
            </div>
          </div>

          {/* Topics — up to 5, stacked vertically */}
          {visibleTopics.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                Topics
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {visibleTopics.map((topic, i) => {
                  const isLast = i === visibleTopics.length - 1;
                  const suffix = isLast && hiddenTopicsCount > 0 ? ` +${hiddenTopicsCount} more` : "";
                  return (
                    <li
                      key={`${topic}-${i}`}
                      className="text-xs text-foreground/85 leading-snug break-words"
                    >
                      {topic}{suffix}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}


          <div className="flex-1" />

          {/* Bottom: progress bar with % overlay */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
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
      {favourite && <FavouriteControl {...favourite} />}
    </div>
  );
};
