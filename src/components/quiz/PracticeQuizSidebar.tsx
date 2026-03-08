import React from "react";
import { Button } from "@/components/ui/button";
import { Flag, Loader2 } from "lucide-react";
import type { PracticeQuestion, UserAnswer } from "./types";

interface PracticeQuizSidebarProps {
  questions: PracticeQuestion[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  userAnswers: Record<string, UserAnswer>;
  flaggedQuestions: Set<string>;
  subjectColor: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  hideNavigation: boolean;
  isReviewMode: boolean;
  answeredCount: number;
  unansweredCount: number;
  totalScore: number;
  totalPossible: number;
  fullyCorrectCount: number;
  partialCreditCount: number;
  incorrectCount: number;
  onNavigateToQuizzes: () => void;
  isSaving?: boolean;
}

const PracticeQuizSidebar: React.FC<PracticeQuizSidebarProps> = ({
  questions,
  currentIndex,
  setCurrentIndex,
  userAnswers,
  flaggedQuestions,
  subjectColor,
  sidebarOpen,
  setSidebarOpen,
  hideNavigation,
  isReviewMode,
  answeredCount,
  unansweredCount,
  totalScore,
  totalPossible,
  fullyCorrectCount,
  partialCreditCount,
  incorrectCount,
  onNavigateToQuizzes,
}) => {
  const getQuestionButtonStyle = (question: PracticeQuestion) => {
    const answer = userAnswers[question.id];
    const hasAnswer = Boolean(answer?.answer?.trim() || answer?.answerLatex?.trim());
    const isFlagged = flaggedQuestions.has(question.id);
    const currentQuestionId = questions[currentIndex]?.id;
    const isCurrent = currentQuestionId === question.id;

    let className = 'relative aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all hover:scale-105 ';
    let style: React.CSSProperties = {};

    if (answer?.submitted) {
      if (answer.score === question.marks) {
        className += 'bg-green-500 text-white';
      } else if ((answer.score || 0) > 0) {
        className += 'bg-orange-500 text-white';
      } else {
        className += 'bg-red-500 text-white';
      }
    } else if (hasAnswer) {
      className += 'text-white';
      style.backgroundColor = subjectColor;
    } else {
      className += 'bg-muted text-muted-foreground hover:bg-muted/80';
    }

    if (isFlagged) className += ' ring-2 ring-yellow-500 ring-offset-2';
    if (isCurrent) className += ' ring-2 ring-primary ring-offset-2';

    return { className, style };
  };

  return (
    <aside className={`${hideNavigation ? 'w-0 overflow-hidden' : sidebarOpen ? 'w-56 lg:w-60' : 'w-0 overflow-hidden'} lg:block ${sidebarOpen && !hideNavigation ? 'fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-auto' : ''} transition-all duration-300 border-r bg-card/50 flex-shrink-0`}>
      {sidebarOpen && !hideNavigation && (
        <div className="fixed inset-0 bg-black/50 lg:hidden z-30" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="relative z-40 bg-card h-full sticky top-[4.5rem] max-h-[calc(100vh-4.5rem)] overflow-y-auto">
        <div className="p-4 lg:p-5 flex flex-col gap-5 h-full">
          <div>
            <h2 className="text-xs font-semibold mb-3 text-muted-foreground tracking-wide">QUESTIONS</h2>
            <div className="grid grid-cols-4 gap-1.5">
              {questions.map((q) => {
                const { className, style } = getQuestionButtonStyle(q);
                return (
                  <button key={q.id} onClick={() => { setCurrentIndex(questions.indexOf(q)); window.scrollTo({ top: 0, behavior: 'smooth' }); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={className} style={style}>
                    {q.question_number}
                    {flaggedQuestions.has(q.id) && (
                      <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5">
                        <Flag className="w-2 h-2 text-white" fill="white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Answered</span><span>{answeredCount}/{questions.length}</span></div>
            <div className="flex justify-between"><span>Flagged</span><span>{flaggedQuestions.size}</span></div>
            <div className="flex justify-between"><span>Unanswered</span><span>{unansweredCount}</span></div>
          </div>
          
          {Object.values(userAnswers).some(a => a.submitted) && (
            <div className="space-y-1.5 text-xs pt-2 border-t">
              <div className="flex justify-between text-green-600 dark:text-green-400"><span>✓ Correct</span><span>{fullyCorrectCount}</span></div>
              <div className="flex justify-between text-orange-600 dark:text-orange-400"><span>◐ Partial</span><span>{partialCreditCount}</span></div>
              <div className="flex justify-between text-red-600 dark:text-red-400"><span>✗ Incorrect</span><span>{incorrectCount}</span></div>
              <div className="flex justify-between font-semibold text-foreground pt-1 border-t"><span>Score</span><span>{totalScore.toFixed(1)}/{totalPossible}</span></div>
            </div>
          )}

          <div className="mt-auto">
            {isReviewMode ? (
              <Button onClick={onNavigateToQuizzes} className="w-full" variant="outline">
                Exit Review
              </Button>
            ) : (
              <Button onClick={onNavigateToQuizzes} className="w-full" variant="outline">
                Save & Quit
              </Button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default PracticeQuizSidebar;
