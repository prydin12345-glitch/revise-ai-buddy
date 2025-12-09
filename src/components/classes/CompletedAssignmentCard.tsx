import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, Eye, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

interface CompletedAssignmentCardProps {
  assignment: {
    id: string;
    exam_id: string;
    exam_title: string;
    exam_type: "uploaded" | "generated";
  };
  submission: {
    status: string;
    total_score?: number;
    total_marks?: number;
    submitted_at?: string;
  };
  hasFeedback?: boolean;
}

export const CompletedAssignmentCard = ({ 
  assignment, 
  submission,
  hasFeedback 
}: CompletedAssignmentCardProps) => {
  const navigate = useNavigate();
  
  const percentage = submission.total_marks && submission.total_score !== null && submission.total_score !== undefined
    ? Math.round((submission.total_score / submission.total_marks) * 100)
    : null;

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30";
    if (pct >= 60) return "text-blue-600 bg-blue-100 dark:bg-blue-900/30";
    if (pct >= 40) return "text-amber-600 bg-amber-100 dark:bg-amber-900/30";
    return "text-red-600 bg-red-100 dark:bg-red-900/30";
  };

  return (
    <Card className="hover:shadow-md transition-all duration-200 border-l-4 border-l-emerald-500">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-medium">
                {assignment.exam_type === "uploaded" ? "Exam" : "Practice"}
              </Badge>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">Completed</span>
            </div>
            
            <h4 className="font-medium text-foreground line-clamp-1 mb-1">
              {assignment.exam_title}
            </h4>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {submission.submitted_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(submission.submitted_at), "MMM d, yyyy")}
                </span>
              )}
              {hasFeedback && (
                <span className="flex items-center gap-1 text-primary">
                  <MessageSquare className="w-3 h-3" />
                  Feedback available
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {percentage !== null ? (
              <div className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getScoreColor(percentage)}`}>
                {percentage}%
              </div>
            ) : (
              <Badge variant="secondary" className="text-xs">
                {submission.status === "submitted" ? "Awaiting Grade" : submission.status}
              </Badge>
            )}
            
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate(`/exam/${assignment.exam_id}/review`)}
              className="gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" />
              Review
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
