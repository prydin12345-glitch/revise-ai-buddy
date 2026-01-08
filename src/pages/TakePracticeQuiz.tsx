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
import { MathInsertKeypad, normalizeUnicodeForGrading } from "@/components/quiz/MathInsertKeypad";
import { useTextareaInsert } from "@/hooks/useTextareaInsert";
import { QuestionOptionsMenu } from "@/components/quiz/QuestionOptionsMenu";
import { 
  TableGridQuestion, 
  parseMarkdownToTableGrid, 
  isTickXTable,
  serializeTableGridAnswer,
  deserializeTableGridAnswers,
  parseStoredTableGridAnswer,
  type TableGridData 
} from "@/components/exam/TableGridQuestion";

// Helper to convert toggle answers from number[] to Record<number, boolean> format
function convertTogglesForSerialization(
  toggles: Record<string, number[]>
): Record<string, Record<number, boolean>> {
  const result: Record<string, Record<number, boolean>> = {};
  for (const [rowId, colIndices] of Object.entries(toggles)) {
    result[rowId] = {};
    for (const idx of colIndices) {
      result[rowId][idx] = true;
    }
  }
  return result;
}
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
  tableGridAnswers?: Record<string, number[]>; // For table_grid questions (toggle)
  tableGridInputs?: Record<string, Record<number, string | number>>; // For table_grid input cells
  markingData?: { // Stored marking results for UI hydration
    perRowResults?: Record<string, { correct: boolean; earned: number; max: number; details: string; status: 'correct' | 'incorrect' | 'missed' | 'partial' }>;
    correctAnswers?: Record<string, number[]>;
    correctInputs?: Record<string, Record<number, string | number>>;
  };
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
  const [showMathKeypad, setShowMathKeypad] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRetrySetDialog, setShowRetrySetDialog] = useState(false);
  const answerTextareaRef = useRef<HTMLTextAreaElement>(null);
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
          timer_elapsed: timeElapsed
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
  }, [userAnswers, timeElapsed, setId]);

  // Auto-save draft answers every 30 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(async () => {
      const hasDrafts = Object.values(userAnswers).some(
        a => !a.submitted && a.answer.trim()
      );
      
      if (!hasDrafts && timeElapsed === 0) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const draftAnswers: Record<string, { text: string }> = {};
      Object.entries(userAnswers).forEach(([questionId, answer]) => {
        if (!answer.submitted && answer.answer.trim()) {
          draftAnswers[questionId] = { text: answer.answer };
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
          timer_elapsed: timeElapsed
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
      sortedQuestions.forEach((q) => {
        initialAnswers[q.id] = { answer: "", workingOut: "", submitted: false };
      });

      // 4. Load submitted answers from database (BEFORE restoring drafts)
      const { data: savedAnswers } = await supabase
        .from('practice_question_answers')
        .select('*')
        .eq('user_id', user.id)
        .eq('set_id', setId);
      
      if (savedAnswers?.length) {
        savedAnswers.forEach((ans: any) => {
          // Parse table grid answers from answer_text if it's a table_grid response
          let tableGridAnswers: Record<string, number[]> | undefined;
          let tableGridInputs: Record<string, Record<number, string | number>> | undefined;
          let markingData: UserAnswer['markingData'] | undefined;
          
          if (ans.answer_text) {
            const parsed = parseStoredTableGridAnswer(ans.answer_text);
            if (parsed) {
              // Convert cells (Record<string, Record<number, boolean>>) to number[] format
              tableGridAnswers = {};
              for (const [rowId, colMap] of Object.entries(parsed.cells)) {
                tableGridAnswers[rowId] = Object.entries(colMap)
                  .filter(([_, selected]) => selected)
                  .map(([colIdx]) => parseInt(colIdx, 10));
              }
              tableGridInputs = parsed.inputs;
            }
          }
          
          // Try to extract marking data from feedback (stored as JSON metadata)
          if (ans.feedback) {
            try {
              // Check if feedback contains embedded marking data
              const feedbackMatch = ans.feedback.match(/<!--MARKING_DATA:(.*?)-->/);
              if (feedbackMatch) {
                markingData = JSON.parse(feedbackMatch[1]);
              }
            } catch {
              // Feedback doesn't contain structured marking data
            }
          }
          
          initialAnswers[ans.question_id] = {
            answer: ans.answer_text || "",
            workingOut: ans.working_out || "",
            submitted: true,
            score: Number(ans.score),
            methodMarks: ans.method_marks ? Number(ans.method_marks) : undefined,
            accuracyMarks: ans.accuracy_marks ? Number(ans.accuracy_marks) : undefined,
            feedback: ans.feedback ? ans.feedback.replace(/<!--MARKING_DATA:.*?-->/g, '') : "",
            isCorrect: ans.is_correct || false,
            tableGridAnswers,
            tableGridInputs,
            markingData,
          };
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
                // Handle new format (object with text) or old format (string)
                if (typeof draft === 'object' && draft !== null) {
                  initialAnswers[questionId].answer = draft.text || "";
                } else if (typeof draft === 'string') {
                  initialAnswers[questionId].answer = draft;
                }
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
              // Check if sessionStorage draft has content and DB has no answer
              const hasDbAnswer = initialAnswers[question.id].answer?.trim();
              if (!hasDbAnswer) {
                console.log(`[Draft] Restoring unsaved answer for ${question.id} from sessionStorage`);
                initialAnswers[question.id].answer = draft.text || '';
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Draft] Failed to restore from sessionStorage:', e);
      }

      // 8. Set all answers at once
      setUserAnswers(initialAnswers);

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

    // Check if there's an answer - for table_grid, check tableGridAnswers OR answer text
    const hasTableGridAnswer = currentAnswer.tableGridAnswers && 
      Object.values(currentAnswer.tableGridAnswers).some(arr => arr.length > 0);
    const hasTableGridInputs = currentAnswer.tableGridInputs && 
      Object.values(currentAnswer.tableGridInputs).some(obj => Object.values(obj).some(v => v !== '' && v !== 0));
    
    if (!currentAnswer.answer.trim() && !hasTableGridAnswer && !hasTableGridInputs) {
      toast.error("Please provide an answer");
      return;
    }

    setIsGrading(true);
    try {
      // Normalize the answer for AI grading (convert Unicode math to plain text)
      const normalizedAnswer = normalizeUnicodeForGrading(currentAnswer.answer);
      
      // Send both original and normalized answer to the grader
      const { data, error } = await supabase.functions.invoke('grade-practice-question', {
        body: {
          questionId: currentQuestion.id,
          setId: setId,
          answerText: currentAnswer.answer,
          normalizedAnswer: normalizedAnswer,
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
          isCorrect: data.isCorrect,
          // Store marking data for table grid questions to persist UI state
          markingData: data.markingData
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

  // Retry current question - clears answer and marking state, keeps question content
  const handleRetryQuestion = async () => {
    const currentQuestion = questions[currentIndex];
    setIsRetrying(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete the saved answer from database
      await supabase
        .from('practice_question_answers')
        .delete()
        .eq('user_id', user.id)
        .eq('question_id', currentQuestion.id);

      // Clear local state for this question
      setUserAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: {
          answer: "",
          workingOut: "",
          submitted: false,
          tableGridAnswers: undefined,
          tableGridInputs: undefined,
          markingData: undefined,
          score: undefined,
          feedback: undefined,
          isCorrect: undefined
        }
      }));

      // Clear sessionStorage draft
      try {
        sessionStorage.removeItem(`practice:${setId}:draft:${currentQuestion.id}`);
      } catch (e) {
        // Ignore
      }

      // Hide worked solution
      setWorkedSolutionVisible(false);

      toast.success("Question reset - try again!");
    } catch (error: any) {
      console.error("Retry error:", error);
      toast.error("Failed to reset question");
    } finally {
      setIsRetrying(false);
    }
  };

  // Regenerate current question - creates new question with same constraints
  const handleRegenerateQuestion = async () => {
    const currentQuestion = questions[currentIndex];
    setIsRegenerating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the practice set details for regeneration constraints
      const { data: quizSet } = await supabase
        .from("practice_question_sets")
        .select("*")
        .eq("id", setId)
        .single();

      if (!quizSet) throw new Error("Practice set not found");

      // Call the generation function to create a new question
      const { data, error } = await supabase.functions.invoke('generate-practice-questions', {
        body: {
          setId: setId,
          subjectId: quizSet.subject_id,
          subtopics: [currentQuestion.subtopic],
          difficultyLevel: quizSet.difficulty_level || 'medium',
          questionCount: 1,
          regenerateQuestionId: currentQuestion.id, // Flag to replace this specific question
          examBoard: quizSet.exam_board,
          educationalTier: quizSet.educational_tier
        }
      });

      if (error) throw error;

      // Delete old answer if exists
      await supabase
        .from('practice_question_answers')
        .delete()
        .eq('user_id', user.id)
        .eq('question_id', currentQuestion.id);

      // Fetch the updated question
      const { data: updatedQuestion } = await supabase
        .from('practice_questions')
        .select('*')
        .eq('id', currentQuestion.id)
        .single();

      if (updatedQuestion) {
        // Update questions list with new question
        setQuestions(prev => prev.map(q => 
          q.id === currentQuestion.id ? updatedQuestion : q
        ));

        // Clear answer state for this question
        setUserAnswers(prev => ({
          ...prev,
          [currentQuestion.id]: {
            answer: "",
            workingOut: "",
            submitted: false,
            tableGridAnswers: undefined,
            tableGridInputs: undefined,
            markingData: undefined
          }
        }));
      }

      setWorkedSolutionVisible(false);
      toast.success("New question generated!");
    } catch (error: any) {
      console.error("Regenerate error:", error);
      toast.error(error.message || "Failed to regenerate question");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Retry entire practice set - clears all answers and marking
  const handleRetryEntireSet = async () => {
    setIsRetrying(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete all saved answers for this set
      await supabase
        .from('practice_question_answers')
        .delete()
        .eq('user_id', user.id)
        .eq('set_id', setId);

      // Reset progress
      await supabase
        .from('practice_set_progress')
        .upsert({
          user_id: user.id,
          set_id: setId,
          questions_attempted: 0,
          questions_correct: 0,
          current_question_index: 0,
          time_spent_seconds: 0,
          flagged_question_ids: [],
          session_data: {},
          last_accessed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,set_id'
        });

      // Clear all local answer state
      const resetAnswers: Record<string, UserAnswer> = {};
      questions.forEach(q => {
        resetAnswers[q.id] = {
          answer: "",
          workingOut: "",
          submitted: false,
          tableGridAnswers: undefined,
          tableGridInputs: undefined,
          markingData: undefined
        };
      });
      setUserAnswers(resetAnswers);

      // Reset other state
      setCurrentIndex(0);
      setTimeElapsed(0);
      setFlaggedQuestions(new Set());
      setWorkedSolutionVisible(false);
      setShowRetrySetDialog(false);

      // Clear sessionStorage drafts
      try {
        questions.forEach(q => {
          sessionStorage.removeItem(`practice:${setId}:draft:${q.id}`);
        });
      } catch (e) {
        // Ignore
      }

      toast.success("Practice set reset - start fresh!");
    } catch (error: any) {
      console.error("Retry set error:", error);
      toast.error("Failed to reset practice set");
    } finally {
      setIsRetrying(false);
    }
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
            <QuestionOptionsMenu
              mode="practice"
              showMathKeypad={showMathKeypad}
              onToggleMathKeypad={() => setShowMathKeypad(prev => !prev)}
              hideNavigation={hideNavigation}
              onToggleNavigation={toggleHideNavigation}
              isFlagged={flaggedQuestions.has(currentQuestion.id)}
              onToggleFlag={toggleFlag}
              onShowSolution={() => setWorkedSolutionVisible(!workedSolutionVisible)}
              solutionVisible={workedSolutionVisible}
              onQuitAndSave={() => setShowQuitDialog(true)}
              onSubmitAll={() => setShowSubmitDialog(true)}
              disabled={currentAnswer.submitted}
              onRetryQuestion={handleRetryQuestion}
              onRegenerateQuestion={handleRegenerateQuestion}
              onRetryEntireSet={() => setShowRetrySetDialog(true)}
              isRetrying={isRetrying}
              isRegenerating={isRegenerating}
            />
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

                  {/* Answer input section - conditionally render based on question type */}
                  {(() => {
                    // Check if this is a table_grid question (explicit type or detected from content)
                    const isTableGrid = currentQuestion.question_type === 'table_grid' || isTickXTable(currentQuestion.question_text);
                    
                    if (isTableGrid) {
                      // Try to get table data from correct_answer (new format) or parse from question text
                      let tableData: TableGridData | null = null;
                      let correctAnswersData: Record<string, number[]> | undefined = undefined;
                      let correctInputsData: Record<string, Record<number, string | number>> | undefined = undefined;
                      
                      // First try parsing from correct_answer (which contains table_data)
                      if (currentQuestion.correct_answer) {
                        try {
                          const parsed = JSON.parse(currentQuestion.correct_answer);
                          if (parsed.table_data) {
                            tableData = parsed.table_data;
                            // Also extract correctAnswers for review mode (toggle tables)
                            if (parsed.correctAnswers) {
                              correctAnswersData = parsed.correctAnswers;
                            }
                            // Extract correctInputs for text/numeric entry tables
                            if (parsed.correctInputs) {
                              correctInputsData = parsed.correctInputs;
                            }
                          }
                        } catch {
                          // Not JSON, try parsing from question text
                        }
                      }
                      
                      // Fallback: parse markdown table from question text
                      if (!tableData) {
                        tableData = parseMarkdownToTableGrid(currentQuestion.question_text);
                      }
                      
                      if (tableData) {
                        // Determine the instruction text based on table type
                        const isInputTable = tableData.tableType === 'text_entry' || 
                          tableData.tableType === 'number_entry' || 
                          tableData.tableType === 'mixed' ||
                          tableData.selectionMode === 'text' || 
                          tableData.selectionMode === 'number' ||
                          (tableData.columns && tableData.columns.some(c => c.kind === 'text' || c.kind === 'number'));
                        
                        // Use stored marking data if available, otherwise fall back to correctAnswersData
                        const effectiveCorrectAnswers = currentAnswer.markingData?.correctAnswers || correctAnswersData;
                        const effectiveCorrectInputs = (currentAnswer.markingData as any)?.correctInputs || correctInputsData;
                        
                        return (
                          <div className="space-y-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              {isInputTable ? 'Complete the table by typing your answers:' : 'Complete the table below:'}
                            </span>
                            <TableGridQuestion
                              tableData={tableData}
                              questionId={currentQuestion.id}
                              answers={currentAnswer.tableGridAnswers || {}}
                              inputAnswers={currentAnswer.tableGridInputs || {}}
                              onAnswerChange={(toggleAnswers, inputAnswers) => {
                                // Convert and serialize the answers for storage
                                const cellsForStorage = convertTogglesForSerialization(toggleAnswers);
                                const serialized = serializeTableGridAnswer(cellsForStorage, inputAnswers);
                                const newAnswer = { 
                                  ...currentAnswer, 
                                  answer: serialized,
                                  tableGridAnswers: toggleAnswers,
                                  tableGridInputs: inputAnswers 
                                };
                                setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                                debouncedSave(currentQuestion.id, { answer: serialized });
                              }}
                              readOnly={currentAnswer.submitted}
                              subjectColor={subjectColor}
                              showCorrectAnswers={currentAnswer.submitted && !!currentAnswer.feedback}
                              correctAnswers={effectiveCorrectAnswers}
                              correctInputs={effectiveCorrectInputs}
                              markingData={currentAnswer.markingData}
                            />
                          </div>
                        );
                      }
                    }
                    
                    // Default: standard text input with math keypad
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Your Answer</span>
                          <Button
                            variant={showMathKeypad ? "secondary" : "ghost"}
                            size="icon"
                            onClick={() => setShowMathKeypad(prev => !prev)}
                            disabled={currentAnswer.submitted}
                            title="Math symbols"
                          >
                            <Calculator className="w-4 h-4" />
                          </Button>
                        </div>
                        <Textarea 
                          ref={answerTextareaRef}
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
                          className="min-h-[140px] lg:min-h-[160px] text-base text-foreground" 
                          placeholder={currentQuestion.has_math ? "Type your answer here… (use the calculator icon for symbols)" : "Type your answer here…"}
                        />
                        
                        {/* Docked Math Insert Keypad (below textarea) */}
                        {showMathKeypad && !currentAnswer.submitted && (
                          <MathInsertKeypad
                            isOpen={true}
                            onClose={() => setShowMathKeypad(false)}
                            onInsert={(text, caretOffset) => {
                              const textarea = answerTextareaRef.current;
                              if (!textarea) return;
                              
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              const before = currentAnswer.answer.substring(0, start);
                              const after = currentAnswer.answer.substring(end);
                              const newValue = before + text + after;
                              
                              const newAnswer = { ...currentAnswer, answer: newValue };
                              setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                              debouncedSave(currentQuestion.id, { answer: newValue });
                              
                              // Restore focus and cursor position (inside template if caretOffset provided)
                              requestAnimationFrame(() => {
                                textarea.focus();
                                const insertEnd = start + text.length;
                                const newPos = caretOffset ? insertEnd - caretOffset : insertEnd;
                                textarea.setSelectionRange(newPos, newPos);
                              });
                            }}
                            onNavigate={(direction) => {
                              const textarea = answerTextareaRef.current;
                              if (!textarea) return;
                              const pos = textarea.selectionStart;
                              const newPos = direction === 'left' 
                                ? Math.max(0, pos - 1) 
                                : Math.min(currentAnswer.answer.length, pos + 1);
                              textarea.focus();
                              textarea.setSelectionRange(newPos, newPos);
                            }}
                            onDelete={() => {
                              const textarea = answerTextareaRef.current;
                              if (!textarea) return;
                              const start = textarea.selectionStart;
                              const end = textarea.selectionEnd;
                              
                              if (start === end && start > 0) {
                                const before = currentAnswer.answer.substring(0, start - 1);
                                const after = currentAnswer.answer.substring(end);
                                const newValue = before + after;
                                const newAnswer = { ...currentAnswer, answer: newValue };
                                setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                                debouncedSave(currentQuestion.id, { answer: newValue });
                                requestAnimationFrame(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start - 1, start - 1);
                                });
                              } else if (start !== end) {
                                const before = currentAnswer.answer.substring(0, start);
                                const after = currentAnswer.answer.substring(end);
                                const newValue = before + after;
                                const newAnswer = { ...currentAnswer, answer: newValue };
                                setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                                debouncedSave(currentQuestion.id, { answer: newValue });
                                requestAnimationFrame(() => {
                                  textarea.focus();
                                  textarea.setSelectionRange(start, start);
                                });
                              }
                            }}
                            subjectColor={subjectColor}
                          />
                        )}
                      </div>
                    );
                  })()}

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
                disabled={currentAnswer.submitted || isGrading || (
                  !currentAnswer.answer.trim() && 
                  !(currentAnswer.tableGridAnswers && Object.values(currentAnswer.tableGridAnswers).some(arr => arr.length > 0)) &&
                  !(currentAnswer.tableGridInputs && Object.values(currentAnswer.tableGridInputs).some(obj => Object.values(obj).some(v => v !== '' && v !== 0)))
                )} 
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

      <AlertDialog open={showRetrySetDialog} onOpenChange={setShowRetrySetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Entire Practice Set?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will clear all your answers and marks for this practice set.</p>
              <p className="text-amber-600 font-medium">⚠️ This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRetryEntireSet} 
              disabled={isRetrying}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isRetrying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reset & Start Fresh
            </AlertDialogAction>
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
