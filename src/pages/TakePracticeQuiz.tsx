import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Menu,
  X,
  Flag,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Eye,
  EyeOff,
  Save,
  AlertCircle,
  Loader2
} from "lucide-react";
import { MathRenderer } from "@/components/MathRenderer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
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

interface Question {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: any;
  correct_answer?: string;
  has_math?: boolean;
  question_latex?: string;
  subtopic: string;
  worked_solution?: string;
}

interface UserAnswer {
  answer: string;
  workingOut?: string;
  submitted: boolean;
  isCorrect?: boolean;
  score?: number;
  methodMarks?: number;
  accuracyMarks?: number;
  feedback?: string;
}

const TakePracticeQuiz = () => {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
  const [loading, setLoading] = useState(true);
  const [quizTitle, setQuizTitle] = useState("");
  const [subjectColor, setSubjectColor] = useState("#3B82F6");
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [workedSolutionVisible, setWorkedSolutionVisible] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadQuiz();
    loadPreviousAnswers();
  }, [setId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in");
        navigate("/auth");
        return;
      }

      const { data: quizSet } = await supabase.from("practice_question_sets").select("*").eq("id", setId).single();
      if (!quizSet) {
        toast.error("Quiz not found");
        navigate("/quizzes");
        return;
      }

      setQuizTitle(quizSet.set_name);
      setSubjectColor(quizSet.subject_id || "#3B82F6");

      const { data: questionsData } = await supabase.from("practice_questions").select("*").eq("set_id", setId).order("question_number");
      if (!questionsData?.length) {
        toast.error("No questions found");
        navigate("/quizzes");
        return;
      }

      setQuestions(questionsData);
      const initialAnswers: Record<string, UserAnswer> = {};
      questionsData.forEach((q) => {
        initialAnswers[q.id] = { answer: "", workingOut: "", submitted: false };
      });
      setUserAnswers(initialAnswers);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const loadPreviousAnswers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: savedAnswers } = await supabase.from('practice_question_answers').select('*').eq('user_id', user.id).eq('set_id', setId);
      if (savedAnswers?.length) {
        setUserAnswers(prev => {
          const updated = { ...prev };
          savedAnswers.forEach(ans => {
            updated[ans.question_id] = {
              answer: ans.answer_text || "",
              workingOut: ans.working_out || "",
              submitted: true,
              score: Number(ans.score),
              methodMarks: ans.method_marks ? Number(ans.method_marks) : undefined,
              accuracyMarks: ans.accuracy_marks ? Number(ans.accuracy_marks) : undefined,
              feedback: ans.feedback || "",
              isCorrect: ans.is_correct || false
            };
          });
          return updated;
        });
      }
    } catch (error) {
      console.error("Error loading answers:", error);
    }
  };

  const handleSubmitAnswer = async () => {
    const currentQuestion = questions[currentIndex];
    const currentAnswer = userAnswers[currentQuestion.id];

    if (!currentAnswer.answer.trim()) {
      toast.error("Please provide an answer");
      return;
    }

    setIsGrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('grade-practice-question', {
        body: {
          questionId: currentQuestion.id,
          setId: setId,
          answerText: currentAnswer.answer,
          workingOut: currentAnswer.workingOut || ''
        }
      });

      if (error) throw error;

      setUserAnswers({
        ...userAnswers,
        [currentQuestion.id]: {
          ...currentAnswer,
          submitted: true,
          score: data.score,
          methodMarks: data.methodMarks,
          accuracyMarks: data.accuracyMarks,
          feedback: data.feedback,
          isCorrect: data.isCorrect
        }
      });

      toast.success(data.score === currentQuestion.marks ? "Perfect! ✓" : `${data.score}/${currentQuestion.marks} marks`);
    } catch (error: any) {
      toast.error(error.message || "Grading failed");
    } finally {
      setIsGrading(false);
    }
  };

  const handleQuitAndSave = async () => {
    setIsSaving(true);
    toast.success("Progress saved!");
    navigate('/quizzes');
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!questions.length) return <div className="p-8 text-center">No questions available</div>;

  const currentQuestion = questions[currentIndex];
  const currentAnswer = userAnswers[currentQuestion.id] || { answer: "", submitted: false };
  const totalScore = Object.values(userAnswers).reduce((sum, ans) => sum + (ans.score || 0), 0);
  const totalPossible = questions.reduce((sum, q) => sum + q.marks, 0);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-card border-b p-4 flex justify-between items-center">
        <h1 className="font-semibold">{quizTitle}</h1>
        <div className="flex gap-2">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{Math.floor(timeElapsed / 60)}m {timeElapsed % 60}s</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setWorkedSolutionVisible(!workedSolutionVisible)}>
                {workedSolutionVisible ? "Hide" : "Show"} Solution
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowQuitDialog(true)}><Save className="w-4 h-4 mr-2" />Quit & Save</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowSubmitDialog(true)}>Submit All</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 p-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between">
              <Badge>Question {currentIndex + 1} of {questions.length}</Badge>
              <Badge variant="outline">{currentQuestion.marks} marks</Badge>
            </div>
            <MathRenderer content={currentQuestion.question_text} hasMath={currentQuestion.has_math} />
            
            <Textarea value={currentAnswer.answer} onChange={(e) => setUserAnswers({...userAnswers, [currentQuestion.id]: {...currentAnswer, answer: e.target.value}})} disabled={currentAnswer.submitted} className="min-h-[100px]" />
            
            {currentAnswer.submitted && (
              <Card className="border-l-4" style={{borderLeftColor: (currentAnswer.score || 0) === currentQuestion.marks ? '#22c55e' : (currentAnswer.score || 0) > 0 ? '#f59e0b' : '#ef4444'}}>
                <CardContent className="p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">{currentAnswer.score?.toFixed(1)} / {currentQuestion.marks} marks</span>
                    {currentAnswer.methodMarks !== undefined && <Badge variant="outline">M: {currentAnswer.methodMarks?.toFixed(1)} | A: {currentAnswer.accuracyMarks?.toFixed(1)}</Badge>}
                  </div>
                  <MathRenderer content={currentAnswer.feedback || ""} />
                  {workedSolutionVisible && currentQuestion.worked_solution && (
                    <div className="mt-3 pt-3 border-t"><p className="font-medium text-sm mb-1">Worked Solution:</p><MathRenderer content={currentQuestion.worked_solution} /></div>
                  )}
                </CardContent>
              </Card>
            )}

            {isGrading && <div className="flex gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Grading...</div>}
          </CardContent>
        </Card>

        <div className="flex gap-4 mt-4">
          <Button onClick={() => setCurrentIndex(i => i - 1)} disabled={currentIndex === 0} variant="outline" className="flex-1"><ChevronLeft />Previous</Button>
          <Button onClick={handleSubmitAnswer} disabled={currentAnswer.submitted || isGrading} className="flex-1">{isGrading ? "Grading..." : "Submit"}</Button>
          <Button onClick={() => setCurrentIndex(i => i + 1)} disabled={currentIndex === questions.length - 1} variant="outline" className="flex-1">Next<ChevronRight /></Button>
        </div>
      </div>

      <AlertDialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Save & Quit?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleQuitAndSave}>Save & Quit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TakePracticeQuiz;
