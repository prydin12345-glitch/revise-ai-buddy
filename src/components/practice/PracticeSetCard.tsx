import { useNavigate } from "react-router-dom";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";

interface PracticeSetProgress {
  questions_attempted: number;
  last_accessed_at: string;
  completed_at?: string;
  time_spent_seconds: number;
}

interface PracticeSet {
  id: string;
  set_name: string;
  subject_id: string;
  subtopics: string[];
  difficulty_mode: string;
  difficulty_level: string;
  question_count: number;
  created_at: string;
  educational_tier?: string;
  exam_board?: string;
}

interface PracticeSetCardProps {
  set: PracticeSet;
  progress: PracticeSetProgress;
  subjectColor: string;
}

const formatProgress = (value: number): string => `${Math.round(value)}%`;

export const PracticeSetCard = ({ set, progress, subjectColor }: PracticeSetCardProps) => {
  const navigate = useNavigate();

  const percentComplete =
    set.question_count > 0
      ? (progress.questions_attempted / set.question_count) * 100
      : 0;
  const isCompleted = !!progress.completed_at;

  const boardLabel = set.exam_board ? getBoardDisplayName(set.exam_board) : null;
  const levelLabel = set.educational_tier
    ? LEVEL_DISPLAY_NAMES[set.educational_tier] ?? set.educational_tier
    : null;
  const allTopics = (set.subtopics ?? []).filter(Boolean);
  const MAX_TOPICS = 5;
  const visibleTopics = allTopics.slice(0, MAX_TOPICS);
  const hiddenTopicsCount = Math.max(0, allTopics.length - MAX_TOPICS);

  const difficulty = set.difficulty_level || set.difficulty_mode || "Medium";
  const estimatedTime = set.question_count * 2;

  return (
    <div className="group w-full">
      <button
        type="button"
        onClick={() => navigate(`/quizzes/${set.id}/cover`)}
        className="relative block w-full rounded-md border border-border bg-card text-left overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ aspectRatio: "1 / 1.414" }}
        aria-label={`Open ${set.set_name}`}
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
              Practice quiz
            </p>
          </div>

          {/* Title block */}
          <div className="mt-3 rounded-md border-2 border-foreground/80 p-3">
            <p className="text-[9px] font-semibold text-muted-foreground line-clamp-1">
              {boardLabel ? `Modelled on ${boardLabel}` : "Generic quiz style"}
              {levelLabel ? ` · ${levelLabel}` : ""}
            </p>
            <h3 className="font-serif text-lg font-bold leading-tight tracking-tight text-foreground mt-1 line-clamp-2">
              {set.set_name || "Untitled quiz"}
            </h3>
            <p className="font-serif text-[11px] text-foreground/80 leading-snug mt-1 line-clamp-1">
              {set.subject_id || "Subject"}
            </p>

          </div>

          {/* Questions / Time strip */}
          <div className="mt-2 flex items-stretch rounded-md border border-border overflow-hidden text-[10px]">
            <div className="flex-1 px-2 py-1.5">
              <p className="text-muted-foreground text-[9px]">Questions</p>
              <p className="font-semibold leading-tight">{set.question_count || "—"}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 px-2 py-1.5">
              <p className="text-muted-foreground text-[9px]">Est. time</p>
              <p className="font-semibold leading-tight">~{estimatedTime}m</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 px-2 py-1.5">
              <p className="text-muted-foreground text-[9px]">Difficulty</p>
              <p className="font-semibold leading-tight capitalize truncate">{difficulty}</p>
            </div>
          </div>

          {/* Subtopics — up to 5, stacked vertically */}
          {visibleTopics.length > 0 && (
            <div className="mt-2">
              <p className="text-[9px] font-bold uppercase tracking-wider text-foreground/80">
                Subtopics
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {visibleTopics.map((topic, i) => {
                  const isLast = i === visibleTopics.length - 1;
                  const suffix = isLast && hiddenTopicsCount > 0 ? ` +${hiddenTopicsCount} more` : "";
                  return (
                    <li
                      key={`${topic}-${i}`}
                      className="text-[11px] text-foreground/85 leading-snug truncate"
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
            <div className="flex items-center justify-between text-[9px] text-muted-foreground mb-1">
              <span className="uppercase tracking-wider">Progress</span>
              <span className="font-semibold">{formatProgress(percentComplete)}</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, percentComplete))}%`,
                  backgroundColor: isCompleted ? "hsl(var(--success))" : subjectColor,
                }}
              />
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};
