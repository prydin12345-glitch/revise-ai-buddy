import { LibraryPaperCard, type LibraryCardActions } from "@/components/shared/LibraryPaperCard";
import {edexcelBiologyBPaperLabel} from '@/lib/biology-paper-display';
import type { FavouriteProps } from "@/components/shared/FavouriteControl";
import { useNavigate } from "react-router-dom";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";

interface ExamProgress {
  questionsCompleted: number;
  totalQuestions: number;
  percentComplete: number;
  totalMarks?: number | null;
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
  actions?: LibraryCardActions;
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
  actions,
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
      board={boardLabel || ""}
      level={savedPaper ? "A Level Biology B · 9BI0/01" : levelLabel || ""}
      totalMarks={progress.totalMarks}
      questions={progress.totalQuestions}
      timeLabel="Time"
      time={progress.timeRemaining && progress.timeRemaining !== "No timer" ? progress.timeRemaining : "Unlimited"}
      progress={progress.percentComplete}
      state={isArchived ? "Archived" : progress.examState === "completed" ? "Completed" : progress.examState === "in-progress" ? "In progress" : "Not started"}
      completed={progress.examState === "completed"}
      subjectColor={subjectColor}
      archived={isArchived}
      favourite={favourite}
      actions={actions}
      onOpen={() => { if (!isArchived) navigate(`/exam/${exam.id}/cover`); }}
    />
  );
};
