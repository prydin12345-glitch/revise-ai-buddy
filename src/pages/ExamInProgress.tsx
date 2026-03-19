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
import { Loader2, Clock, Check, Circle, AlertCircle, Menu, ChevronLeft, ChevronRight, MoreVertical, Calculator, Send, Flag, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ResourcePack, ResourceItem } from "@/components/practice/ResourcePackUploader";
import { ResourceViewerModal } from "@/components/exam/ResourceViewerModal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QuestionOptionsMenu } from "@/components/quiz/QuestionOptionsMenu";
import { MathRenderer, ensureString } from "@/components/MathRenderer";
import { QuizQuestionErrorBoundary } from "@/components/quiz/QuizQuestionErrorBoundary";
import { MathInsertKeypad, normalizeUnicodeForGrading } from "@/components/quiz/MathInsertKeypad";
import { SubmissionLoadingScreen } from "@/components/exam/SubmissionLoadingScreen";
import { InteractiveExamTable, hasInteractiveTable, extractTableHtml, removeTableFromContent } from "@/components/InteractiveExamTable";
import { FillInBlankRenderer, hasFillInBlanks } from "@/components/FillInBlankRenderer";
import { TableGridQuestion, isTickXTable, parseMarkdownToTableGrid, extractTextBeforeTable, deserializeTableGridAnswers, serializeTableGridAnswers } from "@/components/exam/TableGridQuestion";
import {
  GraphInterpretationQuestion,
  GraphPlottingQuestion,
  BearingsQuestion,
  parseGraphQuestionData,
  parseGraphResponse,
  serializeGraphInterpretationResponse,
  serializeGraphPlottingResponse,
  serializeBearingsResponse,
  BoxPlotChart,
  isBoxPlotQuestion,
  type GraphPoint,
  type GraphInterpretationConfig,
  type GraphPlottingConfig,
  type BearingsQuestionConfig,
  type LineSegment,
  type DrawingPath,
  type AngleMeasurement,
} from "@/components/graph";
import { MechanicsFigurePanel, detectDiagramConfig } from "@/components/mechanics";
import { CircuitFigurePanel } from "@/components/circuit";
import { detectCircuitConfig } from "@/components/circuit/circuit-detector";

