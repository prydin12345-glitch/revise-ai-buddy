import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Loader2, MessageCircle, Send, CheckCircle, ChevronLeft, Clock, 
  ChevronDown, ChevronUp, ExternalLink, FileText, History, 
  Bell, Moon, Sun, ChevronRight
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MathRenderer } from "@/components/MathRenderer";
import { format } from "date-fns";
import { FeedbackFilterBar } from "@/components/tutor/FeedbackFilterBar";
import { FeedbackPriorityTags, FeedbackTag, TAG_CONFIG } from "@/components/tutor/FeedbackPriorityTags";
import { StudentProfileTooltip } from "@/components/tutor/StudentProfileTooltip";
import { StudentFeedbackHistory } from "@/components/tutor/StudentFeedbackHistory";
import { checkTone, ToneCheckerDisplay } from "@/components/tutor/ToneChecker";
import { useTheme } from "next-themes";

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
  notify_on_reply?: boolean;
  notify_on_resolve?: boolean;
  exam?: { title: string; subject_id?: string };
  question?: { question_number: string; question_text: string; has_math: boolean; correct_answer?: string };
  student?: { display_name: string | null; student_code: string | null; first_name: string | null; last_name: string | null };
  tags?: FeedbackTag[];
}

interface FilterOptions {
  search: string;
  subject: string;
  examId: string;
}

const ITEMS_PER_PAGE = 10;

