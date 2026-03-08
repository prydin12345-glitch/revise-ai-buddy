import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Menu, Flag } from "lucide-react";
import { QuestionOptionsMenu } from "@/components/quiz/QuestionOptionsMenu";
import { formatTime } from "./types";

interface PracticeQuizHeaderProps {
  quizTitle: string;
  currentQuestionNumber: string;
  isFlagged: boolean;
  isReviewMode: boolean;
  timeElapsed: number;
  answeredCount: number;
  totalQuestions: number;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  hideNavigation: boolean;
  toggleHideNavigation: () => void;
  showMathKeypad: boolean;
  onToggleMathKeypad: () => void;
  toggleFlag: () => void;
  workedSolutionVisible: boolean;
  onToggleSolution: () => void;
  onQuitAndSave: () => void;
  onSubmitAll: () => void;
  isSubmitted: boolean;
  showProtractor: boolean;
  onToggleProtractor: () => void;
  onRetryQuestion: () => void;
  onRegenerateQuestion: () => void;
  onRetryEntireSet: () => void;
  isRetrying: boolean;
  isRegenerating: boolean;
}

const PracticeQuizHeader: React.FC<PracticeQuizHeaderProps> = ({
  quizTitle,
  currentQuestionNumber,
  isFlagged,
  isReviewMode,
  timeElapsed,
  answeredCount,
  totalQuestions,
  sidebarOpen,
  setSidebarOpen,
  hideNavigation,
  toggleHideNavigation,
  showMathKeypad,
  onToggleMathKeypad,
  toggleFlag,
  workedSolutionVisible,
  onToggleSolution,
  onQuitAndSave,
  onSubmitAll,
  isSubmitted,
  showProtractor,
  onToggleProtractor,
  onRetryQuestion,
  onRegenerateQuestion,
  onRetryEntireSet,
  isRetrying,
  isRegenerating,
}) => {
  return (
    <>
      <header className={`sticky top-0 z-50 border-b bg-card/95 backdrop-blur transition-transform duration-300 ${hideNavigation ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className="flex items-center justify-between h-14 px-4 lg:px-6 w-full">
          <div className="flex items-center gap-3 min-w-0 flex-shrink">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden flex-shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-base lg:text-lg truncate max-w-[200px] lg:max-w-[300px]">{quizTitle}</h1>
          </div>

          <div className="flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
            <Badge variant="outline" className="text-sm lg:text-base px-3 py-1.5 whitespace-nowrap">
              Question {currentQuestionNumber}
            </Badge>
            {isFlagged && (
              <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600 hidden sm:flex">
                <Flag className="w-3 h-3" />Flagged
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
            {isReviewMode && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Review Mode
              </Badge>
            )}
            {!isReviewMode && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-sm">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(timeElapsed)}</span>
              </div>
            )}
            {!isReviewMode && (
              <QuestionOptionsMenu
                mode="practice"
                showMathKeypad={showMathKeypad}
                onToggleMathKeypad={onToggleMathKeypad}
                hideNavigation={hideNavigation}
                onToggleNavigation={toggleHideNavigation}
                isFlagged={isFlagged}
                onToggleFlag={toggleFlag}
                onShowSolution={onToggleSolution}
                solutionVisible={workedSolutionVisible}
                onQuitAndSave={onQuitAndSave}
                onSubmitAll={onSubmitAll}
                disabled={isSubmitted}
                showProtractor={showProtractor}
                onToggleProtractor={onToggleProtractor}
                onRetryQuestion={onRetryQuestion}
                onRegenerateQuestion={onRegenerateQuestion}
                onRetryEntireSet={onRetryEntireSet}
                isRetrying={isRetrying}
                isRegenerating={isRegenerating}
              />
            )}
          </div>
        </div>

        <div className="px-4 lg:px-6 pb-2">
          <Progress value={(answeredCount / totalQuestions) * 100} className="h-2" />
        </div>
      </header>

      {hideNavigation && (
        <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-[60] bg-card shadow-lg" onClick={toggleHideNavigation}>
          <Menu className="w-5 h-5" />
        </Button>
      )}
    </>
  );
};

export default PracticeQuizHeader;
