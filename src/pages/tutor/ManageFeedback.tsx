import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageCircle, Send, CheckCircle, ChevronLeft, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MathRenderer } from "@/components/MathRenderer";
import { format } from "date-fns";

interface FeedbackThread {
  id: string;
  exam_id: string;
  question_id: string;
  student_id: string;
  student_comment: string;
  tutor_response: string | null;
  status: string;
  created_at: string;
  responded_at: string | null;
  exam?: { title: string };
  question?: { question_number: string; question_text: string; has_math: boolean };
  student?: { display_name: string | null; student_code: string | null; first_name: string | null; last_name: string | null };
}

// Format student name according to spec
const formatStudentName = (student?: { display_name: string | null; student_code: string | null; first_name: string | null; last_name: string | null }): string => {
  if (!student) return "";
  
  const { first_name, last_name, student_code } = student;
  const code = student_code || "";
  
  if (first_name && last_name) {
    // "FirstName LastInitial (StudentID)"
    return `${first_name} ${last_name.charAt(0).toUpperCase()}${code ? ` (${code})` : ""}`;
  } else if (first_name) {
    // "FirstName (StudentID)"
    return `${first_name}${code ? ` (${code})` : ""}`;
  } else if (code) {
    // Just the ID
    return code;
  }
  
  return "";
};

// Format date as "20 Dec 2025 · 3:06 pm"
const formatFeedbackDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return format(date, "d MMM yyyy · h:mm a").toLowerCase().replace(/ am$/, " am").replace(/ pm$/, " pm");
};

