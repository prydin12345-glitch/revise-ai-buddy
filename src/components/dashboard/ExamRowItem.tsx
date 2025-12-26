import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Eye, Play, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getExamState, getExamButtonConfig } from "@/lib/exam-navigation";
import { format } from "date-fns";

export interface ExamWithSubmission {
  id: string;
  title: string;
  subject_id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  assigned_by?: string;
  deadline?: string;
  submission?: {
    id: string;
    total_score: number;
    total_marks: number;
    status: 'in_progress' | 'submitted' | 'graded' | 'completed';
    last_accessed_at?: string;
  };
}

interface ExamRowItemProps {
  exam: ExamWithSubmission;
  subjectColor?: string;
  showLastAccessed?: boolean;
}

export const ExamRowItem = ({ exam, subjectColor = "#3B82F6", showLastAccessed = false }: ExamRowItemProps) => {
  const navigate = useNavigate();
  
  const state = getExamState(
    exam.submission 
      ? { id: exam.submission.id, status: exam.submission.status } 
      : null
  );
  const config = getExamButtonConfig(exam.id, state);
  const isCompleted = state === 'completed' || state === 'graded';
  const isInProgress = state === 'in-progress';

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const renderActionButton = () => {
    // Check if we can navigate (has valid submission for in-progress)
    if (isInProgress && !exam.submission?.id) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" disabled className="opacity-50 h-9 px-4 text-sm">
                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                Continue
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Unable to resume (missing session)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button
        size="sm"
        variant="default"
        className="h-9 px-4 text-sm font-medium"
        onClick={() => navigate(config.url)}
      >
        {isCompleted ? (
          <Eye className="w-3.5 h-3.5 mr-1.5" />
        ) : (
          <Play className="w-3.5 h-3.5 mr-1.5" />
        )}
        {config.label}
      </Button>
    );
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/30 transition-all duration-200 bg-card/50 hover:bg-card group">
      {/* Left block - Title and metadata */}
      <div className="flex-1 min-w-0 pr-4">
        <h3 className="font-semibold text-base truncate mb-2 group-hover:text-primary transition-colors">
          {exam.title}
        </h3>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Subject pill with subtle color accent */}
          <Badge 
            variant="outline" 
            className="text-xs font-medium px-2.5 py-0.5"
            style={{ 
              borderColor: subjectColor,
              boxShadow: `0 0 8px ${subjectColor}20`
            }}
          >
            <span 
              className="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0"
              style={{ backgroundColor: subjectColor }}
            />
            {exam.subject_id}
          </Badge>
          
          <span className="text-xs text-muted-foreground">·</span>
          
          {/* Date */}
          <span className="text-xs text-muted-foreground">
            {formatDate(exam.created_at)}
          </span>
          
          <span className="text-xs text-muted-foreground">·</span>
          
          {/* Status pill - consistent colors regardless of subject */}
          {isInProgress && (
            <Badge 
              variant="secondary" 
              className="text-xs font-medium px-2.5 py-0.5 bg-warning-light text-warning-foreground border border-warning-border/30"
            >
              In Progress
            </Badge>
          )}
          {isCompleted && (
            <Badge 
              variant="secondary" 
              className="text-xs font-medium px-2.5 py-0.5 bg-success-light text-success-foreground border border-success-border/30"
            >
              Completed
            </Badge>
          )}
          {state === 'not-started' && (
            <Badge 
              variant="secondary" 
              className="text-xs font-medium px-2.5 py-0.5"
            >
              Not Started
            </Badge>
          )}
          
          {/* Score badge if completed and has score */}
          {isCompleted && exam.submission && exam.submission.total_marks > 0 && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs font-medium text-success">
                {Math.round((exam.submission.total_score / exam.submission.total_marks) * 100)}%
              </span>
            </>
          )}

          {/* Last accessed (for modal view) */}
          {showLastAccessed && exam.submission?.last_accessed_at && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                Last accessed: {formatDate(exam.submission.last_accessed_at)}
              </span>
            </>
          )}
        </div>
        
        {/* Deadline warning */}
        {exam.deadline && (
          <div className="mt-2">
            <Badge variant="destructive" className="text-xs px-2 py-0.5">
              Due: {formatDate(exam.deadline)}
            </Badge>
          </div>
        )}
      </div>

      {/* Right block - Action button */}
      <div className="flex-shrink-0">
        {renderActionButton()}
      </div>
    </div>
  );
};
