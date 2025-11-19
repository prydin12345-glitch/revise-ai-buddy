import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Play, Edit, CheckCircle2, FileText, CheckSquare, Target, Trash2 } from "lucide-react";
import { PriorityBadge } from "../panels/PriorityBadge";
import { TaskProgressBar } from "./TaskProgressBar";
import { ConfidenceStars } from "./ConfidenceStars";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  subject: string;
  subject_color: string;
  time: string;
  duration: number | null;
  focus_topic: string | null;
  exam_title: string | null;
  is_completed: boolean;
  priority: string;
  progress_percentage: number;
  confidence_before: number | null;
  confidence_after: number | null;
}

interface EnhancedTaskBlockProps {
  task: Task;
  onAction: (action: string, taskId: string) => void;
  compact?: boolean;
  linkedExamId?: string | null;
  linkedPracticeSetId?: string | null;
  targetScore?: number | null;
  isHighlighted?: boolean;
}

export const EnhancedTaskBlock = ({ task, onAction, compact = false, linkedExamId, linkedPracticeSetId, targetScore, isHighlighted }: EnhancedTaskBlockProps) => {
  return (
    <div
      data-task-id={task.id}
      className={cn(
        "group relative rounded-lg border-l-4 hover:shadow-md transition-all",
        compact ? "p-2" : "p-3",
        task.is_completed && "opacity-60",
        isHighlighted && "ring-2 ring-primary shadow-lg"
      )}
      style={{
        borderLeftColor: task.subject_color,
        backgroundColor: `${task.subject_color}0D`
      }}
    >
      {/* Priority Flag */}
      {!compact && (
        <PriorityBadge priority={task.priority} className="absolute top-2 right-2" />
      )}
      
      {/* Subject Badge */}
      <div className="flex items-center gap-1 flex-wrap">
        <Badge 
          className="text-xs"
          style={{ 
            backgroundColor: task.subject_color,
            color: 'white'
          }}
        >
          {task.subject}
        </Badge>
        
        {/* Linked Content Badges */}
        {linkedExamId && (
          <Badge variant="outline" className="text-xs gap-1">
            <FileText className="w-3 h-3" />
            Exam
          </Badge>
        )}
        {linkedPracticeSetId && (
          <Badge variant="outline" className="text-xs gap-1">
            <CheckSquare className="w-3 h-3" />
            Practice
          </Badge>
        )}
        {targetScore !== undefined && targetScore !== null && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Target className="w-3 h-3" />
            {targetScore}%
          </Badge>
        )}
      </div>
      
      {/* Task Details */}
      <div className={cn("mt-1", compact && "text-xs")}>
        <p className={cn("font-medium", compact && "text-xs truncate")}>
          {task.focus_topic || task.exam_title}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <Clock className="w-3 h-3" />
          <span>{task.time} • {task.duration || 60}m</span>
        </div>
      </div>
      
      {/* Progress Bar */}
      {!compact && (
        <TaskProgressBar 
          progress={task.progress_percentage} 
          color={task.subject_color}
          className="mt-3"
        />
      )}
      
      {/* Confidence Indicators */}
      {!compact && task.confidence_before && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Confidence:</span>
          <ConfidenceStars count={task.confidence_before} />
          {task.confidence_after && (
            <>
              <span className="text-muted-foreground">→</span>
              <ConfidenceStars count={task.confidence_after} />
            </>
          )}
        </div>
      )}
      
      {/* Action Buttons (on hover) */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
        {task.is_completed ? (
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={() => onAction('uncomplete', task.id)}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Completed
          </Button>
        ) : (
          <>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => onAction('edit', task.id)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => onAction('complete', task.id)}
            >
              Complete
            </Button>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => onAction('focus', task.id)}
            >
              <Play className="w-4 h-4" />
            </Button>
          </>
        )}
        <Button 
          size="sm" 
          variant="destructive" 
          onClick={() => onAction('delete', task.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
