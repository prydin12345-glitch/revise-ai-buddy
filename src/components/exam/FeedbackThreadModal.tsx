import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageCircle, CheckCircle, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ResolveConfirmationModal } from "./ResolveConfirmationModal";
import { useUserPreferences } from "@/hooks/useUserPreferences";

interface FeedbackThread {
  id: string;
  student_comment: string;
  tutor_response: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

interface FeedbackThreadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  questionId: string;
  questionNumber: string;
}

export const FeedbackThreadModal = ({ 
  open, 
  onOpenChange, 
  examId, 
  questionId,
  questionNumber 
}: FeedbackThreadModalProps) => {
  const [comment, setComment] = useState("");
  const [existingThread, setExistingThread] = useState<FeedbackThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showResolveConfirm, setShowResolveConfirm] = useState(false);
  
  const { preferences, updatePreference } = useUserPreferences();

  useEffect(() => {
    if (open) {
      fetchExistingThread();
    }
  }, [open, questionId]);

  const fetchExistingThread = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("question_feedback_threads")
        .select("*")
        .eq("exam_id", examId)
        .eq("question_id", questionId)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      setExistingThread(data);
      if (data && data.status === "pending") {
        setComment(data.student_comment);
      }
    } catch (error) {
      console.error("Error fetching feedback thread:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast({ title: "Comment required", description: "Please enter a comment or question.", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (existingThread && existingThread.status === "pending") {
        // Update existing pending thread
        const { error } = await supabase
          .from("question_feedback_threads")
          .update({ student_comment: comment, created_at: new Date().toISOString() })
          .eq("id", existingThread.id);

        if (error) throw error;
      } else {
        // Create new thread - notification is handled by database trigger
        const { error } = await supabase
          .from("question_feedback_threads")
          .insert({
            exam_id: examId,
            question_id: questionId,
            student_id: user.id,
            student_comment: comment,
            status: "pending"
          });

        if (error) throw error;
      }

      toast({ title: "Feedback submitted", description: "Your tutor will respond soon." });
      onOpenChange(false);
      setComment("");
      setExistingThread(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingThread) return;

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from("question_feedback_threads")
        .delete()
        .eq("id", existingThread.id);

      if (error) throw error;

      toast({ title: "Feedback deleted" });
      onOpenChange(false);
      setComment("");
      setExistingThread(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveClick = () => {
    // Check user preference for confirmation
    const shouldConfirm = preferences?.confirm_resolve_feedback !== false;
    
    if (shouldConfirm) {
      setShowResolveConfirm(true);
    } else {
      performResolve(false);
    }
  };

  const performResolve = async (dontShowAgain: boolean) => {
    if (!existingThread) return;

    try {
      setResolving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update preference if "don't show again" was checked
      if (dontShowAgain) {
        await updatePreference({ confirm_resolve_feedback: false });
      }

      const { error } = await supabase
        .from("question_feedback_threads")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id
        })
        .eq("id", existingThread.id);

      if (error) throw error;

      toast({ title: "Marked as resolved", description: "Your tutor has been notified." });
      
      // Update local state
      setExistingThread({
        ...existingThread,
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: user.id
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setResolving(false);
      setShowResolveConfirm(false);
    }
  };

  const isResolved = existingThread?.status === "resolved";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Question {questionNumber} Feedback
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {existingThread && (existingThread.status === "responded" || isResolved) ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Your Question</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(existingThread.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      {existingThread.student_comment}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Tutor Response
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {existingThread.responded_at && new Date(existingThread.responded_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      {existingThread.tutor_response}
                    </div>
                  </div>

                  {/* Resolved status or resolve action */}
                  {isResolved ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Resolved
                      </span>
                      {existingThread.resolved_at && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(existingThread.resolved_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <Button 
                      onClick={handleResolveClick}
                      variant="outline"
                      className="w-full gap-2 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                      disabled={resolving}
                    >
                      {resolving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ThumbsUp className="w-4 h-4" />
                      )}
                      Mark as resolved
                    </Button>
                  )}

                  <Button 
                    onClick={() => {
                      setExistingThread(null);
                      setComment("");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Ask a follow-up question
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      What do you need help with?
                    </label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Explain what you're confused about or what you'd like clarification on..."
                      rows={5}
                      disabled={submitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      Your tutor will be notified and respond to your question.
                    </p>
                  </div>

                  {existingThread && existingThread.status === "pending" && (
                    <Badge variant="secondary" className="w-fit">
                      Pending tutor response
                    </Badge>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {existingThread && existingThread.status === "pending" ? (
              <>
                <Button onClick={handleDelete} variant="outline" disabled={submitting}>
                  Delete
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update
                </Button>
              </>
            ) : existingThread && (existingThread.status === "responded" || isResolved) ? (
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit Feedback
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResolveConfirmationModal
        open={showResolveConfirm}
        onOpenChange={setShowResolveConfirm}
        onConfirm={performResolve}
      />
    </>
  );
};
