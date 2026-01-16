import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Calculator, Eye, EyeOff, Flag, Save, ChevronLeft, Send, RotateCcw, RefreshCw, ListRestart, Compass } from "lucide-react";

interface QuestionOptionsMenuProps {
  mode: "practice" | "exam";
  showMathKeypad: boolean;
  onToggleMathKeypad: () => void;
  hideNavigation: boolean;
  onToggleNavigation: () => void;
  isFlagged: boolean;
  onToggleFlag: () => void;
  onShowSolution?: () => void;
  solutionVisible?: boolean;
  onQuitAndSave: () => void;
  onSubmitAll: () => void;
  disabled?: boolean;
  isReadOnly?: boolean;
  // Protractor toggle
  showProtractor?: boolean;
  onToggleProtractor?: () => void;
  // New retry props
  onRetryQuestion?: () => void;
  onRegenerateQuestion?: () => void;
  onRetryEntireSet?: () => void;
  isRetrying?: boolean;
  isRegenerating?: boolean;
}

export const QuestionOptionsMenu = ({
  mode,
  showMathKeypad,
  onToggleMathKeypad,
  hideNavigation,
  onToggleNavigation,
  isFlagged,
  onToggleFlag,
  onShowSolution,
  solutionVisible = false,
  onQuitAndSave,
  onSubmitAll,
  disabled = false,
  isReadOnly = false,
  showProtractor = false,
  onToggleProtractor,
  onRetryQuestion,
  onRegenerateQuestion,
  onRetryEntireSet,
  isRetrying = false,
  isRegenerating = false,
}: QuestionOptionsMenuProps) => {
  if (isReadOnly) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Question options">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
        <DropdownMenuLabel>
          {mode === "practice" ? "Quiz Options" : "Exam Options"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Math Keyboard - both modes */}
        <DropdownMenuItem 
          onClick={onToggleMathKeypad}
          disabled={disabled}
          className="cursor-pointer"
        >
          <Calculator className="w-4 h-4 mr-2" />
          {showMathKeypad ? "Hide Math Keyboard" : "Show Math Keyboard"}
        </DropdownMenuItem>

        {/* Navigation toggle - both modes */}
        <DropdownMenuItem onClick={onToggleNavigation} className="cursor-pointer">
          {hideNavigation ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
          {hideNavigation ? "Show Navigation" : "Hide Navigation"}
        </DropdownMenuItem>

        {/* Protractor toggle - practice mode only */}
        {mode === "practice" && onToggleProtractor && (
          <DropdownMenuItem onClick={onToggleProtractor} className="cursor-pointer">
            <Compass className="w-4 h-4 mr-2" />
            {showProtractor ? "Hide Protractor" : "Show Protractor"}
          </DropdownMenuItem>
        )}

        {/* Flag Question - both modes */}
        <DropdownMenuItem onClick={onToggleFlag} className="cursor-pointer">
          <Flag className="w-4 h-4 mr-2" />
          {isFlagged ? "Unflag Question" : "Flag Question"}
        </DropdownMenuItem>

        {/* Show Solution - Practice only */}
        {mode === "practice" && onShowSolution && (
          <DropdownMenuItem onClick={onShowSolution} className="cursor-pointer">
            {solutionVisible ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {solutionVisible ? "Hide Solution" : "Show Solution"}
          </DropdownMenuItem>
        )}

        {/* Retry Options - Practice only */}
        {mode === "practice" && (onRetryQuestion || onRegenerateQuestion || onRetryEntireSet) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Retry Options</DropdownMenuLabel>
            
            <DropdownMenuItem 
              onClick={onRetryQuestion} 
              disabled={isRetrying || !onRetryQuestion}
              className="cursor-pointer"
            >
              <RotateCcw className={`w-4 h-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
              Retry Question
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={onRegenerateQuestion}
              disabled={isRegenerating || !onRegenerateQuestion}
              className="cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate Question
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={onRetryEntireSet}
              disabled={!onRetryEntireSet}
              className="cursor-pointer text-orange-600 dark:text-orange-400"
            >
              <ListRestart className="w-4 h-4 mr-2" />
              Retry Entire Set
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Quit - different labels for each mode */}
        {mode === "practice" ? (
          <DropdownMenuItem onClick={onQuitAndSave} className="cursor-pointer">
            <Save className="w-4 h-4 mr-2" />
            Quit & Save
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onQuitAndSave} className="cursor-pointer">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Quit Exam
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Submit - different labels for each mode */}
        <DropdownMenuItem 
          onClick={onSubmitAll}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Send className="w-4 h-4 mr-2" />
          {mode === "practice" ? "Submit All" : "Submit Exam"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
