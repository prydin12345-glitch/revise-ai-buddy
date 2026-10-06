import { LoadError } from "@/components/shared/ListFeedback";
import { useRetainedState } from "@/hooks/use-workspace-session";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, MessageCircle, Send, CheckCircle, Clock, 
  ChevronDown, ChevronUp, ExternalLink, FileText, History, 
  Bell, ChevronLeft, ChevronRight
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MathRenderer } from "@/components/MathRenderer";
import { format } from "date-fns";
import { FeedbackFilterBar } from "@/components/tutor/FeedbackFilterBar";
import { FeedbackPriorityTags, FeedbackTag, TAG_CONFIG } from "@/components/tutor/FeedbackPriorityTags";
import { StudentProfileTooltip } from "@/components/tutor/StudentProfileTooltip";
import { StudentFeedbackHistory } from "@/components/tutor/StudentFeedbackHistory";
import { checkTone, ToneCheckerDisplay } from "@/components/tutor/ToneChecker";
import { useNotifications } from "@/hooks/useNotifications";


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
  resolved_at?: string | null;
  resolved_by?: string | null;
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
  const [searchParams] = useSearchParams();
  const linkedThread = searchParams.get("thread");
  const openedLink = useRef<string | null>(null);
  const { markAsReadByMetadata } = useNotifications();
  const [threads, setThreads] = useRetainedState<FeedbackThread[]>("feedback:threads", []);
  const [loaded, setLoaded] = useRetainedState("feedback:loaded", false);
  const [loading, setLoading] = useState(!loaded);
  const [loadError, setLoadError] = useState(false);
  const [selectedThread, setSelectedThread] = useState<FeedbackThread | null>(null);
  const [response, setResponse] = useState("");
  // Private replies stay in account-scoped memory, never browser storage.
  const [responseDrafts, setResponseDrafts] = useRetainedState<Record<string, string>>("feedback:response-drafts", {});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useRetainedState("feedback:activeTab", "pending");
  
  // Filter states
  const [filters, setFilters] = useRetainedState<FilterOptions>("feedback:filters", { search: "", subject: "all", examId: "all" });
  const [exams, setExams] = useRetainedState<{ id: string; title: string; subject?: string }[]>("feedback:exams", []);
  const [subjects, setSubjects] = useRetainedState<string[]>("feedback:subjects", []);
  
  // Pagination
  const [currentPage, setCurrentPage] = useRetainedState("feedback:currentPage", 1);
  
  // Expandable cards
  const [expandedCards, setExpandedCards] = useRetainedState<Set<string>>("feedback:expandedCards", new Set());
  
  // Tags
  const [threadTags, setThreadTags] = useRetainedState<Map<string, FeedbackTag[]>>("feedback:tags", new Map());
  
  // History modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<{ id: string; name: string; threadId: string } | null>(null);
  
  // Notification toggles
  const [notifyOnReply, setNotifyOnReply] = useState(false);
  const [notifyOnResolve, setNotifyOnResolve] = useState(false);

  const fetchThreads = useCallback(async () => {
    setLoadError(false);
    setLoading(true);
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
      setLoaded(true);
    } catch (error) {
      setLoadError(true);
      console.error("Error fetching threads:", error);
      toast({ title: "Error loading feedback", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [setThreads, setThreadTags, setExams, setSubjects, setLoaded]);

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
  }, [fetchThreads]);

  useEffect(() => {
    if (loading || !linkedThread || openedLink.current === linkedThread) return;
    const match = threads.find(thread => thread.id === linkedThread);
    if (match) { setSelectedThread(match); setResponse(responseDrafts[match.id] ?? match.tutor_response ?? ''); openedLink.current = linkedThread; }
  }, [loading, linkedThread, threads, responseDrafts]);

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
  const respondedThreads = filteredThreads.filter(t => t.status === "responded" || t.status === "resolved");
  
  const currentThreads = activeTab === "pending" ? pendingThreads : respondedThreads;
  const totalPages = Math.ceil(currentThreads.length / ITEMS_PER_PAGE);
  const paginatedThreads = currentThreads.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters or tab changes
  const previousFilters = useRef({ filters, activeTab });
  useEffect(() => {
    if (previousFilters.current.filters === filters && previousFilters.current.activeTab === activeTab) return;
    previousFilters.current = { filters, activeTab };
    setCurrentPage(1);
  }, [filters, activeTab, setCurrentPage]);

  useEffect(() => {
    if (!loaded || loading) return;
    setCurrentPage(page => Math.max(1, Math.min(page, Math.max(1, totalPages))));
  }, [loaded, loading, totalPages, setCurrentPage]);

  const handleRespond = (thread: FeedbackThread) => {
    setSelectedThread(thread);
    setResponse(responseDrafts[thread.id] ?? thread.tutor_response ?? "");
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

      // Mark related feedback_request notifications as read
      await markAsReadByMetadata("threadId", selectedThread.id);

      // Notification is handled by database trigger
      toast({ title: "Response sent", description: "The student has been notified." });
      setResponseDrafts(previous => { const next = { ...previous }; delete next[selectedThread.id]; return next; });
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
    navigate(`/tutor/exams/${encodeURIComponent(thread.exam_id)}/student/${encodeURIComponent(thread.student_id)}?questionId=${encodeURIComponent(thread.question_id)}`);
  };

  const toneResult = checkTone(response);

  if (loadError && !loaded) return <LoadError message="Couldn’t load student feedback. Please retry." onRetry={() => void fetchThreads()} />;
  if (loading && !loaded) {
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
            className={`ml-auto ${thread.status === "resolved" ? "bg-emerald-600 hover:bg-emerald-700" : !isPending ? "bg-green-500 hover:bg-green-600" : ""}`}
          >
            {isPending ? (
              <>
                <Clock className="w-3 h-3 mr-1" />
                Pending
              </>
            ) : thread.status === "resolved" ? (
              <>
                <CheckCircle className="w-3 h-3 mr-1" />
                Resolved
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
        <div className="flex flex-wrap items-center justify-between gap-y-3 mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {isPending ? dateStr : `Responded ${thread.responded_at ? formatFeedbackDate(thread.responded_at) : ""}`}
            </p>
            {thread.status === "resolved" && thread.resolved_at && (
              <Badge variant="outline" className="text-xs border-emerald-500/50 text-emerald-600 dark:text-emerald-400">
                Resolved {formatFeedbackDate(thread.resolved_at)}
              </Badge>
            )}
          </div>
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

        {/* Accordion Question Content - Click anywhere to expand */}
        <button
          type="button"
          onClick={() => toggleCardExpanded(thread.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleCardExpanded(thread.id);
            }
          }}
          aria-expanded={isExpanded}
          aria-controls={`feedback-question-${thread.id}`}
          className="w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-inset"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Question</span>
              {/* Always render with MathRenderer for consistent formatting */}
              <div className={`text-sm mt-0.5 ${!isExpanded ? "line-clamp-2" : ""}`}>
                <MathRenderer
                  content={thread.question?.question_text || ""}
                  hasMath={thread.question?.has_math}
                  className="text-sm"
                  inline={!isExpanded}
                />
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 mt-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
          </div>
        </button>

        {/* Expanded content - only show mark scheme, question already visible above */}
        {isExpanded && (
          <div 
            id={`feedback-question-${thread.id}`}
            className="space-y-2 mt-2 pl-2"
          >
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
          </div>
        )}

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
      {loadError && <LoadError message="Couldn’t refresh student feedback. Your existing list is still available." onRetry={() => void fetchThreads()} />}
        {linkedThread && !loading && !threads.some(thread => thread.id === linkedThread) && <LoadError message="This feedback thread is unavailable or inaccessible to your account." onRetry={() => void fetchThreads()} />}

      <div className="max-w-[1100px] mx-auto px-4 py-4 sm:px-6 sm:py-6">
        {/* Title Row */}
        <div className="mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Student Feedback</h1>
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
              aria-label="Previous page"
              className="h-11 min-w-11"
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
                    className="h-11 w-11 p-0"
                    aria-label={`Go to page ${pageNum}`}
                    aria-current={currentPage === pageNum ? 'page' : undefined}
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
              aria-label="Next page"
              className="h-11 min-w-11"
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
            <DialogDescription>Write an explanation for this question. Choose Send Response when you are ready to send it.</DialogDescription>
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
                <label htmlFor="tutor-feedback-response" className="text-sm font-semibold mb-2 block">Your Response:</label>
                <Textarea
                  id="tutor-feedback-response"
                  value={response}
                  onChange={(e) => {
                    const value = e.target.value;
                    setResponse(value);
                    if (selectedThread) setResponseDrafts(previous => ({ ...previous, [selectedThread.id]: value }));
                  }}
                  placeholder="Provide a helpful explanation or clarification..."
                  rows={6}
                  disabled={submitting}
                  className="text-sm"
                />
                <ToneCheckerDisplay result={toneResult} textLength={response.length} />
                {selectedThread && Object.prototype.hasOwnProperty.call(responseDrafts, selectedThread.id) && <p role="status" className="text-xs text-muted-foreground">Reply draft kept for this session.</p>}
              </div>

              {/* Notification Toggles */}
              <div className="flex flex-col gap-3 p-3 rounded-lg border bg-card">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  Notification Preferences
                </p>
                <div className="flex flex-wrap items-center justify-between gap-y-3">
                  <Label htmlFor="notify-reply" className="text-sm">Notify when student replies</Label>
                  <Switch
                    id="notify-reply"
                    checked={notifyOnReply}
                    onCheckedChange={setNotifyOnReply}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-y-3">
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
            {selectedThread && Object.prototype.hasOwnProperty.call(responseDrafts, selectedThread.id) && <Button variant="ghost" disabled={submitting} onClick={() => {
              if (!window.confirm('Discard this unfinished reply?')) return;
              setResponseDrafts(previous => { const next = { ...previous }; delete next[selectedThread.id]; return next; });
              setResponse(selectedThread.tutor_response ?? '');
            }}>Discard draft</Button>}
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
