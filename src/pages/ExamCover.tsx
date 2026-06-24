import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ExamPaperCoverStatic } from "@/components/exam/ExamPaperCoverStatic";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentPDFDownloadModal } from "@/components/student/StudentPDFDownloadModal";
import { useStudentPDF } from "@/hooks/useStudentPDF";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { LEVEL_DISPLAY_NAMES } from "@/lib/board-level-mapping";
import {
  ArrowLeft,
  ArrowRight,
  Star,
  Download,
  Edit2,
  Trash2,
  Loader2,
  Eye,
} from "lucide-react";

interface Exam {
  id: string;
  title: string;
  subject_id: string;
  created_at: string;
  status: string;
  type: string;
  exam_board?: string | null;
  qualification_level?: string | null;
  exam_topics: Array<{ topic_name: string }>;
}

type ExamState = "not-started" | "in-progress" | "completed";

interface ExamCoverProgress {
  totalQuestions: number;
  questionsCompleted: number;
  percentComplete: number;
  timerEnabled: boolean;
  durationMinutes: number;
  timeRemainingLabel: string;
  lastAccessed: string;
  examState: ExamState;
}

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const ExamCover = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { subjects, getSubjectColor } = useUserSubjects();
  const { generateStudentPDF } = useStudentPDF();

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<Exam | null>(null);
  const [progress, setProgress] = useState<ExamCoverProgress>({
    totalQuestions: 0,
    questionsCompleted: 0,
    percentComplete: 0,
    timerEnabled: false,
    durationMinutes: 0,
    timeRemainingLabel: "No timer",
    lastAccessed: "Never",
    examState: "not-started",
  });
  const [isFavourite, setIsFavourite] = useState(false);

  // Dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", subject_id: "", created_at: "" });

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        const [
          { data: examData, error: examErr },
          { data: questions },
          { data: timer },
          { data: submission },
          { data: answers },
          { data: fav },
        ] = await Promise.all([
          supabase
            .from("exams")
            .select("*, exam_topics(topic_name)")
            .eq("id", examId)
            .maybeSingle(),
          supabase.from("exam_questions").select("id").eq("exam_id", examId),
          supabase
            .from("exam_timer")
            .select("enabled, duration_minutes")
            .eq("exam_id", examId)
            .maybeSingle(),
          supabase
            .from("exam_submissions")
            .select("status, time_remaining_seconds, last_accessed_at, exam_started_at")
            .eq("exam_id", examId)
            .eq("student_id", user.id)
            .maybeSingle(),
          supabase
            .from("student_answers")
            .select("id")
            .eq("exam_id", examId)
            .eq("student_id", user.id),
          supabase
            .from("favourite_exams")
            .select("exam_id")
            .eq("exam_id", examId)
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;
        if (examErr) throw examErr;
        if (!examData) {
          toast({ title: "Not found", description: "Exam not found", variant: "destructive" });
          navigate("/my-exams");
          return;
        }

        setExam(examData as Exam);
        setIsFavourite(!!fav);
        setEditForm({
          title: examData.title,
          subject_id: examData.subject_id,
          created_at: new Date(examData.created_at).toISOString().split("T")[0],
        });

        const totalQuestions = questions?.length ?? 0;
        const questionsCompleted = answers?.length ?? 0;
        const percentComplete =
          totalQuestions > 0 ? (questionsCompleted / totalQuestions) * 100 : 0;

        let state: ExamState = "not-started";
        if (examData.status === "published") {
          if (
            submission?.status === "submitted" ||
            submission?.status === "completed" ||
            submission?.status === "graded"
          ) {
            state = "completed";
          } else if (submission?.status === "in_progress" || questionsCompleted > 0) {
            state = "in-progress";
          }
        }

        let timeRemainingLabel = "No timer";
        if (state === "completed") {
          timeRemainingLabel = "Completed";
        } else if (timer?.enabled) {
          const seconds =
            submission?.time_remaining_seconds ?? (timer.duration_minutes ?? 0) * 60;
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          timeRemainingLabel = hours > 0 ? `${hours}hr ${minutes}min` : `${minutes}min`;
        }

        let lastAccessed = "Never";
        if (submission?.last_accessed_at) {
          lastAccessed = new Date(submission.last_accessed_at).toLocaleDateString("en-GB");
        } else if (submission?.exam_started_at) {
          lastAccessed = new Date(submission.exam_started_at).toLocaleDateString("en-GB");
        }

        setProgress({
          totalQuestions,
          questionsCompleted,
          percentComplete,
          timerEnabled: !!timer?.enabled,
          durationMinutes: timer?.duration_minutes ?? 0,
          timeRemainingLabel,
          lastAccessed,
          examState: state,
        });
      } catch (err: any) {
        toast({ title: "Load failed", description: err.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [examId, navigate]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/my-exams");
  };

  const subjectColor = exam ? getSubjectColor(exam.subject_id) : "#3B82F6";
  const boardLabel = exam?.exam_board
    ? getBoardDisplayName(exam.exam_board)
    : "Generic style";
  const levelLabel = exam?.qualification_level
    ? LEVEL_DISPLAY_NAMES[exam.qualification_level] ?? exam.qualification_level
    : "Not set";

  const continueRoute = () => {
    if (!exam) return;
    switch (progress.examState) {
      case "completed":
        navigate(`/exam/${exam.id}/review`);
        break;
      case "in-progress":
        navigate(`/exam/${exam.id}/in-progress?mode=student`);
        break;
      default:
        navigate(`/exam/${exam.id}/preview`);
    }
  };

  const continueLabel =
    progress.examState === "completed"
      ? "Review"
      : progress.examState === "in-progress"
      ? "Continue"
      : "Start";
  const ContinueIcon = progress.examState === "completed" ? Eye : ArrowRight;

  const handleToggleFavourite = async () => {
    if (!exam) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      if (isFavourite) {
        await supabase
          .from("favourite_exams")
          .delete()
          .eq("user_id", user.id)
          .eq("exam_id", exam.id);
        setIsFavourite(false);
      } else {
        await supabase
          .from("favourite_exams")
          .insert({ user_id: user.id, exam_id: exam.id });
        setIsFavourite(true);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveEdit = async () => {
    if (!exam) return;
    try {
      const { error } = await supabase
        .from("exams")
        .update({
          title: editForm.title,
          subject_id: editForm.subject_id,
          created_at: editForm.created_at || exam.created_at,
        })
        .eq("id", exam.id);
      if (error) throw error;
      toast({ title: "Success", description: "Exam updated successfully" });
      setEditOpen(false);
      setExam({ ...exam, ...editForm, created_at: editForm.created_at || exam.created_at });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!exam) return;
    try {
      const { error } = await supabase.from("exams").delete().eq("id", exam.id);
      if (error) throw error;
      toast({ title: "Success", description: "Exam deleted successfully" });
      navigate("/my-exams");
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handlePDFDownload = async () => {
    if (!exam) return;
    await generateStudentPDF({ contentType: "exam", contentId: exam.id });
  };

  if (loading || !exam) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const showContinue = exam.status === "published";

  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={200}>
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="gap-2 -ml-2"
            aria-label="Back to My Exams"
          >
            <ArrowLeft className="w-4 h-4" />
            My Exams
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-8 items-start">
            {/* Big paper cover */}
            <div className="max-w-xl w-full mx-auto lg:mx-0">
              <ExamPaperCoverStatic
                examName={exam.title}
                subjectId={exam.subject_id}
                subjectColor={subjectColor}
                boardLabel={boardLabel}
                levelLabel={levelLabel}
                totalQuestions={progress.totalQuestions}
                timerEnabled={progress.timerEnabled}
                durationMinutes={progress.durationMinutes}
                topics={exam.exam_topics.map((t) => t.topic_name)}
              />
            </div>

            {/* Side panel */}
            <aside className="rounded-lg border border-border bg-card p-5 space-y-5">
              {/* Status + progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Progress
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {Math.round(progress.percentComplete)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, progress.percentComplete))}%`,
                      backgroundColor:
                        progress.examState === "completed"
                          ? "hsl(var(--success))"
                          : subjectColor,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {progress.questionsCompleted} of {progress.totalQuestions || "—"} questions
                </p>
              </div>

              {/* Meta */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Created
                  </dt>
                  <dd className="font-medium mt-0.5">{formatDate(exam.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Last opened
                  </dt>
                  <dd className="font-medium mt-0.5">{progress.lastAccessed}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Board
                  </dt>
                  <dd className="font-medium mt-0.5 truncate">{boardLabel}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Level
                  </dt>
                  <dd className="font-medium mt-0.5 truncate">{levelLabel}</dd>
                </div>
              </dl>

              {/* Actions */}
              <div className="border-t border-border pt-4 space-y-1">
                <button
                  type="button"
                  onClick={handleToggleFavourite}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                >
                  <Star
                    className={`w-4 h-4 ${
                      isFavourite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                    }`}
                  />
                  {isFavourite ? "Remove from favourites" : "Add to favourites"}
                </button>
                <button
                  type="button"
                  onClick={() => setPdfOpen(true)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                >
                  <Download className="w-4 h-4 text-muted-foreground" />
                  Download as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                  Edit details
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete exam
                </button>
              </div>

              {/* Continue */}
              {showContinue && (
                <div className="border-t border-border pt-4 flex justify-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={continueRoute}
                        aria-label={continueLabel}
                        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center transition-all hover:scale-105 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ContinueIcon className="w-6 h-6" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{continueLabel}</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Exam</DialogTitle>
              <DialogDescription>Update the exam details below</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Exam Title</Label>
                <Input
                  id="title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Select
                  value={editForm.subject_id}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, subject_id: value })
                  }
                >
                  <SelectTrigger id="subject">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.subject_name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: subject.subject_color }}
                          />
                          {subject.subject_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date (Optional)</Label>
                <Input
                  id="date"
                  type="date"
                  value={editForm.created_at}
                  onChange={(e) =>
                    setEditForm({ ...editForm, created_at: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete dialog */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{exam.title}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* PDF download */}
        <StudentPDFDownloadModal
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          contentType="exam"
          contentId={exam.id}
          contentTitle={exam.title}
          onDownload={handlePDFDownload}
        />
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default ExamCover;
