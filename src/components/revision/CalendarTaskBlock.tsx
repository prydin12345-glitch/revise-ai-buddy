import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Check } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { timeToGridRow, durationToRowSpan, dayToColumnIndex } from "@/lib/calendar-utils";

interface CalendarTaskBlockProps {
  task: {
    id: string;
    subject: string;
    subject_color: string;
    focus_topic?: string;
    exam_title?: string;
    time: string;
    duration?: number;
    day: string;
    is_completed: boolean;
  };
  onEdit: (task: any) => void;
  onDelete: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

export function CalendarTaskBlock({ task, onEdit, onDelete, onToggleComplete }: CalendarTaskBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridRow: `${timeToGridRow(task.time)} / span ${durationToRowSpan(task.duration || 60)}`,
    gridColumn: dayToColumnIndex(task.day),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group absolute inset-1 rounded-md border-l-4 p-2 cursor-move hover:shadow-md transition-all"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) {
          e.stopPropagation();
        }
      }}
      data-subject-color={task.subject_color}
    >
      <div 
        className="absolute inset-0 rounded-md opacity-10"
        style={{ backgroundColor: task.subject_color }}
      />
      <div 
        className="absolute inset-y-0 left-0 w-1 rounded-l-md"
        style={{ backgroundColor: task.subject_color }}
      />
      
      <div className="relative space-y-1">
        <div className="flex items-start justify-between gap-1">
          <Badge 
            variant="secondary" 
            className="text-xs font-semibold shrink-0"
            style={{ 
              backgroundColor: `${task.subject_color}20`,
              color: task.subject_color,
              borderColor: task.subject_color
            }}
          >
            {task.subject}
          </Badge>
          
          <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onEdit(task)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => onToggleComplete(task.id)}
            >
              <Check className={`h-3 w-3 ${task.is_completed ? 'text-green-500' : ''}`} />
            </Button>
          </div>
        </div>
        
        <p className="text-xs font-medium line-clamp-2 text-foreground">
          {task.focus_topic || task.exam_title || 'No topic'}
        </p>
        
        <p className="text-xs text-muted-foreground">
          {Math.floor((task.duration || 60) / 60)}h {(task.duration || 60) % 60 > 0 ? `${(task.duration || 60) % 60}m` : ''}
        </p>
      </div>
    </div>
  );
}
