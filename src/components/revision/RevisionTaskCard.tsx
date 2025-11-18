import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CheckCircle2, Clock, FileText, CheckSquare, Target } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface RevisionTaskCardProps {
  id: string;
  subject: string;
  subjectColor: string;
  focusTopic?: string;
  examTitle?: string;
  time: string;
  duration?: number;
  isCompleted: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  isDraggable?: boolean;
  linkedExamId?: string;
  linkedPracticeSetId?: string;
  targetScore?: number;
}

export const RevisionTaskCard = ({
  id,
  subject,
  subjectColor,
  focusTopic,
  examTitle,
  time,
  duration,
  isCompleted,
  onEdit,
  onDelete,
  onToggleComplete,
  isDraggable = true,
  linkedExamId,
  linkedPracticeSetId,
  targetScore,
}: RevisionTaskCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const combinedStyle = {
    ...style,
    borderLeftColor: subjectColor,
  };

  return (
    <div
      ref={setNodeRef}
      style={combinedStyle}
      {...attributes}
      {...listeners}
      className={`group relative p-3 rounded-lg border-l-4 transition-all hover:shadow-md cursor-grab active:cursor-grabbing ${
        isCompleted ? "bg-muted/50 opacity-70" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge
              className="text-xs font-medium"
              style={{ backgroundColor: subjectColor }}
            >
              {subject}
            </Badge>
            {linkedExamId && (
              <Badge variant="outline" className="text-xs gap-1">
                <FileText className="w-3 h-3" />
                Linked Exam
              </Badge>
            )}
            {linkedPracticeSetId && (
              <Badge variant="outline" className="text-xs gap-1">
                <CheckSquare className="w-3 h-3" />
                Practice Set
              </Badge>
            )}
            {targetScore !== undefined && targetScore !== null && (
              <Badge variant="secondary" className="text-xs gap-1">
                <Target className="w-3 h-3" />
                Target: {targetScore}%
              </Badge>
            )}
            {isCompleted && (
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm font-semibold truncate">
            {focusTopic || examTitle || "General revision"}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Clock className="w-3 h-3" />
            <span>{time}</span>
            {duration && <span>• {duration}m</span>}
          </div>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete();
            }}
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
