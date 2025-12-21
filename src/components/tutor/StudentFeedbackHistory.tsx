import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageCircle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

interface HistoryThread {
  id: string;
  student_comment: string;
  tutor_response: string | null;
  status: string;
  created_at: string;
  exam_title?: string;
  question_number?: string;
}

interface StudentFeedbackHistoryProps {
  studentId: string;
  studentName: string;
  currentThreadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StudentFeedbackHistory = ({
  studentId,
  studentName,
  currentThreadId,
  open,
  onOpenChange
}: StudentFeedbackHistoryProps) => {
  const [history, setHistory] = useState<HistoryThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, studentId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("question_feedback_threads")
        .select(`
          id,
          student_comment,
          tutor_response,
          status,
          created_at,
          exam:exams!question_feedback_threads_exam_id_fkey(title),
          question:exam_questions!inner(question_number)
        `)
        .eq("student_id", studentId)
        .neq("id", currentThreadId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const mapped = (data || []).map((t: any) => ({
        id: t.id,
        student_comment: t.student_comment,
        tutor_response: t.tutor_response,
        status: t.status,
        created_at: t.created_at,
        exam_title: t.exam?.title,
        question_number: t.question?.question_number
      }));

      setHistory(mapped);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Feedback History: {studentName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No previous feedback from this student</p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {history.map((thread) => (
                <div 
                  key={thread.id} 
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {thread.question_number && (
                        <Badge variant="outline" className="text-xs">
                          Q{thread.question_number}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {thread.exam_title}
                      </span>
                    </div>
                    <Badge 
                      variant={thread.status === "pending" ? "secondary" : "default"}
                      className={thread.status === "responded" ? "bg-emerald-500" : ""}
                    >
                      {thread.status === "pending" ? (
                        <Clock className="h-3 w-3 mr-1" />
                      ) : (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      {thread.status === "pending" ? "Pending" : "Responded"}
                    </Badge>
                  </div>

                  <p className="text-sm mb-1">{thread.student_comment}</p>
                  
                  {thread.tutor_response && (
                    <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-xs font-medium text-emerald-600 mb-1">Your Response:</p>
                      <p className="text-xs">{thread.tutor_response}</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(thread.created_at), "d MMM yyyy")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
