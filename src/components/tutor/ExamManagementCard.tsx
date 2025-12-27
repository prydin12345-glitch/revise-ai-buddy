import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PrintExamButton } from "@/components/exam/PrintExamButton";
import { 
  Users, 
  Eye, 
  BarChart3, 
  Trash2,
  AlertTriangle,
  Calendar,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExamManagementCardProps {
  exam: {
    id: string;
    title: string;
    subject_id: string;
    status: string;
    created_at: string;
    assigned_groups: string[];
    deadline: string | null;
    completion_percentage: number;
    total_students: number;
    completed_students: number;
    grade_released: boolean;
  };
  subjectColor?: string;
  onAssign: (examId: string, examTitle: string) => void;
  onDelete: (examId: string, examTitle: string, examStatus: string) => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyles = () => {
    switch (status.toLowerCase()) {
      case "published":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "draft":
        return "bg-muted/50 text-muted-foreground border-border/50";
      case "closed":
        return "bg-red-500/15 text-red-400 border-red-500/30";
      case "scheduled":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      default:
        return "bg-muted/50 text-muted-foreground border-border/50";
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={cn("capitalize font-medium border", getStatusStyles())}
    >
      {status}
    </Badge>
  );
};

const DeadlineBadge = ({ deadline }: { deadline: string | null }) => {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const isOverdue = isPast(deadlineDate) && !isToday(deadlineDate);
  const isDueToday = isToday(deadlineDate);
  const isDueTomorrow = isTomorrow(deadlineDate);
  const daysUntil = differenceInDays(deadlineDate, new Date());

  const getDeadlineStyles = () => {
    if (isOverdue) return "bg-red-500/15 text-red-400 border-red-500/30";
    if (isDueToday) return "bg-orange-500/15 text-orange-400 border-orange-500/30";
    if (isDueTomorrow) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    if (daysUntil <= 3) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    if (daysUntil <= 7) return "bg-muted/50 text-muted-foreground border-border/50";
    return "bg-muted/30 text-muted-foreground border-border/30";
  };

  const getDeadlineText = () => {
    if (isOverdue) return "Overdue";
    if (isDueToday) return "Due today";
    if (isDueTomorrow) return "Due tomorrow";
    if (daysUntil <= 7) return `Due in ${daysUntil} days`;
    return format(deadlineDate, "MMM d");
  };

  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium border text-xs", getDeadlineStyles())}
    >
      {(isOverdue || isDueToday) && (
        <Clock className="h-3 w-3 mr-1" />
      )}
      {getDeadlineText()}
    </Badge>
  );
};

export const ExamManagementCard = ({ 
  exam, 
  subjectColor = "#3B82F6",
  onAssign, 
  onDelete 
}: ExamManagementCardProps) => {
  const navigate = useNavigate();
  const progressPercent = exam.total_students > 0 
    ? Math.round((exam.completed_students / exam.total_students) * 100) 
    : 0;

  const isNotAssigned = exam.assigned_groups.length === 0;
  const isComplete = exam.total_students > 0 && exam.completed_students === exam.total_students;
  
  // Check if overdue
  const isOverdue = exam.deadline && isPast(new Date(exam.deadline)) && !isComplete;

  // Progress bar color based on status
  const getProgressColor = () => {
    if (isComplete) return "#22c55e"; // green
    if (isOverdue) return "#ef4444"; // red
    if (progressPercent > 0) return "#f59e0b"; // amber
    return subjectColor;
  };

  return (
    <div 
      className={cn(
        "group relative rounded-2xl border bg-card/60 backdrop-blur-sm",
        "p-6 transition-all duration-300 flex flex-col h-full",
        "hover:bg-card/80 hover:shadow-xl hover:shadow-black/10 hover:-translate-y-0.5",
        isOverdue ? "border-red-500/30" : "border-border/40 hover:border-border/60"
      )}
    >
      {/* Subject color accent */}
      <div 
        className="absolute left-0 top-4 bottom-4 w-1 rounded-full"
        style={{ backgroundColor: subjectColor }}
      />

      {/* Main Content */}
      <div className="flex flex-col gap-4 flex-1">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {exam.title}
            </h3>
          </div>
          <StatusBadge status={exam.status} />
        </div>
        
        {/* Metadata Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge 
            variant="secondary" 
            className="text-xs font-medium px-2.5 py-0.5"
            style={{ 
              backgroundColor: `${subjectColor}15`,
              color: subjectColor,
              borderColor: `${subjectColor}30`
            }}
          >
            {exam.subject_id}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(exam.created_at), "MMM d, yyyy")}
          </span>
        </div>

        {/* Assignment Info */}
        <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
          {isNotAssigned ? (
            <Badge 
              variant="outline" 
              className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Not assigned
            </Badge>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground">Assigned:</span>
              {exam.assigned_groups.slice(0, 2).map((group, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="text-xs bg-background/50 py-0"
                >
                  {group}
                </Badge>
              ))}
              {exam.assigned_groups.length > 2 && (
                <Badge variant="outline" className="text-xs bg-background/50 py-0">
                  +{exam.assigned_groups.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Deadline */}
        {exam.deadline && (
          <div className="flex items-center">
            <DeadlineBadge deadline={exam.deadline} />
          </div>
        )}

        {/* Progress Section */}
        <div className="mt-auto pt-2 space-y-2.5">
          {exam.total_students > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {isComplete ? (
                    <span className="text-emerald-400">All students completed</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {exam.completed_students} / {exam.total_students} completed
                    </span>
                  )}
                </span>
              </div>
              <Progress 
                value={progressPercent} 
                className="h-2 bg-muted/30"
                indicatorColor={getProgressColor()}
              />
            </>
          ) : (
            <div className="h-8 flex items-center">
              <span className="text-xs text-muted-foreground/70">No submissions yet</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border/30 my-1" />

        {/* Actions Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  onClick={() => navigate(`/tutor/exams/${exam.id}/edit`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View / Edit</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  onClick={() => onAssign(exam.id, exam.title)}
                >
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Assign</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  onClick={() => navigate(`/tutor/exams/${exam.id}/dashboard`)}
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Results</TooltipContent>
            </Tooltip>

            <PrintExamButton
              examId={exam.id}
              examTitle={exam.title}
              variant="ghost"
              size="icon"
            />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(exam.id, exam.title, exam.status)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
