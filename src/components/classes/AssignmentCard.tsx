import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, FileText, CheckCircle2, Circle, PlayCircle, Lock } from "lucide-react";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, isFuture } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface AssignmentCardProps {
  assignment: {
    id: string;
    exam_id: string;
    exam_title: string;
    exam_type: "uploaded" | "generated";
    deadline?: string;
    release_date?: string;
  };
  submission?: {
    status: string;
    total_score?: number;
    total_marks?: number;
  };
}

const getStatusConfig = (
  submission?: { status: string; total_score?: number; total_marks?: number }, 
  deadline?: string,
  releaseDate?: string
) => {
  // Check release date first
  if (releaseDate && isFuture(new Date(releaseDate))) {
    return { 
      label: "Not Available", 
      color: "hsl(var(--muted-foreground))", 
      bgColor: "hsl(var(--muted))",
      action: `Available ${format(new Date(releaseDate), "MMM d")}`,
      icon: Lock,
      canAct: false,
      disabledReason: `Available on ${format(new Date(releaseDate), "MMM d, yyyy 'at' h:mm a")}`
    };
  }

  // Check deadline for non-completed assignments
  const isCompleted = submission?.status === "submitted" && submission?.total_score !== null;
  if (deadline && isPast(new Date(deadline)) && !isCompleted && submission?.status !== "submitted") {
    return { 
      label: "Deadline Passed", 
      color: "hsl(var(--destructive))", 
      bgColor: "hsl(var(--destructive) / 0.1)",
      action: "View",
      icon: Lock,
      canAct: false,
      disabledReason: "Deadline has passed"
    };
  }

  if (!submission) {
    return { 
      label: "Not Started", 
      color: "hsl(var(--muted-foreground))", 
      bgColor: "hsl(var(--muted))",
      action: "Start Now",
      icon: Circle,
      canAct: true
    };
  }
  
  if (submission.status === "submitted" && submission.total_score !== null) {
    const percentage = submission.total_marks ? Math.round((submission.total_score! / submission.total_marks) * 100) : 0;
    return { 
      label: `${percentage}%`, 
      color: "hsl(var(--success))", 
      bgColor: "hsl(var(--success) / 0.1)",
      action: "Review",
      icon: CheckCircle2,
      canAct: true
    };
  }
  
  if (submission.status === "submitted") {
    return { 
      label: "Submitted", 
      color: "hsl(217, 91%, 60%)", 
      bgColor: "hsl(217, 91%, 60%, 0.1)",
      action: "View",
      icon: CheckCircle2,
      canAct: true
    };
  }
  
  return { 
    label: "In Progress", 
    color: "hsl(43, 74%, 49%)", 
    bgColor: "hsl(43, 74%, 49%, 0.1)",
    action: "Continue",
    icon: PlayCircle,
    canAct: true
  };
};

const getDeadlineText = (deadline?: string) => {
  if (!deadline) return null;
  const date = new Date(deadline);
  
  if (isPast(date)) return { text: "Overdue", urgent: true };
  if (isToday(date)) return { text: "Due today", urgent: true };
  if (isTomorrow(date)) return { text: "Due tomorrow", urgent: true };
  
  return { text: `Due ${formatDistanceToNow(date, { addSuffix: true })}`, urgent: false };
};

export const AssignmentCard = ({ assignment, submission }: AssignmentCardProps) => {
  const navigate = useNavigate();
  const status = getStatusConfig(submission, assignment.deadline, assignment.release_date);
  const deadlineInfo = getDeadlineText(assignment.deadline);
  const StatusIcon = status.icon;

  const handleAction = () => {
    try {
      if (!assignment.exam_id) {
        toast.error("This assignment is no longer available.");
        return;
      }

      if (!status.canAct) {
        if (assignment.release_date && isFuture(new Date(assignment.release_date))) {
          toast.info(`This assignment will be available on ${format(new Date(assignment.release_date), "MMM d, yyyy")}`);
        }
        return;
      }

      // Route based on submission status
      if (submission?.status === "submitted") {
        navigate(`/exam/${assignment.exam_id}/review`);
      } else {
        navigate(`/exam/${assignment.exam_id}/in-progress`);
      }
    } catch (error) {
      console.error("Error navigating to assignment:", { error, assignmentId: assignment.id, examId: assignment.exam_id });
      toast.error("We couldn't load your session. Please try again.");
    }
  };

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border-l-4" style={{ borderLeftColor: status.color }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-medium">
                {assignment.exam_type === "uploaded" ? "Exam" : "Practice"}
              </Badge>
              {deadlineInfo && (
                <span className={`text-xs ${deadlineInfo.urgent ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  {deadlineInfo.text}
                </span>
              )}
            </div>
            
            <h4 className="font-medium text-foreground line-clamp-1 mb-1">
              {assignment.exam_title}
            </h4>

            {assignment.deadline && (
              <p className="text-xs text-muted-foreground">
                Deadline: {format(new Date(assignment.deadline), "MMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div 
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ backgroundColor: status.bgColor, color: status.color }}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </div>
            
            {!status.canAct ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button 
                      size="sm" 
                      disabled
                      className="opacity-50"
                    >
                      {status.action}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {status.disabledReason}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button 
                size="sm" 
                onClick={handleAction}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {status.action}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
