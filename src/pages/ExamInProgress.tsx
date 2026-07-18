import { useState, useEffect, useRef, useCallback } from "react";
import { InsertPanel } from "@/components/insert/InsertPanel";
import { QuestionCardShell } from "@/components/quiz/QuestionCardShell";
import { AnswerSlate } from "@/components/quiz/AnswerSlate";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isQuantitativeSubject } from "@/lib/subjectKind";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NuclearEquationInput } from "@/components/nuclear/NuclearEquationInput";
import {
  isNuclearEquationQuestion,
  parseNuclearEquation,
  extractEquationFromQuestionText,
} from "@/components/nuclear/nuclear-equation-detector";
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
  GraphTransformationQuestion,
  BearingsQuestion,
  parseGraphQuestionData,
  parseGraphResponse,
  serializeGraphInterpretationResponse,
  serializeGraphPlottingResponse,
  serializeGraphTransformationResponse,
  serializeBearingsResponse,
  BoxPlotChart,
  isBoxPlotQuestion,
  HistogramChart,
  isHistogramQuestion,
  DataTableChart,
  isDataTableQuestion,
  BarChart,
  isBarChartQuestion,
  PieChart,
  isPieChartQuestion,
  CumulativeFrequencyChart,
  isCumulativeFrequencyQuestion,
  FrequencyPolygonChart,
  isFrequencyPolygonQuestion,
  ClimateChart,
  isClimateChartQuestion,
  LineChart,
  isLineChartQuestion,
  type GraphPoint,
  type GraphInterpretationConfig,
  type GraphPlottingConfig,
  type BearingsQuestionConfig,
  type LineSegment,
  type DrawingPath,
  type AngleMeasurement,
} from "@/components/graph";
import { MechanicsFigurePanel, detectDiagramConfig } from "@/components/mechanics";
import { getChartData, hasDataTableConfig } from "@/utils/chartData";
import { MultiDiagramOptionPanel } from "@/components/shared/MultiDiagramOptionPanel";
import { FigureChartTabs, hasFigureAndChart } from "@/components/shared/FigureChartTabs";
import { CircuitFigurePanel } from "@/components/circuit";
import { getCircuitConfig } from "@/components/circuit/getCircuitConfig";
import { BiologyFigurePanel, detectBiologyDiagram } from "@/components/biology";
import { EconomicsFigurePanel } from "@/components/economics/EconomicsFigurePanel";
import { MathsFigurePanel } from "@/components/maths";
import { PhysicsFigurePanel } from "@/components/physics";
import { DrawDiagramQuestion, detectDrawQuestion, DRAWING_PREFIX, isDrawingAnswer } from "@/components/drawing/DrawDiagramQuestion";
import { isPhysicsDrawOverride } from "@/components/drawing/physics-draw-override";
import type { DrawnElement } from "@/components/drawing/DrawingCanvas";
import { SelfMarkReviewModal, type DrawQuestionForReview } from "@/components/drawing/SelfMarkReviewModal";