// Format student name according to spec
const formatStudentName = (student?: { display_name: string | null; student_code: string | null; first_name: string | null; last_name: string | null }): string => {
  if (!student) return "";
  
  const { first_name, last_name, student_code } = student;
  const code = student_code || "";
  
  if (first_name && last_name) {
    return `${first_name} ${last_name.charAt(0).toUpperCase()}${code ? ` (${code})` : ""}`;
  } else if (first_name) {
    return `${first_name}${code ? ` (${code})` : ""}`;
  } else if (code) {
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
  const { theme, setTheme } = useTheme();
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<FeedbackThread | null>(null);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  
  // Filter states
  const [filters, setFilters] = useState<FilterOptions>({ search: "", subject: "all", examId: "all" });
  const [exams, setExams] = useState<{ id: string; title: string; subject?: string }[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Expandable cards
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  // Tags
  const [threadTags, setThreadTags] = useState<Map<string, FeedbackTag[]>>(new Map());
  
  // History modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<{ id: string; name: string; threadId: string } | null>(null);
  
  // Notification toggles
  const [notifyOnReply, setNotifyOnReply] = useState(false);
  const [notifyOnResolve, setNotifyOnResolve] = useState(false);

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
          exam:exams!question_feedback_threads_exam_id_fkey(title, subject_id)
        `)
        .or(`tutor_id.eq.${user.id},tutor_id.is.null`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const questionIds = data?.map(t => t.question_id) || [];
      
      const { data: questions } = await supabase
        .from("exam_questions")
        .select("id, question_number, question_text, has_math, correct_answer")
        .in("id", questionIds);

      const questionsMap = new Map(questions?.map(q => [q.id, q]) || []);

      const studentIds = [...new Set(data?.map(t => t.student_id) || [])];
      const { data: studentProfiles } = await supabase
        .from("user_profiles")
        .select("id, display_name, student_code, first_name, last_name")
        .in("id", studentIds);

      const studentMap = new Map(studentProfiles?.map(s => [s.id, s]) || []);

      const { data: userExams } = await supabase
        .from("exams")
        .select("id, title, subject_id")
        .or(`user_id.eq.${user.id},assigned_by.eq.${user.id}`);

      const userExamIds = new Set(userExams?.map(e => e.id) || []);
      const filteredThreads = (data || [])
        .filter(t => userExamIds.has(t.exam_id))
        .map(t => ({
          ...t,
          question: questionsMap.get(t.question_id),
          student: studentMap.get(t.student_id)
        }));

      // Fetch tags
      const threadIds = filteredThreads.map(t => t.id);
      const { data: tagsData } = await supabase
        .from("feedback_tags")
        .select("thread_id, tag")
        .in("thread_id", threadIds);
      
      const tagsMap = new Map<string, FeedbackTag[]>();
      tagsData?.forEach(t => {
        const existing = tagsMap.get(t.thread_id) || [];
        tagsMap.set(t.thread_id, [...existing, t.tag as FeedbackTag]);
      });
      setThreadTags(tagsMap);

      // Extract unique exams and subjects
      const uniqueExams = userExams?.map(e => ({ id: e.id, title: e.title })) || [];
      setExams(uniqueExams);
      
      // Get subject names
      const subjectIds = [...new Set(userExams?.map(e => e.subject_id).filter(Boolean))];
      if (subjectIds.length > 0) {
        const { data: subjectsData } = await supabase
          .from("user_subjects")
          .select("subject_name")
          .in("id", subjectIds);
        setSubjects([...new Set(subjectsData?.map(s => s.subject_name) || [])]);
      }

      setThreads(filteredThreads as FeedbackThread[]);
    } catch (error) {
      console.error("Error fetching threads:", error);
      toast({ title: "Error loading feedback", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Filter threads
  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const studentName = formatStudentName(thread.student).toLowerCase();
        const examTitle = thread.exam?.title?.toLowerCase() || "";
        const questionNum = thread.question?.question_number?.toLowerCase() || "";
        
        if (!studentName.includes(search) && !examTitle.includes(search) && !questionNum.includes(search)) {
          return false;
        }
      }
      
      // Exam filter
      if (filters.examId !== "all" && thread.exam_id !== filters.examId) {
        return false;
      }
      
      return true;
    });
  }, [threads, filters]);

  const pendingThreads = filteredThreads.filter(t => t.status === "pending");
  const respondedThreads = filteredThreads.filter(t => t.status === "responded");
  
  const currentThreads = activeTab === "pending" ? pendingThreads : respondedThreads;
  const totalPages = Math.ceil(currentThreads.length / ITEMS_PER_PAGE);
  const paginatedThreads = currentThreads.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, activeTab]);

  const handleRespond = (thread: FeedbackThread) => {
    setSelectedThread(thread);
    setResponse(thread.tutor_response || "");
    setNotifyOnReply(thread.notify_on_reply || false);
    setNotifyOnResolve(thread.notify_on_resolve || false);
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
          responded_at: new Date().toISOString(),
          notify_on_reply: notifyOnReply,
          notify_on_resolve: notifyOnResolve
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

  const toggleCardExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTagToggle = async (threadId: string, tag: FeedbackTag) => {
    const currentTags = threadTags.get(threadId) || [];
    const hasTag = currentTags.includes(tag);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (hasTag) {
        await supabase.from("feedback_tags").delete()
          .eq("thread_id", threadId)
          .eq("tag", tag);
      } else {
        await supabase.from("feedback_tags").insert({
          thread_id: threadId,
          tag,
          created_by: user.id
        });
      }

      setThreadTags(prev => {
        const next = new Map(prev);
        const updated = hasTag 
          ? currentTags.filter(t => t !== tag)
          : [...currentTags, tag];
        next.set(threadId, updated);
        return next;
      });
    } catch (error) {
      console.error("Error toggling tag:", error);
    }
  };

  const openStudentSubmission = (thread: FeedbackThread) => {
    navigate(`/tutor/exam/${thread.exam_id}/review?studentId=${thread.student_id}&questionId=${thread.question_id}`);
  };

  const toneResult = checkTone(response);

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
    const isExpanded = expandedCards.has(thread.id);
    const tags = threadTags.get(thread.id) || [];
    
    return (
      <Card key={thread.id} className="p-4">
        {/* Header Row */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
            Q{thread.question?.question_number}
          </Badge>
          <span className="text-sm font-medium text-foreground">{thread.exam?.title}</span>
          {studentName && (
            <StudentProfileTooltip studentId={thread.student_id}>
              <span className="text-sm text-muted-foreground cursor-help hover:text-foreground transition-colors">
                · {studentName}
              </span>
            </StudentProfileTooltip>
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

        {/* Tags */}
        <div className="mb-2">
          <FeedbackPriorityTags
            activeTags={tags}
            onTagToggle={(tag) => handleTagToggle(thread.id, tag)}
          />
        </div>

        {/* Timestamp & Quick Actions */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground">
            {isPending ? dateStr : `Responded ${thread.responded_at ? formatFeedbackDate(thread.responded_at) : ""}`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => {
                setHistoryStudent({ 
                  id: thread.student_id, 
                  name: studentName || "Student", 
                  threadId: thread.id 
                });
                setHistoryModalOpen(true);
              }}
            >
              <History className="h-3 w-3" />
              History
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => openStudentSubmission(thread)}
            >
              <ExternalLink className="h-3 w-3" />
              View Submission
            </Button>
          </div>
        </div>

        {/* Collapsible Question Content */}
        <Collapsible open={isExpanded} onOpenChange={() => toggleCardExpanded(thread.id)}>
          <CollapsibleTrigger asChild>
            <button className="w-full text-left">
              <div className="flex items-start justify-between gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Question</span>
                  <p className="text-sm mt-0.5 line-clamp-2">
                    {thread.question?.question_text?.slice(0, 150)}
                    {(thread.question?.question_text?.length || 0) > 150 && "..."}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-4" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-4" />
                )}
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-2 mt-2">
            <div className="p-3 rounded-md bg-muted/50">
              <MathRenderer
                content={thread.question?.question_text || ""}
                hasMath={thread.question?.has_math}
                className="text-sm"
              />
            </div>

            {thread.question?.correct_answer && (
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Mark Scheme
                </span>
                <div className="p-2.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-sm mt-1">
                  {thread.question.correct_answer}
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Student's Question */}
        <div className="mt-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Student's Question</span>
          <div className="p-2.5 rounded-md bg-muted text-sm mt-1">
            {thread.student_comment}
          </div>
        </div>

        {/* Tutor Response (for responded threads) */}
        {!isPending && thread.tutor_response && (
          <div className="mt-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Response</span>
            <div className="p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-sm mt-1">
              {thread.tutor_response}
            </div>
          </div>
        )}

        {/* Action */}
        {isPending && (
          <div className="pt-3 mt-3 border-t border-border flex justify-center">
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
        {/* Title Row with Back Button & Theme Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 p-0"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="mb-4">
          <FeedbackFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            exams={exams}
            subjects={subjects}
          />
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
            {paginatedThreads.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-base font-semibold mb-1">All caught up!</h3>
                <p className="text-sm text-muted-foreground">No pending feedback requests</p>
              </Card>
            ) : (
              paginatedThreads.map((thread) => renderFeedbackCard(thread, true))
            )}
          </TabsContent>

          <TabsContent value="responded" className="space-y-3 mt-3">
            {paginatedThreads.length === 0 ? (
              <Card className="p-8 text-center">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-base font-semibold mb-1">No responses yet</h3>
                <p className="text-sm text-muted-foreground">Responded feedback threads will appear here</p>
              </Card>
            ) : (
              paginatedThreads.map((thread) => renderFeedbackCard(thread, false))
            )}
          </TabsContent>
        </Tabs>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Response Dialog */}
      <Dialog open={!!selectedThread} onOpenChange={(open) => !open && setSelectedThread(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Respond to Student</DialogTitle>
          </DialogHeader>

          {selectedThread && (
            <div className="space-y-4">
              {/* Context Info */}
              <div className="p-3 rounded-lg bg-muted/50 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Student:</span>{" "}
                  <span className="font-medium">{formatStudentName(selectedThread.student) || "Unknown"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Exam:</span>{" "}
                  <span className="font-medium">{selectedThread.exam?.title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Question:</span>{" "}
                  <span className="font-medium">Q{selectedThread.question?.question_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Asked:</span>{" "}
                  <span className="font-medium">{formatFeedbackDate(selectedThread.created_at)}</span>
                </div>
              </div>

              {/* Question */}
              <div>
                <div className="text-sm font-semibold mb-2">Question {selectedThread.question?.question_number}</div>
                <MathRenderer
                  content={selectedThread.question?.question_text || ""}
                  hasMath={selectedThread.question?.has_math}
                  className="text-sm p-3 rounded-lg bg-muted"
                />
              </div>

              {/* Mark Scheme if available */}
              {selectedThread.question?.correct_answer && (
                <div>
                  <div className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    Mark Scheme
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
                    {selectedThread.question.correct_answer}
                  </div>
                </div>
              )}

              {/* Student's Question */}
              <div>
                <div className="text-sm font-semibold mb-2">Student's Question:</div>
                <div className="p-3 rounded-lg bg-accent text-sm">
                  {selectedThread.student_comment}
                </div>
              </div>

              {/* Response Input */}
              <div>
                <label className="text-sm font-semibold mb-2 block">Your Response:</label>
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Provide a helpful explanation or clarification..."
                  rows={6}
                  disabled={submitting}
                  className="text-sm"
                />
                <ToneCheckerDisplay result={toneResult} textLength={response.length} />
              </div>

              {/* Notification Toggles */}
              <div className="flex flex-col gap-3 p-3 rounded-lg border bg-card">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  Notification Preferences
                </p>
                <div className="flex items-center justify-between">
                  <Label htmlFor="notify-reply" className="text-sm">Notify when student replies</Label>
                  <Switch
                    id="notify-reply"
                    checked={notifyOnReply}
                    onCheckedChange={setNotifyOnReply}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="notify-resolve" className="text-sm">Notify when resolved</Label>
                  <Switch
                    id="notify-resolve"
                    checked={notifyOnResolve}
                    onCheckedChange={setNotifyOnResolve}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleSubmitResponse} disabled={submitting || !response.trim()}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Send className="w-4 h-4 mr-2" />
              Send Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student History Modal */}
      {historyStudent && (
        <StudentFeedbackHistory
          studentId={historyStudent.id}
          studentName={historyStudent.name}
          currentThreadId={historyStudent.threadId}
          open={historyModalOpen}
          onOpenChange={setHistoryModalOpen}
        />
      )}
    </div>
  );
};

export default ManageFeedback;
