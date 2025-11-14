import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Menu,
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
  const [hideNavigation, setHideNavigation] = useState(false);
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

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      switch(e.key) {
        case 'ArrowLeft':
          if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          break;
        case 'ArrowRight':
          if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFlag();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          toggleHideNavigation();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          setWorkedSolutionVisible(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, questions.length]);

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

  const toggleFlag = () => {
    const currentQuestionId = questions[currentIndex].id;
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestionId)) {
        newSet.delete(currentQuestionId);
        toast.success("Question unflagged");
      } else {
        newSet.add(currentQuestionId);
        toast.success("Question flagged for review");
      }
      return newSet;
    });
  };

  const toggleHideNavigation = () => {
    setHideNavigation(!hideNavigation);
    setSidebarOpen(hideNavigation);
  };

  const getQuestionButtonStyle = (question: Question) => {
    const answer = userAnswers[question.id];
    const hasAnswer = Boolean(answer?.answer?.trim());
    const isFlagged = flaggedQuestions.has(question.id);
    const isCurrent = questions[currentIndex].id === question.id;

    let className = 'relative aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all hover:scale-105 ';
    let style: React.CSSProperties = {};

    if (answer?.submitted) {
      if (answer.score === question.marks) {
        className += 'bg-green-500 text-white';
      } else if ((answer.score || 0) > 0) {
        className += 'bg-orange-500 text-white';
      } else {
        className += 'bg-red-500 text-white';
      }
    } else if (hasAnswer) {
      className += 'text-white';
      style.backgroundColor = subjectColor;
    } else {
      className += 'bg-muted text-muted-foreground hover:bg-muted/80';
    }

    if (isFlagged) className += ' ring-2 ring-yellow-500 ring-offset-2';
    if (isCurrent) className += ' ring-2 ring-primary ring-offset-2';

    return { className, style };
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!questions.length) return <div className="p-8 text-center">No questions available</div>;

  const currentQuestion = questions[currentIndex];
  const currentAnswer = userAnswers[currentQuestion.id] || { answer: "", submitted: false };
  const answeredCount = Object.values(userAnswers).filter(a => a.answer.trim()).length;
  const unansweredCount = questions.length - answeredCount;
  const totalScore = Object.values(userAnswers).reduce((sum, ans) => sum + (ans.score || 0), 0);
  const totalPossible = questions.reduce((sum, q) => sum + q.marks, 0);
  const fullyCorrectCount = Object.entries(userAnswers).filter(([id, a]) => a.submitted && a.score === questions.find(q => q.id === id)?.marks).length;
  const partialCreditCount = Object.entries(userAnswers).filter(([id, a]) => a.submitted && (a.score || 0) > 0 && a.score !== questions.find(q => q.id === id)?.marks).length;
  const incorrectCount = Object.values(userAnswers).filter(a => a.submitted && (a.score || 0) === 0).length;

  return (
    <div className="min-h-screen flex flex-col bg-background w-full">
      <div className={`sticky top-0 z-50 border-b bg-card/95 backdrop-blur transition-transform duration-300 ${hideNavigation ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className="container grid grid-cols-3 items-center h-16 px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg truncate">{quizTitle}</h1>
          </div>
          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
              <Clock className="w-5 h-5" />
              <span className="font-mono text-lg">{formatTime(timeElapsed)}</span>
            </div>
          </div>
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={toggleHideNavigation}>
                  {hideNavigation ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                  {hideNavigation ? 'Show' : 'Hide'} Navigation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleFlag}>
                  <Flag className="w-4 h-4 mr-2" />
                  {flaggedQuestions.has(currentQuestion.id) ? 'Unflag' : 'Flag'} Question
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWorkedSolutionVisible(!workedSolutionVisible)}>
                  {workedSolutionVisible ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {workedSolutionVisible ? 'Hide' : 'Show'} Solution
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowQuitDialog(true)}>
                  <Save className="w-4 h-4 mr-2" />Quit & Save
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSubmitDialog(true)}>Submit All</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {hideNavigation && (
        <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-[60] bg-card shadow-lg" onClick={toggleHideNavigation}>
          <Menu className="w-5 h-5" />
        </Button>
      )}

      <div className="flex flex-1 w-full">
        <div className={`${hideNavigation ? 'w-0' : sidebarOpen ? 'w-64' : 'w-0'} lg:block ${sidebarOpen && !hideNavigation ? 'fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-auto' : ''} transition-all duration-300 border-r bg-card/30 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto`}>
          {sidebarOpen && !hideNavigation && (
            <div className="fixed inset-0 bg-black/50 lg:hidden z-30" onClick={() => setSidebarOpen(false)} />
          )}
          <div className="relative z-40 bg-card h-full">
            <div className="p-6 flex flex-col gap-6 h-full">
              <div>
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground">QUESTIONS</h2>
                <div className="grid grid-cols-4 gap-2">
                  {questions.map((q) => {
                    const { className, style } = getQuestionButtonStyle(q);
                    return (
                      <button key={q.id} onClick={() => { setCurrentIndex(questions.indexOf(q)); window.scrollTo({ top: 0, behavior: 'smooth' }); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={className} style={style}>
                        {q.question_number}
                        {flaggedQuestions.has(q.id) && (
                          <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1">
                            <Flag className="w-2 h-2 text-white" fill="white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Answered:</span> {answeredCount}/{questions.length}</div>
                <div><span className="font-medium">Flagged:</span> {flaggedQuestions.size}</div>
              </div>
              <Button variant="destructive" className="mt-auto" onClick={() => setShowSubmitDialog(true)}>Submit All</Button>
            </div>
          </div>
        </div>

        <main className="flex-1 p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-lg px-4 py-2">Question {currentIndex + 1} of {questions.length}</Badge>
                  {flaggedQuestions.has(currentQuestion.id) && <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600"><Flag className="w-3 h-3" />Flagged</Badge>}
                </div>
                <div className="flex gap-1">
                  {questions.map((q, idx) => {
                    const answer = userAnswers[q.id];
                    return (
                      <button key={q.id} onClick={() => { setCurrentIndex(idx); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-primary w-6' : answer?.submitted ? (answer.score === q.marks ? 'bg-green-500' : (answer.score || 0) > 0 ? 'bg-orange-500' : 'bg-red-500') : answer?.answer ? 'bg-blue-500' : 'bg-muted'}`} title={`Question ${idx + 1}`} />
                    );
                  })}
                </div>
              </div>
              <Progress value={(answeredCount / questions.length) * 100} className="h-2" />
            </div>

            <Card className="border-l-4" style={{ borderLeftColor: subjectColor }}>
              <CardContent className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">{currentQuestion.question_number}</h2>
                  <Badge style={{ backgroundColor: subjectColor, color: 'white' }}>{currentQuestion.marks} marks</Badge>
                </div>
                <div className="text-base leading-relaxed">
                  <MathRenderer content={currentQuestion.question_text} hasMath={currentQuestion.has_math} />
                </div>
                <Textarea value={currentAnswer.answer} onChange={(e) => setUserAnswers({ ...userAnswers, [currentQuestion.id]: { ...currentAnswer, answer: e.target.value }})} disabled={currentAnswer.submitted} className="min-h-[120px]" placeholder="Type your answer here..." />
                {currentAnswer.submitted && (
                  <Card className="border-l-4" style={{ borderLeftColor: (currentAnswer.score || 0) === currentQuestion.marks ? '#22c55e' : (currentAnswer.score || 0) > 0 ? '#f59e0b' : '#ef4444' }}>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-lg">{currentAnswer.score?.toFixed(1)} / {currentQuestion.marks} marks</span>
                        {currentAnswer.methodMarks !== undefined && <Badge variant="outline">M: {currentAnswer.methodMarks?.toFixed(1)} | A: {currentAnswer.accuracyMarks?.toFixed(1)}</Badge>}
                      </div>
                      <div className="text-sm"><MathRenderer content={currentAnswer.feedback || ""} /></div>
                      {workedSolutionVisible && currentQuestion.worked_solution && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <p className="font-medium text-sm">Worked Solution:</p>
                          </div>
                          <MathRenderer content={currentQuestion.worked_solution} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                {isGrading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Grading your answer...</div>}
              </CardContent>
            </Card>

            <div className="flex gap-4 p-4 border-t bg-card/50 rounded-lg">
              <Button onClick={() => { setCurrentIndex(prev => prev - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentIndex === 0} variant="outline" size="lg" className="flex-1"><ChevronLeft className="w-4 h-4 mr-2" />Previous</Button>
              <Button onClick={handleSubmitAnswer} disabled={currentAnswer.submitted || isGrading || !currentAnswer.answer.trim()} size="lg" className="flex-1" style={{ backgroundColor: currentAnswer.submitted ? undefined : subjectColor }}>{isGrading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Grading...</> : 'Submit Answer'}</Button>
              <Button onClick={() => { setCurrentIndex(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={currentIndex === questions.length - 1} variant="outline" size="lg" className="flex-1">Next<ChevronRight className="w-4 h-4 ml-2" /></Button>
            </div>
          </div>
        </main>
      </div>

      <AlertDialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Save & Quit?</AlertDialogTitle><AlertDialogDescription>Your progress will be saved and you can continue later.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleQuitAndSave} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Save & Quit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Submit Practice Quiz?</AlertDialogTitle><AlertDialogDescription className="space-y-2"><p>You've answered {answeredCount} out of {questions.length} questions.</p>{unansweredCount > 0 && <p className="text-amber-600 font-medium">⚠️ {unansweredCount} question(s) are unanswered.</p>}{flaggedQuestions.size > 0 && <p className="text-blue-600">🚩 {flaggedQuestions.size} question(s) flagged for review.</p>}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Answers</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowSubmitDialog(false); setShowResults(true); }}>Submit Quiz</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showResults && (
        <AlertDialog open={showResults} onOpenChange={setShowResults}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader><AlertDialogTitle className="text-2xl">Quiz Complete! 🎉</AlertDialogTitle></AlertDialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-6 text-center bg-green-50 dark:bg-green-950">
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400">{totalScore.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground mt-2">Total Score</div>
                </Card>
                <Card className="p-6 text-center bg-blue-50 dark:bg-blue-950">
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">{totalPossible > 0 ? ((totalScore / totalPossible) * 100).toFixed(1) : 0}%</div>
                  <div className="text-sm text-muted-foreground mt-2">Percentage</div>
                </Card>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />Fully Correct</span>
                  <Badge className="bg-green-600">{fullyCorrectCount}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <span className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />Partial Credit</span>
                  <Badge className="bg-orange-600">{partialCreditCount}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                  <span className="flex items-center gap-2"><XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />Incorrect</span>
                  <Badge className="bg-red-600">{incorrectCount}</Badge>
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">Completed in {formatTime(timeElapsed)}</div>
            </div>
            <AlertDialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowResults(false); setCurrentIndex(0); }}>Review Answers</Button>
              <Button onClick={() => navigate('/quizzes')}>Back to My Quizzes</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default TakePracticeQuiz;
