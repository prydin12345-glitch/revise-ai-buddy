import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Check, Circle, AlertCircle, Menu, ChevronLeft, ChevronRight, MoreVertical, Calculator, Send } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MathRenderer } from "@/components/MathRenderer";
import { SubmissionLoadingScreen } from "@/components/exam/SubmissionLoadingScreen";

// Helper to add opacity to hex color
const addOpacity = (hex: string, opacity: number): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Strip inline MCQ options (A), B), C), D)) from question text for student view
// This prevents duplication when the UI also renders interactive option buttons
const stripInlineMCQOptions = (text: string, questionType: string): string => {
  if (questionType !== 'mcq') return text;
  
  let cleanedText = text;
  
  // Pattern 1: Options on separate lines starting with A) or A.
  // Matches from the first standalone A) or A. option line to end
  const lineOptionsPattern = /(?:\n|^)\s*A[).]\s+[\s\S]*$/i;
  
  // Pattern 2: Options all inline (A) ... B) ... C) ... D) ...)
  const inlineOptionsPattern = /\s+A[).]\s+.+?\s+B[).]\s+.+?\s+C[).]\s+.+?\s+D[).]\s+.+$/i;
  
  // Try inline pattern first (more specific)
  if (inlineOptionsPattern.test(cleanedText)) {
    cleanedText = cleanedText.replace(inlineOptionsPattern, '').trim();
  } 
  // Then try line-by-line pattern
  else if (lineOptionsPattern.test(cleanedText)) {
    cleanedText = cleanedText.replace(lineOptionsPattern, '').trim();
  }
  
  return cleanedText;
};

interface Question {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: string[];
  figure_urls?: string[];
  correct_answer?: string;
  has_math?: boolean;
  question_latex?: string;
}

