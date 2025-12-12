import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Clock, Bell, Users, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CompletionStudent {
  id: string;
  name: string;
  studentCode: string | null;
  submittedAt?: string | null;
}

interface ExamCompletion {
  examId: string;
  examTitle: string;
  deadline: string | null;
  completedStudents: CompletionStudent[];
  pendingStudents: CompletionStudent[];
}

interface AggregateCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completionData: ExamCompletion[];
  totalStudents: number;
}

export const AggregateCompletionModal = ({
  open,
  onOpenChange,
  completionData,
  totalStudents,
}: AggregateCompletionModalProps) => {
  const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set());

  const toggleExam = (examId: string) => {
    const newExpanded = new Set(expandedExams);
    if (newExpanded.has(examId)) {
      newExpanded.delete(examId);
    } else {
      newExpanded.add(examId);
    }
    setExpandedExams(newExpanded);
  };

  const handleSendReminder = (examTitle: string, studentCount: number) => {
    toast.success(`Reminder sent to ${studentCount} student${studentCount !== 1 ? "s" : ""} for "${examTitle}"`);
  };

  const totalCompleted = completionData.reduce((sum, e) => sum + e.completedStudents.length, 0);
  const totalPending = completionData.reduce((sum, e) => sum + e.pendingStudents.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CheckCircle className="h-5 w-5 text-blue-500" />
            </div>
            Completion Breakdown
          </DialogTitle>
          <DialogDescription>
            View completion status for each assigned exam
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          <div className="flex-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Completed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalCompleted}</p>
          </div>
          <div className="flex-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalPending}</p>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {completionData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No assignments found</p>
              <p className="text-sm mt-1">Completion breakdown will appear once you assign exams to students</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completionData.map((exam) => {
                const completionPercent = totalStudents > 0 
                  ? Math.round((exam.completedStudents.length / (exam.completedStudents.length + exam.pendingStudents.length)) * 100) 
                  : 0;
                const isExpanded = expandedExams.has(exam.examId);

                return (
                  <Collapsible key={exam.examId} open={isExpanded} onOpenChange={() => toggleExam(exam.examId)}>
                    <div className="border border-border rounded-lg overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="font-medium text-sm">{exam.examTitle}</p>
                              {exam.deadline && (
                                <p className="text-xs text-muted-foreground">
                                  Due: {format(new Date(exam.deadline), "MMM d, yyyy")}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={completionPercent === 100 ? "default" : completionPercent >= 50 ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {exam.completedStudents.length}/{exam.completedStudents.length + exam.pendingStudents.length}
                            </Badge>
                            <span className="text-xs text-muted-foreground">({completionPercent}%)</span>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t border-border p-3 space-y-3">
                          {/* Completed Students */}
                          {exam.completedStudents.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Completed ({exam.completedStudents.length})
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {exam.completedStudents.map((student) => (
                                  <Badge key={student.id} variant="outline" className="text-xs bg-emerald-500/5">
                                    {student.name}
                                    {student.submittedAt && (
                                      <span className="ml-1 text-muted-foreground">
                                        ({format(new Date(student.submittedAt), "MMM d")})
                                      </span>
                                    )}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Pending Students */}
                          {exam.pendingStudents.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Pending ({exam.pendingStudents.length})
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendReminder(exam.examTitle, exam.pendingStudents.length);
                                  }}
                                >
                                  <Bell className="h-3 w-3" />
                                  Send Reminder
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {exam.pendingStudents.map((student) => (
                                  <Badge key={student.id} variant="outline" className="text-xs bg-amber-500/5">
                                    {student.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
