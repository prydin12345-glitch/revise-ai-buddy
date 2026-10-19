import { LibraryPaperCard, type LibraryCardActions } from "@/components/shared/LibraryPaperCard";
import type { FavouriteProps } from "@/components/shared/FavouriteControl";
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
  status?: string;
}

interface PracticeSetCardProps {
  favourite?: FavouriteProps;
  actions?: LibraryCardActions;
  totalMarks?: number | null;
  set: PracticeSet;
  progress: PracticeSetProgress;
  subjectColor: string;
}

export const PracticeSetCard = ({ set, progress, subjectColor, favourite, actions, totalMarks }: PracticeSetCardProps) => {
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
  const difficulty = set.difficulty_level || set.difficulty_mode || "Medium";
  const estimatedTime = set.question_count * 2;

  return (
    <LibraryPaperCard
      title={set.set_name || "Untitled quiz"}
      board={boardLabel || ""}
      level={levelLabel || ""}
      totalMarks={totalMarks}
      questions={set.question_count}
      timeLabel="Est. time"
      time={`~${estimatedTime}m`}
      difficulty={difficulty}
      progress={percentComplete}
      state={set.status === "archived" ? "Archived" : isCompleted ? "Completed" : progress.questions_attempted > 0 ? "In progress" : "Not started"}
      completed={isCompleted}
      subjectColor={subjectColor}
      favourite={favourite}
      archived={set.status === "archived"}
      actions={actions}
      onOpen={() => { if (set.status !== "archived") navigate(`/quizzes/${set.id}/cover`); }}
    />
  );
};
