import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageCircle, Send, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MathRenderer } from "@/components/MathRenderer";
import { PageContainer } from "@/components/PageContainer";
import { PageHeader } from "@/components/PageHeader";

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
  student?: { display_name: string | null; student_code: string | null };
}

const ManageFeedback = () => {
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

      // Fetch questions separately
      const threadIds = data?.map(t => t.id) || [];
      const questionIds = data?.map(t => t.question_id) || [];
      
      const { data: questions } = await supabase
        .from("exam_questions")
        .select("id, question_number, question_text, has_math")
        .in("id", questionIds);

      const questionsMap = new Map(questions?.map(q => [q.id, q]) || []);

      // Fetch student profiles
      const studentIds = [...new Set(data?.map(t => t.student_id) || [])];
      const { data: studentProfiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, student_code")
        .in("id", studentIds) as { data: Array<{ id: string; display_name: string | null; student_code: string | null }> | null; error: any };

      const studentMap = new Map(studentProfiles?.map(s => [s.id, s]) || []);

      // Filter for threads where user is exam creator or assignee
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

      // Notify student
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

  return (
    <PageContainer>
      <PageHeader
        title="Student Feedback"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pending" className="relative">
            Pending
            {pendingThreads.length > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs">{pendingThreads.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="responded">Responded</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingThreads.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">No pending feedback requests</p>
            </Card>
          ) : (
            pendingThreads.map((thread) => (
              <Card key={thread.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Q{thread.question?.question_number}
                      </Badge>
                      <span className="text-sm font-medium">{thread.exam?.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {thread.student?.display_name || "Student"}
                      {thread.student?.student_code && (
                        <span className="font-mono ml-1">({thread.student.student_code})</span>
                      )}
                      {" • "}
                      {new Date(thread.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Question:
                    </div>
                    <MathRenderer
                      content={thread.question?.question_text || ""}
                      hasMath={thread.question?.has_math}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Student's Question:
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-sm">
                      {thread.student_comment}
                    </div>
                  </div>
                </div>

                <Button onClick={() => handleRespond(thread)} className="w-full gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Respond
                </Button>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="responded" className="space-y-4">
          {respondedThreads.length === 0 ? (
            <Card className="p-12 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No responses yet</h3>
              <p className="text-muted-foreground">
                Responded feedback threads will appear here
              </p>
            </Card>
          ) : (
            respondedThreads.map((thread) => (
              <Card key={thread.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        Q{thread.question?.question_number}
                      </Badge>
                      <span className="text-sm font-medium">{thread.exam?.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {thread.student?.display_name || "Student"}
                      {thread.student?.student_code && (
                        <span className="font-mono ml-1">({thread.student.student_code})</span>
                      )}
                      {" • "}
                      Responded {thread.responded_at && new Date(thread.responded_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge className="bg-green-500">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Responded
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Student's Question:
                    </div>
                    <div className="p-3 rounded-lg bg-muted text-sm">
                      {thread.student_comment}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      Your Response:
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
                      {thread.tutor_response}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedThread} onOpenChange={(open) => !open && setSelectedThread(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Respond to Student</DialogTitle>
          </DialogHeader>

          {selectedThread && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                From: {selectedThread.student?.display_name || "Student"}
                {selectedThread.student?.student_code && (
                  <span className="font-mono ml-1">({selectedThread.student.student_code})</span>
                )}
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
    </PageContainer>
  );
};

export default ManageFeedback;
