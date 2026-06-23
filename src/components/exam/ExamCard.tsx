import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Play,
  Eye,
  Edit2,
  Trash2,
  Star,
  Download,
  ChevronRight,
} from "lucide-react";
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
  onEdit: (exam: Exam) => void;
  onDelete: (exam: Exam) => void;
  onToggleFavourite: (examId: string) => void;
  onDownloadPDF?: (exam: Exam) => void;
  isFavourite: boolean;
  isArchived?: boolean;
}

const formatProgress = (value: number): string => `${Math.round(value)}%`;

export const ExamCard = ({
  exam,
  progress,
  subjectColor,
  onEdit,
  onDelete,
  onToggleFavourite,
  onDownloadPDF,
  isFavourite,
  isArchived = false,
}: ExamCardProps) => {
  const navigate = useNavigate();

  const getButtonConfig = () => {
    switch (progress.examState) {
      case "completed":
        return {
          label: "Review",
          icon: Eye,
          action: () => navigate(`/exam/${exam.id}/review`),
        };
      case "in-progress":
        return {
          label: "Continue",
          icon: ChevronRight,
          action: () => navigate(`/exam/${exam.id}/in-progress?mode=student`),
        };
      default:
        return {
          label: "Start",
          icon: Play,
          action: () => navigate(`/exam/${exam.id}/preview`),
        };
    }
  };

  const buttonConfig = getButtonConfig();
  const ButtonIcon = buttonConfig.icon;

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const boardLabel = exam.exam_board ? getBoardDisplayName(exam.exam_board) : null;
  const levelLabel = exam.qualification_level
    ? LEVEL_DISPLAY_NAMES[exam.qualification_level] ?? exam.qualification_level
    : null;
  const topicLabel = exam.exam_topics[0]?.topic_name;
  const extraTopics = Math.max(0, exam.exam_topics.length - 1);

  const statusRibbon =
    progress.examState === "completed"
      ? { label: "Completed", className: "bg-success/15 text-success border-success/30" }
      : progress.examState === "in-progress"
      ? { label: "In progress", className: "bg-amber-500/15 text-amber-600 border-amber-500/30" }
      : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`group flex flex-col ${isArchived ? "opacity-60" : ""}`}>
        {/* ===== Paper face ===== */}
        <button
          type="button"
          onClick={() => {
            if (exam.status === "published" && !isArchived) buttonConfig.action();
          }}
          className="relative block w-full rounded-md border border-border bg-card text-left overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ aspectRatio: "1 / 1.414" }}
          aria-label={`${exam.title} — ${buttonConfig.label}`}
        >
          {/* Subject-colour spine */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5"
            style={{ backgroundColor: subjectColor }}
          />

          {/* Status ribbon */}
          {statusRibbon && (
            <span
              className={`absolute top-2.5 right-2.5 z-10 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusRibbon.className}`}
            >
              {statusRibbon.label}
            </span>
          )}

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
              <h3
                className="font-serif text-lg font-bold leading-tight tracking-tight text-foreground mt-1 line-clamp-2"
              >
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

        {/* ===== Action row (outside paper) ===== */}
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavourite(exam.id);
                  }}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  disabled={isArchived}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      isFavourite ? "fill-yellow-400 text-yellow-400" : ""
                    }`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFavourite ? "Remove from favourites" : "Add to favourites"}</p>
              </TooltipContent>
            </Tooltip>

            {onDownloadPDF && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownloadPDF(exam);
                    }}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    disabled={isArchived}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download PDF</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(exam);
                  }}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  disabled={isArchived}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit exam</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(exam);
                  }}
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={isArchived}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete exam</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {exam.status === "published" && !isArchived && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                buttonConfig.action();
              }}
              className="h-7 rounded-full px-3 text-xs gap-1"
            >
              <ButtonIcon className="w-3.5 h-3.5" />
              {buttonConfig.label}
            </Button>
          )}
        </div>

        {/* Meta line */}
        <p className="mt-1 px-1 text-[10px] text-muted-foreground line-clamp-1">
          Created {formatDate(exam.created_at)}
          {progress.lastAccessed && progress.lastAccessed !== "Never"
            ? ` · last opened ${progress.lastAccessed}`
            : ""}
        </p>
      </div>
    </TooltipProvider>
  );
};
