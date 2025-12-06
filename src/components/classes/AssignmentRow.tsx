import { format, isToday, isTomorrow, isPast } from "date-fns";
import { Clock, FileText, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AssignmentRowProps {
  assignment: {
    id: string;
    exam_id: string;
    title: string;
    type: string;
    deadline: string | null;
    release_date?: string | null;
  };
  className?: string;
  tutorName?: string;
  submission?: {
    status: string | null;
    total_score?: number | null;
    total_marks?: number | null;
  } | null;
  subjectColor?: string;
}

const subjectColors: Record<string, string> = {
  "Mathematics": "hsl(45, 70%, 60%)",
  "Physics": "hsl(200, 60%, 50%)",
  "Chemistry": "hsl(280, 50%, 55%)",
  "Biology": "hsl(140, 50%, 45%)",
  "English": "hsl(350, 60%, 55%)",
  "History": "hsl(25, 60%, 50%)",
  "Geography": "hsl(170, 50%, 45%)",
  "Computer Science": "hsl(220, 70%, 55%)",
  "default": "hsl(var(--primary))"
};

export const AssignmentRow = ({ 
  assignment, 
  className, 
  tutorName,
  submission,
  subjectColor 
}: AssignmentRowProps) => {
  const navigate = useNavigate();
  const color = subjectColor || subjectColors["default"];

  const getStatusConfig = () => {
    if (!submission) {
      return { label: "Not Started", variant: "secondary" as const, action: "Start", canAct: true };
    }
    if (submission.status === "graded" || submission.status === "submitted") {
      const score = submission.total_score ?? 0;
      const total = submission.total_marks ?? 100;
      return { 
        label: `${Math.round((score / total) * 100)}%`, 
        variant: "default" as const, 
        action: "Review",
        canAct: true 
      };
    }
    if (submission.status === "in_progress") {
      return { label: "In Progress", variant: "outline" as const, action: "Continue", canAct: true };
    }
    return { label: "Pending", variant: "secondary" as const, action: "View", canAct: true };
  };

  const getDeadlineInfo = () => {
    if (!assignment.deadline) return null;
    const deadline = new Date(assignment.deadline);
    if (isPast(deadline) && !isToday(deadline)) return { text: "Overdue", urgent: true };
    if (isToday(deadline)) return { text: "Due Today", urgent: true };
    if (isTomorrow(deadline)) return { text: "Due Tomorrow", urgent: false };
    return { text: format(deadline, "MMM d"), urgent: false };
  };

  const status = getStatusConfig();
  const deadlineInfo = getDeadlineInfo();

  const handleAction = () => {
    if (!submission || submission.status === "not_started") {
      navigate(`/exam/${assignment.exam_id}`);
    } else {
      navigate(`/review/${assignment.exam_id}`);
    }
  };

  return (
    <div 
      className="flex items-center gap-4 py-4 border-l-4 pl-4 bg-card/30 rounded-r-lg hover:bg-card/50 transition-colors"
      style={{ borderLeftColor: color }}
    >
      <div className="p-2 rounded-lg bg-muted/50">
        {assignment.type === "practice" ? (
          <BookOpen className="w-5 h-5 text-muted-foreground" />
        ) : (
          <FileText className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{assignment.title}</p>
        <p className="text-sm text-muted-foreground">
          {className && <span>{className}</span>}
          {tutorName && <span> • {tutorName}</span>}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {deadlineInfo && (
          <div className={`flex items-center gap-1 text-sm ${deadlineInfo.urgent ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="w-4 h-4" />
            <span>{deadlineInfo.text}</span>
          </div>
        )}

        <Badge variant={status.variant} className="min-w-[80px] justify-center">
          {status.label}
        </Badge>

        <Button 
          size="sm" 
          variant="ghost"
          onClick={handleAction}
          className="text-primary hover:text-primary hover:bg-primary/10"
        >
          {status.action}
        </Button>
      </div>
    </div>
  );
};
