import { useState, useEffect, useCallback, useRef } from "react";
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
  Loader2,
  Calculator
} from "lucide-react";
import { MathRenderer } from "@/components/MathRenderer";
import { MathAnswerField, latexToPlainText } from "@/components/quiz/MathAnswerField";
import { MathKeypad } from "@/components/quiz/MathKeypad";
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
  answer: string; // Plain text or converted from latex
  answerLatex?: string; // LaTeX representation (canonical for math)
  workingOut?: string;
  submitted: boolean;
  isCorrect?: boolean;
  score?: number;
  methodMarks?: number;
  accuracyMarks?: number;
  feedback?: string;
  useMathInput?: boolean; // Track if user is using math input
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
  const [mathInputEnabled, setMathInputEnabled] = useState<Record<string, boolean>>({});
  const [showMathKeypad, setShowMathKeypad] = useState(false);
  const mathFieldRef = useRef<any>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadQuiz();
  }, [setId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Debounced save function for answer changes
  const debouncedSave = useCallback(async (questionId: string, answerData: { answer: string; answerLatex?: string }) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Always save to sessionStorage as fallback immediately
    try {
      const draftKey = `practice:${setId}:draft:${questionId}`;
      sessionStorage.setItem(draftKey, JSON.stringify({
        text: answerData.answer,
        latex: answerData.answerLatex,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('[Draft] Failed to save to sessionStorage:', e);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Build draft answers from current state plus this update
      const draftAnswers: Record<string, { text: string; latex?: string }> = {};
      Object.entries(userAnswers).forEach(([qId, answer]) => {
        if (!answer.submitted && (answer.answer.trim() || answer.answerLatex?.trim())) {
          draftAnswers[qId] = { 
            text: answer.answer, 
            latex: answer.answerLatex 
          };
        }
      });
      // Add current update
      if (answerData.answer.trim() || answerData.answerLatex?.trim()) {
        draftAnswers[questionId] = { 
          text: answerData.answer, 
          latex: answerData.answerLatex 
        };
      }

      const { data: currentProgress } = await supabase
        .from('practice_set_progress')
        .select('questions_attempted, questions_correct')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .single();

      const { error } = await supabase.from('practice_set_progress').upsert({
        user_id: user.id,
        set_id: setId,
        session_data: { 
          draft_answers: draftAnswers,
          timer_elapsed: timeElapsed,
          math_input_enabled: mathInputEnabled
        },
        time_spent_seconds: timeElapsed,
        last_accessed_at: new Date().toISOString(),
        questions_attempted: currentProgress?.questions_attempted || 0,
        questions_correct: currentProgress?.questions_correct || 0
      }, {
        onConflict: 'user_id,set_id'
      });

      if (!error) {
        // Clear sessionStorage draft on successful save
        try {
          sessionStorage.removeItem(`practice:${setId}:draft:${questionId}`);
        } catch (e) {
          // Ignore
        }
      }

      console.log("Debounce-saved answer for question:", questionId);
    }, 1500); // 1.5 second debounce
  }, [userAnswers, timeElapsed, setId, mathInputEnabled]);

  // Auto-save draft answers every 30 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(async () => {
      const hasDrafts = Object.values(userAnswers).some(
        a => !a.submitted && (a.answer.trim() || a.answerLatex?.trim())
      );
      
      if (!hasDrafts && timeElapsed === 0) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const draftAnswers: Record<string, { text: string; latex?: string }> = {};
      Object.entries(userAnswers).forEach(([questionId, answer]) => {
        if (!answer.submitted && (answer.answer.trim() || answer.answerLatex?.trim())) {
          draftAnswers[questionId] = { 
            text: answer.answer, 
            latex: answer.answerLatex 
          };
        }
      });

      // Get current counts from database
      const { data: currentProgress } = await supabase
        .from('practice_set_progress')
        .select('questions_attempted, questions_correct')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .single();

      await supabase.from('practice_set_progress').upsert({
        user_id: user.id,
        set_id: setId,
        session_data: { 
          draft_answers: draftAnswers,
          timer_elapsed: timeElapsed,
          math_input_enabled: mathInputEnabled
        },
        time_spent_seconds: timeElapsed,
        last_accessed_at: new Date().toISOString(),
        // Preserve existing counts
        questions_attempted: currentProgress?.questions_attempted || 0,
        questions_correct: currentProgress?.questions_correct || 0
      }, {
        onConflict: 'user_id,set_id'
      });

      console.log("Auto-saved:", { timer: timeElapsed, drafts: Object.keys(draftAnswers).length });
      
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [userAnswers, timeElapsed, setId]);

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

      // 1. Load quiz metadata
      const { data: quizSet } = await supabase.from("practice_question_sets").select("*").eq("id", setId).single();
      if (!quizSet) {
        toast.error("Quiz not found");
        navigate("/quizzes");
        return;
      }

      setQuizTitle(quizSet.set_name);
      setSubjectColor(quizSet.subject_id || "#3B82F6");

      // 2. Load questions with numeric sorting
      const { data: questionsData } = await supabase.from("practice_questions").select("*").eq("set_id", setId).order("question_number_int");
      if (!questionsData?.length) {
        toast.error("No questions found");
        navigate("/quizzes");
        return;
      }

      const sortedQuestions = questionsData.sort((a, b) => {
        const numA = a.question_number_int || parseInt(a.question_number) || 0;
        const numB = b.question_number_int || parseInt(b.question_number) || 0;
        return numA - numB;
      });

      setQuestions(sortedQuestions);

      // 3. Initialize blank answers first
      const initialAnswers: Record<string, UserAnswer> = {};
      const initialMathEnabled: Record<string, boolean> = {};
      sortedQuestions.forEach((q) => {
        initialAnswers[q.id] = { answer: "", answerLatex: "", workingOut: "", submitted: false, useMathInput: false };
        initialMathEnabled[q.id] = false;
      });

      // 4. Load submitted answers from database (BEFORE restoring drafts)
      const { data: savedAnswers } = await supabase
        .from('practice_question_answers')
        .select('*')
        .eq('user_id', user.id)
        .eq('set_id', setId);
      
      if (savedAnswers?.length) {
        savedAnswers.forEach((ans: any) => {
          // If answer_latex exists, use it; otherwise fall back to answer_text
          const hasLatex = ans.answer_latex && ans.answer_latex.trim();
          initialAnswers[ans.question_id] = {
            answer: ans.answer_text || (hasLatex ? latexToPlainText(ans.answer_latex) : ""),
            answerLatex: ans.answer_latex || "",
            workingOut: ans.working_out || "",
            submitted: true,
            score: Number(ans.score),
            methodMarks: ans.method_marks ? Number(ans.method_marks) : undefined,
            accuracyMarks: ans.accuracy_marks ? Number(ans.accuracy_marks) : undefined,
            feedback: ans.feedback || "",
            isCorrect: ans.is_correct || false,
            useMathInput: !!hasLatex
          };
          // If the saved answer had LaTeX, enable math input for that question
          if (hasLatex) {
            initialMathEnabled[ans.question_id] = true;
          }
        });
      }

      // 5. Load session progress
      const { data: progress } = await supabase
        .from('practice_set_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .single();

      if (progress) {
        // Restore timer
        if (progress.time_spent_seconds) {
          setTimeElapsed(progress.time_spent_seconds);
        }
        
        // Restore current question index
        if (progress.current_question_index !== null && progress.current_question_index !== undefined) {
          setCurrentIndex(progress.current_question_index);
        }
        
        // Restore flagged questions
        if (progress.flagged_question_ids?.length > 0) {
          setFlaggedQuestions(new Set(progress.flagged_question_ids));
        }
        
        // 6. Restore draft answers (only for UNSUBMITTED questions)
        if (progress.session_data && typeof progress.session_data === 'object' && progress.session_data !== null) {
          const sessionData = progress.session_data as any;
          if (sessionData.draft_answers) {
            Object.entries(sessionData.draft_answers).forEach(([questionId, draft]: [string, any]) => {
              // Only restore draft if question hasn't been submitted
              if (initialAnswers[questionId] && !initialAnswers[questionId].submitted) {
                // Handle new format (object with text/latex) or old format (string)
                if (typeof draft === 'object' && draft !== null) {
                  initialAnswers[questionId].answer = draft.text || "";
                  initialAnswers[questionId].answerLatex = draft.latex || "";
                  if (draft.latex) {
                    initialMathEnabled[questionId] = true;
                  }
                } else if (typeof draft === 'string') {
                  initialAnswers[questionId].answer = draft;
                }
              }
            });
          }
          
          // Restore math input enabled states
          if (sessionData.math_input_enabled) {
            Object.entries(sessionData.math_input_enabled).forEach(([qId, enabled]) => {
              if (typeof enabled === 'boolean') {
                initialMathEnabled[qId] = enabled;
              }
            });
          }
          
          // Restore navigation state
          if (sessionData.navigation_state) {
            const navState = sessionData.navigation_state;
            setSidebarOpen(navState.sidebar_open ?? true);
            setHideNavigation(navState.hide_navigation ?? false);
          }
        }

        if (progress.current_question_index > 0 || savedAnswers?.length > 0) {
          toast.success("Progress restored!", {
            description: `${savedAnswers?.length || 0} answers loaded • Resuming from Q${progress.current_question_index + 1}`
          });
        }
      }
      
      // 7. Check sessionStorage for any unsaved drafts (fallback for network failures)
      try {
        for (const question of sortedQuestions) {
          const draftKey = `practice:${setId}:draft:${question.id}`;
          const draftStr = sessionStorage.getItem(draftKey);
          if (draftStr) {
            const draft = JSON.parse(draftStr);
            // Only use draft if question hasn't been submitted
            if (initialAnswers[question.id] && !initialAnswers[question.id].submitted) {
              // Check if sessionStorage draft is newer or DB has no answer
              const hasDbAnswer = initialAnswers[question.id].answer?.trim() || initialAnswers[question.id].answerLatex?.trim();
              if (!hasDbAnswer) {
                console.log(`[Draft] Restoring unsaved answer for ${question.id} from sessionStorage`);
                initialAnswers[question.id].answer = draft.text || '';
                initialAnswers[question.id].answerLatex = draft.latex || '';
                if (draft.latex) {
                  initialMathEnabled[question.id] = true;
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Draft] Failed to restore from sessionStorage:', e);
      }

      // 8. Set all answers and math enabled states at once
      setUserAnswers(initialAnswers);
      setMathInputEnabled(initialMathEnabled);

    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };


  const handleSubmitAnswer = async () => {
    const currentQuestion = questions[currentIndex];
    const currentAnswer = userAnswers[currentQuestion.id];
    const isMathMode = mathInputEnabled[currentQuestion.id];

    // Check if there's an answer (either plain text or latex)
    const hasAnswer = isMathMode 
      ? (currentAnswer.answerLatex?.trim() || currentAnswer.answer.trim())
      : currentAnswer.answer.trim();

    if (!hasAnswer) {
      toast.error("Please provide an answer");
      return;
    }

    setIsGrading(true);
    try {
      // Send both latex and plain text to the grader
      const { data, error } = await supabase.functions.invoke('grade-practice-question', {
        body: {
          questionId: currentQuestion.id,
          setId: setId,
          answerText: currentAnswer.answer,
          answerLatex: currentAnswer.answerLatex || "",
          workingOut: currentAnswer.workingOut || ''
        }
      });

      if (error) throw error;

      // Update local state with grading results
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

      // Update session state (timer, index) but NOT counts
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('practice_set_progress').upsert({
          user_id: user.id,
          set_id: setId,
          time_spent_seconds: timeElapsed,
          current_question_index: currentIndex,
          last_accessed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,set_id'
        });
      }

      toast.success(data.score === currentQuestion.marks ? "Perfect! ✓" : `${data.score}/${currentQuestion.marks} marks`);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Grading failed");
    } finally {
      setIsGrading(false);
    }
  };

  const handleQuitAndSave = async () => {
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Prepare draft answers (only unanswered questions)
      const draftAnswers: Record<string, string> = {};
      Object.entries(userAnswers).forEach(([questionId, answer]) => {
        if (!answer.submitted && answer.answer.trim()) {
          draftAnswers[questionId] = answer.answer;
        }
      });

      // Get current progress counts from database (don't recalculate from state)
      const { data: currentProgress } = await supabase
        .from('practice_set_progress')
        .select('questions_attempted, questions_correct')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .single();

      // Upsert progress - preserve existing counts, update session state
      const { error } = await supabase
        .from('practice_set_progress')
        .upsert({
          user_id: user.id,
          set_id: setId,
          current_question_index: currentIndex,
          flagged_question_ids: Array.from(flaggedQuestions),
          time_spent_seconds: timeElapsed,
          // Preserve existing counts from database
          questions_attempted: currentProgress?.questions_attempted || 0,
          questions_correct: currentProgress?.questions_correct || 0,
          last_accessed_at: new Date().toISOString(),
          session_data: {
            draft_answers: draftAnswers,
            timer_elapsed: timeElapsed,
            navigation_state: {
              sidebar_open: sidebarOpen,
              hide_navigation: hideNavigation
            }
          }
        }, {
          onConflict: 'user_id,set_id'
        });

      if (error) throw error;

      setShowQuitDialog(false);
      toast.success("Progress saved successfully!");
      navigate('/quizzes');
      
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Failed to save progress");
    } finally {
      setIsSaving(false);
    }
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
    // Check both plain text and latex for having an answer
    const hasAnswer = Boolean(answer?.answer?.trim() || answer?.answerLatex?.trim());
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
  const currentAnswer = userAnswers[currentQuestion.id] || { answer: "", answerLatex: "", submitted: false };
  // Count answers including those with LaTeX
  const answeredCount = Object.values(userAnswers).filter(a => a.answer.trim() || a.answerLatex?.trim()).length;
  const unansweredCount = questions.length - answeredCount;
  const totalScore = Object.values(userAnswers).reduce((sum, ans) => sum + (ans.score || 0), 0);
  const totalPossible = questions.reduce((sum, q) => sum + q.marks, 0);
  const fullyCorrectCount = Object.entries(userAnswers).filter(([id, a]) => a.submitted && a.score === questions.find(q => q.id === id)?.marks).length;
  const partialCreditCount = Object.entries(userAnswers).filter(([id, a]) => a.submitted && (a.score || 0) > 0 && a.score !== questions.find(q => q.id === id)?.marks).length;
  const incorrectCount = Object.values(userAnswers).filter(a => a.submitted && (a.score || 0) === 0).length;

  return (
    <div className="min-h-screen flex flex-col bg-background w-full">
      {/* Sticky Header - reorganized layout */}
      <header className={`sticky top-0 z-50 border-b bg-card/95 backdrop-blur transition-transform duration-300 ${hideNavigation ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className="flex items-center justify-between h-14 px-4 lg:px-6 w-full">
          {/* Left: Hamburger + Title */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden flex-shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-base lg:text-lg truncate max-w-[200px] lg:max-w-[300px]">{quizTitle}</h1>
          </div>

          {/* Center: Question X of Y */}
          <div className="flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
            <Badge variant="outline" className="text-sm lg:text-base px-3 py-1.5 whitespace-nowrap">
              Question {currentIndex + 1} of {questions.length}
            </Badge>
            {flaggedQuestions.has(currentQuestion.id) && (
              <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600 hidden sm:flex">
                <Flag className="w-3 h-3" />Flagged
              </Badge>
            )}
          </div>

          {/* Right: Timer + Menu */}
          <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-sm">
              <Clock className="w-4 h-4" />
              <span className="font-mono">{formatTime(timeElapsed)}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => {
                    const qId = currentQuestion.id;
                    setMathInputEnabled(prev => ({ ...prev, [qId]: !prev[qId] }));
                  }}
                  disabled={currentAnswer.submitted}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  {mathInputEnabled[currentQuestion.id] ? 'Switch to Text' : 'Math Keyboard'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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

        {/* Progress bar directly under header */}
        <div className="px-4 lg:px-6 pb-2">
          <Progress value={(answeredCount / questions.length) * 100} className="h-2" />
        </div>
      </header>

      {hideNavigation && (
        <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-[60] bg-card shadow-lg" onClick={toggleHideNavigation}>
          <Menu className="w-5 h-5" />
        </Button>
      )}

      <div className="flex flex-1 w-full">
        {/* Sidebar - fixed width, scrollable */}
        <aside className={`${hideNavigation ? 'w-0 overflow-hidden' : sidebarOpen ? 'w-56 lg:w-60' : 'w-0 overflow-hidden'} lg:block ${sidebarOpen && !hideNavigation ? 'fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-auto' : ''} transition-all duration-300 border-r bg-card/50 flex-shrink-0`}>
          {sidebarOpen && !hideNavigation && (
            <div className="fixed inset-0 bg-black/50 lg:hidden z-30" onClick={() => setSidebarOpen(false)} />
          )}
          <div className="relative z-40 bg-card h-full sticky top-[4.5rem] max-h-[calc(100vh-4.5rem)] overflow-y-auto">
            <div className="p-4 lg:p-5 flex flex-col gap-5 h-full">
              <div>
                <h2 className="text-xs font-semibold mb-3 text-muted-foreground tracking-wide">QUESTIONS</h2>
                <div className="grid grid-cols-4 gap-1.5">
                  {questions.map((q) => {
                    const { className, style } = getQuestionButtonStyle(q);
                    return (
                      <button key={q.id} onClick={() => { setCurrentIndex(questions.indexOf(q)); window.scrollTo({ top: 0, behavior: 'smooth' }); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={className} style={style}>
                        {q.question_number}
                        {flaggedQuestions.has(q.id) && (
                          <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5">
                            <Flag className="w-2 h-2 text-white" fill="white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div><span className="font-medium text-foreground">Answered:</span> {answeredCount}/{questions.length}</div>
                <div><span className="font-medium text-foreground">Flagged:</span> {flaggedQuestions.size}</div>
              </div>
              <Button variant="destructive" size="sm" className="mt-auto" onClick={() => setShowSubmitDialog(true)}>Submit All</Button>
            </div>
          </div>
        </aside>

        {/* Main content - takes remaining space, with bottom nav */}
        <main className="flex-1 flex flex-col min-h-[calc(100vh-4.5rem)] min-w-0">
          {/* Scrollable question area */}
          <div className="flex-1 p-4 lg:p-6 xl:p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full">
              {/* Question Card */}
              <Card className="border-l-4" style={{ borderLeftColor: subjectColor }}>
                <CardContent className="p-5 lg:p-8 space-y-5 lg:space-y-6">
                  {/* Question header - removed redundant number display */}
                  <div className="flex justify-end items-center">
                    <Badge style={{ backgroundColor: subjectColor, color: 'white' }} className="text-sm px-3 py-1">
                      {currentQuestion.marks} marks
                    </Badge>
                  </div>

                  {/* Question text */}
                  <div className="text-base lg:text-lg leading-relaxed">
                    <MathRenderer content={currentQuestion.question_text} hasMath={currentQuestion.has_math} />
                  </div>

                  {/* Answer input - Math or Text mode */}
                  {mathInputEnabled[currentQuestion.id] ? (
                    <div className="space-y-2">
                      <MathAnswerField
                        ref={mathFieldRef}
                        valueLatex={currentAnswer.answerLatex || ""}
                        mode="math"
                        onChange={({ valueLatex, valuePlain }) => {
                          const newAnswer = {
                            ...currentAnswer,
                            answerLatex: valueLatex,
                            answer: valuePlain,
                            useMathInput: true
                          };
                          setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                          debouncedSave(currentQuestion.id, { answer: valuePlain, answerLatex: valueLatex });
                        }}
                        onFocus={() => setShowMathKeypad(true)}
                        onBlur={() => {
                          // Save on blur
                          debouncedSave(currentQuestion.id, { 
                            answer: currentAnswer.answer, 
                            answerLatex: currentAnswer.answerLatex 
                          });
                        }}
                        disabled={currentAnswer.submitted}
                        questionId={currentQuestion.id}
                        subjectColor={subjectColor}
                        placeholder="Enter your mathematical answer..."
                      />
                      {/* Docked Math Keypad */}
                      {showMathKeypad && !currentAnswer.submitted && (
                        <MathKeypad
                          isOpen={true}
                          onClose={() => setShowMathKeypad(false)}
                          onInsertLatex={(latex) => {
                            mathFieldRef.current?.insertLatex(latex);
                          }}
                          onExecuteCommand={(cmd) => {
                            mathFieldRef.current?.executeCommand(cmd);
                          }}
                          subjectColor={subjectColor}
                        />
                      )}
                    </div>
                  ) : (
                    <Textarea 
                      value={currentAnswer.answer} 
                      onChange={(e) => {
                        const newAnswer = { ...currentAnswer, answer: e.target.value };
                        setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                        debouncedSave(currentQuestion.id, { answer: e.target.value });
                      }}
                      onBlur={() => {
                        debouncedSave(currentQuestion.id, { answer: currentAnswer.answer });
                      }}
                      disabled={currentAnswer.submitted} 
                      className="min-h-[140px] lg:min-h-[160px] text-base" 
                      placeholder="Type your answer here..." 
                    />
                  )}

                  {/* Submitted answer display with LaTeX rendering */}
                  {currentAnswer.submitted && currentAnswer.answerLatex && (
                    <div className="p-3 bg-muted/50 rounded-lg border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Your Answer:</p>
                      <div className="text-base">
                        <MathRenderer content={`$${currentAnswer.answerLatex}$`} hasMath={true} />
                      </div>
                    </div>
                  )}

                  {/* Feedback section after submission */}
                  {currentAnswer.submitted && (
                    <Card className="border-l-4 mt-4" style={{ borderLeftColor: (currentAnswer.score || 0) === currentQuestion.marks ? '#22c55e' : (currentAnswer.score || 0) > 0 ? '#f59e0b' : '#ef4444' }}>
                      <CardContent className="p-5 lg:p-6 space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-lg">{currentAnswer.score?.toFixed(1)} / {currentQuestion.marks} marks</span>
                          {/* Hidden M/A marks - kept in DOM for debugging but not visible */}
                          {currentAnswer.methodMarks !== undefined && (
                            <span className="sr-only" data-method-marks={currentAnswer.methodMarks?.toFixed(1)} data-accuracy-marks={currentAnswer.accuracyMarks?.toFixed(1)}>
                              M: {currentAnswer.methodMarks?.toFixed(1)} | A: {currentAnswer.accuracyMarks?.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div className="border-t pt-4">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Feedback</p>
                          <div className="text-sm lg:text-base leading-relaxed">
                            <MathRenderer content={currentAnswer.feedback || ""} />
                          </div>
                        </div>
                        {workedSolutionVisible && currentQuestion.worked_solution && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <p className="font-medium text-sm">Worked Solution</p>
                            </div>
                            <div className="text-sm lg:text-base leading-relaxed">
                              <MathRenderer content={currentQuestion.worked_solution} />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {isGrading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Grading your answer...
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sticky bottom navigation */}
          <div className="sticky bottom-0 border-t bg-card/95 backdrop-blur p-3 lg:p-4">
            <div className="max-w-5xl mx-auto flex gap-3">
              <Button 
                onClick={() => { setCurrentIndex(prev => prev - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                disabled={currentIndex === 0} 
                variant="outline" 
                size="lg" 
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1 lg:mr-2" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </Button>
              <Button 
                onClick={handleSubmitAnswer} 
                disabled={currentAnswer.submitted || isGrading || !currentAnswer.answer.trim()} 
                size="lg" 
                className="flex-1 min-w-0" 
                style={{ backgroundColor: currentAnswer.submitted ? undefined : subjectColor }}
              >
                {isGrading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span className="hidden sm:inline">Grading...</span>
                  </>
                ) : (
                  <span className="truncate">Submit Answer</span>
                )}
              </Button>
              <Button 
                onClick={() => { setCurrentIndex(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                disabled={currentIndex === questions.length - 1} 
                variant="outline" 
                size="lg" 
                className="flex-1"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 ml-1 lg:ml-2" />
              </Button>
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
            <AlertDialogAction onClick={async () => {
              setShowSubmitDialog(false);
              try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Get final counts from database (the source of truth)
                const { data: allAnswers } = await supabase
                  .from('practice_question_answers')
                  .select('score, is_correct')
                  .eq('user_id', user.id)
                  .eq('set_id', setId);

                const questionsAttempted = allAnswers?.length || 0;
                const questionsCorrect = allAnswers?.filter(a => a.is_correct).length || 0;

                // Mark as completed
                await supabase.from('practice_set_progress').upsert({
                  user_id: user.id,
                  set_id: setId,
                  questions_attempted: questionsAttempted,
                  questions_correct: questionsCorrect,
                  completed_at: new Date().toISOString(),
                  time_spent_seconds: timeElapsed,
                  current_question_index: 0,
                  flagged_question_ids: [],
                  session_data: {}
                }, {
                  onConflict: 'user_id,set_id'
                });

                // Update daily goals with study time
                const today = new Date().toISOString().split('T')[0];
                const studyMinutes = Math.round(timeElapsed / 60);
                
                const { data: existingGoal } = await supabase
                  .from('daily_goals')
                  .select('*')
                  .eq('user_id', user.id)
                  .eq('date', today)
                  .maybeSingle();

                if (existingGoal) {
                  await supabase
                    .from('daily_goals')
                    .update({
                      completed_minutes: (existingGoal.completed_minutes || 0) + studyMinutes,
                      blocks_completed: (existingGoal.blocks_completed || 0) + 1,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', existingGoal.id);
                } else {
                  await supabase
                    .from('daily_goals')
                    .insert({
                      user_id: user.id,
                      date: today,
                      completed_minutes: studyMinutes,
                      blocks_completed: 1,
                      target_minutes: 60
                    });
                }

                // Update study streak
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session?.access_token) {
                    await supabase.functions.invoke('update-study-streak', {
                      headers: {
                        Authorization: `Bearer ${session.access_token}`
                      }
                    });
                  }
                } catch (streakError) {
                  console.error("Streak update error:", streakError);
                  // Don't fail the whole submission if streak update fails
                }
              } catch (error) {
                console.error("Submission error:", error);
                toast.error("Failed to submit quiz");
              }
              setShowResults(true);
            }}>Submit Quiz</AlertDialogAction>
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
              <Button onClick={() => navigate('/quizzes')}>Back to Practice Quizzes</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default TakePracticeQuiz;