const ExamInProgress = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modeParam = searchParams.get('mode');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<Record<string, { workingOut: string; finalAnswer: string }>>({});
  const [savedAnswers, setSavedAnswers] = useState<Set<string>>(new Set());
  const [isTeacher, setIsTeacher] = useState(false); // Explicitly initialize to false
  const treatAsStudent = modeParam === 'student';
  const isReadOnly = isTeacher && !treatAsStudent;
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerNeedsReinit, setTimerNeedsReinit] = useState(false); // Flag to trigger timer reinit
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSubmit, setIsAutoSubmit] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [existingAnswers, setExistingAnswers] = useState<any[]>([]);
  const [submission, setSubmission] = useState<any>(null);
  const [examSubject, setExamSubject] = useState<string>('');
  const examSubjectRef = useRef<string>(''); // Ref to avoid stale closures
  const [examName, setExamName] = useState<string>('');
  const [subjectColor, setSubjectColor] = useState<string>('#3B82F6');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const startTime = useRef<number>(Date.now());
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef(userAnswers);
  
  // Keep answersRef in sync with userAnswers
  useEffect(() => {
    answersRef.current = userAnswers;
  }, [userAnswers]);

  // Keep examSubjectRef in sync with examSubject
  useEffect(() => {
    examSubjectRef.current = examSubject;
  }, [examSubject]);

  // Helper to update answers in a structured way
  const updateAnswer = (questionId: string, patch: Partial<{ workingOut: string; finalAnswer: string }>) => {
    setUserAnswers(prev => {
      const existing = prev[questionId] || { workingOut: '', finalAnswer: '' };
      const next = { ...existing, ...patch };
      // Keep the ref in sync immediately to avoid stale saves
      answersRef.current = { ...answersRef.current, [questionId]: next };
      return { ...prev, [questionId]: next };
    });
  };

  // Save exam progress to backend - works for ALL exams (timed and non-timed)
  const saveExamProgress = useCallback(async () => {
    if (!examId) return;
    
    try {
      await supabase.functions.invoke('save-exam-progress', {
        body: { 
          examId, 
          timeRemainingSeconds: timerEnabled ? timeRemaining : null 
        }
      });
      console.log('[Progress] Saved to backend');
    } catch (error) {
      console.error('Failed to save exam progress:', error);
      throw error; // Propagate for proper error handling
    }
  }, [examId, timeRemaining, timerEnabled]);

  const saveTimerState = useCallback(async () => {
    if (!examId) return;
    
    try {
      // Save to localStorage for timed exams (immediate, synchronous)
      if (timerEnabled) {
        localStorage.setItem(`exam_${examId}_time_remaining`, timeRemaining.toString());
        localStorage.setItem(`exam_${examId}_last_saved`, Date.now().toString());
      }
      
      // Save to backend (works for ALL exams)
      await saveExamProgress();
    } catch (error) {
      console.error('Failed to save timer state:', error);
    }
  }, [examId, timeRemaining, timerEnabled, saveExamProgress]);

  // Auto-save timer every 30 seconds
  useEffect(() => {
    if (!timerEnabled || isReadOnly || loading) return;
    
    const interval = setInterval(() => {
      saveTimerState();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [timerEnabled, isReadOnly, loading, saveTimerState]);

  // Save timer on tab close/refresh
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (timerEnabled && examId) {
        // Synchronous localStorage save (always works)
        localStorage.setItem(`exam_${examId}_time_remaining`, timeRemaining.toString());
        localStorage.setItem(`exam_${examId}_last_saved`, Date.now().toString());
        
        // Async backend save with keepalive
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-exam-progress`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
              },
              body: JSON.stringify({
                examId,
                timeRemainingSeconds: timeRemaining
              }),
              keepalive: true // ✅ Ensures request completes even after page unloads
            });
          }
        } catch (error) {
          console.error('BeforeUnload save failed:', error);
        }
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [examId, timeRemaining, timerEnabled]);

  useEffect(() => {
    setCurrentPage(0); // Always start at first question when exam loads
    loadQuestions();
  }, [examId]);

  useEffect(() => {
    // Clear any existing interval
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }

    if (!isReadOnly && !loading && !isSubmitting && timerEnabled) {
      console.log('[Timer] Initializing timer with timeRemaining:', timeRemaining);
      
      timerInterval.current = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime.current) / 1000));
        
        if (timerEnabled) {
          setTimeRemaining(prev => {
            // Trigger final minute alert
            if (prev === 60) {
              toast({
                title: "⏰ Final Minute!",
                description: "Your exam will auto-submit at 0:00",
                variant: "destructive",
                duration: 10000
              });
            }
            
            if (prev <= 1) {
              if (timerInterval.current) clearInterval(timerInterval.current);
              
              // Check if this is a stale timer (user was away)
              const lastSaved = parseInt(
                localStorage.getItem(`exam_${examId}_last_saved`) || '0'
              );
              const timeSinceLastSave = Date.now() - lastSaved;
              
              // If more than 2 minutes since last save, this is stale data
              if (timeSinceLastSave > 120000) {
                toast({
                  title: "Session Expired",
                  description: "Your exam session timed out. Progress has been saved.",
                  variant: "destructive"
                });
                navigate('/my-exams');
                return 0;
              }
              
              handleAutoSubmit();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
      
      // Reset the reinit flag after starting the timer
      if (timerNeedsReinit) {
        setTimerNeedsReinit(false);
      }

      return () => {
        if (timerInterval.current) clearInterval(timerInterval.current);
      };
    }
  }, [isReadOnly, loading, timerEnabled, isSubmitting, timerNeedsReinit]);

  const loadQuestions = async () => {
    try {
      // Fetch exam metadata to get subject and name
      const { data: examData } = await supabase
        .from('exams')
        .select('subject_id, title')
        .eq('id', examId)
        .single();
      
      if (examData) {
        setExamSubject(examData.subject_id || '');
        setExamName(examData.title || 'Exam in Progress');
        
        // Fetch subject color from user_subjects table
        const { data: { user } } = await supabase.auth.getUser();
        if (user && examData.subject_id) {
          const { data: subjectData } = await supabase
            .from('user_subjects')
            .select('subject_color')
            .eq('user_id', user.id)
            .ilike('subject_name', examData.subject_id)
            .maybeSingle();
          
          if (subjectData?.subject_color) {
            console.log('[Subject Color] Loaded:', subjectData.subject_color, 'for subject:', examData.subject_id);
            setSubjectColor(subjectData.subject_color);
          } else {
            console.log('[Subject Color] No color found for subject:', examData.subject_id, 'using default');
          }
        }
      }

      const { data, error } = await supabase.functions.invoke('get-exam-questions', {
        body: { examId }
      });

      if (error) throw error;

      if (data.submission && data.submission.status === 'submitted') {
        toast({
          title: "Exam Already Submitted",
          description: "Redirecting to review page...",
        });
        navigate(`/exam/${examId}/review`);
        return;
      }

      // Client-side fallback: Re-sort questions to ensure correct order
      const parseQuestionNumber = (numStr: string) => {
        const mainMatch = numStr.match(/^(\d+)/);
        const main = mainMatch ? parseInt(mainMatch[1], 10) : 0;
        
        const dotMatch = numStr.match(/^(\d+)\.(\d+)/);
        const subDot = dotMatch ? parseInt(dotMatch[2], 10) : 0;
        
        const letterMatch = numStr.match(/\(([a-z])\)/i) || numStr.match(/^[0-9]+\s*([a-z])/i);
        const letter = letterMatch ? letterMatch[1].toLowerCase().charCodeAt(0) - 96 : 0;
        
        const romanMatch = numStr.match(/\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\)/i);
        const romanMap: Record<string, number> = {
          'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
          'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
        };
        const roman = romanMatch ? romanMap[romanMatch[1].toLowerCase()] : 0;
        
        return [main, subDot, letter, roman];
      };

      const sortedQuestions = (data.questions || []).sort((a: Question, b: Question) => {
        const aParts = parseQuestionNumber(a.question_number);
        const bParts = parseQuestionNumber(b.question_number);
        
        for (let i = 0; i < aParts.length; i++) {
          if (aParts[i] !== bParts[i]) {
            return aParts[i] - bParts[i];
          }
        }
        return 0;
      });

      setQuestions(sortedQuestions);
      setIsTeacher(Boolean(data.isTeacher));
      console.log('[Resume Debug] isTeacher:', data.isTeacher, 'isReadOnly:', Boolean(data.isTeacher) && !treatAsStudent);
      setExistingAnswers(data.existingAnswers || []);
      setSubmission(data.submission || null);
      
      if (data.timer?.enabled) {
        setTimerEnabled(true);
        
        // Get localStorage data
        const localStorageTime = parseInt(
          localStorage.getItem(`exam_${examId}_time_remaining`) || '0'
        );
        const lastSaved = parseInt(
          localStorage.getItem(`exam_${examId}_last_saved`) || '0'
        );
        
        // Check if localStorage data is stale (> 1 hour old)
        const isStale = lastSaved > 0 && (Date.now() - lastSaved > 3600000);
        
        // Priority: Backend > Fresh LocalStorage > Full Duration
        const initialTime = (data.timer.time_remaining_seconds ?? (!isStale && localStorageTime > 0 ? localStorageTime : null)) ?? (data.timer.duration_minutes * 60);
        
        // Detect if this is a resume
        const isResume = data.timer.time_remaining_seconds && 
                         data.timer.time_remaining_seconds < (data.timer.duration_minutes * 60);
        
        if (isResume) {
          console.log('[Resume Mode] Restoring exam state with', initialTime, 'seconds remaining');
        }
        
        // If we ignored stale localStorage, clear it
        if (isStale && localStorageTime > 0) {
          console.log('Cleared stale localStorage timer data');
          localStorage.removeItem(`exam_${examId}_time_remaining`);
          localStorage.removeItem(`exam_${examId}_last_saved`);
        }
        
        setTimeRemaining(initialTime);
        
        // ALWAYS recalculate start time based on elapsed time to prevent timer stuck issues
        const elapsedSeconds = (data.timer.duration_minutes * 60) - initialTime;
        startTime.current = Date.now() - (elapsedSeconds * 1000);
        
        // Trigger timer reinitialization
        setTimerNeedsReinit(true);
      }

      // Use local variable from examData to determine if math exam (avoids stale state)
      const isMathExam = examData?.subject_id?.toLowerCase().includes('math');
      console.log('[Load] Subject:', examData?.subject_id, 'isMathExam:', isMathExam);
      
      const answersMap: Record<string, { workingOut: string; finalAnswer: string }> = {};
      const savedSet = new Set<string>();
      (data.existingAnswers || []).forEach((ans: any) => {
        const answerText = ans.answer_text || '';
        // For math exams, text goes to workingOut; for others, to finalAnswer
        if (isMathExam) {
          answersMap[ans.question_id] = { workingOut: answerText, finalAnswer: '' };
        } else {
          answersMap[ans.question_id] = { workingOut: '', finalAnswer: answerText };
        }
        savedSet.add(ans.question_id);
      });
      setUserAnswers(answersMap);
      setSavedAnswers(savedSet);

      // Create initial session if none exists (for non-timed exams too)
      const shouldCreateSession = !data.submission && !(Boolean(data.isTeacher) && !treatAsStudent);
      if (shouldCreateSession) {
        console.log('[Session] Creating initial exam session...');
        try {
          await supabase.functions.invoke('save-exam-progress', {
            body: { 
              examId, 
              timeRemainingSeconds: data.timer?.enabled 
                ? (data.timer.duration_minutes * 60) 
                : null 
            }
          });
        } catch (sessionError) {
          console.error('Failed to create initial session:', sessionError);
        }
      }

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = useCallback((questionId: string, answer: string) => {
    // Legacy handler for non-math questions (plain text answer)
    updateAnswer(questionId, { finalAnswer: answer });
    setSavedAnswers(prev => {
      const newSet = new Set(prev);
      newSet.delete(questionId);
      return newSet;
    });

    if (saveTimeouts.current[questionId]) {
      clearTimeout(saveTimeouts.current[questionId]);
    }

    saveTimeouts.current[questionId] = setTimeout(() => {
      handleSaveAnswer(questionId);
    }, 1000);
  }, []);

  const handleSaveAnswer = async (questionId: string) => {
    const answerData = answersRef.current[questionId] || { workingOut: '', finalAnswer: '' };
    
    // Use ref to get current subject (avoids stale closure)
    const currentSubject = examSubjectRef.current;
    const isMathExam = currentSubject?.toLowerCase().includes('math');
    
    // Serialize based on exam type
    let answerText: string;
    if (isMathExam) {
      // Math exam: save workingOut only (no separate final answer field)
      answerText = answerData.workingOut || '';
    } else {
      // Non-math: save finalAnswer as plain text
      answerText = answerData.finalAnswer || answerData.workingOut || '';
    }
    
    console.log(`[Save] Question ${questionId}, subject: ${currentSubject}, isMath: ${isMathExam}, answer: ${answerText.substring(0, 50)}...`);
    setAutoSaveStatus('saving');
    try {
      console.log(`[Save] Question ${questionId}: ${answerText.substring(0, 50)}...`);
      
      const { error } = await supabase.functions.invoke('submit-student-answer', {
        body: { examId, questionId, answerText }
      });

      if (error) throw error;

      // Save timer state after answer saved
      await saveTimerState();

      setSavedAnswers(prev => new Set(prev).add(questionId));
      setAutoSaveStatus('saved');
      setLastSavedTime(new Date());
      
      // Reset to idle after 3 seconds
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch (error: any) {
      setAutoSaveStatus('error');
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    }
  };
  
  // Flush saves for current page questions before navigation
  const flushCurrentPageSaves = async () => {
    const currentQuestions = questionGroups[currentPage]?.questions || [];
    for (const question of currentQuestions) {
      if (saveTimeouts.current[question.id]) {
        clearTimeout(saveTimeouts.current[question.id]);
        const answerData = answersRef.current[question.id];
        if (answerData) {
          await handleSaveAnswer(question.id);
        }
      }
    }
  };

  const scrollToQuestion = (questionId: string) => {
    questionRefs.current[questionId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleAutoSubmit = () => {
    setIsAutoSubmit(true);
    toast({ title: "Time's Up!", description: "Auto-submitting exam...", variant: "destructive" });
    submitExam();
  };

  // Retry logic with exponential backoff
  const submitExamWithRetry = async (maxRetries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('submit-exam', {
          body: { examId, timeTakenSeconds: timeElapsed }
        });
        
        if (error) throw error;
        return data;
      } catch (error) {
        console.error(`[Submit] Attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) throw error;
        
        // Wait before retry (exponential backoff: 1s, 2s, 4s)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  };

  const submitExam = async () => {
    setIsSubmitting(true);
    try {
      // 1. Clear any pending debounced saves
      Object.keys(saveTimeouts.current).forEach(questionId => {
        if (saveTimeouts.current[questionId]) {
          clearTimeout(saveTimeouts.current[questionId]);
          delete saveTimeouts.current[questionId];
        }
      });

      // 2. Save ALL answers synchronously before submission
      const answersToSave = Object.entries(answersRef.current)
        .filter(([_, answer]) => answer?.workingOut?.trim() || answer?.finalAnswer?.trim());
      
      console.log(`[Submit] Saving ${answersToSave.length} answers before submission...`);
      await Promise.all(answersToSave.map(([qId]) => handleSaveAnswer(qId)));

      // 3. Call submit edge function with retry
      const data = await submitExamWithRetry();

      // 4. Clear localStorage timer state
      localStorage.removeItem(`exam_${examId}_time_remaining`);
      localStorage.removeItem(`exam_${examId}_last_saved`);

      // 5. Handle score visibility based on tutor settings
      if (data.scoresHidden) {
        toast({ 
          title: "Exam Submitted!", 
          description: "Your exam has been submitted. Results will be released by your tutor." 
        });
      } else {
        toast({ 
          title: "Exam Submitted!", 
          description: `Score: ${Math.round(data.totalScore)}/${data.totalMarks} (${Math.round(data.percentage)}%)` 
        });
      }
      
      navigate(`/exam/${examId}/review`);
    } catch (error: any) {
      console.error('[Submit] Final failure:', error);
      toast({ 
        title: "Submission Failed", 
        description: error.message + ". Your answers are saved. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  const handleQuitExam = async () => {
    try {
      // 1. Clear any pending debounced saves
      Object.keys(saveTimeouts.current).forEach(questionId => {
        if (saveTimeouts.current[questionId]) {
          clearTimeout(saveTimeouts.current[questionId]);
          delete saveTimeouts.current[questionId];
        }
      });

      // 2. Save ALL current answers (not just pending ones)
      const answersToSave = Object.entries(userAnswers)
        .filter(([_, answer]) => answer.workingOut?.trim() || answer.finalAnswer?.trim());
      
      console.log(`[Quit] Saving ${answersToSave.length} answers...`);
      
      const savePromises = answersToSave.map(([questionId]) => handleSaveAnswer(questionId));
      await Promise.all(savePromises);

      // 3. Save session progress (works for ALL exams - timed and non-timed)
      await saveExamProgress();

      // 4. Only clear localStorage AFTER successful backend save
      localStorage.removeItem(`exam_${examId}_time_remaining`);
      localStorage.removeItem(`exam_${examId}_last_saved`);

      // 5. Show success toast
      toast({
        title: "Progress Saved",
        description: "You can continue this exam later from My Exams.",
      });

      // 6. Navigate back to My Exams page
      navigate('/my-exams');
    } catch (error: any) {
      // Keep localStorage as backup on failure
      toast({
        title: "Failed to Save Progress",
        description: "Your progress is saved locally. Please try again.",
        variant: "destructive"
      });
    } finally {
      setShowQuitDialog(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 
      ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.values(userAnswers).filter(a => 
    Boolean(a?.finalAnswer?.trim() || a?.workingOut?.trim())
  ).length;
  const unansweredCount = questions.length - answeredCount;

  // Helper to extract parent question number (e.g., "1a" -> "1", "2b(i)" -> "2")
  const getParentQuestionNumber = (questionNumber: string): string => {
    return questionNumber.match(/^(\d+)/)?.[1] || questionNumber;
  };

  // Smart grouping: Keep consecutive MCQs together, group sub-questions (1a, 1b) together
  const groupedQuestions = questions.reduce((acc, question, index) => {
    const prevQuestion = index > 0 ? questions[index - 1] : null;
    const currentParent = getParentQuestionNumber(question.question_number);
    const prevParent = prevQuestion ? getParentQuestionNumber(prevQuestion.question_number) : null;
    
    // Determine if we should start a new group
    const shouldStartNewGroup = 
      index === 0 || // First question
      question.question_type !== prevQuestion?.question_type || // Type changed
      (question.question_type === 'mcq') || // Always group MCQs separately
      (question.question_type !== 'mcq' && currentParent !== prevParent); // Different parent for non-MCQ
    
    if (shouldStartNewGroup) {
      const groupKey = `group_${Object.keys(acc).length}`;
      acc[groupKey] = [];
    }
    
    const lastGroupKey = Object.keys(acc)[Object.keys(acc).length - 1];
    acc[lastGroupKey].push(question);
    
    return acc;
  }, {} as Record<string, Question[]>);

  const questionGroups = Object.entries(groupedQuestions).map(([key, qs], idx) => {
    const firstQ = qs[0];
    const lastQ = qs[qs.length - 1];
    
    let label = '';
    if (qs.length === 1) {
      label = `Question ${firstQ.question_number}`;
    } else if (firstQ.question_type === 'mcq') {
      label = `Questions ${firstQ.question_number}-${lastQ.question_number}`;
    } else {
      // Sub-questions like 1a, 1b
      const parent = getParentQuestionNumber(firstQ.question_number);
      label = `Question ${parent} (${qs.length} part${qs.length !== 1 ? 's' : ''})`;
    }
    
    return {
      parent: label,
      questions: qs
    };
  });

  const currentGroup = questionGroups[currentPage] || { parent: '1', questions: [] };
  const hasNextPage = currentPage < questionGroups.length - 1;
  const hasPrevPage = currentPage > 0;

  // Show submission loading screen
  if (isSubmitting) {
    return (
      <SubmissionLoadingScreen 
        subjectName={examName}
        subjectColor={subjectColor}
        isAutoSubmit={isAutoSubmit}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container grid grid-cols-3 items-center h-16 px-6 max-w-none gap-4">
          {/* Left: Menu and Title */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">{examName || 'Exam in Progress'}</h1>
          </div>
          
          {/* Center: Timer */}
          <div className="flex justify-center">
            {timerEnabled && (
              <div 
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  timeRemaining <= 60 
                    ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/50' 
                    : timeRemaining < 300 
                    ? 'bg-orange-500 text-white' 
                    : 'bg-muted'
                }`}
                style={timeRemaining <= 60 ? {
                  animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  boxShadow: '0 0 20px rgba(220, 38, 38, 0.6)'
                } : undefined}
              >
                <Clock className={`w-5 h-5 ${timeRemaining <= 60 ? 'animate-bounce' : ''}`} />
                <span className="font-mono text-lg font-semibold">{formatTime(timeRemaining)}</span>
                {timeRemaining <= 60 && (
                  <span className="ml-2 text-xs font-bold uppercase">Final Minute!</span>
                )}
              </div>
            )}
            {!timerEnabled && !isTeacher && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                <Clock className="w-5 h-5" />
                <span className="font-mono text-lg">{formatTime(timeElapsed)}</span>
              </div>
            )}
          </div>
          
          {/* Right: Autosave & Menu */}
          <div className="flex items-center justify-end gap-4">
            
            {/* Auto-save status indicator - hidden visually but accessible to screen readers */}
            {!isReadOnly && (
              <div className="sr-only">
                {autoSaveStatus === 'saving' && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="w-4 h-4" />
                    Saved
                  </span>
                )}
                {autoSaveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    Save failed
                  </span>
                )}
              </div>
            )}
            
            {!isReadOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                  <DropdownMenuLabel>Exam Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem
                    onClick={() => setShowQuitDialog(true)}
                    className="cursor-pointer"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Quit Exam
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={() => setShowSubmitDialog(true)}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Submit Exam
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Sidebar - Collapsible */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 border-r bg-card/30 overflow-hidden sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto`}>
          <div className="p-6 flex flex-col gap-6 h-full">
            <div>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">QUESTIONS</h2>
              <div className="grid grid-cols-4 gap-2">
                {questions.map((q) => {
                  const answerData = userAnswers[q.id];
                  const hasAnswer = Boolean(answerData?.finalAnswer?.trim() || answerData?.workingOut?.trim());
                  const answer = existingAnswers?.find((a: any) => a.question_id === q.id);
                  
                  // Determine color based on submission status
                  let colorClass = '';
                  let inlineStyle: React.CSSProperties | undefined = undefined;
                  
                  if (submission && answer) {
                    // Post-submission colors (Red/Amber/Green)
                    if (answer.is_correct === true) {
                      colorClass = 'bg-green-500 text-white'; // Correct
                    } else if (answer.score > 0 && answer.score < q.marks) {
                      colorClass = 'bg-orange-500 text-white'; // Partial
                    } else {
                      colorClass = 'bg-red-500 text-white'; // Incorrect
                    }
                  } else if (hasAnswer) {
                    // Pre-submission with answer → use subject color
                    colorClass = 'text-white';
                    inlineStyle = { 
                      backgroundColor: subjectColor,
                    };
                  } else {
                    // No answer → gray
                    colorClass = 'bg-muted text-muted-foreground hover:bg-muted/80';
                  }
                  
                  return (
                    <button
                      key={q.id}
                      onClick={async () => {
                        await flushCurrentPageSaves();
                        const groupIndex = questionGroups.findIndex(g => 
                          g.questions.some(question => question.id === q.id)
                        );
                        if (groupIndex !== -1) {
                          setCurrentPage(groupIndex);
                          setTimeout(() => scrollToQuestion(q.id), 100);
                        }
                      }}
                      style={inlineStyle}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all hover:scale-105 ${colorClass}`}
                      title={`Question ${q.question_number}`}
                    >
                      {q.question_number}
                    </button>
                  );
                })}
              </div>
            </div>


            {!isTeacher && (
              <Button 
                size="lg" 
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
                variant="destructive"
                className="mt-auto"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                End Exam Early
              </Button>
            )}
          </div>
        </div>

        {/* Main Panel - Wider with page navigation */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Page Navigation Header */}
          <div className="border-b bg-muted/30 px-6 py-4 flex items-center justify-between relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex"
            >
              <Menu className="h-4 w-4 mr-2" />
              {sidebarOpen ? 'Hide' : 'Show'} Navigation
            </Button>
            <div className="flex-1 flex justify-center">
              <h2 className="text-lg font-semibold">
                {currentGroup.parent}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await flushCurrentPageSaves();
                  setCurrentPage(prev => prev - 1);
                }}
                disabled={!hasPrevPage}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous Section
              </Button>
              <span className="text-sm text-muted-foreground px-3">
                {currentPage + 1} / {questionGroups.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await flushCurrentPageSaves();
                  setCurrentPage(prev => prev + 1);
                }}
                disabled={!hasNextPage}
              >
                Next Section
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Questions Container */}
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-7xl py-8 px-8 space-y-6">
              {currentGroup.questions.map((question) => (
                <Card 
                  key={question.id} 
                  ref={(el) => questionRefs.current[question.id] = el}
                  className="p-8 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="secondary" 
                        className="text-lg px-4 py-1.5 font-bold border-2 transition-all"
                        style={{ 
                          backgroundColor: subjectColor,
                          borderColor: subjectColor,
                          color: '#FFFFFF'
                        }}
                      >
                        Q{question.question_number}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge 
                        className="text-lg px-4 py-1.5 font-bold border-2 transition-all"
                        style={{
                          backgroundColor: subjectColor,
                          borderColor: subjectColor,
                          color: '#FFFFFF'
                        }}
                      >
                        {question.marks} marks
                      </Badge>
                    </div>
                  </div>

                  <MathRenderer 
                    content={stripInlineMCQOptions(question.question_text, question.question_type)}
                    latex={(question as any).question_latex}
                    hasMath={(question as any).has_math}
                    className="mb-6 text-lg"
                  />

                  {question.figure_urls && question.figure_urls.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {question.figure_urls.map((url, idx) => (
                        <img key={idx} src={url} alt={`Figure ${idx + 1}`} className="rounded-lg border w-full" />
                      ))}
                    </div>
                  )}

                  {question.question_type === 'mcq' && question.options ? (
                    <RadioGroup 
                      value={userAnswers[question.id]?.finalAnswer || ''} 
                      onValueChange={(val) => handleAnswerChange(question.id, val)}
                      disabled={isReadOnly}
                      className="space-y-2"
                    >
                      {question.options.map((option, idx) => {
                        const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D...
                        const isSelected = userAnswers[question.id]?.finalAnswer === optionLetter;
                        return (
                        <div 
                            key={idx} 
                            className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                              isSelected ? '' : 'border-border hover:bg-accent'
                            }`}
                            style={isSelected ? {
                              borderColor: subjectColor,
                              backgroundColor: addOpacity(subjectColor, 0.1)
                            } : undefined}
                          >
                            <RadioGroupItem value={optionLetter} id={`${question.id}-${idx}`} />
                            <Label htmlFor={`${question.id}-${idx}`} className="flex-1 cursor-pointer text-lg">
                              <span className="font-medium mr-2">{optionLetter})</span>
                              <MathRenderer 
                                content={option} 
                                hasMath={question.has_math}
                                inline={true}
                              />
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  ) : examSubject.toLowerCase().includes('math') ? (
                    <div>
                      <Label className="text-base font-medium mb-2 block">Your Answer</Label>
                      <Textarea 
                        placeholder="Show your working and final answer here..."
                        value={userAnswers[question.id]?.workingOut || ''}
                        onChange={(e) => {
                          updateAnswer(question.id, { workingOut: e.target.value });
                          // Trigger debounced save
                          if (saveTimeouts.current[question.id]) {
                            clearTimeout(saveTimeouts.current[question.id]);
                          }
                          saveTimeouts.current[question.id] = setTimeout(() => {
                            handleSaveAnswer(question.id);
                          }, 1000);
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = subjectColor;
                          e.target.style.borderWidth = '2px';
                          e.target.style.outline = 'none';
                          e.target.style.boxShadow = 'none';
                        }}
                        onBlur={async (e) => {
                          e.target.style.borderColor = '';
                          e.target.style.borderWidth = '';
                          e.target.style.outline = '';
                          e.target.style.boxShadow = '';
                          if (saveTimeouts.current[question.id]) {
                            clearTimeout(saveTimeouts.current[question.id]);
                          }
                          await handleSaveAnswer(question.id);
                        }}
                        className="min-h-[300px] resize-y text-base font-mono transition-all"
                        disabled={isReadOnly}
                      />
                    </div>
                  ) : (
                    <Textarea 
                      placeholder="Your Answer"
                      value={userAnswers[question.id]?.finalAnswer || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      onFocus={(e) => {
                        e.target.style.borderColor = subjectColor;
                        e.target.style.borderWidth = '2px';
                        e.target.style.outline = 'none';
                        e.target.style.boxShadow = 'none';
                      }}
                      onBlur={async (e) => {
                        e.target.style.borderColor = '';
                        e.target.style.borderWidth = '';
                        e.target.style.outline = '';
                        e.target.style.boxShadow = '';
                        if (e.target.value) {
                          await handleSaveAnswer(question.id);
                        }
                      }}
                      className="min-h-[200px] resize-y text-base transition-all"
                    />
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Bottom Navigation */}
          <div className="border-t bg-muted/30 px-6 py-4 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={async () => {
                await flushCurrentPageSaves();
                setCurrentPage(prev => prev - 1);
              }}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous Section
            </Button>
            
            {hasNextPage ? (
              <Button
                onClick={async () => {
                  await flushCurrentPageSaves();
                  setCurrentPage(prev => prev + 1);
                }}
              >
                Next Section
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : !isReadOnly && (
              <Button
                variant="default"
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Exam
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to submit?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {unansweredCount > 0 ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                  <span className="text-sm">
                    You have <strong>{unansweredCount}</strong> unanswered question{unansweredCount > 1 ? 's' : ''}. 
                    These will be marked as incorrect.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 text-primary">
                  <Check className="w-5 h-5 mt-0.5 shrink-0" />
                  <span className="text-sm">
                    You've answered all questions. Great job!
                  </span>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Once submitted, you cannot change your answers. Your exam will be automatically graded.
              </p>
              {timerEnabled && timeRemaining > 0 && (
                <p className="text-sm text-muted-foreground">
                  Time remaining: <strong>{formatTime(timeRemaining)}</strong>
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Review Answers</AlertDialogCancel>
            <AlertDialogAction 
              onClick={submitExam} 
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Exam'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quit Exam Confirmation Dialog */}
      <AlertDialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to quit this exam? Your progress will be saved, and you can continue later from My Exams.
              {timerEnabled && timeRemaining > 0 && (
                <span className="block mt-2 font-semibold text-foreground">
                  ⏱️ Time remaining: {formatTime(timeRemaining)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleQuitExam} className="bg-primary">
              Save & Quit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExamInProgress;
