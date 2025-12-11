import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Clock, AlertCircle, Send, ListChecks } from "lucide-react";
import { toast } from "sonner";

interface ExamSubmission {
  id: string;
  exam_id: string;
  submitted_at: string;
  total_score: number | null;
  total_marks: number | null;
  exam_title: string;
}

interface CompletionBreakdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissions: ExamSubmission[];
  totalExams: number;
  completedExams: number;
  studentName: string;
}

export const CompletionBreakdownModal = ({
  open,
  onOpenChange,
  submissions,
  totalExams,
  completedExams,
  studentName
}: CompletionBreakdownModalProps) => {
  const completionRate = totalExams > 0 ? Math.round((completedExams / totalExams) * 100) : 0;
  
  // Group submissions by status
  const completedSubmissions = submissions.filter(s => 
    s.total_score !== null && s.total_marks && s.total_marks > 0
  );
  
  const inProgressCount = totalExams - completedExams;

  const handleSendReminder = () => {
    toast.success("Reminder sent", {
      description: `A reminder has been sent to ${studentName} about pending exams.`
    });
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return "text-emerald-500";
    if (percentage >= 60) return "text-blue-500";
    if (percentage >= 40) return "text-amber-500";
    return "text-rose-500";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Completion Breakdown - {studentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-emerald-500/10 border-emerald-500/30">
              <CardContent className="pt-4 text-center">
                <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-500">{completedExams}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/30">
              <CardContent className="pt-4 text-center">
                <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-500">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="pt-4 text-center">
                <AlertCircle className="h-5 w-5 text-primary mx-auto mb-1" />
                <p className="text-2xl font-bold text-primary">{completionRate}%</p>
                <p className="text-xs text-muted-foreground">Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Completed Exams List */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Completed Exams ({completedSubmissions.length})
            </h4>
            <ScrollArea className="h-[180px]">
              {completedSubmissions.length > 0 ? (
                <div className="space-y-2">
                  {completedSubmissions.map((submission) => (
                    <Card key={submission.id} className="bg-card/50">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">
                              {submission.exam_title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(submission.submitted_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric"
                              })}
                            </p>
                          </div>
                          {submission.total_score !== null && submission.total_marks && (
                            <Badge 
                              variant="secondary"
                              className={getScoreColor(submission.total_score, submission.total_marks)}
                            >
                              {Math.round((submission.total_score / submission.total_marks) * 100)}%
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  No completed exams yet
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Pending Actions */}
          {inProgressCount > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Pending Exams</p>
                  <p className="text-xs text-muted-foreground">
                    {inProgressCount} exam{inProgressCount !== 1 ? "s" : ""} not yet completed
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleSendReminder}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send Reminder
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