const ManageFeedback = () => {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<FeedbackThread | null>(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    fetchThreads();

    const channel = supabase
      .channel("feedback-threads-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "question_feedback_threads" },
        () => fetchThreads()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchThreads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("question_feedback_threads")
        .select(`
          *,
          exam:exams!question_feedback_threads_exam_id_fkey(title)
        `)
        .or(`tutor_id.eq.${user.id},tutor_id.is.null`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const questionIds = data?.map(t => t.question_id) || [];
      
      const { data: questions } = await supabase
        .from("exam_questions")
        .select("id, question_number, question_text, has_math")
        .in("id", questionIds);

      const questionsMap = new Map(questions?.map(q => [q.id, q]) || []);

      // Fetch student profiles with first_name and last_name
      const studentIds = [...new Set(data?.map(t => t.student_id) || [])];
      const { data: studentProfiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, student_code, first_name, last_name")
        .in("id", studentIds) as { data: Array<{ id: string; display_name: string | null; student_code: string | null; first_name: string | null; last_name: string | null }> | null; error: any };

      const studentMap = new Map(studentProfiles?.map(s => [s.id, s]) || []);

      const { data: userExams } = await supabase
        .from("exams")
        .select("id")
        .or(`user_id.eq.${user.id},assigned_by.eq.${user.id}`);

      const userExamIds = new Set(userExams?.map(e => e.id) || []);
      const filteredThreads = (data || [])
        .filter(t => userExamIds.has(t.exam_id))
        .map(t => ({
          ...t,
          question: questionsMap.get(t.question_id),
          student: studentMap.get(t.student_id)
        }));

      setThreads(filteredThreads as FeedbackThread[]);
    } catch (error) {
      console.error("Error fetching threads:", error);
      toast({ title: "Error loading feedback", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = (thread: FeedbackThread) => {
    setSelectedThread(thread);
    setResponse(thread.tutor_response || "");
  };

  const handleSubmitResponse = async () => {
    if (!selectedThread || !response.trim()) {
      toast({ title: "Response required", variant: "destructive" });
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("question_feedback_threads")
        .update({
          tutor_response: response,
          tutor_id: user.id,
          status: "responded",
          responded_at: new Date().toISOString()
        })
        .eq("id", selectedThread.id);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: selectedThread.student_id,
        type: "feedback_response",
        title: "Tutor Responded to Your Question",
        body: `Your tutor responded to your question on Question ${selectedThread.question?.question_number}`,
        action_data: { examId: selectedThread.exam_id, questionId: selectedThread.question_id }
      });

      toast({ title: "Response sent", description: "The student has been notified." });
      setSelectedThread(null);
      setResponse("");
      fetchThreads();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingThreads = threads.filter(t => t.status === "pending");
  const respondedThreads = threads.filter(t => t.status === "responded");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const renderFeedbackCard = (thread: FeedbackThread, isPending: boolean) => {
    const studentName = formatStudentName(thread.student);
    const dateStr = formatFeedbackDate(thread.created_at);
    
    return (
      <Card key={thread.id} className="p-4">
        {/* Header Row */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
            Q{thread.question?.question_number}
          </Badge>
          <span className="text-sm font-medium text-foreground">{thread.exam?.title}</span>
          {studentName && (
            <span className="text-sm text-muted-foreground">· {studentName}</span>
          )}
          <Badge 
            variant={isPending ? "secondary" : "default"}
            className={`ml-auto ${!isPending ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
          >
            {isPending ? (
              <>
                <Clock className="w-3 h-3 mr-1" />
                Pending
              </>
            ) : (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Responded
              </>
            )}
          </Badge>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mb-3">
          {isPending ? dateStr : `Responded ${thread.responded_at ? formatFeedbackDate(thread.responded_at) : ""}`}
        </p>

        {/* Question Content */}
        <div className="space-y-2 mb-3">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Question</span>
            <MathRenderer
              content={thread.question?.question_text || ""}
              hasMath={thread.question?.has_math}
              className="text-sm mt-1"
            />
          </div>

          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Student's Question</span>
            <div className="p-2.5 rounded-md bg-muted text-sm mt-1">
              {thread.student_comment}
            </div>
          </div>

          {!isPending && thread.tutor_response && (
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Response</span>
              <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-sm mt-1">
                {thread.tutor_response}
              </div>
            </div>
          )}
        </div>

        {/* Action */}
        {isPending && (
          <div className="pt-3 border-t border-border flex justify-center">
            <Button onClick={() => handleRespond(thread)} size="sm" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              Respond
            </Button>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1100px] mx-auto px-4 py-4 sm:px-6 sm:py-6">
        {/* Title Row with Back Button */}
        <div className="flex items-center gap-3 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Student Feedback</h1>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="pending" className="relative text-sm">
              Pending
              {pendingThreads.length > 0 && (
                <Badge className="ml-1.5 h-5 px-1.5 text-xs">{pendingThreads.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="responded" className="text-sm">Responded</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-3">
            {pendingThreads.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-base font-semibold mb-1">All caught up!</h3>
                <p className="text-sm text-muted-foreground">No pending feedback requests</p>
              </Card>
            ) : (
              pendingThreads.map((thread) => renderFeedbackCard(thread, true))
            )}
          </TabsContent>

          <TabsContent value="responded" className="space-y-3 mt-3">
            {respondedThreads.length === 0 ? (
              <Card className="p-8 text-center">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-base font-semibold mb-1">No responses yet</h3>
                <p className="text-sm text-muted-foreground">Responded feedback threads will appear here</p>
              </Card>
            ) : (
              respondedThreads.map((thread) => renderFeedbackCard(thread, false))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Response Dialog */}
      <Dialog open={!!selectedThread} onOpenChange={(open) => !open && setSelectedThread(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Respond to Student</DialogTitle>
          </DialogHeader>

          {selectedThread && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                From: {formatStudentName(selectedThread.student) || "Unknown Student"}
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">Question {selectedThread.question?.question_number}</div>
                <MathRenderer
                  content={selectedThread.question?.question_text || ""}
                  hasMath={selectedThread.question?.has_math}
                  className="text-sm p-3 rounded-lg bg-muted"
                />
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Student's Question:</div>
                <div className="p-3 rounded-lg bg-accent text-sm">
                  {selectedThread.student_comment}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Your Response:</label>
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Provide a helpful explanation or clarification..."
                  rows={6}
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleSubmitResponse} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Send Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageFeedback;