// Helper to add opacity to hex color
const addOpacity = (hex: string, opacity: number): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Marks-adaptive answer box sizing
function getAnswerBoxHeight(marks: number, isMath: boolean): string {
  if (marks <= 2) return isMath ? 'min-h-[150px]' : 'min-h-[120px]';
  if (marks <= 4) return isMath ? 'min-h-[220px]' : 'min-h-[200px]';
  if (marks <= 7) return 'min-h-[300px]';
  return 'min-h-[400px]';
}

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
  const [tableAnswers, setTableAnswers] = useState<Record<string, Record<string, string | boolean>>>({});
  const [blankAnswers, setBlankAnswers] = useState<Record<string, Record<string, string>>>({});
  const [tableGridAnswers, setTableGridAnswers] = useState<Record<string, Record<string, number[]>>>({});
  
  // Graph question state - shared with practice mode for feature parity
  const [graphAnswers, setGraphAnswers] = useState<Record<string, {
    graphInterpretationAnswers?: Record<string, string | number | boolean>;
    graphPlottedPoints?: GraphPoint[];
    graphJoinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | null;
    graphSegments?: LineSegment[];
    graphDrawnPaths?: DrawingPath[];
    bearingsAnswer?: string;
    angleMeasurements?: AngleMeasurement[];
  }>>({});
  const [showProtractor, setShowProtractor] = useState(false);
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  
  const [savedAnswers, setSavedAnswers] = useState<Set<string>>(new Set());
  const [showMathKeypad, setShowMathKeypad] = useState(false);
  const [activeQuestionForMath, setActiveQuestionForMath] = useState<string | null>(null);
  const answerTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
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
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [hideNavigation, setHideNavigation] = useState(false);
  const [existingAnswers, setExistingAnswers] = useState<any[]>([]);
  const [submission, setSubmission] = useState<any>(null);
  const [examSubject, setExamSubject] = useState<string>('');
  const examSubjectRef = useRef<string>(''); // Ref to avoid stale closures
  const [examName, setExamName] = useState<string>('');
  const [subjectColor, setSubjectColor] = useState<string>('#3B82F6');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const [resourcePack, setResourcePack] = useState<ResourcePack | null>(null);
  const [resourcesExpanded, setResourcesExpanded] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);
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

  // Helper to update table answers
  const updateTableAnswer = (questionId: string, answers: Record<string, string | boolean>) => {
    setTableAnswers(prev => ({ ...prev, [questionId]: answers }));
  };

  // Helper to update fill-in-blank answers
  const updateBlankAnswer = (questionId: string, blankId: string, value: string) => {
    setBlankAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [blankId]: value
      }
    }));
  };

  // Helper to update table grid answers (for tick/X tables)
  const updateTableGridAnswer = (questionId: string, answers: Record<string, number[]>) => {
    setTableGridAnswers(prev => ({ ...prev, [questionId]: answers }));
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
      // Fetch exam metadata to get subject, name, and resource pack
      const { data: examData } = await supabase
        .from('exams')
        .select('subject_id, title, resource_pack_id')
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
        
        // Load resource pack if exists
        if (examData.resource_pack_id) {
          const { data: packData } = await supabase
            .from("resource_packs")
            .select("*")
            .eq("id", examData.resource_pack_id)
            .single();

          if (packData) {
            const { data: itemsData } = await supabase
              .from("resource_items")
              .select("*")
              .eq("pack_id", packData.id)
              .order("display_order");

            setResourcePack({
              id: packData.id,
              title: packData.title,
              subject_id: packData.subject_id,
              pack_type: packData.pack_type as 'uploaded' | 'ai_generated' | 'extracted',
              status: packData.status as 'pending' | 'processing' | 'ready' | 'failed',
              items: (itemsData || []).map(item => ({
                id: item.id,
                source_label: item.source_label,
                resource_type: item.resource_type,
                content_text: item.content_text || undefined,
                content_url: item.content_url || undefined,
                content_json: item.content_json,
                word_count: item.word_count || undefined,
                attribution: item.attribution || undefined,
                difficulty_contribution: item.difficulty_contribution || undefined,
                display_order: item.display_order || 0,
              })),
            });
            console.log('[Resource Pack] Loaded:', packData.title, 'with', itemsData?.length || 0, 'items');
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
      
      const answersMap: Record<string, { workingOut: string; finalAnswer: string; answerLatex?: string }> = {};
      const tableAnswersMap: Record<string, Record<string, string | boolean>> = {};
      const tableGridAnswersMap: Record<string, Record<string, number[]>> = {};
      const graphAnswersMap: Record<string, {
        graphInterpretationAnswers?: Record<string, string | number | boolean>;
        graphPlottedPoints?: GraphPoint[];
        graphJoinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | null;
        graphSegments?: LineSegment[];
        graphDrawnPaths?: DrawingPath[];
        bearingsAnswer?: string;
        angleMeasurements?: AngleMeasurement[];
      }> = {};
      const savedSet = new Set<string>();
      
      // First, load answers from database
      const flaggedSet = new Set<string>();
      (data.existingAnswers || []).forEach((ans: any) => {
        const answerText = ans.answer_text || '';
        
        // Check if this is a table_grid answer
        try {
          const parsed = JSON.parse(answerText);
          if (parsed._type === 'table_grid' && parsed.answers) {
            tableGridAnswersMap[ans.question_id] = parsed.answers;
            savedSet.add(ans.question_id);
            if (ans.is_flagged) {
              flaggedSet.add(ans.question_id);
            }
            return; // Skip normal answer processing
          }
          
          // Check if this is a graph answer
          if (parsed._type === 'graph_interpretation' || parsed._type === 'graph_plotting' || parsed._type === 'bearings') {
            const graphResponse = parseGraphResponse(answerText);
            if (graphResponse) {
              if (graphResponse._type === 'graph_interpretation') {
                graphAnswersMap[ans.question_id] = {
                  graphInterpretationAnswers: graphResponse.answers
                };
              } else if (graphResponse._type === 'graph_plotting') {
                graphAnswersMap[ans.question_id] = {
                  graphPlottedPoints: graphResponse.points,
                  graphJoinMode: graphResponse.joinMode,
                  graphSegments: graphResponse.segments,
                  graphDrawnPaths: graphResponse.drawnPaths
                };
              } else if (graphResponse._type === 'bearings') {
                graphAnswersMap[ans.question_id] = {
                  bearingsAnswer: String(graphResponse.bearing)
                };
              }
              savedSet.add(ans.question_id);
              if (ans.is_flagged) {
                flaggedSet.add(ans.question_id);
              }
              return; // Skip normal answer processing
            }
          }
        } catch {
          // Not JSON, continue with normal processing
        }
        
        // For math exams, text goes to workingOut; for others, to finalAnswer
        if (isMathExam) {
          answersMap[ans.question_id] = { 
            workingOut: answerText, 
            finalAnswer: ''
          };
        } else {
          answersMap[ans.question_id] = { 
            workingOut: '', 
            finalAnswer: answerText
          };
        }
        
        // Load table answers if present
        if (ans.table_answers && typeof ans.table_answers === 'object') {
          tableAnswersMap[ans.question_id] = ans.table_answers;
        }
        
        // Load flagged status
        if (ans.is_flagged) {
          flaggedSet.add(ans.question_id);
        }
        
        savedSet.add(ans.question_id);
      });
      
      setFlaggedQuestions(flaggedSet);
      setTableGridAnswers(tableGridAnswersMap);
      setGraphAnswers(graphAnswersMap);
      
      // Then, check sessionStorage for any unsaved drafts (fallback for network failures)
      try {
        for (const question of sortedQuestions) {
          const draftKey = `exam:${examId}:draft:${question.id}`;
          const draftStr = sessionStorage.getItem(draftKey);
          if (draftStr) {
            const draft = JSON.parse(draftStr);
            // Only use draft if it's newer than what we have from DB or DB has no answer
            if (!savedSet.has(question.id) || !answersMap[question.id]) {
              console.log(`[Draft] Restoring unsaved answer for ${question.id} from sessionStorage`);
              if (isMathExam) {
                answersMap[question.id] = {
                  workingOut: draft.answerText || '',
                  finalAnswer: ''
                };
              } else {
                answersMap[question.id] = {
                  workingOut: '',
                  finalAnswer: draft.answerText || ''
                };
              }
            }
          }
        }
      } catch (e) {
        console.warn('[Draft] Failed to restore from sessionStorage:', e);
      }
      
      setUserAnswers(answersMap);
      setTableAnswers(tableAnswersMap);
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
    const answerData = answersRef.current[questionId] || { workingOut: '', finalAnswer: '', answerLatex: '' };
    
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
    
    // Normalize the answer for grading (convert Unicode math to plain text)
    const normalizedAnswer = normalizeUnicodeForGrading(answerText);
    
    // Always save to sessionStorage as fallback (before network call)
    try {
      const draftKey = `exam:${examId}:draft:${questionId}`;
      sessionStorage.setItem(draftKey, JSON.stringify({
        answerText,
        normalizedAnswer,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('[Draft] Failed to save to sessionStorage:', e);
    }
    
    console.log(`[Save] Question ${questionId}, subject: ${currentSubject}, isMath: ${isMathExam}, answer: ${answerText.substring(0, 50)}...`);
    setAutoSaveStatus('saving');
    try {
      console.log(`[Save] Question ${questionId}: ${answerText.substring(0, 50)}...`);
      
      // Include table answers if present for this question
      const questionTableAnswers = tableAnswers[questionId];
      
      // Include table grid answers if present for this question (tick/X tables)
      const questionTableGridAnswers = tableGridAnswers[questionId];
      
      // Include blank answers if present for this question
      // Serialize blank answers into answerText if they exist
      const questionBlankAnswers = blankAnswers[questionId];
      let finalAnswerText = answerText;
      if (questionBlankAnswers && Object.keys(questionBlankAnswers).length > 0) {
        // For fill-in-blank, serialize the blanks as JSON in the answer
        finalAnswerText = JSON.stringify(questionBlankAnswers);
      } else if (questionTableGridAnswers && Object.keys(questionTableGridAnswers).length > 0) {
        // For table grid, serialize the grid answers as JSON with a marker
        finalAnswerText = JSON.stringify({ _type: 'table_grid', answers: questionTableGridAnswers });
      }
      
      // Check for graph answers
      const questionGraphAnswers = graphAnswers[questionId];
      if (questionGraphAnswers) {
        if (questionGraphAnswers.graphInterpretationAnswers) {
          finalAnswerText = serializeGraphInterpretationResponse(questionGraphAnswers.graphInterpretationAnswers);
        } else if (questionGraphAnswers.graphPlottedPoints) {
          finalAnswerText = serializeGraphPlottingResponse(
            questionGraphAnswers.graphPlottedPoints,
            questionGraphAnswers.graphJoinMode,
            questionGraphAnswers.graphSegments,
            questionGraphAnswers.graphDrawnPaths
          );
        } else if (questionGraphAnswers.bearingsAnswer) {
          finalAnswerText = serializeBearingsResponse(questionGraphAnswers.bearingsAnswer);
        }
      }
      
      const { error } = await supabase.functions.invoke('submit-student-answer', {
        body: { 
          examId, 
          questionId, 
          answerText: finalAnswerText,
          normalizedAnswer: normalizedAnswer,
          tableAnswers: questionTableAnswers || undefined
        }
      });

      if (error) throw error;

      // Save timer state after answer saved
      await saveTimerState();
      
      // Clear sessionStorage draft on successful save
      try {
        sessionStorage.removeItem(`exam:${examId}:draft:${questionId}`);
      } catch (e) {
        // Ignore
      }

      setSavedAnswers(prev => new Set(prev).add(questionId));
      setAutoSaveStatus('saved');
      setLastSavedTime(new Date());
      
      // Reset to idle after 3 seconds
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } catch (error: any) {
      setAutoSaveStatus('error');
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
      // Keep sessionStorage draft on failure - it will be used on reload
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
      // Clean up any stale pointer-events left by dialog/overlay
      document.body.style.pointerEvents = '';
      document.documentElement.style.pointerEvents = '';
      const root = document.getElementById('root');
      if (root) root.style.pointerEvents = '';
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

  const answeredCount = questions.filter(q => {
    const textAnswer = userAnswers[q.id];
    const hasTextAnswer = Boolean(textAnswer?.finalAnswer?.trim() || textAnswer?.workingOut?.trim());
    const tableAnswer = tableAnswers[q.id];
    const hasTableAnswer = tableAnswer && Object.keys(tableAnswer).length > 0;
    return hasTextAnswer || hasTableAnswer;
  }).length;
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

  // Toggle flag for a question and persist to backend
  const toggleFlag = async (questionId: string) => {
    const newFlagged = !flaggedQuestions.has(questionId);
    
    // Optimistic update
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newFlagged) {
        newSet.add(questionId);
      } else {
        newSet.delete(questionId);
      }
      return newSet;
    });
    
    // Persist to backend
    try {
      await supabase.functions.invoke('submit-student-answer', {
        body: { 
          examId, 
          questionId, 
          answerText: userAnswers[questionId]?.finalAnswer || userAnswers[questionId]?.workingOut || '',
          isFlagged: newFlagged
        }
      });
    } catch (error) {
      console.error('Failed to save flag state:', error);
    }
  };

  const toggleNavigation = () => {
    setHideNavigation(!hideNavigation);
    setSidebarOpen(hideNavigation);
  };

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
            
            {isReadOnly ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Exam options">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                  <DropdownMenuLabel>Exam Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isTeacher && !treatAsStudent && (
                    <DropdownMenuItem
                      onClick={() => {
                        if (!examId) return;
                        navigate(`/exam/${examId}/live?mode=student`);
                      }}
                      className="cursor-pointer"
                    >
                      Student Mode
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <QuestionOptionsMenu
                mode="exam"
                showMathKeypad={showMathKeypad}
                onToggleMathKeypad={() => setShowMathKeypad(prev => !prev)}
                hideNavigation={hideNavigation}
                onToggleNavigation={toggleNavigation}
                isFlagged={flaggedQuestions.has(currentGroup.questions[0]?.id)}
                onToggleFlag={() => currentGroup.questions[0] && toggleFlag(currentGroup.questions[0].id)}
                onQuitAndSave={() => setShowQuitDialog(true)}
                onSubmitAll={() => setShowSubmitDialog(true)}
                isReadOnly={isReadOnly}
                showProtractor={showProtractor}
                onToggleProtractor={() => setShowProtractor(prev => !prev)}
              />
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
              {/* Tree-style navigation: group by root question number */}
              <div className="space-y-1">
                {(() => {
                  // Build tree: { rootNum: Question[] }
                  const tree: Record<string, Question[]> = {};
                  questions.forEach(q => {
                    const root = q.question_number.match(/^(\d+)/)?.[1] || q.question_number;
                    if (!tree[root]) tree[root] = [];
                    tree[root].push(q);
                  });
                  
                  return Object.entries(tree).map(([rootNum, subQuestions]) => {
                    const isMultiPart = subQuestions.length > 1 || subQuestions[0].question_number !== rootNum;
                    const totalMarks = subQuestions.reduce((sum, q) => sum + q.marks, 0);
                    const allAnswered = subQuestions.every(q => {
                      const a = userAnswers[q.id];
                      return Boolean(a?.finalAnswer?.trim() || a?.workingOut?.trim()) || Boolean(tableAnswers[q.id]) || Boolean(graphAnswers[q.id]);
                    });
                    const someAnswered = subQuestions.some(q => {
                      const a = userAnswers[q.id];
                      return Boolean(a?.finalAnswer?.trim() || a?.workingOut?.trim()) || Boolean(tableAnswers[q.id]) || Boolean(graphAnswers[q.id]);
                    });
                    
                    return (
                      <div key={rootNum} className="mb-1">
                        {isMultiPart ? (
                          <Collapsible defaultOpen>
                            <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-muted/50 text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{
                                  backgroundColor: allAnswered ? subjectColor : someAnswered ? subjectColor + '60' : undefined,
                                  color: allAnswered || someAnswered ? '#fff' : undefined
                                }}>
                                  {rootNum}
                                </span>
                              </div>
                              <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-4 space-y-0.5 mt-0.5">
                              {subQuestions.map(q => {
                                const answerData = userAnswers[q.id];
                                const hasAnswer = Boolean(answerData?.finalAnswer?.trim() || answerData?.workingOut?.trim()) || Boolean(tableAnswers[q.id]) || Boolean(graphAnswers[q.id]);
                                const isFlagged = flaggedQuestions.has(q.id);
                                const subLabel = q.question_number.replace(/^\d+/, '');
                                
                                return (
                                  <button
                                    key={q.id}
                                    onClick={async () => {
                                      await flushCurrentPageSaves();
                                      const groupIndex = questionGroups.findIndex(g => g.questions.some(question => question.id === q.id));
                                      if (groupIndex !== -1) {
                                        setCurrentPage(groupIndex);
                                        setTimeout(() => scrollToQuestion(q.id), 100);
                                      }
                                    }}
                                    className={`relative flex items-center gap-2 w-full px-2 py-1 rounded text-xs transition-all hover:bg-muted/50 ${isFlagged ? 'ring-1 ring-yellow-500' : ''}`}
                                  >
                                    <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold" style={{
                                      backgroundColor: hasAnswer ? subjectColor : undefined,
                                      color: hasAnswer ? '#fff' : undefined
                                    }} >
                                      {subLabel || rootNum}
                                    </span>
                                    {/* marks label removed for cleaner sidebar */}
                                    {isFlagged && <Flag className="w-2.5 h-2.5 text-yellow-500 ml-auto" fill="currentColor" />}
                                  </button>
                                );
                              })}
                            </CollapsibleContent>
                          </Collapsible>
                        ) : (
                          (() => {
                            const q = subQuestions[0];
                            const answerData = userAnswers[q.id];
                            const hasAnswer = Boolean(answerData?.finalAnswer?.trim() || answerData?.workingOut?.trim()) || Boolean(tableAnswers[q.id]) || Boolean(graphAnswers[q.id]);
                            const isFlagged = flaggedQuestions.has(q.id);
                            
                            return (
                              <button
                                onClick={async () => {
                                  await flushCurrentPageSaves();
                                  const groupIndex = questionGroups.findIndex(g => g.questions.some(question => question.id === q.id));
                                  if (groupIndex !== -1) {
                                    setCurrentPage(groupIndex);
                                    setTimeout(() => scrollToQuestion(q.id), 100);
                                  }
                                }}
                                className={`relative flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm font-medium hover:bg-muted/50 transition-all ${isFlagged ? 'ring-1 ring-yellow-500' : ''}`}
                              >
                                <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{
                                  backgroundColor: hasAnswer ? subjectColor : undefined,
                                  color: hasAnswer ? '#fff' : undefined
                                }}>
                                  {rootNum}
                                </span>
                                {/* marks label removed for cleaner sidebar */}
                                {isFlagged && <Flag className="w-2.5 h-2.5 text-yellow-500 ml-auto" fill="currentColor" />}
                              </button>
                            );
                          })()
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              
              {/* Total Marks Summary */}
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{questions.length} questions</span>
                  <span>{questions.reduce((sum, q) => sum + q.marks, 0)} marks</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted-foreground">{answeredCount} answered</span>
                  <span className="text-muted-foreground">{unansweredCount} remaining</span>
                </div>
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

            {/* Resource Pack Section - at bottom of sidebar */}
            {resourcePack && resourcePack.items.length > 0 && (
              <Collapsible open={resourcesExpanded} onOpenChange={setResourcesExpanded} className="mt-4 pt-4 border-t border-border">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center justify-between w-full text-left group">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" style={{ color: subjectColor }} />
                      <span className="text-xs font-semibold text-muted-foreground tracking-wide">RESOURCES</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {resourcePack.items.length}
                      </Badge>
                    </div>
                    {resourcesExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <ScrollArea className="max-h-64">
                    <div className="space-y-2 pr-2">
                        {resourcePack.items.map((item) => (
                          <div 
                            key={item.id} 
                            className="p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setSelectedResource(item)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-xs">{item.source_label}</span>
                              <Badge variant="outline" className="text-[10px] capitalize px-1">
                                {item.resource_type.replace('_', ' ')}
                              </Badge>
                            </div>
                            {item.content_text && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {item.content_text.substring(0, 100)}...
                              </p>
                            )}
                            {item.word_count && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {item.word_count} words
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>

        {/* Main Panel - Wider with page navigation */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Page Navigation Header */}
          <div className="border-b bg-muted/30 px-4 sm:px-6 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex h-8 w-8 shrink-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h2 className="text-base sm:text-lg font-semibold flex-1 text-center lg:text-left">
              {currentGroup.parent}
            </h2>
            <span className="text-sm text-muted-foreground shrink-0">
              {currentPage + 1} / {questionGroups.length}
            </span>
          </div>

          {/* Questions Container */}
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-7xl py-8 px-8 space-y-8">
              {currentGroup.questions.map((question, qIdx) => {
                // Determine if this is a sub-part (e.g., "1a", "2b") vs standalone ("1", "2")
                const subPartMatch = question.question_number.match(/^(\d+)([a-z].*)?$/i);
                const parentNum = subPartMatch?.[1] || question.question_number;
                const subPart = subPartMatch?.[2] || '';
                const isSubPart = !!subPart;
                
                // Check if this is the first sub-part of a new parent (show parent header)
                const prevQuestion = qIdx > 0 ? currentGroup.questions[qIdx - 1] : null;
                const prevParent = prevQuestion?.question_number.match(/^(\d+)/)?.[1];
                const showParentHeader = isSubPart && parentNum !== prevParent;
                
                return (
                  <div key={question.id} className={isSubPart ? 'ml-2' : ''}>
                    {/* Parent question header for first sub-part */}
                    {showParentHeader && (
                      <h2 className="text-xl font-bold mb-4 mt-2">Question {parentNum}</h2>
                    )}
                    
                    <Card 
                      ref={(el) => questionRefs.current[question.id] = el}
                      className={`p-8 shadow-sm ${isSubPart ? 'border-l-4' : ''}`}
                      style={isSubPart ? { borderLeftColor: subjectColor + '40' } : undefined}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-3">
                          {isSubPart ? (
                            <span className="text-lg font-semibold text-foreground">
                              ({subPart})
                            </span>
                          ) : (
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
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-muted-foreground">
                            ({question.marks} {question.marks === 1 ? 'mark' : 'marks'})
                          </span>
                        </div>
                      </div>

                  <QuizQuestionErrorBoundary questionId={question.id}>
                  {/* Render question text - handle tick/X tables, tables, fill-in-blanks, or standard */}
                  {isTickXTable(ensureString(question.question_text)) ? (
                    <>
                      <MathRenderer 
                        content={extractTextBeforeTable(question.question_text)}
                        latex={(question as any).question_latex}
                        hasMath={(question as any).has_math}
                        className="mb-4 text-lg"
                      />
                      {(() => {
                        const tableData = parseMarkdownToTableGrid(question.question_text);
                        if (!tableData) return null;
                        return (
                          <TableGridQuestion
                            tableData={tableData}
                            questionId={question.id}
                            answers={tableGridAnswers[question.id] || {}}
                            onAnswerChange={(answers) => {
                              updateTableGridAnswer(question.id, answers);
                              // Trigger save after grid change
                              if (saveTimeouts.current[question.id]) {
                                clearTimeout(saveTimeouts.current[question.id]);
                              }
                              saveTimeouts.current[question.id] = setTimeout(() => {
                                handleSaveAnswer(question.id);
                              }, 1000);
                            }}
                            readOnly={isReadOnly}
                            subjectColor={subjectColor}
                          />
                        );
                      })()}
                    </>
                  ) : hasInteractiveTable(question.question_text) ? (
                    <>
                      <MathRenderer 
                        content={stripInlineMCQOptions(removeTableFromContent(question.question_text), question.question_type)}
                        latex={(question as any).question_latex}
                        hasMath={(question as any).has_math}
                        className="mb-4 text-lg"
                      />
                      <InteractiveExamTable
                        tableHtml={extractTableHtml(question.question_text) || ''}
                        questionId={question.id}
                        tableAnswers={tableAnswers[question.id] || {}}
                        onTableChange={(answers) => {
                          updateTableAnswer(question.id, answers);
                          // Trigger save after table change
                          if (saveTimeouts.current[question.id]) {
                            clearTimeout(saveTimeouts.current[question.id]);
                          }
                          saveTimeouts.current[question.id] = setTimeout(() => {
                            handleSaveAnswer(question.id);
                          }, 1000);
                        }}
                        readOnly={isReadOnly}
                        subjectColor={subjectColor}
                      />
                    </>
                  ) : hasFillInBlanks(question.question_text) ? (
                    <FillInBlankRenderer
                      content={stripInlineMCQOptions(question.question_text, question.question_type)}
                      questionId={question.id}
                      answers={blankAnswers[question.id] || {}}
                      onAnswerChange={(blankId, value) => {
                        updateBlankAnswer(question.id, blankId, value);
                        // Trigger save after blank change
                        if (saveTimeouts.current[question.id]) {
                          clearTimeout(saveTimeouts.current[question.id]);
                        }
                        saveTimeouts.current[question.id] = setTimeout(() => {
                          handleSaveAnswer(question.id);
                        }, 1000);
                      }}
                      readOnly={isReadOnly}
                      subjectColor={subjectColor}
                    />
                  ) : (
                    <MathRenderer 
                      content={stripInlineMCQOptions(question.question_text, question.question_type)}
                      latex={(question as any).question_latex}
                      hasMath={(question as any).has_math}
                      className="mb-6 text-lg"
                    />
                  )}

                  {/* Mechanics diagram panel */}
                  {(() => {
                    const diagConfig = detectDiagramConfig(question.question_text);
                    if (!diagConfig) return null;
                    return <MechanicsFigurePanel config={diagConfig} />;
                  })()}

                  {/* Circuit diagram panel */}
                  {(() => {
                    const circuitConfig = detectCircuitConfig(question.question_text);
                    if (!circuitConfig) return null;
                    return <CircuitFigurePanel config={circuitConfig} />;
                  })()}

                  {/* Box Plot Chart rendering */}
                  {isBoxPlotQuestion((question as any).options) && (
                    <BoxPlotChart chartData={(question as any).options} className="mb-6" />
                  )}

                  {question.figure_urls && question.figure_urls.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {question.figure_urls.map((url, idx) => (
                        <img key={idx} src={url} alt={`Figure ${idx + 1}`} className="rounded-lg border w-full" />
                      ))}
                    </div>
                  )}

                  {/* Graph question rendering - same components as practice mode for feature parity */}
                  {(() => {
                    const graphData = parseGraphQuestionData(question.correct_answer || null);
                    const isGraphInterpretation = question.question_type === 'graph_interpretation' || graphData?.graphType === 'interpretation';
                    const isGraphPlotting = question.question_type === 'graph_plotting' || graphData?.graphType === 'plotting';
                    const isBearings = question.question_type === 'bearings' || graphData?.graphType === 'bearings';
                    const currentGraphAnswer = graphAnswers[question.id] || {};
                    
                    if (isBearings && graphData?.bearingsConfig) {
                      const config = graphData.bearingsConfig as BearingsQuestionConfig;
                      return (
                        <div className="space-y-4">
                          <BearingsQuestion
                            config={config}
                            value={currentGraphAnswer.bearingsAnswer || ''}
                            onChange={(value) => {
                              setGraphAnswers(prev => ({
                                ...prev,
                                [question.id]: { ...prev[question.id], bearingsAnswer: value }
                              }));
                              if (saveTimeouts.current[question.id]) {
                                clearTimeout(saveTimeouts.current[question.id]);
                              }
                              saveTimeouts.current[question.id] = setTimeout(() => {
                                handleSaveAnswer(question.id);
                              }, 1000);
                            }}
                            readOnly={isReadOnly}
                            showCorrectAnswers={false}
                          />
                        </div>
                      );
                    }
                    
                    if (isGraphInterpretation && graphData) {
                      const config = graphData.graphConfig as GraphInterpretationConfig;
                      const fields = graphData.interpretationFields || [];
                      return (
                        <div className="space-y-4">
                          <GraphInterpretationQuestion
                            config={config}
                            fields={fields}
                            answers={currentGraphAnswer.graphInterpretationAnswers || {}}
                            onAnswerChange={(newAnswers) => {
                              setGraphAnswers(prev => ({
                                ...prev,
                                [question.id]: { ...prev[question.id], graphInterpretationAnswers: newAnswers }
                              }));
                              if (saveTimeouts.current[question.id]) {
                                clearTimeout(saveTimeouts.current[question.id]);
                              }
                              saveTimeouts.current[question.id] = setTimeout(() => {
                                handleSaveAnswer(question.id);
                              }, 1000);
                            }}
                            readOnly={isReadOnly}
                            showCorrectAnswers={false}
                            subjectColor={subjectColor}
                          />
                        </div>
                      );
                    }
                    
                    if (isGraphPlotting && graphData) {
                      const config = graphData.graphConfig as GraphPlottingConfig;
                      const plottingAnswer = graphData.plottingAnswer;
                      return (
                        <div className="space-y-4">
                          <GraphPlottingQuestion
                            questionId={question.id}
                            config={{
                              ...config,
                              maxPoints: config.maxPoints === 1 ? undefined : config.maxPoints,
                              joinPointsMode: {
                                enabled: true,
                                graded: config.joinPointsMode?.graded,
                                correctMode: config.joinPointsMode?.correctMode,
                              }
                            }}
                            expectedAnswer={plottingAnswer || { expectedPoints: [], toleranceUnits: 0.5 }}
                            studentPoints={currentGraphAnswer.graphPlottedPoints || []}
                            showProtractor={showProtractor}
                            selectedSegmentIds={selectedSegmentIds}
                            onSelectedSegmentIdsChange={setSelectedSegmentIds}
                            onPointsChange={(points) => {
                              setGraphAnswers(prev => {
                                const existing = prev[question.id] || {};
                                return {
                                  ...prev,
                                  [question.id]: { ...existing, graphPlottedPoints: points }
                                };
                              });
                              if (saveTimeouts.current[question.id]) {
                                clearTimeout(saveTimeouts.current[question.id]);
                              }
                              saveTimeouts.current[question.id] = setTimeout(() => {
                                handleSaveAnswer(question.id);
                              }, 1000);
                            }}
                            joinMode={currentGraphAnswer.graphJoinMode}
                            onJoinModeChange={(mode) => {
                              setGraphAnswers(prev => {
                                const existing = prev[question.id] || {};
                                return {
                                  ...prev,
                                  [question.id]: { ...existing, graphJoinMode: mode }
                                };
                              });
                              if (saveTimeouts.current[question.id]) {
                                clearTimeout(saveTimeouts.current[question.id]);
                              }
                              saveTimeouts.current[question.id] = setTimeout(() => {
                                handleSaveAnswer(question.id);
                              }, 1000);
                            }}
                            segments={currentGraphAnswer.graphSegments || []}
                            onSegmentsChange={(segments) => {
                              setGraphAnswers(prev => {
                                const existing = prev[question.id] || {};
                                return {
                                  ...prev,
                                  [question.id]: { ...existing, graphSegments: segments }
                                };
                              });
                              if (saveTimeouts.current[question.id]) {
                                clearTimeout(saveTimeouts.current[question.id]);
                              }
                              saveTimeouts.current[question.id] = setTimeout(() => {
                                handleSaveAnswer(question.id);
                              }, 1000);
                            }}
                            drawnPaths={currentGraphAnswer.graphDrawnPaths || []}
                            onDrawnPathsChange={(paths) => {
                              setGraphAnswers(prev => {
                                const existing = prev[question.id] || {};
                                return {
                                  ...prev,
                                  [question.id]: { ...existing, graphDrawnPaths: paths }
                                };
                              });
                              if (saveTimeouts.current[question.id]) {
                                clearTimeout(saveTimeouts.current[question.id]);
                              }
                              saveTimeouts.current[question.id] = setTimeout(() => {
                                handleSaveAnswer(question.id);
                              }, 1000);
                            }}
                            readOnly={isReadOnly}
                            showCorrectAnswers={false}
                            subjectColor={subjectColor}
                            angleMeasurements={currentGraphAnswer.angleMeasurements || []}
                            onAngleMeasurementsChange={(measurements) => {
                              setGraphAnswers(prev => {
                                const existing = prev[question.id] || {};
                                return {
                                  ...prev,
                                  [question.id]: { ...existing, angleMeasurements: measurements }
                                };
                              });
                            }}
                            questionText={question.question_text}
                          />
                        </div>
                      );
                    }
                    
                    return null;
                  })()}

                  {/* Standard answer inputs for non-graph questions */}
                  {!(() => {
                    const graphData = parseGraphQuestionData(question.correct_answer || null);
                    return question.question_type === 'graph_interpretation' || 
                           question.question_type === 'graph_plotting' || 
                           question.question_type === 'bearings' ||
                           graphData?.graphType === 'interpretation' ||
                           graphData?.graphType === 'plotting' ||
                           graphData?.graphType === 'bearings';
                  })() && (
                    <>
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Your Answer</Label>
                        <Button
                          variant={activeQuestionForMath === question.id ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => setActiveQuestionForMath(
                            activeQuestionForMath === question.id ? null : question.id
                          )}
                          disabled={isReadOnly}
                          title="Math symbols"
                        >
                          <Calculator className="w-4 h-4" />
                        </Button>
                      </div>
                      <Textarea 
                        ref={(el) => { if (el) answerTextareaRefs.current[question.id] = el; }}
                        placeholder="Show your working and final answer here… (use the calculator icon for symbols)"
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
                        className={`${getAnswerBoxHeight(question.marks, true)} resize-y text-base font-mono transition-all text-foreground`}
                        disabled={isReadOnly}
                      />
                      {/* Docked Math Insert Keypad */}
                      {activeQuestionForMath === question.id && !isReadOnly && (
                        <MathInsertKeypad
                          isOpen={true}
                          onClose={() => setActiveQuestionForMath(null)}
                          onInsert={(text, caretOffset) => {
                            const textarea = answerTextareaRefs.current[question.id];
                            if (!textarea) return;
                            
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const currentValue = userAnswers[question.id]?.workingOut || '';
                            const before = currentValue.substring(0, start);
                            const after = currentValue.substring(end);
                            const newValue = before + text + after;
                            
                            updateAnswer(question.id, { workingOut: newValue });
                            
                            // Trigger save
                            if (saveTimeouts.current[question.id]) {
                              clearTimeout(saveTimeouts.current[question.id]);
                            }
                            saveTimeouts.current[question.id] = setTimeout(() => {
                              handleSaveAnswer(question.id);
                            }, 1000);
                            
                            // Restore focus and cursor (inside template if caretOffset provided)
                            requestAnimationFrame(() => {
                              textarea.focus();
                              const insertEnd = start + text.length;
                              const newPos = caretOffset ? insertEnd - caretOffset : insertEnd;
                              textarea.setSelectionRange(newPos, newPos);
                            });
                          }}
                          onNavigate={(direction) => {
                            const textarea = answerTextareaRefs.current[question.id];
                            if (!textarea) return;
                            const currentValue = userAnswers[question.id]?.workingOut || '';
                            const pos = textarea.selectionStart;
                            const newPos = direction === 'left' 
                              ? Math.max(0, pos - 1) 
                              : Math.min(currentValue.length, pos + 1);
                            textarea.focus();
                            textarea.setSelectionRange(newPos, newPos);
                          }}
                          onDelete={() => {
                            const textarea = answerTextareaRefs.current[question.id];
                            if (!textarea) return;
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const currentValue = userAnswers[question.id]?.workingOut || '';
                            
                            if (start === end && start > 0) {
                              const before = currentValue.substring(0, start - 1);
                              const after = currentValue.substring(end);
                              updateAnswer(question.id, { workingOut: before + after });
                              requestAnimationFrame(() => {
                                textarea.focus();
                                textarea.setSelectionRange(start - 1, start - 1);
                              });
                            } else if (start !== end) {
                              const before = currentValue.substring(0, start);
                              const after = currentValue.substring(end);
                              updateAnswer(question.id, { workingOut: before + after });
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
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-medium">Your Answer</Label>
                        <Button
                          variant={activeQuestionForMath === question.id ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => setActiveQuestionForMath(
                            activeQuestionForMath === question.id ? null : question.id
                          )}
                          disabled={isReadOnly}
                          title="Math symbols"
                        >
                          <Calculator className="w-4 h-4" />
                        </Button>
                      </div>
                      <Textarea 
                        ref={(el) => { if (el) answerTextareaRefs.current[question.id] = el; }}
                        placeholder="Type your answer here…"
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
                        className={`${getAnswerBoxHeight(question.marks, false)} resize-y text-base transition-all text-foreground`}
                        disabled={isReadOnly}
                      />
                      {/* Docked Math Insert Keypad */}
                      {activeQuestionForMath === question.id && !isReadOnly && (
                        <MathInsertKeypad
                          isOpen={true}
                          onClose={() => setActiveQuestionForMath(null)}
                          onInsert={(text, caretOffset) => {
                            const textarea = answerTextareaRefs.current[question.id];
                            if (!textarea) return;
                            
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const currentValue = userAnswers[question.id]?.finalAnswer || '';
                            const before = currentValue.substring(0, start);
                            const after = currentValue.substring(end);
                            const newValue = before + text + after;
                            
                            handleAnswerChange(question.id, newValue);
                            
                            // Restore focus and cursor (inside template if caretOffset provided)
                            requestAnimationFrame(() => {
                              textarea.focus();
                              const insertEnd = start + text.length;
                              const newPos = caretOffset ? insertEnd - caretOffset : insertEnd;
                              textarea.setSelectionRange(newPos, newPos);
                            });
                          }}
                          onNavigate={(direction) => {
                            const textarea = answerTextareaRefs.current[question.id];
                            if (!textarea) return;
                            const currentValue = userAnswers[question.id]?.finalAnswer || '';
                            const pos = textarea.selectionStart;
                            const newPos = direction === 'left' 
                              ? Math.max(0, pos - 1) 
                              : Math.min(currentValue.length, pos + 1);
                            textarea.focus();
                            textarea.setSelectionRange(newPos, newPos);
                          }}
                          onDelete={() => {
                            const textarea = answerTextareaRefs.current[question.id];
                            if (!textarea) return;
                            const start = textarea.selectionStart;
                            const end = textarea.selectionEnd;
                            const currentValue = userAnswers[question.id]?.finalAnswer || '';
                            
                            if (start === end && start > 0) {
                              const before = currentValue.substring(0, start - 1);
                              const after = currentValue.substring(end);
                              handleAnswerChange(question.id, before + after);
                              requestAnimationFrame(() => {
                                textarea.focus();
                                textarea.setSelectionRange(start - 1, start - 1);
                              });
                            } else if (start !== end) {
                              const before = currentValue.substring(0, start);
                              const after = currentValue.substring(end);
                              handleAnswerChange(question.id, before + after);
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
                      )}
                    </>
                  )}
                  </QuizQuestionErrorBoundary>
                </Card>
                  </div>
                );
              })}
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

      {/* Resource Viewer Modal */}
      <ResourceViewerModal
        open={selectedResource !== null}
        onClose={() => setSelectedResource(null)}
        item={selectedResource}
        subjectColor={subjectColor}
      />

      {/* Content Disclaimer Footer */}
      <div className="border-t border-border bg-muted/30 py-3 px-6 text-center">
        <p className="text-xs text-muted-foreground">
          Original AI-generated content for educational practice. Not affiliated with or endorsed by any official examination board.
        </p>
      </div>
    </div>
  );
};

export default ExamInProgress;
