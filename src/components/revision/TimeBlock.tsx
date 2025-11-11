import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CheckCircle2, Clock, Play, Lock } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TimeBlockProps {
  id: string;
  subject: string;
  subjectColor: string;
  focusTopic?: string;
  examTitle?: string;
  time: string;
  duration?: number;
  isCompleted: boolean;
  isPrivate?: boolean;
  focusSessionDuration?: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onStartFocus: () => void;
  isDraggable?: boolean;
}

export const TimeBlock = ({
  id,
  subject,
  subjectColor,
  focusTopic,
  examTitle,
  time,
  duration,
  isCompleted,
  isPrivate,
  focusSessionDuration,
  onEdit,
  onDelete,
  onToggleComplete,
  onStartFocus,
  isDraggable = true,
}: TimeBlockProps) => {
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

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderLeftColor: subjectColor,
        backgroundColor: `${subjectColor}0D`, // 5% opacity
      }}
      {...attributes}
      {...listeners}
      className={`group relative p-3 rounded-lg border-l-[3px] transition-all hover:shadow-md cursor-grab active:cursor-grabbing ${
        isCompleted ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              className="text-xs font-medium"
              style={{ backgroundColor: subjectColor }}
            >
              {subject}
            </Badge>
            {isCompleted && (
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            )}
            {isPrivate && (
              <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          <p className="text-sm font-semibold truncate">
            {focusTopic || examTitle || "General revision"}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <Clock className="w-3 h-3" />
            <span>{time}</span>
            {duration && <span>• {duration}m</span>}
            {focusSessionDuration && focusSessionDuration > 0 && (
              <span className="text-primary font-medium">• {focusSessionDuration}m focused</span>
            )}
          </div>
        </div>

        <div className="flex gap-1 transition-opacity">
          {!isCompleted && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onStartFocus();
              }}
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
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