// Helper to add opacity to hex color
const addOpacity = (hex: string, opacity: number): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Marks-adaptive answer box sizing
function getAnswerBoxHeight(marks: number, isMath: boolean, mobile = false): string {
  if (mobile) {
    if (marks <= 2) return isMath ? 'min-h-[100px]' : 'min-h-[90px]';
    if (marks <= 4) return isMath ? 'min-h-[150px]' : 'min-h-[130px]';
    if (marks <= 7) return isMath ? 'min-h-[200px]' : 'min-h-[180px]';
    return 'min-h-[240px]';
  }
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
  const [paperBlueprint, setPaperBlueprint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<Record<string, { workingOut: string; finalAnswer: string }>>({});
  const [tableAnswers, setTableAnswers] = useState<Record<string, Record<string, string | boolean>>>({});
  const [blankAnswers, setBlankAnswers] = useState<Record<string, Record<string, string>>>({});
  const [tableGridAnswers, setTableGridAnswers] = useState<Record<string, Record<string, number[]>>>({});
  
  // Graph question state - shared with practice mode for feature parity
  const [graphAnswers, setGraphAnswers] = useState<Record<string, {
    graphInterpretationAnswers?: Record<string, string | number | boolean>;
    graphPlottedPoints?: GraphPoint[];
    graphJoinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null;
    graphSegments?: LineSegment[];
    graphDrawnPaths?: DrawingPath[];
    graphBestFitLine?: { x1: number; y1: number; x2: number; y2: number } | null;
    bearingsAnswer?: string;
    angleMeasurements?: AngleMeasurement[];
    transformationAnswers?: Record<string, any>;
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
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [isMobileLayout, setIsMobileLayout] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [hideNavigation, setHideNavigation] = useState(false);
  const [existingAnswers, setExistingAnswers] = useState<any[]>([]);
  const [submission, setSubmission] = useState<any>(null);
  const [examSubject, setExamSubject] = useState<string>('');
  const examSubjectRef = useRef<string>(''); // Ref to avoid stale closures
  const [examName, setExamName] = useState<string>('');
  const [insertFigures, setInsertFigures] = useState<any[]>([]);
  const [examView, setExamView] = useState<'questions' | 'insert'>('questions');
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
  const [showSelfMarkReview, setShowSelfMarkReview] = useState(false);
  const [selfMarkScores, setSelfMarkScores] = useState<Record<string, number>>({});

  // Track which questions have unsaved drawing changes
  const [unsavedDrawingQuestions, setUnsavedDrawingQuestions] = useState<Set<string>>(new Set());
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<null | (() => void)>(null);
  // Synchronous mirror of unsavedDrawingQuestions to avoid stale-closure races
  const unsavedDrawingQuestionsRef = useRef<Set<string>>(new Set());
  const savedElementsRef = useRef<Record<string, DrawnElement[]>>({});

  const handleDrawingWorkingChange = useCallback((questionId: string, hasChanges: boolean) => {
    if (hasChanges) unsavedDrawingQuestionsRef.current.add(questionId);
    else unsavedDrawingQuestionsRef.current.delete(questionId);
    setUnsavedDrawingQuestions(prev => {
      const next = new Set(prev);
      if (hasChanges) next.add(questionId);
      else next.delete(questionId);
      return next;
    });
  }, []);

  // Intercept any navigation action; returns true if blocked by unsaved warning
  const guardNavigation = useCallback((action: () => void): boolean => {
    if (unsavedDrawingQuestionsRef.current.size > 0) {
      setPendingNavigation(() => action);
      setShowUnsavedWarning(true);
      return true;
    }
    action();
    return false;
  }, []);
  
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

  // Warn on tab close/refresh if there are unsaved drawing changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (unsavedDrawingQuestionsRef.current.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Track mobile layout
  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobileLayout(mobile);
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    setCurrentPage(0);
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
        .select('subject_id, title, resource_pack_id, insert_figures')
        .eq('id', examId)
        .single();
      
      if (examData) {
        setExamSubject(examData.subject_id || '');
        setExamName(examData.title || 'Exam in Progress');
        setInsertFigures(Array.isArray((examData as any).insert_figures) ? (examData as any).insert_figures : []);
        
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

      // Strip a leading "(b) " style marker from question text when it
      // duplicates the question's own letter — the sub-part badge shows it.
      const dedupedQuestions = sortedQuestions.map((q: any) => {
        const letter = String(q.question_number ?? '').match(/([a-z])\)?\s*$/i)?.[1]?.toLowerCase();
        if (letter && typeof q.question_text === 'string') {
          const pattern = new RegExp(`^\\s*\\(${letter}\\)\\s*`, 'i');
          if (pattern.test(q.question_text)) {
            return { ...q, question_text: q.question_text.replace(pattern, '') };
          }
        }
        return q;
      });

      // True dedupe: drop exact repeats (same number + same opening text) that
      // a non-idempotent publish may have stored. Keeps the first occurrence.
      const seenQ = new Set<string>();
      const uniqueQuestions = dedupedQuestions.filter((q: any) => {
        const key = `${q.question_number}|${String(q.question_text || '').slice(0, 80)}`;
        if (seenQ.has(key)) return false;
        seenQ.add(key);
        return true;
      });
      if (uniqueQuestions.length !== dedupedQuestions.length) {
        console.warn(`[Load] removed ${dedupedQuestions.length - uniqueQuestions.length} duplicate question row(s)`);
      }
      setPaperBlueprint((data as any).paperBlueprint ?? null);
      setQuestions(uniqueQuestions);
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
      const isMathExam = isQuantitativeSubject(examData?.subject_id);
      console.log('[Load] Subject:', examData?.subject_id, 'isMathExam:', isMathExam);
      
      const answersMap: Record<string, { workingOut: string; finalAnswer: string; answerLatex?: string }> = {};
      const tableAnswersMap: Record<string, Record<string, string | boolean>> = {};
      const tableGridAnswersMap: Record<string, Record<string, number[]>> = {};
      const graphAnswersMap: Record<string, {
        graphInterpretationAnswers?: Record<string, string | number | boolean>;
        graphPlottedPoints?: GraphPoint[];
        graphJoinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null;
        graphSegments?: LineSegment[];
        graphDrawnPaths?: DrawingPath[];
        graphBestFitLine?: { x1: number; y1: number; x2: number; y2: number } | null;
        bearingsAnswer?: string;
        angleMeasurements?: AngleMeasurement[];
        transformationAnswers?: Record<string, any>;
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
          if (parsed._type === 'graph_interpretation' || parsed._type === 'graph_plotting' || parsed._type === 'bearings' || parsed._type === 'graph_transformation') {
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
                  graphDrawnPaths: graphResponse.drawnPaths,
                  graphBestFitLine: graphResponse.bestFitLine ?? null,
                } as any;
              } else if (graphResponse._type === 'bearings') {
                graphAnswersMap[ans.question_id] = {
                  bearingsAnswer: String(graphResponse.bearing)
                };
              } else if (graphResponse._type === 'graph_transformation') {
                graphAnswersMap[ans.question_id] = {
                  transformationAnswers: (graphResponse as any).partAnswers || {}
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
          // Recover the split on reload: the serializer joins with a
          // "Final answer:" suffix — split it back so the final input
          // doesn't arrive empty after a refresh.
          const parts = answerText.split('\n\nFinal answer: ');
          answersMap[ans.question_id] = parts.length === 2
            ? { workingOut: parts[0], finalAnswer: parts[1] }
            : { workingOut: answerText, finalAnswer: '' };
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
    const isMathExam = isQuantitativeSubject(currentSubject);
    
    // Serialize based on exam type — combine Working + Final Answer when both provided
    const workingText = (answerData.workingOut || '').trim();
    const finalText = (answerData.finalAnswer || '').trim();
    let answerText: string;
    if (isMathExam) {
      // Math exam: primary field is working; append Final Answer when the split is used
      answerText = finalText
        ? (workingText ? `${workingText}\n\nFinal answer: ${finalText}` : finalText)
        : workingText;
    } else {
      // Non-math: prefer finalAnswer; include working when both are present (multi-mark split)
      answerText = workingText && finalText
        ? `${workingText}\n\nFinal answer: ${finalText}`
        : (finalText || workingText);
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
        if (questionGraphAnswers.transformationAnswers) {
          finalAnswerText = serializeGraphTransformationResponse(questionGraphAnswers.transformationAnswers as any);
        } else if (questionGraphAnswers.graphInterpretationAnswers) {
          finalAnswerText = serializeGraphInterpretationResponse(questionGraphAnswers.graphInterpretationAnswers);
        } else if (questionGraphAnswers.graphPlottedPoints) {
          finalAnswerText = serializeGraphPlottingResponse(
            questionGraphAnswers.graphPlottedPoints,
            questionGraphAnswers.graphJoinMode,
            questionGraphAnswers.graphSegments,
            questionGraphAnswers.graphDrawnPaths,
            (questionGraphAnswers as any).graphBestFitLine ?? null
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
    // Time is up — drop unsaved-drawing flags so submission isn't blocked
    unsavedDrawingQuestionsRef.current.clear();
    setUnsavedDrawingQuestions(new Set());
    setIsAutoSubmit(true);
    toast({ title: "Time's Up!", description: "Auto-submitting exam...", variant: "destructive" });
    submitExam();
  };

  // Retry logic with exponential backoff
  const submitExamWithRetry = async (
    selfMarkScores: Record<string, number> = {},
    maxRetries = 3,
  ): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('submit-exam', {
          body: { examId, timeTakenSeconds: timeElapsed, selfMarkScores }
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

  const submitExam = async (selfMarkScoresOverride?: Record<string, number>) => {
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

      // 3. Call submit edge function with retry, passing self-mark scores for drawing questions
      const scoresPayload = selfMarkScoresOverride ?? selfMarkScores;
      const data = await submitExamWithRetry(scoresPayload);

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
  // Choice sections ("answer TWO of the three") lower the number of answers
  // actually required — a student exercising their choice must not be warned.
  const requiredAnswerCount = (() => {
    const sections = paperBlueprint?.sections;
    if (!Array.isArray(sections) || sections.length === 0) return questions.length;
    const fromBlueprint = sections.reduce((n: number, s: any) => {
      const m = Array.isArray(s.questions) ? s.questions.length : 0;
      return n + (s.answerCount && s.answerCount < m ? s.answerCount : m);
    }, 0);
    // Sub-parts can make DB questions outnumber blueprint slots; never require
    // more than exist, and fall back cleanly if the shapes disagree.
    return Math.min(questions.length, Math.max(fromBlueprint, 1));
  })();
  const unansweredCount = Math.max(0, requiredAnswerCount - answeredCount);

  // Helper to extract parent question number (e.g., "1a" -> "1", "2b(i)" -> "2")
  const getParentQuestionNumber = (questionNumber: string): string => {
    return questionNumber.match(/^(\d+)/)?.[1] || questionNumber;
  };

  // Resolve each question's parent number sequentially: letter-only numbers
  // like "(b)" or "(c)" belong to the most recent numeric parent. Without
  // this they orphaned into single-question groups and rendered with the
  // full "Q1(c)" badge instead of a small "(c)" sub-part label.
  const resolvedParents = (() => {
    let last = '';
    return questions.map((q) => {
      const m = String(q.question_number ?? '').match(/^(\d+)/);
      if (m) { last = m[1]; return m[1]; }
      return last || String(q.question_number ?? '');
    });
  })();

  // Smart grouping: Keep consecutive MCQs together, group sub-questions (1a, 1b) together
  const groupedQuestions = questions.reduce((acc, question, index) => {
    const prevQuestion = index > 0 ? questions[index - 1] : null;
    const currentParent = resolvedParents[index];
    const prevParent = prevQuestion ? resolvedParents[index - 1] : null;
    
    // Determine if we should start a new group. Same-parent sub-questions
    // stay together even when their types differ (text part + sketch part).
    const shouldStartNewGroup = 
      index === 0 || // First question
      (question.question_type === 'mcq') !== (prevQuestion?.question_type === 'mcq') || // crossing MCQ boundary
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
      // Sub-questions like 1a, 1b — use the resolved numeric parent
      const firstIdx = questions.indexOf(firstQ);
      const parent = firstIdx >= 0 ? resolvedParents[firstIdx] : getParentQuestionNumber(firstQ.question_number);
      label = `Question ${parent}`;
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
        <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 h-14 lg:h-16 gap-2 lg:grid lg:grid-cols-3 max-w-none">
          {/* Left: Menu and Title */}
          <div className="flex items-center gap-2 min-w-0 flex-1 lg:flex-none">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden flex-shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-sm sm:text-base lg:text-xl font-bold truncate">{examName || 'Exam in Progress'}</h1>
          </div>
          
          {/* Center: Timer */}
          <div className="flex justify-center flex-shrink-0">
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
          <div className="flex items-center justify-end gap-2 lg:gap-4 flex-shrink-0">
            
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
                onQuitAndSave={() => guardNavigation(() => setShowQuitDialog(true))}
                onSubmitAll={() => guardNavigation(() => setShowSubmitDialog(true))}
                isReadOnly={isReadOnly}
                showProtractor={showProtractor}
                onToggleProtractor={() => setShowProtractor(prev => !prev)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile progress bar */}
      {isMobileLayout && (
        <div className="h-1 bg-muted lg:hidden sticky top-14 z-40">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%`,
              background: 'hsl(var(--primary))',
            }}
          />
        </div>
      )}

      <div className="flex flex-1">
        {/* Mobile overlay backdrop */}
        {isMobileLayout && sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar - Overlay on mobile, flex column on desktop */}
        <div className={`
          ${isMobileLayout
            ? `fixed top-0 left-0 h-full z-50 transition-transform duration-300 w-[280px]
               ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `relative transition-all duration-300
               ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`
          }
          border-r bg-card overflow-y-auto scrollbar-hide
          ${!isMobileLayout ? 'sticky top-16 h-[calc(100vh-4rem)]' : ''}
        `}>
          <div className="p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 h-full">
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
                              {subQuestions.map((q, subIdx) => {
                                const answerData = userAnswers[q.id];
                                const hasAnswer = Boolean(answerData?.finalAnswer?.trim() || answerData?.workingOut?.trim()) || Boolean(tableAnswers[q.id]) || Boolean(graphAnswers[q.id]);
                                const isFlagged = flaggedQuestions.has(q.id);
                                // Extract sub-label robustly: prefer any letter inside parens,
                                // fall back to alphabetical position when the tail is empty or "(".
                                const rawTail = q.question_number.replace(/^\d+/, '').trim();
                                const letterMatch = rawTail.match(/[a-z]/i);
                                const letter = letterMatch ? letterMatch[0].toLowerCase() : String.fromCharCode(97 + subIdx);
                                const subLabel = `(${letter})`;
                                
                                return (
                                  <button
                                    key={q.id}
                                    onClick={() => guardNavigation(async () => {
                                      await flushCurrentPageSaves();
                                      const groupIndex = questionGroups.findIndex(g => g.questions.some(question => question.id === q.id));
                                      if (groupIndex !== -1) {
                                        setCurrentPage(groupIndex);
                                        setTimeout(() => scrollToQuestion(q.id), 100);
                                      }
                                    })}
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
                                onClick={() => guardNavigation(async () => {
                                  await flushCurrentPageSaves();
                                  const groupIndex = questionGroups.findIndex(g => g.questions.some(question => question.id === q.id));
                                  if (groupIndex !== -1) {
                                    setCurrentPage(groupIndex);
                                    setTimeout(() => scrollToQuestion(q.id), 100);
                                  }
                                })}
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
                onClick={() => guardNavigation(() => setShowSubmitDialog(true))}
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
            <div className="flex items-center rounded-token-sm border border-border p-0.5 shrink-0 mr-2" role="tablist" aria-label="Exam view">
              <button
                role="tab"
                aria-selected={examView === 'questions'}
                onClick={() => setExamView('questions')}
                className={`px-3 py-1 rounded-[6px] text-xs font-medium transition-colors ${examView === 'questions' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Questions
              </button>
              <button
                role="tab"
                aria-selected={examView === 'insert'}
                onClick={() => setExamView('insert')}
                className={`px-3 py-1 rounded-[6px] text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${examView === 'insert' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Insert
                {insertFigures.length > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold tabular-nums ${examView === 'insert' ? 'bg-background/20' : 'bg-muted'}`}>
                    {insertFigures.length}
                  </span>
                )}
              </button>
            </div>
            <span className="text-sm text-muted-foreground shrink-0">
              {currentPage + 1} / {questionGroups.length}
            </span>
          </div>

          {/* Insert view — figures the questions reference */}
          {examView === 'insert' && (
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <InsertPanel figures={insertFigures} />
            </div>
          )}

          {/* Questions Container */}
          <div className={`flex-1 overflow-y-auto scrollbar-hide ${examView === 'insert' ? 'hidden' : ''}`}>
            <div className="container max-w-7xl py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-8 space-y-4 sm:space-y-6 lg:space-y-8 min-h-[calc(100vh-12rem)] flex flex-col justify-start">
              {currentGroup.questions.map((question, qIdx) => {
                // Determine if this is a sub-part (e.g., "1a", "2b") vs standalone ("1", "2")
                // In a multi-part group, EVERY question gets a clean letter label (a, b, c)
                // derived from its question_number suffix, or its position as fallback —
                // this normalises messy extracted numbers like "1", "1(b)", "(b)".
                const groupIsMultiPart = currentGroup.questions.length > 1 && question.question_type !== 'mcq';
                const numberStr = String(question.question_number ?? '');
                const letterMatch = numberStr.match(/([a-z])\)?\s*$/i);
                const parentNum = numberStr.match(/^\d+/)?.[0]
                  || String(currentGroup.questions[0]?.question_number ?? '').match(/^\d+/)?.[0]
                  || numberStr;
                const subPart = groupIsMultiPart
                  ? (letterMatch ? letterMatch[1].toLowerCase() : String.fromCharCode(97 + qIdx))
                  : '';
                const isSubPart = !!subPart;
                
                // Parent header only when the group title doesn't already show it (i.e. not the first card)
                const prevQuestion = qIdx > 0 ? currentGroup.questions[qIdx - 1] : null;
                const prevParent = prevQuestion ? String(prevQuestion.question_number ?? '').match(/^\d+/)?.[0] : null;
                const showParentHeader = isSubPart && qIdx > 0 && parentNum !== prevParent;
                
                return (
                  <div key={question.id} className={isSubPart ? 'ml-2' : ''}>
                    {/* Parent question header for first sub-part */}
                    {showParentHeader && (
                      <h2 className="text-lg lg:text-xl font-bold mb-3 lg:mb-4 mt-2">Question {parentNum}</h2>
                    )}
                    
                    <div ref={(el) => questionRefs.current[question.id] = el}>
                    <QuestionCardShell
                      parent={parentNum || String(question.question_number ?? '')}
                      part={isSubPart ? subPart : undefined}
                      subtopic={(question as any).subtopic}
                      marks={question.marks}
                      subjectColor={subjectColor}
                      active={true}
                      metadata={{
                        topic: (question as any).topic,
                        difficulty: (question as any).difficulty,
                      }}
                    >


                  <QuizQuestionErrorBoundary questionId={question.id}>
                  {/* Render question text - handle tick/X tables, tables, fill-in-blanks, or standard */}
                  {isTickXTable(ensureString(question.question_text)) ? (
                    <>
                      <MathRenderer 
                        content={extractTextBeforeTable(question.question_text)}
                        latex={(question as any).question_latex}
                        hasMath={(question as any).has_math}
                        className="mb-4 text-base sm:text-lg"
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
                        className="mb-4 text-base sm:text-lg"
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
                      content={hasDataTableConfig(question)
                        ? removeTableFromContent(stripInlineMCQOptions(question.question_text, question.question_type))
                        : stripInlineMCQOptions(question.question_text, question.question_type)}
                      latex={(question as any).question_latex}
                      hasMath={(question as any).has_math}
                      className="mb-4 sm:mb-6 text-base sm:text-lg"
                    />
                  )}

                  {/* Multi-diagram MCQ options (A/B/C/D) */}
                  {(question as any).diagram_config?.type === 'multi_option' &&
                    Array.isArray((question as any).diagram_config.diagrams) && (
                      <MultiDiagramOptionPanel diagrams={(question as any).diagram_config.diagrams} />
                    )}

                  {/* Mechanics diagram panel */}
                  {(() => {
                    const diagConfig = detectDiagramConfig(question.question_text);
                    if (!diagConfig) return null;
                    return <MechanicsFigurePanel config={diagConfig} isExam={true} />;
                  })()}

                  {/* Circuit diagram panel */}
                  {(() => {
                    const circuitConfig = getCircuitConfig(question, (question as any).subject ?? examSubject ?? '');
                    if (!circuitConfig) return null;
                    return <CircuitFigurePanel config={circuitConfig} />;
                  })()}

                  {/* Combined Figure + Data tab switcher when both exist */}
                  <FigureChartTabs question={question} isExam={true} />

                  {/* Biology diagram panel */}
                  {(() => {
                    if (hasFigureAndChart(question)) return null;
                    const bioConfig = detectBiologyDiagram(question.question_text, (question as any).subject);
                    if (!bioConfig) return null;
                    return <BiologyFigurePanel config={bioConfig} isExam={true} />;
                  })()}

                  <EconomicsFigurePanel
                    questionText={question.question_text ?? ''}
                    subject={(question as any).subject ?? ''}
                    diagramConfig={null}
                    isSubmitted={false}
                    isReview={false}
                    isExam={true}
                  />

                  <MathsFigurePanel
                    questionText={question.question_text ?? ''}
                    subject={(question as any).subject ?? ''}
                    diagramConfig={null}
                    isSubmitted={false}
                    isReview={false}
                    isExam={true}
                  />

                  <PhysicsFigurePanel
                    questionText={question.question_text ?? ''}
                    subject={(question as any).subject ?? ''}
                    diagramConfig={(question as any).diagram_config ?? null}
                    isSubmitted={false}
                    isReview={false}
                    isExam={true}
                  />

                  {/* Drawing canvas for economics/biology/physics diagram-draw questions */}
                  {(() => {
                    const physicsOverride = isPhysicsDrawOverride(
                      question.question_text,
                      (question as any).subject,
                      question.question_type,
                    );
                    const isGraphType =
                      (question.question_type === 'graph_plotting' ||
                       question.question_type === 'graph_interpretation' ||
                       question.question_type === 'graph_transformation' ||
                       question.question_type === 'bearings') &&
                      !physicsOverride;
                    if (isGraphType) return null;
                    const drawInfo = detectDrawQuestion(
                      question.question_text ?? '',
                      (question as any).subject ?? '',
                      question.question_type,
                    );
                    if (!drawInfo.needsDrawingCanvas) return null;
                    return (
                      <DrawDiagramQuestion
                        key={question.id}
                        questionText={question.question_text ?? ''}
                        subject={(question as any).subject ?? ''}
                        questionType={question.question_type}
                        totalMarks={question.marks ?? 4}
                        isExam={true}
                        savedDrawingDataUrl={userAnswers[question.id]?.workingOut || userAnswers[question.id]?.finalAnswer || ''}
                        initialElements={savedElementsRef.current[question.id] ?? []}
                        onSave={(url) => {
                          updateAnswer(question.id, { workingOut: url, finalAnswer: url });
                          if (saveTimeouts.current[question.id]) {
                            clearTimeout(saveTimeouts.current[question.id]);
                          }
                          handleSaveAnswer(question.id);
                        }}
                        onSaveWithElements={(_url, els) => {
                          savedElementsRef.current[question.id] = els;
                        }}
                        onUnsavedChanges={(hasChanges) =>
                          handleDrawingWorkingChange(question.id, hasChanges)
                        }
                      />
                    );
                  })()}

                  {/* Chart rendering — reads from diagram_config first, falls back to options */}
                  {(() => {
                    if (hasFigureAndChart(question)) return null;
                    const chartData = getChartData(question);
                    if (!chartData) return null;
                    return (
                      <>
                        {isBoxPlotQuestion(chartData) && (
                          <BoxPlotChart chartData={chartData} className="mb-6" />
                        )}
                        {isHistogramQuestion(chartData) && (
                          <HistogramChart chartData={chartData} className="mb-6" />
                        )}
                        {isDataTableQuestion(chartData) && (
                          <DataTableChart chartData={chartData} className="mb-6" />
                        )}
                        {isBarChartQuestion(chartData) && (
                          <BarChart chartData={chartData} className="mb-6" />
                        )}
                        {isPieChartQuestion(chartData) && (
                          <PieChart chartData={chartData} className="mb-6" />
                        )}
                        {isCumulativeFrequencyQuestion(chartData) && (
                          <CumulativeFrequencyChart chartData={chartData} className="mb-6" />
                        )}
                        {isFrequencyPolygonQuestion(chartData) && (
                          <FrequencyPolygonChart chartData={chartData} className="mb-6" />
                        )}
                        {isClimateChartQuestion(chartData) && (
                          <ClimateChart chartData={chartData} className="mb-6" />
                        )}
                        {isLineChartQuestion(chartData) && (
                          <LineChart chartData={chartData} className="mb-6" />
                        )}
                      </>
                    );
                  })()}


                  {question.figure_urls && question.figure_urls.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {question.figure_urls.map((url, idx) => (
                        <img key={idx} src={url} alt={`Figure ${idx + 1}`} className="rounded-lg border w-full" />
                      ))}
                    </div>
                  )}

                  {/* Graph question rendering - same components as practice mode for feature parity */}
                  {(() => {
                    const graphData = parseGraphQuestionData(
                      question.correct_answer || null,
                      (question as any).diagram_config ?? null,
                      question.question_type ?? null,
                    );
                    const physicsOverride = isPhysicsDrawOverride(
                      question.question_text,
                      (question as any).subject,
                      question.question_type,
                    );
                    const isGraphInterpretation = !physicsOverride && (question.question_type === 'graph_interpretation' || graphData?.graphType === 'interpretation');
                    const isGraphPlotting = !physicsOverride && (question.question_type === 'graph_plotting' || graphData?.graphType === 'plotting');
                    const isBearings = !physicsOverride && (question.question_type === 'bearings' || graphData?.graphType === 'bearings');
                    const isGraphTransformation = question.question_type === 'graph_transformation' || graphData?.graphType === 'transformation';
                    const currentGraphAnswer = graphAnswers[question.id] || {};
                    
                    if (isGraphTransformation && graphData?.transformationConfig) {
                      return (
                        <div className="space-y-4">
                          <GraphTransformationQuestion
                            config={graphData.transformationConfig as any}
                            answers={currentGraphAnswer.transformationAnswers || {}}
                            onAnswerChange={(partId, partAnswer) => {
                              setGraphAnswers(prev => {
                                const existing = prev[question.id] || {};
                                const merged = { ...(existing.transformationAnswers || {}), [partId]: partAnswer };
                                return { ...prev, [question.id]: { ...existing, transformationAnswers: merged } };
                              });
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
                        </div>
                      );
                    }
                    
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
                            bestFitLine={(currentGraphAnswer as any).graphBestFitLine ?? null}
                            onBestFitLineChange={(line) => {
                              setGraphAnswers(prev => {
                                const existing = prev[question.id] || {};
                                return {
                                  ...prev,
                                  [question.id]: { ...existing, graphBestFitLine: line } as any
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
                    const physicsOverride = isPhysicsDrawOverride(
                      question.question_text,
                      (question as any).subject,
                      question.question_type,
                    );
                    if (physicsOverride) return false;
                    const graphData = parseGraphQuestionData(
                      question.correct_answer || null,
                      (question as any).diagram_config ?? null,
                      question.question_type ?? null,
                    );
                    return question.question_type === 'graph_interpretation' || 
                           question.question_type === 'graph_plotting' || 
                           question.question_type === 'graph_transformation' ||
                           question.question_type === 'bearings' ||
                           graphData?.graphType === 'interpretation' ||
                           graphData?.graphType === 'plotting' ||
                           graphData?.graphType === 'transformation' ||
                           graphData?.graphType === 'bearings';
                  })() && !detectDrawQuestion(question.question_text ?? '', (question as any).subject ?? '', question.question_type).needsDrawingCanvas && (
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
                                className={`flex items-center space-x-3 px-3 py-2.5 sm:p-4 rounded-lg border-2 transition-all cursor-pointer min-h-[44px] ${
                                  isSelected ? '' : 'border-border hover:bg-accent'
                                }`}
                                style={isSelected ? {
                                  borderColor: subjectColor,
                                  backgroundColor: addOpacity(subjectColor, 0.1)
                                } : undefined}
                              >
                                <RadioGroupItem value={optionLetter} id={`${question.id}-${idx}`} />
                                <Label htmlFor={`${question.id}-${idx}`} className="flex-1 cursor-pointer text-base sm:text-lg">
                                  <span className="font-medium mr-2">{optionLetter})</span>
                                  <MathRenderer 
                                    content={option.replace(/^[A-Da-d][.)]\s*/, '')} 
                                    hasMath={question.has_math}
                                    inline={true}
                                  />
                                </Label>
                              </div>
                            );
                          })}
                        </RadioGroup>
                      ) : isNuclearEquationQuestion(question.question_text ?? '') && extractEquationFromQuestionText(question.question_text ?? '') ? (() => {
                          const eq = extractEquationFromQuestionText(question.question_text ?? '')!;
                          const data = parseNuclearEquation(eq, question.correct_answer);
                          if (data.blankCount === 0) return null;
                          return (
                            <div className="space-y-2">
                              <Label className="text-base font-medium">Your Answer</Label>
                              <NuclearEquationInput
                                terms={data.terms}
                                correctAnswer={data.correctAnswer}
                                disabled={isReadOnly}
                                onAnswerChange={(answer) => handleAnswerChange(question.id, answer)}
                              />
                            </div>
                          );
                        })() : (() => {
                    // ─── Unified default answer surface (text + math text-based subjects) ───
                    // MCQ / nuclear / graph / drawing / table / physics-override branches are
                    // handled elsewhere and stay in their current shells until a focused audit.
                    const isMathExam = isQuantitativeSubject(examSubject);
                    // Split ONLY for quantitative subjects — an English/History
                    // 5-marker is one continuous piece of writing, and forcing
                    // the split here previously corrupted the save/load round
                    // trip (essay saved via workingOut, reloaded into finalAnswer).
                    const useSplit = isMathExam && (question.marks ?? 0) >= 3;
                    const answer = userAnswers[question.id] || { workingOut: '', finalAnswer: '' };
                    // When split is active: workingSlot writes to workingOut, finalSlot to finalAnswer
                    // When no split: single input writes to finalAnswer (non-math) or workingOut (math short)
                    const primaryField: 'workingOut' | 'finalAnswer' = useSplit
                      ? 'workingOut'
                      : (isMathExam ? 'workingOut' : 'finalAnswer');
                    const primaryValue = primaryField === 'workingOut' ? answer.workingOut : answer.finalAnswer;

                    const setField = (field: 'workingOut' | 'finalAnswer', val: string) => {
                      if (field === 'finalAnswer' && !useSplit) {
                        handleAnswerChange(question.id, val);
                        return;
                      }
                      updateAnswer(question.id, { [field]: val });
                      if (saveTimeouts.current[question.id]) clearTimeout(saveTimeouts.current[question.id]);
                      saveTimeouts.current[question.id] = setTimeout(() => handleSaveAnswer(question.id), 1000);
                    };

                    const workingSlot = (
                      <Textarea
                        ref={(el) => { if (el) answerTextareaRefs.current[question.id] = el; }}
                        placeholder={useSplit ? "Show your working…" : "Type your answer here…"}
                        value={primaryValue || ''}
                        onChange={(e) => setField(primaryField, e.target.value)}
                        onFocus={(e) => {
                          e.target.style.borderColor = subjectColor;
                        }}
                        onBlur={async (e) => {
                          e.target.style.borderColor = '';
                          if (saveTimeouts.current[question.id]) clearTimeout(saveTimeouts.current[question.id]);
                          await handleSaveAnswer(question.id);
                        }}
                        className={`${getAnswerBoxHeight(question.marks, isMathExam, isMobileLayout)} resize-y text-[15px] leading-[1.6] transition-colors text-foreground bg-background`}
                        disabled={isReadOnly}
                      />
                    );

                    const finalSlot = useSplit ? (
                      <Input
                        value={answer.finalAnswer || ''}
                        onChange={(e) => {
                          updateAnswer(question.id, { finalAnswer: e.target.value });
                          if (saveTimeouts.current[question.id]) clearTimeout(saveTimeouts.current[question.id]);
                          saveTimeouts.current[question.id] = setTimeout(() => handleSaveAnswer(question.id), 1000);
                        }}
                        onBlur={async () => {
                          if (saveTimeouts.current[question.id]) clearTimeout(saveTimeouts.current[question.id]);
                          await handleSaveAnswer(question.id);
                        }}
                        onFocus={(e) => { e.target.style.borderColor = subjectColor; }}
                        placeholder="Enter your final answer"
                        disabled={isReadOnly}
                        className="text-[15px] font-medium bg-background"
                      />
                    ) : undefined;

                    const keypadSlot = activeQuestionForMath === question.id && !isReadOnly ? (
                      <MathInsertKeypad
                        isOpen={true}
                        onClose={() => setActiveQuestionForMath(null)}
                        onInsert={(text, caretOffset) => {
                          const textarea = answerTextareaRefs.current[question.id];
                          if (!textarea) return;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const current = primaryField === 'workingOut' ? (answer.workingOut || '') : (answer.finalAnswer || '');
                          const newValue = current.substring(0, start) + text + current.substring(end);
                          setField(primaryField, newValue);
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
                          const current = primaryField === 'workingOut' ? (answer.workingOut || '') : (answer.finalAnswer || '');
                          const pos = textarea.selectionStart;
                          const newPos = direction === 'left' ? Math.max(0, pos - 1) : Math.min(current.length, pos + 1);
                          textarea.focus();
                          textarea.setSelectionRange(newPos, newPos);
                        }}
                        onDelete={() => {
                          const textarea = answerTextareaRefs.current[question.id];
                          if (!textarea) return;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const current = primaryField === 'workingOut' ? (answer.workingOut || '') : (answer.finalAnswer || '');
                          if (start === end && start > 0) {
                            setField(primaryField, current.substring(0, start - 1) + current.substring(end));
                            requestAnimationFrame(() => {
                              textarea.focus();
                              textarea.setSelectionRange(start - 1, start - 1);
                            });
                          } else if (start !== end) {
                            setField(primaryField, current.substring(0, start) + current.substring(end));
                            requestAnimationFrame(() => {
                              textarea.focus();
                              textarea.setSelectionRange(start, start);
                            });
                          }
                        }}
                        subjectColor={subjectColor}
                      />
                    ) : undefined;

                    return (
                      <div className="mt-4">
                        {isMathExam && (
                        <div className="flex justify-end mb-2">
                          <Button
                            variant={activeQuestionForMath === question.id ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setActiveQuestionForMath(
                              activeQuestionForMath === question.id ? null : question.id
                            )}
                            disabled={isReadOnly}
                            className="rounded-token-sm gap-1.5 text-xs h-8"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            Math symbols
                          </Button>
                        </div>
                        )}
                        <AnswerSlate
                          marks={question.marks}
                          mode="text"
                          onModeChange={() => {}}
                          showModeToggle={false}
                          workingSlot={workingSlot}
                          finalSlot={finalSlot}
                          keypadSlot={keypadSlot}
                        />
                      </div>
                    );
                  })()}
                    </>
                  )}
                  </QuizQuestionErrorBoundary>
                </QuestionCardShell>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Navigation — section-level, aligned with practice workspace radius/typography */}
          <div className="border-t border-border bg-background/80 backdrop-blur-sm px-3 sm:px-4 lg:px-6 py-3 sm:py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              className="rounded-token-sm px-3 sm:px-5 min-h-[44px] text-foreground hover:bg-muted"
              onClick={() => guardNavigation(async () => {
                await flushCurrentPageSaves();
                setCurrentPage(prev => prev - 1);
              })}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline ml-1.5 font-medium">Previous section</span>
            </Button>

            <span className="text-[11px] uppercase tracking-wider text-muted-foreground tabular-nums hidden sm:inline">
              Section {currentPage + 1} of {questionGroups.length}
            </span>

            {hasNextPage ? (
              <Button
                className="rounded-token-sm px-4 sm:px-5 min-h-[44px] font-semibold bg-foreground text-background hover:bg-foreground/90"
                onClick={() => guardNavigation(async () => {
                  await flushCurrentPageSaves();
                  setCurrentPage(prev => prev + 1);
                })}
              >
                <span className="hidden sm:inline mr-1.5">Next section</span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </Button>
            ) : !isReadOnly && (
              <Button
                className="rounded-token-sm px-4 sm:px-6 min-h-[44px] font-semibold"
                style={{ backgroundColor: subjectColor, color: '#fff' }}
                onClick={() => guardNavigation(() => setShowSubmitDialog(true))}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit exam
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
                    You have <strong>{unansweredCount}</strong> required question{unansweredCount > 1 ? 's' : ''} still unanswered{requiredAnswerCount < questions.length ? ` (this paper requires ${requiredAnswerCount} of its ${questions.length} questions)` : ''}. 
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
              onClick={() => {
                const drawQs: DrawQuestionForReview[] = questions
                  .filter(q => {
                    const ans = userAnswers[q.id];
                    const stored = ans?.workingOut || ans?.finalAnswer || '';
                    return isDrawingAnswer(stored) || (
                      detectDrawQuestion(q.question_text ?? '', (q as any).subject ?? '', q.question_type).needsDrawingCanvas
                    );
                  })
                  .map(q => ({
                    id: q.id,
                    questionText: q.question_text ?? '',
                    subject: (q as any).subject ?? '',
                    questionType: q.question_type,
                    marks: q.marks ?? 4,
                    studentDrawingDataUrl: userAnswers[q.id]?.workingOut || userAnswers[q.id]?.finalAnswer || '',
                  }));
                if (drawQs.length > 0) {
                  setShowSubmitDialog(false);
                  setShowSelfMarkReview(true);
                } else {
                  submitExam();
                }
              }}
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

      {/* Unsaved diagram warning */}
      {showUnsavedWarning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <div style={{
            background: 'hsl(var(--card))', borderRadius: 14, padding: 24,
            maxWidth: 400, width: '100%',
            boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'hsl(25 95% 53% / 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <AlertCircle className="h-5 w-5" style={{ color: 'hsl(25 95% 53%)' }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 8 }}>
              You have an unsaved diagram
            </div>
            <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', lineHeight: 1.6, marginBottom: 20 }}>
              You have drawn a diagram for this question but have not saved it yet. Your diagram will not be included in your submission if you leave without saving. This cannot be undone.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => {
                  setShowUnsavedWarning(false);
                  setPendingNavigation(null);
                }}
                style={{
                  width: '100%', padding: '11px',
                  background: 'hsl(var(--primary))', border: 'none', borderRadius: 8,
                  color: 'hsl(var(--primary-foreground))',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Go back and save my diagram
              </button>
              <button
                onClick={() => {
                  // Drop unsaved flags so this navigation can complete
                  unsavedDrawingQuestionsRef.current.clear();
                  setUnsavedDrawingQuestions(new Set());
                  setShowUnsavedWarning(false);
                  if (pendingNavigation) pendingNavigation();
                  setPendingNavigation(null);
                }}
                style={{
                  width: '100%', padding: '11px',
                  background: 'transparent',
                  border: '1px solid hsl(var(--border))', borderRadius: 8,
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Leave without saving — my diagram will be lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Self-mark review for diagram questions before submission */}
      {showSelfMarkReview && (
        <SelfMarkReviewModal
          questions={questions
            .filter(q => {
              const ans = userAnswers[q.id];
              const stored = ans?.workingOut || ans?.finalAnswer || '';
              return isDrawingAnswer(stored) || (
                detectDrawQuestion(q.question_text ?? '', (q as any).subject ?? '', q.question_type).needsDrawingCanvas
              );
            })
            .map(q => ({
              id: q.id,
              questionText: q.question_text ?? '',
              subject: (q as any).subject ?? '',
              questionType: q.question_type,
              marks: q.marks ?? 4,
              studentDrawingDataUrl: userAnswers[q.id]?.workingOut || userAnswers[q.id]?.finalAnswer || '',
            }))}
          onComplete={async (scores) => {
            setSelfMarkScores(scores);
            setShowSelfMarkReview(false);
            // Pass scores directly — state update is async and submitExam needs them now
            await submitExam(scores);
          }}
          onDismiss={() => setShowSelfMarkReview(false)}
        />
      )}

      {/* Resource Viewer Modal */}
      <ResourceViewerModal
        open={selectedResource !== null}
        onClose={() => setSelectedResource(null)}
        item={selectedResource}
        subjectColor={subjectColor}
      />

      {/* Content Disclaimer Footer */}
      <div className="border-t border-border bg-muted/30 py-2 sm:py-3 px-3 sm:px-6 text-center">
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          Original AI-generated content for educational practice. Not affiliated with or endorsed by any official examination board.
        </p>
      </div>
    </div>
  );
};

export default ExamInProgress;
