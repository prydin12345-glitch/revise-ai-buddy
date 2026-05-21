/**
 * TakePracticeQuiz - Practice quiz taking and review component
 * 
 * REGRESSION CHECKLIST (after UI fixes 2026-01-09):
 * ✅ Review mode: no timer/menu/submit buttons shown
 * ✅ Review mode: footer shows Previous | Exit Review | Next
 * ✅ Review mode: sidebar shows "Exit Review" instead of "Submit All"
 * ✅ Review mode badge displayed in header
 * ✅ Toast auto-dismisses after 8s and has close button
 * ✅ All answers + graphs/tables rehydrate correctly from stored data
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NuclearEquationInput } from "@/components/nuclear/NuclearEquationInput";
import {
  isNuclearEquationQuestion,
  parseNuclearEquation,
  extractEquationFromQuestionText,
} from "@/components/nuclear/nuclear-equation-detector";
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
  Calculator,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from "lucide-react";
import { MathRenderer } from "@/components/MathRenderer";
import { MathInsertKeypad, normalizeUnicodeForGrading } from "@/components/quiz/MathInsertKeypad";
import { useTextareaInsert } from "@/hooks/useTextareaInsert";
import { QuestionOptionsMenu } from "@/components/quiz/QuestionOptionsMenu";
import { OnDemandRationaleBox } from "@/components/quiz/OnDemandRationaleBox";
import { 
  TableGridQuestion, 
  parseMarkdownToTableGrid,
  isTickXTable,
  serializeTableGridAnswer,
  deserializeTableGridAnswers,
  parseStoredTableGridAnswer,
  type TableGridData 
} from "@/components/exam/TableGridQuestion";
import {
  GraphInterpretationQuestion,
  GraphPlottingQuestion,
  GraphTransformationQuestion,
  BearingsQuestion,
  ReferenceDiagram,
  extractFunctionFromText,
  generateCurveFromExpression,
  parseGraphQuestionData,
  parseGraphResponse,
  serializeGraphInterpretationResponse,
  serializeGraphPlottingResponse,
  serializeGraphTransformationResponse,
  serializeBearingsResponse,
  type GraphQuestionData,
  type GraphPoint,
  type GraphInterpretationConfig,
  type GraphPlottingConfig,
  type GraphPlottingAnswer,
  type GraphInterpretationField,
  type BearingsQuestionConfig,
  type BearingsMarkingResult,
  type GraphSeries,
} from "@/components/graph";
import { generateCurveFromFormula, parseTransformFromQuestionText, applyFormulaTransform } from "@/lib/formula-evaluator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ResourcePack, ResourceItem } from "@/components/practice/ResourcePackUploader";
import { QuizQuestionErrorBoundary } from "@/components/quiz/QuizQuestionErrorBoundary";
import { MechanicsFigurePanel, detectDiagramConfig } from "@/components/mechanics";
import { CircuitFigurePanel } from "@/components/circuit";
import { getCircuitConfig } from "@/components/circuit/getCircuitConfig";
import { BiologyFigurePanel, detectBiologyDiagram } from "@/components/biology";
import { EconomicsFigurePanel } from "@/components/economics/EconomicsFigurePanel";
import { MathsFigurePanel } from "@/components/maths";
import { PhysicsFigurePanel } from "@/components/physics";
import { DrawDiagramQuestion, detectDrawQuestion, getDrawingDataUrl } from "@/components/drawing/DrawDiagramQuestion";
import { isPhysicsDrawOverride } from "@/components/drawing/physics-draw-override";
import { SelfMarkReviewModal, type DrawQuestionForReview } from "@/components/drawing/SelfMarkReviewModal";
import type { DrawnElement } from "@/components/drawing/DrawingCanvas";
import { BoxPlotChart, isBoxPlotQuestion } from "@/components/graph/BoxPlotChart";
import { HistogramChart, isHistogramQuestion } from "@/components/graph/HistogramChart";
import { DataTableChart, isDataTableQuestion } from "@/components/graph/DataTableChart";
import {
  BarChart, isBarChartQuestion,
  PieChart, isPieChartQuestion,
  CumulativeFrequencyChart, isCumulativeFrequencyQuestion,
  FrequencyPolygonChart, isFrequencyPolygonQuestion,
  ClimateChart, isClimateChartQuestion,
} from "@/components/graph";
import { getChartData } from "@/utils/chartData";
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
  rationale?: string;
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
  // Graph question answers
  graphInterpretationAnswers?: Record<string, string | number | boolean>;
  graphPlottedPoints?: GraphPoint[];
  graphJoinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null; // Join mode for plotting questions (angle is for measurement only)
  graphSegments?: Array<{ id: string; from: GraphPoint; to: GraphPoint; mode: 'straight' | 'curved'; controlPoint?: GraphPoint }>; // Persisted line segments with optional control point
  graphDrawnPaths?: Array<{ id: string; dataPoints: Array<{ x: number; y: number }>; points?: Array<{ pixelX: number; pixelY: number }> }>; // Freeform drawn paths (dataPoints is canonical, points is legacy)
  graphBestFitLine?: { x1: number; y1: number; x2: number; y2: number } | null; // Student-drawn line of best fit
  graphMarkingData?: {
    perFieldResults?: Record<string, { correct: boolean; earned: number; max: number; studentAnswer: any; correctAnswer: any; status: 'correct' | 'incorrect' | 'missed' }>;
    perPointResults?: Array<{ studentPoint?: GraphPoint; expectedPoint: GraphPoint; matched: boolean; distance?: number; status: 'correct' | 'incorrect' | 'missed' }>;
  };
  // Bearings question answers
  bearingsAnswer?: string;
  bearingsMarkingData?: BearingsMarkingResult;
  // Protractor state for persistence
  protractorState?: { x: number; y: number; rotationDeg: number; visible: boolean };
}

const GRAPH_QUESTION_TYPES = new Set(['graph_interpretation', 'graph_plotting', 'bearings', 'graph_transformation']);

const looksLikeGraphJson = (value?: string | null) => {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.startsWith('{') && trimmed.includes('"graphType"');
};

const shouldParseGraphData = (
  questionType?: string,
  correctAnswer?: string | null,
  diagramConfig?: any | null,
) => {
  if (questionType && GRAPH_QUESTION_TYPES.has(questionType)) return true;
  if (looksLikeGraphJson(correctAnswer)) return true;
  if (diagramConfig && typeof diagramConfig === 'object') {
    if (diagramConfig.graphType || diagramConfig.plottingAnswer || diagramConfig.interpretationFields) return true;
  }
  return false;
};

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
  const [unsavedDrawingQuestions, setUnsavedDrawingQuestions] = useState<Set<string>>(new Set());
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<null | (() => void)>(null);
  const unsavedDrawingQuestionsRef = useRef<Set<string>>(new Set());
  const savedElementsRef = useRef<Record<string, DrawnElement[]>>({});
  const handleDrawingWorkingChange = useCallback((qid: string, hasChanges: boolean) => {
    if (hasChanges) unsavedDrawingQuestionsRef.current.add(qid);
    else unsavedDrawingQuestionsRef.current.delete(qid);
    setUnsavedDrawingQuestions(prev => {
      const n = new Set(prev);
      if (hasChanges) n.add(qid); else n.delete(qid);
      return n;
    });
  }, []);

  // Persist drawing answer to DB so it survives reload / next-day return
  const persistDrawingAnswer = useCallback(async (questionId: string, prefixedUrl: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !setId) return;
      const { error } = await supabase
        .from('practice_question_answers')
        .upsert({
          user_id: user.id,
          set_id: setId,
          question_id: questionId,
          answer_text: prefixedUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,question_id' });
      if (error) console.error('[Drawing] Failed to persist:', error);
    } catch (e) {
      console.error('[Drawing] Persist exception:', e);
    }
  }, [setId]);

  const persistDrawingScore = useCallback(async (questionId: string, score: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !setId) return;
      const { error } = await supabase
        .from('practice_question_answers')
        .upsert({
          user_id: user.id,
          set_id: setId,
          question_id: questionId,
          score,
          is_correct: score > 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,question_id' });
      if (error) console.error('[Drawing] Failed to persist score:', error);
    } catch (e) {
      console.error('[Drawing] Persist score exception:', e);
    }
  }, [setId]);

  const handleDrawingScoreChange = useCallback((questionId: string, score: number) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] ?? { answer: '', submitted: false }),
        score,
        submitted: true,
        isCorrect: score > 0,
      },
    }));
    persistDrawingScore(questionId, score);
  }, [persistDrawingScore]);

  // Self-mark gate state for Submit All
  const [showPracticeSelfMarkModal, setShowPracticeSelfMarkModal] = useState(false);
  const [practiceDrawQuestionsForReview, setPracticeDrawQuestionsForReview] = useState<DrawQuestionForReview[]>([]);
  const pendingSubmitAllRef = useRef(false);

  const finaliseSubmitAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: allAnswers } = await supabase
        .from('practice_question_answers')
        .select('score, is_correct')
        .eq('user_id', user.id)
        .eq('set_id', setId);

      const questionsAttempted = allAnswers?.length || 0;
      const questionsCorrect = allAnswers?.filter(a => a.is_correct).length || 0;

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
      }, { onConflict: 'user_id,set_id' });

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

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.functions.invoke('update-study-streak', {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
        }
      } catch (streakError) {
        console.error("Streak update error:", streakError);
      }
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit quiz");
    }
    setShowResults(true);
  }, [setId, timeElapsed]);

  const handleSubmitAll = useCallback(async () => {
    // Find drawing questions saved but not self-marked, and ones with no drawing
    const unmarkedDrawingQuestions: DrawQuestionForReview[] = [];
    const undrawnDrawingQuestionIds: string[] = [];

    for (const q of questions) {
      const needsCanvas = detectDrawQuestion(
        q.question_text ?? '',
        (q as any).subject ?? '',
        q.question_type,
      ).needsDrawingCanvas;
      if (!needsCanvas) continue;

      const ans = userAnswers[q.id];
      const stored = ans?.workingOut ?? '';
      const hasDrawing = stored.startsWith('drawing:');
      const hasScore = ans?.score !== undefined && ans?.score !== null;

      if (hasDrawing && !hasScore) {
        unmarkedDrawingQuestions.push({
          id: q.id,
          questionText: q.question_text ?? '',
          subject: (q as any).subject ?? '',
          questionType: q.question_type,
          marks: q.marks ?? 4,
          studentDrawingDataUrl: stored,
        });
      } else if (!hasDrawing) {
        undrawnDrawingQuestionIds.push(q.id);
      }
    }

    if (unmarkedDrawingQuestions.length > 0) {
      setPracticeDrawQuestionsForReview(unmarkedDrawingQuestions);
      pendingSubmitAllRef.current = true;
      setShowPracticeSelfMarkModal(true);
      return;
    }

    // Drawings the student never started: persist a 0 so they're counted in totals
    for (const qid of undrawnDrawingQuestionIds) {
      await persistDrawingScore(qid, 0);
      setUserAnswers(prev => ({
        ...prev,
        [qid]: {
          ...(prev[qid] ?? { answer: '', submitted: false }),
          score: 0,
          submitted: true,
          isCorrect: false,
        },
      }));
    }

    await finaliseSubmitAll();
  }, [questions, userAnswers, persistDrawingScore, finaliseSubmitAll]);

  const handlePracticeSelfMarkComplete = useCallback(async (scores: Record<string, number>) => {
    for (const [qid, score] of Object.entries(scores)) {
      handleDrawingScoreChange(qid, score);
      await persistDrawingScore(qid, score);
    }
    setShowPracticeSelfMarkModal(false);
    setPracticeDrawQuestionsForReview([]);
    if (pendingSubmitAllRef.current) {
      pendingSubmitAllRef.current = false;
      await handleSubmitAll();
    }
  }, [handleDrawingScoreChange, persistDrawingScore, handleSubmitAll]);

  const guardNavigation = useCallback((action: () => void): boolean => {
    if (unsavedDrawingQuestionsRef.current.size > 0) {
      setPendingNavigation(() => action);
      setShowUnsavedWarning(true);
      return true;
    }
    action();
    return false;
  }, []);
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
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [workedSolutionVisible, setWorkedSolutionVisible] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMathKeypad, setShowMathKeypad] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRetrySetDialog, setShowRetrySetDialog] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false); // Review mode state
  const [showProtractor, setShowProtractor] = useState(() => {
    // Restore from sessionStorage
    try {
      return sessionStorage.getItem(`practice_protractor_${setId}`) === 'true';
    } catch { return false; }
  });
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [angleMeasurements, setAngleMeasurements] = useState<Array<{ id: string; segmentId1: string; segmentId2: string; angleDegrees: number; labelOffset?: { x: number; y: number } }>>([]);
  const [resourcePack, setResourcePack] = useState<ResourcePack | null>(null);
  const [resourcesExpanded, setResourcesExpanded] = useState(false);
  const answerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persist protractor state
  useEffect(() => {
    try {
      sessionStorage.setItem(`practice_protractor_${setId}`, String(showProtractor));
    } catch {}
  }, [showProtractor, setId]);

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

  // Reset graph join mode when question changes (navigation)
  useEffect(() => {
    if (!questions[currentIndex]) return;
    const qId = questions[currentIndex].id;
    setUserAnswers(prev => {
      const existing = prev[qId];
      // Only reset graphJoinMode if it exists (don't create new entry if not needed)
      if (existing?.graphJoinMode !== undefined && existing?.graphJoinMode !== null) {
        return {
          ...prev,
          [qId]: {
            ...existing,
            graphJoinMode: null, // Reset to OFF so user can add points immediately
          }
        };
      }
      return prev;
    });
  }, [currentIndex, questions]);

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

      // Load resource pack if exists
      if (quizSet.resource_pack_id) {
        const { data: packData } = await supabase
          .from("resource_packs")
          .select("*")
          .eq("id", quizSet.resource_pack_id)
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
        }
      }
      // 2. Load questions with numeric sorting
      const { data: questionsData } = await supabase.from("practice_questions").select("*").eq("set_id", setId).order("question_number_int").order("question_number");
      if (!questionsData?.length) {
        toast.error("No questions found");
        navigate("/quizzes");
        return;
      }

      // Sort questions: first by numeric part, then by suffix (a, b, c)
      // Examples: 1a < 1b < 2 < 10a < 10b
      const sortedQuestions = questionsData.sort((a, b) => {
        const numA = a.question_number_int ?? (parseInt(a.question_number) || 0);
        const numB = b.question_number_int ?? (parseInt(b.question_number) || 0);
        if (numA !== numB) return numA - numB;
        
        // Same number - sort by suffix (extract letters after the number)
        const suffixA = a.question_number.replace(/^\d+/, '') || '';
        const suffixB = b.question_number.replace(/^\d+/, '') || '';
        return suffixA.localeCompare(suffixB);
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
          
          // Graph question answers
          let graphInterpretationAnswers: Record<string, string | number | boolean> | undefined;
          let graphPlottedPoints: GraphPoint[] | undefined;
          let graphMarkingData: UserAnswer['graphMarkingData'] | undefined;
          
          // Bearings question answers
          let bearingsAnswer: string | undefined;
          let bearingsMarkingData: BearingsMarkingResult | undefined;
          
          if (ans.answer_text) {
            // Try parsing as table grid
            const parsed = parseStoredTableGridAnswer(ans.answer_text);
            if (parsed) {
              tableGridAnswers = {};
              for (const [rowId, colMap] of Object.entries(parsed.cells)) {
                tableGridAnswers[rowId] = Object.entries(colMap)
                  .filter(([_, selected]) => selected)
                  .map(([colIdx]) => parseInt(colIdx, 10));
              }
              tableGridInputs = parsed.inputs;
            }
            
            // Try parsing as graph response
            const graphResponse = parseGraphResponse(ans.answer_text);
            if (graphResponse) {
              if (graphResponse._type === 'graph_interpretation') {
                graphInterpretationAnswers = graphResponse.answers;
              } else if (graphResponse._type === 'graph_plotting') {
                graphPlottedPoints = graphResponse.points;
              } else if (graphResponse._type === 'bearings') {
                bearingsAnswer = String(graphResponse.bearing);
              }
            }
          }
          
          // Declare variables for graphJoinMode and graphSegments before the block
          let graphJoinMode: 'straight' | 'curved' | 'freeform' | 'best_fit' | undefined;
          let graphSegments: Array<{ id: string; from: GraphPoint; to: GraphPoint; mode: 'straight' | 'curved' }> | undefined;
          let graphBestFitLine: { x1: number; y1: number; x2: number; y2: number } | null | undefined;
          
          // Rehydrate joinMode and segments from submitted answer
          if (ans.answer_text) {
            const graphResponse2 = parseGraphResponse(ans.answer_text);
            if (graphResponse2 && graphResponse2._type === 'graph_plotting') {
              graphJoinMode = graphResponse2.joinMode;
              graphSegments = graphResponse2.segments;
              graphBestFitLine = graphResponse2.bestFitLine ?? null;
            }
          }
          
          // Try to extract marking data from feedback (stored as JSON metadata)
          if (ans.feedback) {
            try {
              const feedbackMatch = ans.feedback.match(/<!--MARKING_DATA:(.*?)-->/);
              if (feedbackMatch) {
                const parsedMarking = JSON.parse(feedbackMatch[1]);
                // Check if it's bearings marking data
                if (parsedMarking.studentBearing !== undefined || parsedMarking.correctBearing !== undefined) {
                  bearingsMarkingData = parsedMarking as BearingsMarkingResult;
                }
                // Check if it's graph marking data or table marking data
                else if (parsedMarking.perFieldResults || parsedMarking.perPointResults) {
                  graphMarkingData = parsedMarking;
                } else {
                  markingData = parsedMarking;
                }
              }
            } catch {
              // Feedback doesn't contain structured marking data
            }
          }
          
          const isDrawing = typeof ans.answer_text === 'string' && ans.answer_text.startsWith('drawing:');
          initialAnswers[ans.question_id] = {
            answer: isDrawing ? '' : (ans.answer_text || ''),
            workingOut: isDrawing ? ans.answer_text : (ans.working_out || ''),
            submitted: !isDrawing,
            score: Number(ans.score),
            methodMarks: ans.method_marks ? Number(ans.method_marks) : undefined,
            accuracyMarks: ans.accuracy_marks ? Number(ans.accuracy_marks) : undefined,
            feedback: ans.feedback ? ans.feedback.replace(/<!--MARKING_DATA:.*?-->/g, '') : "",
            isCorrect: ans.is_correct || false,
            tableGridAnswers,
            tableGridInputs,
            markingData,
            graphInterpretationAnswers,
            graphPlottedPoints,
            graphMarkingData,
            graphJoinMode,
            graphSegments,
            graphBestFitLine,
            bearingsAnswer,
            bearingsMarkingData,
          };
        });
      }

      // 5. Load session progress
      const { data: progress, error: progressError } = await supabase
        .from('practice_set_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .maybeSingle();

      if (progressError) {
        console.warn('[Progress] Failed to fetch progress row:', progressError.message);
      }

      if (progress) {
        // Restore timer
        if (progress.time_spent_seconds) {
          setTimeElapsed(progress.time_spent_seconds);
        }
        
        // Restore current question index (clamped to valid bounds)
        if (progress.current_question_index !== null && progress.current_question_index !== undefined) {
          const boundedIndex = Math.max(0, Math.min(progress.current_question_index, Math.max(sortedQuestions.length - 1, 0)));
          setCurrentIndex(boundedIndex);
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
                const draftText = typeof draft === 'object' && draft !== null ? (draft.text || "") : (typeof draft === 'string' ? draft : "");
                initialAnswers[questionId].answer = draftText;
                
                // Rehydrate graph plotting state from draft JSON
                const graphResponse = parseGraphResponse(draftText);
                if (graphResponse && graphResponse._type === 'graph_plotting') {
                  initialAnswers[questionId].graphPlottedPoints = graphResponse.points;
                  initialAnswers[questionId].graphJoinMode = graphResponse.joinMode as 'straight' | 'curved' | 'freeform' | undefined;
                  initialAnswers[questionId].graphSegments = graphResponse.segments;
                  initialAnswers[questionId].graphDrawnPaths = graphResponse.drawnPaths;
                } else if (graphResponse && graphResponse._type === 'graph_interpretation') {
                  initialAnswers[questionId].graphInterpretationAnswers = graphResponse.answers;
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

        // Detect review mode: if quiz is completed (completed_at set)
        if (progress.completed_at) {
          setIsReviewMode(true);
        }

        if (progress.current_question_index > 0 || savedAnswers?.length > 0) {
          toast.success("Progress restored!", {
            description: `${savedAnswers?.length || 0} answers loaded • Resuming from Q${progress.current_question_index + 1}`,
            duration: 8000, // Auto-dismiss after 8 seconds
            closeButton: true, // Allow manual close via X
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
                const draftText = draft.text || '';
                initialAnswers[question.id].answer = draftText;
                
                // Rehydrate graph plotting state from sessionStorage draft
                const graphResponse = parseGraphResponse(draftText);
                if (graphResponse && graphResponse._type === 'graph_plotting') {
                  initialAnswers[question.id].graphPlottedPoints = graphResponse.points;
                  initialAnswers[question.id].graphJoinMode = graphResponse.joinMode as 'straight' | 'curved' | 'freeform' | undefined;
                  initialAnswers[question.id].graphSegments = graphResponse.segments;
                  initialAnswers[question.id].graphDrawnPaths = graphResponse.drawnPaths;
                } else if (graphResponse && graphResponse._type === 'graph_interpretation') {
                  initialAnswers[question.id].graphInterpretationAnswers = graphResponse.answers;
                }
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
    
    // Check for graph interpretation answers
    const graphData = shouldParseGraphData(currentQuestion.question_type, currentQuestion.correct_answer, (currentQuestion as any).diagram_config)
      ? parseGraphQuestionData(
          currentQuestion.correct_answer || null,
          (currentQuestion as any).diagram_config ?? null,
          currentQuestion.question_type ?? null,
        )
      : null;
    const isGraphInterpretation = currentQuestion.question_type === 'graph_interpretation' || graphData?.graphType === 'interpretation';
    const rawIsGraphPlotting = currentQuestion.question_type === 'graph_plotting' || graphData?.graphType === 'plotting';
    // Defensive: physics diagram sketches sometimes get stored as graph_plotting
    // by the AI. In that case the freehand canvas renders instead of a grid,
    // so we must skip the graph-plotting validation.
    const physicsDrawOverride = isPhysicsDrawOverride(
      currentQuestion.question_text,
      (currentQuestion as any).subject,
      currentQuestion.question_type,
    );
    const isGraphPlotting = rawIsGraphPlotting && !physicsDrawOverride;

    // Validate graph interpretation: check which fields are answered
    if (isGraphInterpretation && graphData) {
      const fields = graphData.interpretationFields || [];
      const answers = currentAnswer.graphInterpretationAnswers || {};
      const missingFields: string[] = [];
      
      // DEBUG: Log the full state before submit
      console.log('[GraphSubmit] currentAnswer.graphInterpretationAnswers:', JSON.stringify(answers, null, 2));
      console.log('[GraphSubmit] currentAnswer.answer (serialized):', currentAnswer.answer);
      console.log('[GraphSubmit] Field IDs expected:', fields.map((f: any) => f.id));
      
      for (const field of fields) {
        const val = answers[field.id];
        if (val === undefined || val === null || val === '') {
          missingFields.push(field.question.replace(/[:?].*$/, '').trim());
        }
      }
      
      if (missingFields.length > 0) {
        toast.error(`You haven't answered: ${missingFields.join(', ')}`);
        return;
      }
    }
    
    // Validate graph plotting
    if (isGraphPlotting) {
      const points = currentAnswer.graphPlottedPoints || [];
      if (points.length === 0) {
        toast.error("Please plot at least one point on the graph");
        return;
      }
    }
    
    // Standard validation for non-graph questions
    if (!isGraphInterpretation && !isGraphPlotting) {
      if (!currentAnswer.answer.trim() && !hasTableGridAnswer && !hasTableGridInputs) {
        toast.error("Please provide an answer");
        return;
      }
    }

    setIsGrading(true);
    try {
      // Normalize the answer for AI grading (convert Unicode math to plain text)
      const normalizedAnswer = normalizeUnicodeForGrading(currentAnswer.answer);
      
      // DEBUG: Log payload being sent
      console.log('[GraphSubmit] Sending to grader:', {
        questionId: currentQuestion.id,
        answerText: currentAnswer.answer,
        questionType: currentQuestion.question_type,
      });
      
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
          markingData: data.markingData,
          // Store graph marking data
          graphMarkingData: data.markingData?.perFieldResults ? data.markingData : 
                            data.markingData?.perPointResults ? data.markingData : currentAnswer.graphMarkingData
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
      
      // Clean up any stale pointer-events left by dialog/overlay
      document.body.style.pointerEvents = '';
      document.documentElement.style.pointerEvents = '';
      const root = document.getElementById('root');
      if (root) root.style.pointerEvents = '';
      
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

  // Handle segment selection for angle measurement
  const handleSegmentSelection = useCallback((ids: string[]) => {
    // If we have exactly 2 segments, check if they share a vertex
    if (ids.length === 2) {
      const currentQuestionId = questions[currentIndex]?.id;
      const currentAnswer = userAnswers[currentQuestionId] || { answer: '', submitted: false };
      const segments = currentAnswer.graphSegments || [];
      
      const seg1 = segments.find((s: any) => s.id === ids[0]);
      const seg2 = segments.find((s: any) => s.id === ids[1]);
      
      if (seg1 && seg2) {
        // Check if segments share a vertex
        const points1 = [seg1.from, seg1.to];
        const points2 = [seg2.from, seg2.to];
        
        let hasSharedVertex = false;
        for (const p1 of points1) {
          for (const p2 of points2) {
            if (p1.x === p2.x && p1.y === p2.y) {
              hasSharedVertex = true;
              break;
            }
          }
          if (hasSharedVertex) break;
        }
        
        if (!hasSharedVertex) {
          toast.error("Select a connected line");
          return;
        }
      }
    }
    
    setSelectedSegmentIds(ids);
  }, [questions, currentIndex, userAnswers]);

  // Retry current question - clears answer and marking state, keeps question content
  const handleRetryQuestion = async () => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) {
      console.error('[Retry] No current question at index:', currentIndex);
      toast.error("Unable to retry - question not found");
      return;
    }
    
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

      // Clear local state for this question (including ALL graph data)
      // Use functional update to ensure we're working with latest state
      setUserAnswers(prev => {
        const newAnswers = { ...prev };
        newAnswers[currentQuestion.id] = {
          answer: "",
          workingOut: "",
          submitted: false,
          answerLatex: undefined,
          useMathInput: undefined,
          tableGridAnswers: undefined,
          tableGridInputs: undefined,
          markingData: undefined,
          graphInterpretationAnswers: undefined,
          graphPlottedPoints: [],
          graphJoinMode: null, // Reset to null (OFF) so user can add points immediately
          graphSegments: [],
          graphDrawnPaths: [],
          graphMarkingData: undefined,
          score: undefined,
          methodMarks: undefined,
          accuracyMarks: undefined,
          feedback: undefined,
          isCorrect: undefined
        };
        return newAnswers;
      });

      // Clear sessionStorage draft
      try {
        sessionStorage.removeItem(`practice:${setId}:draft:${currentQuestion.id}`);
      } catch (e) {
        console.warn('[Retry] Failed to clear sessionStorage:', e);
      }

      // Hide worked solution
      setWorkedSolutionVisible(false);

      toast.success("Question reset - try again!");
    } catch (error: any) {
      console.error("[Retry] Error:", error);
      // Defensive fallback: try to reset state locally even if DB delete failed
      try {
        setUserAnswers(prev => ({
          ...prev,
          [currentQuestion.id]: {
            answer: "",
            workingOut: "",
            submitted: false,
            graphPlottedPoints: [],
            graphSegments: [],
            graphDrawnPaths: []
          }
        }));
        toast.warning("Reset locally (network issue)");
      } catch (fallbackError) {
        console.error("[Retry] Fallback also failed:", fallbackError);
        toast.error("Failed to reset question");
      }
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

        // Clear answer state for this question (including graph data)
        setUserAnswers(prev => ({
          ...prev,
          [currentQuestion.id]: {
            answer: "",
            workingOut: "",
            submitted: false,
            tableGridAnswers: undefined,
            tableGridInputs: undefined,
            markingData: undefined,
            graphInterpretationAnswers: undefined,
            graphPlottedPoints: undefined,
            graphMarkingData: undefined
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
          markingData: undefined,
          graphInterpretationAnswers: undefined,
          graphPlottedPoints: undefined,
          graphMarkingData: undefined,
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
    const currentQuestionId = questions[currentIndex]?.id;
    const isCurrent = currentQuestionId === question.id;

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

  /**
   * Extract root question number from a question number like "1a", "1b", "5c" -> "1", "5"
   */
  const getRootQuestionNumber = useCallback((qNum: string): string => {
    const match = qNum.match(/^(\d+)/);
    return match ? match[1] : qNum;
  }, []);

  /**
   * Group questions by their root number for display.
   * Returns array of { rootNumber, questions[] } objects.
   */
  const groupedQuestions = useMemo(() => {
    const groups: { rootNumber: string; questions: Question[] }[] = [];
    let currentRoot: string | null = null;
    let currentGroup: Question[] = [];
    
    questions.forEach((q) => {
      const root = getRootQuestionNumber(q.question_number);
      if (root !== currentRoot) {
        if (currentGroup.length > 0 && currentRoot) {
          groups.push({ rootNumber: currentRoot, questions: currentGroup });
        }
        currentRoot = root;
        currentGroup = [q];
      } else {
        currentGroup.push(q);
      }
    });
    
    if (currentGroup.length > 0 && currentRoot) {
      groups.push({ rootNumber: currentRoot, questions: currentGroup });
    }
    
    return groups;
  }, [questions, getRootQuestionNumber]);

  /**
   * Find reference diagram series for a question that mentions "shown in the diagram".
   * Looks in sibling questions (same root) for graph_plotting questions with series data.
   * Also handles sub-questions that reference "the same original graph from part (a)".
   */
  const findReferenceSeries = useCallback((questionText: string, questionId: string, questionNumber: string): { series: GraphSeries[]; domainX: [number, number]; domainY: [number, number] } | null => {
    // Expanded patterns to catch more variations:
    // - "shown in the diagram" / "the diagram shows"
    // - "The graph shows..." / "curve is shown"
    // - "Using the same original graph from part (a)"
    const mentionsDiagram = 
      /shown in the diagram|in the diagram|the diagram shows/i.test(questionText) ||
      /\b(graph|curve)\s+shows\b/i.test(questionText) ||
      /\b(graph|curve|diagram)\s+(of\s+)?[^.]*\s*(is\s+)?(shown|given)\b/i.test(questionText) ||
      /\busing\s+the\s+same\s+(original\s+)?graph\b/i.test(questionText) ||
      /\bfrom\s+part\s*\(?[a-zA-Z]\)?/i.test(questionText);
    
    if (!mentionsDiagram) return null;
    
    // First check the current question's own graphConfig for series
    const __currentQ = questions.find(q => q.id === questionId);
    const currentGraphData = parseGraphQuestionData(
      __currentQ?.correct_answer || null,
      (__currentQ as any)?.diagram_config ?? null,
      __currentQ?.question_type ?? null,
    );
    if (currentGraphData?.graphConfig && 'series' in currentGraphData.graphConfig) {
      const config = currentGraphData.graphConfig as GraphInterpretationConfig;
      if (config.series && config.series.length > 0) {
        return {
          series: config.series,
          domainX: config.domainX || [-5, 5],
          domainY: config.domainY || [-5, 5],
        };
      }
    }
    
    // Look through sibling questions in the same group for graph data
    // Prioritize part (a) as it usually contains the original curve
    const rootNum = getRootQuestionNumber(questionNumber);
    const siblingQuestions = questions
      .filter(q => getRootQuestionNumber(q.question_number) === rootNum && q.id !== questionId)
      .sort((a, b) => {
        // Sort to put part 'a' first
        const aEndsWithA = a.question_number.toLowerCase().endsWith('a');
        const bEndsWithA = b.question_number.toLowerCase().endsWith('a');
        if (aEndsWithA && !bEndsWithA) return -1;
        if (!aEndsWithA && bEndsWithA) return 1;
        return 0;
      });
    
    // Check siblings for graphConfig with series
    for (const sibling of siblingQuestions) {
      const graphData = parseGraphQuestionData(
        sibling.correct_answer,
        (sibling as any).diagram_config ?? null,
        sibling.question_type ?? null,
      );
      if (graphData?.graphConfig && 'series' in graphData.graphConfig) {
        const config = graphData.graphConfig as GraphInterpretationConfig;
        if (config.series && config.series.length > 0) {
          return {
            series: config.series,
            domainX: config.domainX || [-5, 5],
            domainY: config.domainY || [-5, 5],
          };
        }
      }
    }
    
    // Try to generate from the current question's function expression
    const funcExpr = extractFunctionFromText(questionText);
    if (funcExpr) {
      const curveData = generateCurveFromExpression(funcExpr);
      if (curveData && curveData.length > 2) {
        // Determine domain from curve data
        const xValues = curveData.map(p => p.x);
        const yValues = curveData.map(p => p.y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        
        return {
          series: [{
            id: 'generated',
            label: `y = f(x) = ${funcExpr}`,
            data: curveData,
            color: 'hsl(var(--primary))',
            showLine: true,
            lineStyle: 'solid',
          }],
          domainX: [Math.floor(minX) - 1, Math.ceil(maxX) + 1],
          domainY: [Math.floor(minY) - 1, Math.ceil(maxY) + 1],
        };
      }
    }
    
    return null;
  }, [questions, getRootQuestionNumber]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!questions.length) return <div className="p-8 text-center">No questions available</div>;

  const safeIndex = Math.min(Math.max(currentIndex, 0), questions.length - 1);
  const currentQuestion = questions[safeIndex];
  const currentAnswer = userAnswers[currentQuestion.id] || { answer: "", answerLatex: "", submitted: false };
  
  /**
   * Find which group the current question belongs to
   */
  const currentGroupIdx = groupedQuestions.findIndex(g => g.rootNumber === getRootQuestionNumber(currentQuestion.question_number));
  
  /**
   * Get the current group of questions to display together
   */
  const currentGroup = groupedQuestions[currentGroupIdx] || { rootNumber: '', questions: [currentQuestion] };
  
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

          {/* Center: Question number (e.g., "Question 2c") */}
          <div className="flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
            <Badge variant="outline" className="text-sm lg:text-base px-3 py-1.5 whitespace-nowrap">
              Question {currentQuestion.question_number}
            </Badge>
            {flaggedQuestions.has(currentQuestion.id) && (
              <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600 hidden sm:flex">
                <Flag className="w-3 h-3" />Flagged
              </Badge>
            )}
          </div>

          {/* Right: Timer + Menu (hidden in review mode) */}
          <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
            {/* Review Mode Badge */}
            {isReviewMode && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Review Mode
              </Badge>
            )}
            {/* Timer - only show when NOT in review mode */}
            {!isReviewMode && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-sm">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(timeElapsed)}</span>
              </div>
            )}
            {/* Options Menu - only show when NOT in review mode */}
            {!isReviewMode && (
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
                onQuitAndSave={() => guardNavigation(() => setShowQuitDialog(true))}
                onSubmitAll={() => guardNavigation(() => setShowSubmitDialog(true))}
                disabled={currentAnswer.submitted}
                showProtractor={showProtractor}
                onToggleProtractor={() => setShowProtractor(prev => !prev)}
                onRetryQuestion={handleRetryQuestion}
                onRegenerateQuestion={handleRegenerateQuestion}
                onRetryEntireSet={() => setShowRetrySetDialog(true)}
                isRetrying={isRetrying}
                isRegenerating={isRegenerating}
              />
            )}
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
                      <button key={q.id} onClick={() => guardNavigation(() => { setCurrentIndex(questions.indexOf(q)); window.scrollTo({ top: 0, behavior: 'smooth' }); if (window.innerWidth < 1024) setSidebarOpen(false); })} className={className} style={style}>
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
              {/* Submit All / Exit button - contextual based on mode */}
              {isReviewMode ? (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/quizzes')}>Exit Review</Button>
              ) : (
                <Button variant="destructive" size="sm" className="mt-2" onClick={() => guardNavigation(() => setShowSubmitDialog(true))}>Submit All</Button>
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
                            onClick={() => {
                              // Could open a modal here in the future
                            }}
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
        </aside>

        {/* Main content - takes remaining space, with bottom nav */}
        <main className="flex-1 flex flex-col min-h-[calc(100vh-4.5rem)] min-w-0">
          {/* Scrollable question area */}
          <div className="flex-1 p-4 lg:p-6 xl:p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto w-full">
              {/* Question Card */}
              <Card className="border-l-4" style={{ borderLeftColor: subjectColor }}>
                <CardContent className="p-5 lg:p-8 space-y-6 lg:space-y-8">
                  {/* Question header - shows specific question number (e.g., "Question 2c") */}
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-lg font-semibold text-foreground">
                      Question {currentQuestion.question_number}
                    </span>
                    <Badge style={{ backgroundColor: subjectColor, color: 'white' }} className="text-sm px-3 py-1 shrink-0">
                      {currentQuestion.marks} marks
                    </Badge>
                  </div>

                  <QuizQuestionErrorBoundary questionId={currentQuestion.id}>
                    {/* Question text */}
                    <div className="text-base lg:text-lg leading-relaxed">
                      <MathRenderer content={currentQuestion.question_text} hasMath={currentQuestion.has_math} />
                    </div>
                  {/* Reference diagram for "shown in the diagram" questions - SKIP for graph_plotting as it has its own curve rendering */}
                  {(() => {
                    // Parse graph data to check if this is a graph_plotting question
                    const graphData = shouldParseGraphData(currentQuestion.question_type, currentQuestion.correct_answer, (currentQuestion as any).diagram_config)
                      ? parseGraphQuestionData(
                          currentQuestion.correct_answer || null,
                          (currentQuestion as any).diagram_config ?? null,
                          currentQuestion.question_type ?? null,
                        )
                      : null;
                    const isGraphPlotting = currentQuestion.question_type === 'graph_plotting' || 
                      (graphData?.graphConfig && graphData?.plottingAnswer);
                    
                    // Skip ReferenceDiagram for graph_plotting - the curve is shown inside GraphPlottingQuestion
                    if (isGraphPlotting) return null;
                    
                    const refSeries = findReferenceSeries(currentQuestion.question_text, currentQuestion.id, currentQuestion.question_number);
                    if (refSeries && refSeries.series.length > 0) {
                      return (
                        <div className="my-4">
                          <ReferenceDiagram
                            series={refSeries.series}
                            domainX={refSeries.domainX}
                            domainY={refSeries.domainY}
                            className="mx-auto"
                          />
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Mechanics figure panel */}
                  {(() => {
                    const diagConfig = detectDiagramConfig(currentQuestion.question_text);
                    if (!diagConfig) return null;
                    return <MechanicsFigurePanel config={diagConfig} />;
                  })()}

                  {/* Circuit figure panel */}
                  {(() => {
                    const circuitConfig = getCircuitConfig(currentQuestion);
                    if (!circuitConfig) return null;
                    return <CircuitFigurePanel config={circuitConfig} />;
                  })()}

                  {/* Biology figure panel */}
                  {(() => {
                    const bioConfig = detectBiologyDiagram(currentQuestion.question_text, (currentQuestion as any).subject);
                    if (!bioConfig) return null;
                    return <BiologyFigurePanel config={bioConfig} />;
                  })()}

                  <EconomicsFigurePanel
                    questionText={currentQuestion.question_text ?? ''}
                    subject={(currentQuestion as any).subject ?? ''}
                    diagramConfig={null}
                    isSubmitted={!!currentAnswer?.submitted}
                    isReview={false}
                  />

                  <MathsFigurePanel
                    questionText={currentQuestion.question_text ?? ''}
                    subject={(currentQuestion as any).subject ?? ''}
                    diagramConfig={null}
                    isSubmitted={!!currentAnswer?.submitted}
                    isReview={false}
                    isPracticeQuiz={true}
                  />

                  <PhysicsFigurePanel
                    questionText={currentQuestion.question_text ?? ''}
                    subject={(currentQuestion as any).subject ?? ''}
                    diagramConfig={(currentQuestion as any).diagram_config ?? null}
                    isSubmitted={!!currentAnswer?.submitted}
                    isReview={false}
                    isPracticeQuiz={true}
                  />

                  {(() => {
                    const physicsOverride = isPhysicsDrawOverride(
                      currentQuestion.question_text,
                      (currentQuestion as any).subject,
                      currentQuestion.question_type,
                    );
                    const isGraphType =
                      (currentQuestion.question_type === 'graph_plotting' ||
                       currentQuestion.question_type === 'graph_interpretation' ||
                       currentQuestion.question_type === 'graph_transformation' ||
                       currentQuestion.question_type === 'bearings') &&
                      !physicsOverride;
                    if (isGraphType) return null;
                    const drawInfo = detectDrawQuestion(
                      currentQuestion.question_text ?? '',
                      (currentQuestion as any).subject ?? '',
                      currentQuestion.question_type,
                    );
                    if (!drawInfo.needsDrawingCanvas) return null;
                    return (
                      <DrawDiagramQuestion
                        key={currentQuestion.id}
                        questionText={currentQuestion.question_text ?? ''}
                        subject={(currentQuestion as any).subject ?? ''}
                        questionType={currentQuestion.question_type}
                        totalMarks={currentQuestion.marks ?? 4}
                        savedDrawingDataUrl={userAnswers[currentQuestion.id]?.workingOut ?? ''}
                        initialElements={savedElementsRef.current[currentQuestion.id] ?? []}
                        onSave={(url) => {
                          setUserAnswers(prev => ({
                            ...prev,
                            [currentQuestion.id]: {
                              ...(prev[currentQuestion.id] ?? { answer: '', submitted: false }),
                              workingOut: url,
                            },
                          }));
                          persistDrawingAnswer(currentQuestion.id, url);
                        }}
                        onSaveWithElements={(_url, els) => {
                          savedElementsRef.current[currentQuestion.id] = els;
                        }}
                        onUnsavedChanges={(has) => handleDrawingWorkingChange(currentQuestion.id, has)}
                        onScoreChange={(score) => handleDrawingScoreChange(currentQuestion.id, score)}
                      />
                    );
                  })()}

                  {/* Chart rendering — diagram_config first, options fallback */}
                  {(() => {
                    const chartData = getChartData(currentQuestion);
                    if (!chartData) return null;
                    return (
                      <>
                        {isBoxPlotQuestion(chartData) && (
                          <BoxPlotChart chartData={chartData} className="mb-4" />
                        )}
                        {isHistogramQuestion(chartData) && (
                          <HistogramChart chartData={chartData} className="mb-4" />
                        )}
                        {isDataTableQuestion(chartData) && (
                          <DataTableChart chartData={chartData} className="mb-4" />
                        )}
                        {isBarChartQuestion(chartData) && (
                          <BarChart chartData={chartData} className="mb-4" />
                        )}
                        {isPieChartQuestion(chartData) && (
                          <PieChart chartData={chartData} className="mb-4" />
                        )}
                        {isCumulativeFrequencyQuestion(chartData) && (
                          <CumulativeFrequencyChart chartData={chartData} className="mb-4" />
                        )}
                        {isFrequencyPolygonQuestion(chartData) && (
                          <FrequencyPolygonChart chartData={chartData} className="mb-4" />
                        )}
                        {isClimateChartQuestion(chartData) && (
                          <ClimateChart chartData={chartData} className="mb-4" />
                        )}
                      </>
                    );
                  })()}


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
                    
                    // Check if this is a graph or bearings question
                    // CRITICAL: question_type is the authoritative source - only use graphData parsing as fallback
                    // This prevents short_answer questions with old cached graphData from rendering as graph questions
                    const graphData = shouldParseGraphData(currentQuestion.question_type, currentQuestion.correct_answer, (currentQuestion as any).diagram_config)
                      ? parseGraphQuestionData(
                          currentQuestion.correct_answer,
                          (currentQuestion as any).diagram_config ?? null,
                          currentQuestion.question_type ?? null,
                        )
                      : null;
                    
                    // Only treat as graph question if question_type explicitly says so
                    // OR if question_type is unset/generic but graphData has a graphType
                    const physicsOverride = isPhysicsDrawOverride(
                      currentQuestion.question_text,
                      (currentQuestion as any).subject,
                      currentQuestion.question_type,
                    );
                    const isGraphInterpretation = !physicsOverride && (currentQuestion.question_type === 'graph_interpretation' ||
                      (currentQuestion.question_type !== 'short_answer' && currentQuestion.question_type !== 'extended' && graphData?.graphType === 'interpretation'));
                    const isGraphPlotting = !physicsOverride && (currentQuestion.question_type === 'graph_plotting' ||
                      (currentQuestion.question_type !== 'short_answer' && currentQuestion.question_type !== 'extended' && graphData?.graphType === 'plotting'));
                    const isBearings = !physicsOverride && (currentQuestion.question_type === 'bearings' ||
                      (currentQuestion.question_type !== 'short_answer' && currentQuestion.question_type !== 'extended' && graphData?.graphType === 'bearings'));
                    const isGraphTransformation = !physicsOverride && (currentQuestion.question_type === 'graph_transformation' ||
                      (currentQuestion.question_type !== 'short_answer' && currentQuestion.question_type !== 'extended' && graphData?.graphType === 'transformation'));
                    
                    // Render graph transformation (multi-part sketch)
                    if (isGraphTransformation && graphData?.transformationConfig) {
                      return (
                        <div className="space-y-4">
                          <GraphTransformationQuestion
                            config={graphData.transformationConfig as any}
                            answers={(currentAnswer as any).transformationAnswers || {}}
                            onAnswerChange={(partId, partAnswer) => {
                              const merged = { ...((currentAnswer as any).transformationAnswers || {}), [partId]: partAnswer };
                              const serialized = serializeGraphTransformationResponse(merged as any);
                              const newAnswer = {
                                ...currentAnswer,
                                answer: serialized,
                                transformationAnswers: merged,
                              } as any;
                              setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                              debouncedSave(currentQuestion.id, { answer: serialized });
                            }}
                            readOnly={currentAnswer.submitted}
                            showCorrectAnswers={currentAnswer.submitted && !!currentAnswer.feedback}
                            subjectColor={subjectColor}
                          />
                        </div>
                      );
                    }
                    
                    // Render bearings question
                    if (isBearings && graphData?.bearingsConfig) {
                      const config = graphData.bearingsConfig as BearingsQuestionConfig;
                      
                      return (
                        <div className="space-y-4">
                          <BearingsQuestion
                            config={config}
                            value={currentAnswer.bearingsAnswer || ''}
                            onChange={(value) => {
                              const serialized = serializeBearingsResponse(value);
                              const newAnswer = {
                                ...currentAnswer,
                                answer: serialized,
                                bearingsAnswer: value,
                              };
                              setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                              debouncedSave(currentQuestion.id, { answer: serialized });
                            }}
                            readOnly={currentAnswer.submitted}
                            showCorrectAnswers={currentAnswer.submitted && !!currentAnswer.feedback}
                            markingData={currentAnswer.bearingsMarkingData}
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
                            answers={currentAnswer.graphInterpretationAnswers || {}}
                            onAnswerChange={(newAnswers) => {
                              const serialized = serializeGraphInterpretationResponse(newAnswers);
                              const newAnswer = {
                                ...currentAnswer,
                                answer: serialized,
                                graphInterpretationAnswers: newAnswers,
                              };
                              setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                              debouncedSave(currentQuestion.id, { answer: serialized });
                            }}
                            readOnly={currentAnswer.submitted}
                            showCorrectAnswers={currentAnswer.submitted && !!currentAnswer.feedback}
                            markingData={currentAnswer.graphMarkingData?.perFieldResults ? {
                              perFieldResults: currentAnswer.graphMarkingData.perFieldResults,
                              totalScore: currentAnswer.score || 0,
                              totalMarks: currentQuestion.marks,
                            } : undefined}
                            subjectColor={subjectColor}
                          />
                        </div>
                      );
                    }
                    
                    if (isGraphPlotting && graphData) {
                      const config = graphData.graphConfig as GraphPlottingConfig;
                      const plottingAnswer = graphData.plottingAnswer;
                      
                      // Get reference series from graphConfig.series
                      let rawRefSeries = (graphData.graphConfig as any)?.series || [];
                      
                      // CRITICAL: For "sketch" questions that mention "graph is shown" or similar,
                      // we MUST display the reference series (the original f(x) curve).
                      // Only hide reference series if it's a pure sketch-from-equation question
                      // (no mention of "shown" or "given" curve).
                      const isSketchQuestion = /\bsketch\b/i.test(currentQuestion.question_text);
                      
                      // Expanded patterns to catch more variations:
                      // - "The graph shows..." / "graph of y=f(x) is shown"
                      // - "Using the same original graph" (for sub-questions)
                      // - "the curve shown" / "diagram shown"
                      const mentionsShownGraph = 
                        /\b(graph|curve|diagram)\s+(of\s+)?[^.]*\s*(is\s+)?(shown|given|illustrated|displayed|below|above)\b/i.test(currentQuestion.question_text) ||
                        /\b(shown|given|illustrated)\s+(in\s+)?(the\s+)?(graph|curve|diagram)\b/i.test(currentQuestion.question_text) ||
                        /\b(graph|curve)\s+shows\b/i.test(currentQuestion.question_text) ||
                        /\busing\s+the\s+same\s+(original\s+)?graph\b/i.test(currentQuestion.question_text) ||
                        /\bfrom\s+part\s*\(?[a-zA-Z]\)?/i.test(currentQuestion.question_text);
                      
                      const isInReviewMode = currentAnswer.submitted && !!currentAnswer.feedback;
                      
                      // For sub-questions that reference "the same original graph from part (a)",
                      // we need to look up the parent question's reference series
                      if (mentionsShownGraph && rawRefSeries.length === 0) {
                        // Try to find parent question's series data
                        const rootNum = getRootQuestionNumber(currentQuestion.question_number);
                        const parentQuestion = questions.find(q => 
                          getRootQuestionNumber(q.question_number) === rootNum && 
                          q.question_number !== currentQuestion.question_number &&
                          q.question_number.endsWith('a') // Usually part (a) has the original curve
                        );
                        if (parentQuestion) {
                          const parentGraphData = parseGraphQuestionData(
                            parentQuestion.correct_answer || null,
                            (parentQuestion as any).diagram_config ?? null,
                            parentQuestion.question_type ?? null,
                          );
                          if (parentGraphData?.graphConfig && 'series' in parentGraphData.graphConfig) {
                            rawRefSeries = (parentGraphData.graphConfig as any).series || [];
                          }
                        }
                      }
                      
                      // ===============================================================
                      // SHADOW GRAPH: Display parent f(x) as visual reference
                      // ===============================================================
                      // For sub-questions with transformations (e.g., "sketch f(x-2)"),
                      // we show the original f(x) curve as a faint dashed "shadow" line.
                      // This is stored in plottingAnswer.shadowCurve by the edge function.
                      const shadowCurve = (plottingAnswer as any)?.shadowCurve;
                      if (shadowCurve && shadowCurve.data && shadowCurve.data.length > 0) {
                        // Add shadow curve to reference series for display
                        const shadowSeries: GraphSeries = {
                          id: shadowCurve.id || 'shadow-reference',
                          label: shadowCurve.label || 'y = f(x) (reference)',
                          data: shadowCurve.data,
                          showLine: true,
                          lineStyle: 'dashed' as const,
                          color: 'hsl(220 8.9% 66.1%)', // Muted grey for shadow
                        };
                        // Prepend shadow to series so it renders behind other curves
                        rawRefSeries = [shadowSeries, ...rawRefSeries];
                      }
                      
                      // Show reference series if:
                      // 1. The question mentions a "shown" graph (student needs to see original curve), OR
                      // 2. It's NOT a sketch question (just a plotting question), OR
                      // 3. We're in review mode
                      // 4. There's a shadow curve from a parent question
                      // Hide reference series ONLY for pure "sketch from equation" questions (no shown graph)
                      const hasShadowCurve = !!shadowCurve;
                      const shouldShowReference = mentionsShownGraph || !isSketchQuestion || isInReviewMode || hasShadowCurve;
                      const refSeries = shouldShowReference ? rawRefSeries : [];
                      
                      // ===============================================================
                      // PRE-CALCULATED SOURCE OF TRUTH — No Runtime Transform Guessing
                      // ===============================================================
                      // The database stores the FINAL, already-transformed markingFormula.
                      // We simply evaluate it. No parseTransformFromQuestionText, no
                      // formulaAlreadyTransformed heuristics, no applyFormulaTransform.
                      let expectedCurveSeries: GraphSeries[] = [];
                      
                      // Bind pathAnnotations only in REVIEW mode for non-math subjects
                      // to avoid "spoiling" the answer during the answering phase
                      if (plottingAnswer && isInReviewMode) {
                        const expectedPath = (plottingAnswer as any).expectedPath;
                        const pathAnnotations = (plottingAnswer as any).pathAnnotations;
                        if (Array.isArray(expectedPath) && expectedPath.length >= 2 && Array.isArray(pathAnnotations) && pathAnnotations.length > 0) {
                          const pathAnns = pathAnnotations
                            .filter((pa: any) => pa.pointIndex >= 0 && pa.pointIndex < expectedPath.length)
                            .map((pa: any, i: number) => ({
                              id: `path-ann-${i}`,
                              type: 'point' as const,
                              coords: { x: expectedPath[pa.pointIndex].x, y: expectedPath[pa.pointIndex].y },
                              label: pa.label,
                              showCoordinates: true,
                            }));
                          if (!config.annotations) config.annotations = [];
                          // Avoid duplicates if already added
                          const existingIds = new Set(config.annotations.map((a: any) => a.id));
                          const newAnns = pathAnns.filter((a: any) => !existingIds.has(a.id));
                          if (newAnns.length > 0) {
                            config.annotations = [...config.annotations, ...newAnns];
                          }
                        }
                      }
                      
                      if (isInReviewMode && plottingAnswer) {
                        const markingFormula = (plottingAnswer as any).markingFormula;
                        const expCurve = (plottingAnswer as any).expectedCurve;
                        const domainX: [number, number] = config.domainX || [-10, 10];
                        
                        // Step 1: If markingFormula exists and is a real expression, use it directly
                        const isBareRef = markingFormula && /^[a-zA-Z]\(x\)$/.test(String(markingFormula).trim());
                        
                        if (markingFormula && typeof markingFormula === 'string' && markingFormula.trim() !== '' && !isBareRef) {
                          const formulaCurve = generateCurveFromFormula(markingFormula, domainX);
                          if (formulaCurve.length > 0) {
                            expectedCurveSeries = formulaCurve;
                            console.log('[Review] SOURCE OF TRUTH: Using pre-calculated markingFormula:', markingFormula, 'points:', formulaCurve.reduce((s, b) => s + b.data.length, 0));
                          } else {
                            console.warn('[Review] markingFormula failed to evaluate:', markingFormula);
                          }
                        }
                        
                        // Step 1.5: PARENT FORMULA INHERITANCE FALLBACK
                        // If no markingFormula, check if this is a sub-question (e.g., 4b)
                        // that references a parent function (e.g., -h(x) from 4a).
                        // Strip "y =" from question text, detect the transform, and apply
                        // it to the parent's markingFormula.
                        if (expectedCurveSeries.length === 0) {
                          const qNum = currentQuestion.question_number || '';
                          const rootNum = getRootQuestionNumber(qNum);
                          const isSubQ = qNum !== rootNum && rootNum !== '';
                          
                          if (isSubQ) {
                            // Find parent question (usually part 'a')
                            const parentQ = questions.find(q => 
                              getRootQuestionNumber(q.question_number) === rootNum &&
                              q.question_number !== qNum &&
                              q.question_number.endsWith('a')
                            );
                            
                            if (parentQ) {
                              const parentGraphData = parseGraphQuestionData(
                                parentQ.correct_answer || null,
                                (parentQ as any).diagram_config ?? null,
                                parentQ.question_type ?? null,
                              );
                              const parentFormula = (parentGraphData?.plottingAnswer as any)?.markingFormula;
                              
                              if (parentFormula && typeof parentFormula === 'string' && parentFormula.trim() !== '') {
                                // Strip "y =" from question text before parsing transform
                                const strippedText = currentQuestion.question_text.replace(/y\s*=\s*/gi, '');
                                const transform = parseTransformFromQuestionText(strippedText);
                                
                                if (transform) {
                                  const hasTransform = transform.shiftX !== 0 || transform.shiftY !== 0 ||
                                    transform.scaleY !== 1 || (transform.scaleX !== undefined && transform.scaleX !== 1) ||
                                    transform.reflectX || transform.reflectY;
                                  
                                  if (hasTransform) {
                                    const transformedFormula = applyFormulaTransform(parentFormula, transform);
                                    console.log('[Review] PARENT INHERITANCE: Applying transform to parent formula', {
                                      parentFormula, transform, transformedFormula
                                    });
                                    
                                    const formulaCurve = generateCurveFromFormula(transformedFormula, domainX);
                                    if (formulaCurve.length > 0) {
                                      expectedCurveSeries = formulaCurve;
                                      console.log('[Review] SUCCESS: Generated curve from parent formula + transform, points:', 
                                        formulaCurve.reduce((s, b) => s + b.data.length, 0));
                                    }
                                  } else {
                                    // No transform detected but references parent - use parent formula directly
                                    const formulaCurve = generateCurveFromFormula(parentFormula, domainX);
                                    if (formulaCurve.length > 0) {
                                      expectedCurveSeries = formulaCurve;
                                      console.log('[Review] PARENT DIRECT: Using parent formula directly:', parentFormula);
                                    }
                                  }
                                } else {
                                  // parseTransformFromQuestionText returned null, try parent formula directly
                                  const formulaCurve = generateCurveFromFormula(parentFormula, domainX);
                                  if (formulaCurve.length > 0) {
                                    expectedCurveSeries = formulaCurve;
                                    console.log('[Review] PARENT FALLBACK: No transform detected, using parent formula:', parentFormula);
                                  }
                                }
                              }
                            }
                          }
                        }
                        
                        // Step 1.7: expectedPath — connect-the-dots for piecewise/non-math answers
                        if (expectedCurveSeries.length === 0 && plottingAnswer) {
                          const expectedPath = (plottingAnswer as any).expectedPath;
                          if (Array.isArray(expectedPath) && expectedPath.length >= 2) {
                            expectedCurveSeries = [{
                              id: 'expected-path',
                              label: 'Expected Answer',
                              data: expectedPath.map((p: any) => ({ x: p.x, y: p.y })),
                              color: 'hsl(var(--success))',
                              showLine: true,
                              lineStyle: 'solid' as const,
                            }];
                            console.log('[Review] EXPECTED PATH: Using connect-the-dots mode with', expectedPath.length, 'vertices');
                          }
                        }
                        
                        // Step 2: Legacy fallback — use cached expectedCurve coordinates
                        if (expectedCurveSeries.length === 0 && expCurve) {
                          console.log('[Review] LEGACY FALLBACK: Using cached expectedCurve (no valid markingFormula)');
                          if (Array.isArray(expCurve) && expCurve.length > 0 && typeof expCurve[0] === 'object' && 'data' in expCurve[0]) {
                            expectedCurveSeries = expCurve.map((branch: any, idx: number) => ({
                              id: branch.id || `expected-branch-${idx}`,
                              label: branch.label || `Expected ${idx + 1}`,
                              data: branch.data || [],
                              color: branch.color || 'hsl(var(--success))',
                              showLine: branch.showLine !== false,
                              lineStyle: 'solid' as const,
                            }));
                          } else if (expCurve && typeof expCurve === 'object' && !Array.isArray(expCurve) && Array.isArray(expCurve.data)) {
                            expectedCurveSeries = [{
                              id: expCurve.id || 'expected-answer',
                              label: expCurve.label || 'Expected Answer',
                              data: expCurve.data,
                              color: expCurve.color || 'hsl(var(--success))',
                              showLine: expCurve.showLine !== false,
                              lineStyle: 'solid' as const,
                            }];
                          } else if (Array.isArray(expCurve) && expCurve.length > 0 && typeof expCurve[0] === 'object' && 'x' in expCurve[0]) {
                            expectedCurveSeries = [{
                              id: 'expected-answer',
                              label: 'Expected Answer',
                              data: expCurve,
                              color: 'hsl(var(--success))',
                              showLine: true,
                              lineStyle: 'solid' as const,
                            }];
                          }
                        }
                        
                        // Step 3: Runtime fallback — extract formula from question text
                        // Handles: plain text, LaTeX ($...$), Unicode superscripts, transformations
                        if (expectedCurveSeries.length === 0) {
                          const qText = currentQuestion.question_text || '';
                          
                          // Strip LaTeX and normalize to evaluatable math
                          const stripAndClean = (raw: string): string => {
                            let f = raw.trim();
                            // Remove LaTeX wrappers
                            f = f.replace(/\$\$/g, '').replace(/\$/g, '');
                            // LaTeX commands → plain
                            f = f.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');
                            f = f.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');
                            f = f.replace(/\\ln\b/g, 'ln').replace(/\\log\b/g, 'log');
                            f = f.replace(/\\sin\b/g, 'sin').replace(/\\cos\b/g, 'cos').replace(/\\tan\b/g, 'tan');
                            f = f.replace(/\\pi\b/g, 'pi');
                            f = f.replace(/\\left\s*/g, '').replace(/\\right\s*/g, '');
                            f = f.replace(/\\cdot/g, '*').replace(/\\times/g, '*');
                            f = f.replace(/\\,/g, '');
                            f = f.replace(/\{([^}]+)\}/g, '($1)');
                            // Unicode superscripts
                            f = f.replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4');
                            // Implicit multiplication
                            f = f.replace(/(\d)(x)/gi, '$1*$2');
                            f = f.replace(/\)\(/g, ')*(');
                            f = f.replace(/(\d)\(/g, '$1*(');
                            f = f.replace(/\)(x)/gi, ')*$1');
                            f = f.replace(/[.\s]+$/, '');
                            return f;
                          };
                          
                          const plainText = stripAndClean(qText);
                          
                          // 1. Extract base function definition: f(x) = ...
                          const baseFnMatch = plainText.match(/([a-zA-Z])\(x\)\s*=\s*([^,.;]+(?:[\+\-][^,.;]+)*)/);
                          // 2. Detect transformation request: "sketch y = f(x+1)" or "y = g(2x)"
                          const transformMatch = plainText.match(/(?:sketch|draw|plot)\s+.*?y\s*=\s*([a-zA-Z])\(([^)]+)\)/i);
                          
                          let finalFormula: string | null = null;
                          
                          if (baseFnMatch && transformMatch && transformMatch[1] === baseFnMatch[1]) {
                            // Transformation case
                            const baseExpr = stripAndClean(baseFnMatch[2]);
                            const transformArg = transformMatch[2].trim();
                            finalFormula = baseExpr.replace(/x/gi, `(${transformArg})`);
                            console.log('[Review] RUNTIME FALLBACK: transform detected, base:', baseExpr, 'arg:', transformArg, '→', finalFormula);
                          } else if (baseFnMatch) {
                            // Direct function
                            finalFormula = stripAndClean(baseFnMatch[2]);
                          } else {
                            // Try bare "y = ..." pattern
                            const yMatch = plainText.match(/y\s*=\s*([^,.;]+(?:[\+\-][^,.;]+)*)/);
                            if (yMatch) {
                              finalFormula = stripAndClean(yMatch[1]);
                            }
                          }
                          
                          if (finalFormula) {
                            const domainXLocal: [number, number] = config.domainX || [-10, 10];
                            const fallbackCurve = generateCurveFromFormula(finalFormula, domainXLocal);
                            if (fallbackCurve.length > 0) {
                              expectedCurveSeries = fallbackCurve;
                              console.log('[Review] RUNTIME FALLBACK: Generated curve from:', finalFormula);
                            } else {
                              console.warn('[Review] Formula extracted but curve generation failed:', finalFormula);
                            }
                          } else {
                            console.warn('[Review] No markingFormula or extractable formula — no answer line');
                          }
                        }
                      }
                      
                      return (
                        <div className="space-y-4">
                          {/* CRITICAL: Use composite key to FORCE complete re-mount when question changes */}
                          {/* This ensures all internal state (camera, undo/redo, selections) resets cleanly */}
                          <GraphPlottingQuestion
                            key={`graph-plotting-${currentQuestion.id}-${currentIndex}`}
                            questionId={currentQuestion.id}
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
                            studentPoints={currentAnswer.graphPlottedPoints || []}
                            showProtractor={showProtractor}
                            selectedSegmentIds={selectedSegmentIds}
                            onSelectedSegmentIdsChange={handleSegmentSelection}
                            referenceSeries={refSeries}
                            expectedCurveSeries={expectedCurveSeries}
                            onPointsChange={(points) => {
                              let serializedToSave = '';
                              setUserAnswers((prev) => {
                                const existing = prev[currentQuestion.id] ?? currentAnswer;
                                const serialized = serializeGraphPlottingResponse(
                                  points,
                                  existing.graphJoinMode,
                                  existing.graphSegments,
                                  existing.graphDrawnPaths,
                                  existing.graphBestFitLine
                                );
                                serializedToSave = serialized;
                                return {
                                  ...prev,
                                  [currentQuestion.id]: {
                                    ...existing,
                                    answer: serialized,
                                    graphPlottedPoints: points,
                                  },
                                };
                              });
                              debouncedSave(currentQuestion.id, { answer: serializedToSave });
                            }}
                            joinMode={currentAnswer.graphJoinMode}
                            onJoinModeChange={(mode) => {
                              let serializedToSave = '';
                              setUserAnswers((prev) => {
                                const existing = prev[currentQuestion.id] ?? currentAnswer;
                                const points = existing.graphPlottedPoints || [];
                                const serialized = serializeGraphPlottingResponse(
                                  points,
                                  mode,
                                  existing.graphSegments,
                                  existing.graphDrawnPaths,
                                  existing.graphBestFitLine
                                );
                                serializedToSave = serialized;
                                return {
                                  ...prev,
                                  [currentQuestion.id]: {
                                    ...existing,
                                    answer: serialized,
                                    graphJoinMode: mode,
                                  },
                                };
                              });
                              debouncedSave(currentQuestion.id, { answer: serializedToSave });
                            }}
                            segments={currentAnswer.graphSegments}
                            onSegmentsChange={(segments) => {
                              let serializedToSave = '';
                              setUserAnswers((prev) => {
                                const existing = prev[currentQuestion.id] ?? currentAnswer;
                                const serialized = serializeGraphPlottingResponse(
                                  existing.graphPlottedPoints || [],
                                  existing.graphJoinMode,
                                  segments,
                                  existing.graphDrawnPaths,
                                  existing.graphBestFitLine
                                );
                                serializedToSave = serialized;
                                return {
                                  ...prev,
                                  [currentQuestion.id]: {
                                    ...existing,
                                    answer: serialized,
                                    graphSegments: segments,
                                  },
                                };
                              });
                              debouncedSave(currentQuestion.id, { answer: serializedToSave });
                            }}
                            drawnPaths={currentAnswer.graphDrawnPaths}
                            onDrawnPathsChange={(paths) => {
                              let serializedToSave = '';
                              setUserAnswers((prev) => {
                                const existing = prev[currentQuestion.id] ?? currentAnswer;
                                const serialized = serializeGraphPlottingResponse(
                                  existing.graphPlottedPoints || [],
                                  existing.graphJoinMode,
                                  existing.graphSegments,
                                  paths,
                                  existing.graphBestFitLine
                                );
                                serializedToSave = serialized;
                                return {
                                  ...prev,
                                  [currentQuestion.id]: {
                                    ...existing,
                                    answer: serialized,
                                    graphDrawnPaths: paths,
                                  },
                                };
                              });
                              debouncedSave(currentQuestion.id, { answer: serializedToSave });
                            }}
                            bestFitLine={currentAnswer.graphBestFitLine ?? null}
                            onBestFitLineChange={(line) => {
                              let serializedToSave = '';
                              setUserAnswers((prev) => {
                                const existing = prev[currentQuestion.id] ?? currentAnswer;
                                const serialized = serializeGraphPlottingResponse(
                                  existing.graphPlottedPoints || [],
                                  existing.graphJoinMode,
                                  existing.graphSegments,
                                  existing.graphDrawnPaths,
                                  line
                                );
                                serializedToSave = serialized;
                                return {
                                  ...prev,
                                  [currentQuestion.id]: {
                                    ...existing,
                                    answer: serialized,
                                    graphBestFitLine: line,
                                  },
                                };
                              });
                              debouncedSave(currentQuestion.id, { answer: serializedToSave });
                            }}
                            readOnly={currentAnswer.submitted}
                            showCorrectAnswers={currentAnswer.submitted && !!currentAnswer.feedback}
                            markingData={currentAnswer.graphMarkingData?.perPointResults ? {
                              perPointResults: currentAnswer.graphMarkingData.perPointResults,
                              totalScore: currentAnswer.score || 0,
                              totalMarks: currentQuestion.marks,
                            } : undefined}
                            subjectColor={subjectColor}
                            angleMeasurements={angleMeasurements}
                            onAngleMeasurementsChange={setAngleMeasurements}
                            questionText={currentQuestion.question_text}
                          />
                        </div>
                      );
                    }
                    
                    // Nuclear equation completion input
                    if (isNuclearEquationQuestion(currentQuestion.question_text ?? '')) {
                      const eq = extractEquationFromQuestionText(currentQuestion.question_text ?? '');
                      if (eq) {
                        const data = parseNuclearEquation(eq, currentQuestion.correct_answer);
                        if (data.blankCount > 0) {
                          return (
                            <div className="space-y-2">
                              <span className="text-sm font-medium text-muted-foreground">Your Answer</span>
                              <NuclearEquationInput
                                terms={data.terms}
                                correctAnswer={data.correctAnswer}
                                showCorrect={!!currentAnswer?.submitted}
                                disabled={!!currentAnswer?.submitted}
                                onAnswerChange={(answer) => {
                                  const newAnswer = { ...currentAnswer, answer };
                                  setUserAnswers({ ...userAnswers, [currentQuestion.id]: newAnswer });
                                  debouncedSave(currentQuestion.id, { answer });
                                }}
                              />
                            </div>
                          );
                        }
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
                  </QuizQuestionErrorBoundary>

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
                        {/* MCQ Rationale Insight Box — on-demand in review/submitted mode */}
                        {currentQuestion.question_type === 'mcq' && (currentAnswer.submitted || isReviewMode) && (
                          <OnDemandRationaleBox question={currentQuestion} subjectName={quizTitle} />
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
              {/* In review mode: show only navigation buttons + Exit review */}
              {isReviewMode ? (
                <>
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
                    onClick={() => navigate('/quizzes')} 
                    variant="default"
                    size="lg" 
                    className="flex-1 min-w-0"
                  >
                    <span className="truncate">Exit Review</span>
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
                </>
              ) : (
                <>
                  <Button 
                    onClick={() => guardNavigation(() => { setCurrentIndex(prev => prev - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); })} 
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
                    onClick={() => guardNavigation(() => { setCurrentIndex(prev => prev + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); })} 
                    disabled={currentIndex === questions.length - 1} 
                    variant="outline" 
                    size="lg" 
                    className="flex-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4 ml-1 lg:ml-2" />
                  </Button>
                </>
              )}
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
              await handleSubmitAll();
            }}>Submit Quiz</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showPracticeSelfMarkModal && practiceDrawQuestionsForReview.length > 0 && (
        <SelfMarkReviewModal
          questions={practiceDrawQuestionsForReview}
          onComplete={handlePracticeSelfMarkComplete}
          onDismiss={() => {
            setShowPracticeSelfMarkModal(false);
            pendingSubmitAllRef.current = false;
          }}
        />
      )}
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
            <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 8 }}>
              You have an unsaved diagram
            </div>
            <div style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', lineHeight: 1.6, marginBottom: 20 }}>
              You have drawn a diagram for this question but have not saved it yet. Your diagram will not be included if you leave without saving. This cannot be undone.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => { setShowUnsavedWarning(false); setPendingNavigation(null); }}
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
      {/* Content Disclaimer Footer */}
      <div className="border-t border-border bg-muted/30 py-3 px-6 text-center mt-auto">
        <p className="text-xs text-muted-foreground">
          Original AI-generated content for educational practice. Not affiliated with or endorsed by any official examination board.
        </p>
      </div>
    </div>
  );
};

export default TakePracticeQuiz;
