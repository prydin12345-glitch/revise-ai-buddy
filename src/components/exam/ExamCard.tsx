import { LibraryPaperCard } from "@/components/shared/LibraryPaperCard";
import {edexcelBiologyBPaperLabel} from '@/lib/biology-paper-display';
import type { FavouriteProps } from "@/components/shared/FavouriteControl";
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
  generation_context?:unknown;
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

export const ExamCard = ({
  exam,
  progress,
  subjectColor,
  isArchived = false,
  favourite,
}: ExamCardProps) => {
  const navigate = useNavigate();

  const savedPaper=edexcelBiologyBPaperLabel(exam.generation_context);
  const boardLabel = exam.exam_board ? getBoardDisplayName(exam.exam_board) : null;
  const levelLabel = exam.qualification_level
    ? LEVEL_DISPLAY_NAMES[exam.qualification_level] ?? exam.qualification_level
    : null;
  return (
    <LibraryPaperCard
      title={exam.title || "Untitled exam"}
      subject={exam.subject_id || "Subject"}
      course={savedPaper ?? [boardLabel, levelLabel].filter(Boolean).join(" · ")}
      questions={progress.totalQuestions}
      timeLabel="Time"
      time={progress.timeRemaining && progress.timeRemaining !== "No timer" ? progress.timeRemaining : "Untimed"}
      progress={progress.percentComplete}
      state={isArchived ? "Archived" : progress.examState === "completed" ? "Completed" : progress.examState === "in-progress" ? "In progress" : "Not started"}
      completed={progress.examState === "completed"}
      subjectColor={subjectColor}
      archived={isArchived}
      favourite={favourite}
      onOpen={() => { if (!isArchived) navigate(`/exam/${exam.id}/cover`); }}
    />
  );
};
