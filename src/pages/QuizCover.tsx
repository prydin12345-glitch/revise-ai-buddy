import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { QuizPaperCoverStatic } from "@/components/practice/QuizPaperCoverStatic";
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

interface PracticeSet {
  id: string;
  set_name: string;
  subject_id: string;
  subtopics: string[];
  difficulty_mode: string;
  difficulty_level: string;
  question_count: number;
  created_at: string;
  educational_tier?: string;
  exam_board?: string;
}

type QuizState = "not-started" | "in-progress" | "completed";

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime()) || d.getTime() < 86400000) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const QuizCover = () => {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const { subjects, getSubjectColor } = useUserSubjects();
  const { generateStudentPDF } = useStudentPDF();

  const [loading, setLoading] = useState(true);
  const [set, setSet] = useState<PracticeSet | null>(null);
  const [questionsAttempted, setQuestionsAttempted] = useState(0);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [lastAccessed, setLastAccessed] = useState<string>("Never");
  const [timeSpentSec, setTimeSpentSec] = useState(0);
  const [isFavourite, setIsFavourite] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [editForm, setEditForm] = useState({ set_name: "", subject_id: "", created_at: "" });

  useEffect(() => {
    if (!setId) return;
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
          { data: setData, error: setErr },
          { data: prog },
          { data: fav },
        ] = await Promise.all([
          supabase.from("practice_question_sets").select("*").eq("id", setId).maybeSingle(),
          supabase
            .from("practice_set_progress")
            .select("*")
            .eq("set_id", setId)
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("favourite_practice_sets")
            .select("set_id")
            .eq("set_id", setId)
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (cancelled) return;
        if (setErr) throw setErr;
        if (!setData) {
          toast({ title: "Not found", description: "Quiz not found", variant: "destructive" });
          navigate("/quizzes");
          return;
        }

        setSet(setData as PracticeSet);
        setIsFavourite(!!fav);
        setEditForm({
          set_name: setData.set_name,
          subject_id: setData.subject_id,
          created_at: new Date(setData.created_at).toISOString().split("T")[0],
        });

        if (prog) {
          setQuestionsAttempted(prog.questions_attempted || 0);
          setCompletedAt(prog.completed_at || null);
          setTimeSpentSec(prog.time_spent_seconds || 0);
          if (prog.last_accessed_at) {
            setLastAccessed(new Date(prog.last_accessed_at).toLocaleDateString("en-GB"));
          }
        }
      } catch (err: any) {
        toast({ title: "Load failed", description: err.message, variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setId, navigate]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/quizzes");
  };

  const subjectColor = set ? getSubjectColor(set.subject_id) : "#3B82F6";
  const boardLabel = set?.exam_board ? getBoardDisplayName(set.exam_board) : "Generic style";
  const levelLabel = set?.educational_tier
    ? LEVEL_DISPLAY_NAMES[set.educational_tier] ?? set.educational_tier
    : "Not set";

  const totalQuestions = set?.question_count ?? 0;
  const percentComplete =
    totalQuestions > 0 ? (questionsAttempted / totalQuestions) * 100 : 0;

  const quizState: QuizState = completedAt
    ? "completed"
    : questionsAttempted > 0
    ? "in-progress"
    : "not-started";

  const continueRoute = () => {
    if (!set) return;
    if (quizState === "completed") {
      navigate(`/practice-questions/${set.id}/preview`);
    } else {
      navigate(`/practice-questions/${set.id}/take`);
    }
  };

  const continueLabel =
    quizState === "completed" ? "Review" : quizState === "in-progress" ? "Continue" : "Start";
  const ContinueIcon = quizState === "completed" ? Eye : ArrowRight;

  const handleToggleFavourite = async () => {
    if (!set) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      if (isFavourite) {
        await supabase
          .from("favourite_practice_sets")
          .delete()
          .eq("user_id", user.id)
          .eq("set_id", set.id);
        setIsFavourite(false);
      } else {
        await supabase
          .from("favourite_practice_sets")
          .insert({ user_id: user.id, set_id: set.id });
        setIsFavourite(true);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveEdit = async () => {
    if (!set) return;
    try {
      const { error } = await supabase
        .from("practice_question_sets")
        .update({
          set_name: editForm.set_name,
          subject_id: editForm.subject_id,
          created_at: editForm.created_at || set.created_at,
        })
        .eq("id", set.id);
      if (error) throw error;
      toast({ title: "Success", description: "Quiz updated successfully" });
      setEditOpen(false);
      setSet({ ...set, ...editForm, created_at: editForm.created_at || set.created_at });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!set) return;
    try {
      const { error } = await supabase
        .from("practice_question_sets")
        .delete()
        .eq("id", set.id);
      if (error) throw error;
      toast({ title: "Success", description: "Quiz deleted successfully" });
      navigate("/quizzes");
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const handlePDFDownload = async () => {
    if (!set) return;
    await generateStudentPDF({ contentType: "practice", contentId: set.id });
  };

  if (loading || !set) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const difficulty = set.difficulty_level || set.difficulty_mode || "Medium";

  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={200}>
        <div className="max-w-6xl mx-auto space-y-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="gap-2 -ml-2"
            aria-label="Back to Practice Quizzes"
          >
            <ArrowLeft className="w-4 h-4" />
            Practice Quizzes
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 lg:gap-8 items-start">
            <div className="max-w-xl w-full mx-auto lg:mx-0">
              <QuizPaperCoverStatic
                setName={set.set_name}
                subjectId={set.subject_id}
                subjectColor={subjectColor}
                boardLabel={boardLabel}
                levelLabel={levelLabel}
                totalQuestions={totalQuestions}
                difficulty={difficulty}
                subtopics={set.subtopics || []}
              />
            </div>

            <aside className="rounded-lg border border-border bg-card p-5 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Progress
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {Math.round(percentComplete)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max(0, Math.min(100, percentComplete))}%`,
                      backgroundColor:
                        quizState === "completed" ? "hsl(var(--success))" : subjectColor,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {questionsAttempted} of {totalQuestions || "—"} questions
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Created
                  </dt>
                  <dd className="font-medium mt-0.5">{formatDate(set.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Last opened
                  </dt>
                  <dd className="font-medium mt-0.5">{lastAccessed}</dd>
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
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Difficulty
                  </dt>
                  <dd className="font-medium mt-0.5 capitalize truncate">{difficulty}</dd>
                </div>
                {timeSpentSec > 0 && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Time spent
                    </dt>
                    <dd className="font-medium mt-0.5">
                      {Math.floor(timeSpentSec / 60)} min
                    </dd>
                  </div>
                )}
              </dl>

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
                  Delete quiz
                </button>
              </div>

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
            </aside>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Quiz</DialogTitle>
              <DialogDescription>Update the quiz details below</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="set_name">Quiz Title</Label>
                <Input
                  id="set_name"
                  value={editForm.set_name}
                  onChange={(e) => setEditForm({ ...editForm, set_name: e.target.value })}
                  placeholder="Enter quiz title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Select
                  value={editForm.subject_id}
                  onValueChange={(value) => setEditForm({ ...editForm, subject_id: value })}
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
                  onChange={(e) => setEditForm({ ...editForm, created_at: e.target.value })}
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

        {/* Delete Dialog */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{set.set_name}". This action cannot be undone.
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

        {/* PDF Download Modal */}
        <StudentPDFDownloadModal
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          contentType="practice"
          contentId={set.id}
          contentTitle={set.set_name}
          onDownload={handlePDFDownload}
        />
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default QuizCover;
