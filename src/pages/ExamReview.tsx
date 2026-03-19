import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, Award, Save, MessageCircle, EyeOff, Menu, X, Sparkles, Send } from "lucide-react";
import { MathRenderer } from "@/components/MathRenderer";
import { FeedbackThreadModal } from "@/components/exam/FeedbackThreadModal";
import { BoxPlotChart, isBoxPlotQuestion } from "@/components/graph/BoxPlotChart";
import { HistogramChart, isHistogramQuestion } from "@/components/graph/HistogramChart";
import { MechanicsFigurePanel, detectDiagramConfig } from "@/components/mechanics";
import { CircuitFigurePanel } from "@/components/circuit";
import { detectCircuitConfig } from "@/components/circuit/circuit-detector";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  TableGridQuestion, 
  parseMarkdownToTableGrid, 
  isTickXTable, 
  extractTextBeforeTable,
  deserializeTableGridAnswers,
  generateCorrectAnswerDisplay,
  TableGridData
} from "@/components/exam/TableGridQuestion";

interface Question {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: { text: string }[] | string[];
  figure_urls?: string[];
  correct_answer?: string;
  has_math?: boolean;
  question_latex?: string;
}

interface Answer {
  question_id: string;
  answer_text: string;
  score: number;
  feedback: string;
  is_correct: boolean;
  table_answers?: Record<string, any>;
}

interface Submission {
  submitted_at: string;
  total_score: number;
  total_marks: number;
  time_taken_seconds: number;
}

// ── Helper: resolve MCQ letter to full option text ──────────────────────────
function resolveOptionText(answerText: string | undefined, options: Question["options"]): string | null {
  if (!answerText || !options || !Array.isArray(options) || options.length === 0) return null;

  const trimmed = answerText.trim();
  // Check if the answer is a single letter A-Z
  if (/^[A-Za-z]$/.test(trimmed)) {
    const idx = trimmed.toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < options.length) {
      const opt = options[idx];
      return typeof opt === "string" ? opt : (opt as any)?.text ?? null;
    }
  }
  return null;
}

function getOptionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

// ── AI Explain Inline Component ─────────────────────────────────────────────
function AIExplainPanel({ question, answer }: { question: Question; answer?: Answer }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setExplanation(null);
    try {
      const { data, error } = await supabase.functions.invoke("explain-answer", {
        body: {
          questionText: question.question_text,
          correctAnswer: question.correct_answer,
          studentAnswer: answer?.answer_text,
          studentQuery: query.trim(),
          options: question.options,
        },
      });
      if (error) throw error;
      setExplanation(data.explanation);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to get explanation", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Explain</span>
      </Button>
    );
  }

  return (
    <div className="mt-4 p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" /> Ask AI
        </span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setOpen(false)}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      {!explanation && (
        <div className="flex gap-2">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Why is this the correct answer?"
            className="min-h-[60px] text-sm resize-none"
            rows={2}
          />
          <Button size="icon" onClick={handleAsk} disabled={loading || !query.trim()} className="shrink-0 self-end">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      )}
      {explanation && (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed">{explanation}</p>
          <Button size="sm" variant="ghost" onClick={() => { setExplanation(null); setQuery(""); }}>
            Ask another question
          </Button>
        </div>
      )}
    </div>
  );
}

const ExamReview = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoresHidden, setScoresHidden] = useState(false);
  const [isTutorAssigned, setIsTutorAssigned] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedQuestionForFeedback, setSelectedQuestionForFeedback] = useState<{ id: string; number: string } | null>(null);

  useEffect(() => {
    loadReview();
  }, [examId]);

  const loadReview = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-exam-questions', {
        body: { examId }
      });

      if (error) throw error;

      if (!data.submission) {
        toast({ title: "Not Submitted", description: "This exam hasn't been submitted yet.", variant: "destructive" });
        navigate(`/exam/${examId}/in-progress`);
        return;
      }

      setQuestions(data.questions || []);
      setSubmission(data.submission);

      const answersMap: Record<string, Answer> = {};
      (data.existingAnswers || []).forEach((ans: Answer) => {
        answersMap[ans.question_id] = ans;
      });
      setAnswers(answersMap);

      // Check grade release settings
      const { data: assignment } = await supabase
        .from('exam_assignments')
        .select('is_grades_released, assigned_by')
        .eq('exam_id', examId)
        .maybeSingle();

      const { data: exam } = await supabase
        .from('exams')
        .select('grade_released, assigned_by')
        .eq('id', examId)
        .single();

      const isAssignedExam = assignment || exam?.assigned_by;
      const gradesReleased = assignment?.is_grades_released || exam?.grade_released;
      setScoresHidden(!!isAssignedExam && !gradesReleased);
      setIsTutorAssigned(!!isAssignedExam);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const scrollToQuestion = (questionId: string) => {
    questionRefs.current[questionId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (isMobile) setSidebarOpen(false);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 
      ? `${hrs}h ${mins}m ${secs}s`
      : `${mins}m ${secs}s`;
  };

  const getStatusIcon = (answer?: Answer) => {
    if (scoresHidden) return <EyeOff className="w-5 h-5 text-muted-foreground" />;
    if (!answer) return <XCircle className="w-5 h-5 text-destructive" />;
    if (answer.is_correct) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (answer.score > 0) return <AlertCircle className="w-5 h-5 text-orange-500" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  const getStatusColor = (answer?: Answer) => {
    if (scoresHidden) return 'bg-muted text-muted-foreground';
    if (!answer) return 'bg-destructive/10 text-destructive';
    if (answer.is_correct) return 'bg-green-500/10 text-green-600';
    if (answer.score > 0) return 'bg-orange-500/10 text-orange-600';
    return 'bg-destructive/10 text-destructive';
  };

  const handleSaveToDashboard = () => {
    toast({ 
      title: "Results Saved", 
      description: "Your exam results have been saved to your dashboard." 
    });
    setTimeout(() => navigate('/my-exams'), 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const percentage = submission && !scoresHidden ? (submission.total_score / submission.total_marks) * 100 : 0;
  const correctCount = scoresHidden ? 0 : Object.values(answers).filter(a => a.is_correct).length;
  const partialCount = scoresHidden ? 0 : Object.values(answers).filter(a => !a.is_correct && a.score > 0).length;
  const incorrectCount = scoresHidden ? 0 : questions.length - correctCount - partialCount;

  // ── Sidebar Content (shared between mobile drawer and desktop sidebar) ────
  const sidebarContent = (
    <div className="p-4 lg:p-6 flex flex-col gap-5 h-full">
      <div>
        <h2 className="text-xs font-semibold mb-3 text-muted-foreground tracking-wide">QUESTIONS</h2>
        <div className="grid grid-cols-4 gap-2">
          {questions.map((q) => {
            const answer = answers[q.id];

            if (scoresHidden) {
              return (
                <button
                  key={q.id}
                  onClick={() => scrollToQuestion(q.id)}
                  className="aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-105 bg-muted text-muted-foreground"
                >
                  {q.question_number}
                </button>
              );
            }

            const isFullyCorrect = answer && answer.score === q.marks;
            const isPartial = answer && answer.score > 0 && answer.score < q.marks;

            return (
              <button
                key={q.id}
                onClick={() => scrollToQuestion(q.id)}
                className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-105 ${
                  isFullyCorrect
                    ? 'bg-green-500 text-white'
                    : isPartial
                    ? 'bg-orange-500 text-white'
                    : 'bg-destructive text-destructive-foreground'
                }`}
                title={answer ? `Score: ${Math.round(answer.score)}/${q.marks}` : 'Not answered'}
              >
                {q.question_number}
              </button>
            );
          })}
        </div>
      </div>

      {scoresHidden ? (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-muted-foreground" />
            <span className="font-semibold">Scores Hidden</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Your tutor has not released scores yet. Check back later.
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <span className="font-semibold">Your Score</span>
            </div>
            <div className="text-3xl font-bold text-primary">
              {Math.round(submission?.total_score || 0)}/{submission?.total_marks}
            </div>
            <div className="text-lg font-semibold text-muted-foreground">
              {percentage.toFixed(1)}%
            </div>
          </Card>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Correct</span>
              </div>
              <span className="font-semibold">{correctCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span>Partial</span>
              </div>
              <span className="font-semibold">{partialCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                <span>Incorrect</span>
              </div>
              <span className="font-semibold">{incorrectCount}</span>
            </div>
          </div>
        </>
      )}

      {submission && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t">
          <Clock className="w-4 h-4" />
          <span>Time: {formatTime(submission.time_taken_seconds)}</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between h-14 px-3 sm:px-6">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
                <Menu className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate('/my-exams')} className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Exams</span>
            </Button>
          </div>
          <h1 className="text-base sm:text-xl font-bold">Exam Review</h1>
          <Button size="sm" onClick={handleSaveToDashboard} className="gap-1.5">
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Save to Dashboard</span>
          </Button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 z-50 bg-card border-r overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-semibold text-sm">Overview</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            {sidebarContent}
          </div>
        </>
      )}

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="w-64 border-r bg-card/30 flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
            {sidebarContent}
          </div>
        )}

        {/* Main Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto py-4 sm:py-8 px-3 sm:px-6 space-y-6 sm:space-y-8">
            {questions.map((question, qIdx) => {
              const answer = answers[question.id];
              const subPartMatch = question.question_number.match(/^(\d+)([a-z].*)?$/i);
              const parentNum = subPartMatch?.[1] || question.question_number;
              const subPart = subPartMatch?.[2] || '';
              const isSubPart = !!subPart;
              const prevQ = qIdx > 0 ? questions[qIdx - 1] : null;
              const prevParent = prevQ?.question_number.match(/^(\d+)/)?.[1];
              const showParentHeader = isSubPart && parentNum !== prevParent;
              const isMcq = question.question_type === 'mcq' || (question.options && Array.isArray(question.options) && question.options.length > 0);

              return (
                <div key={question.id} className={isSubPart ? 'ml-2' : ''}>
                  {showParentHeader && (
                    <h2 className="text-xl font-bold mb-4 mt-2">Question {parentNum}</h2>
                  )}
                <Card 
                  ref={(el) => questionRefs.current[question.id] = el}
                  className={`p-4 sm:p-6 ${isSubPart ? 'border-l-4 border-l-muted' : ''}`}
                >
                  {/* Question header */}
                  <div className="flex items-start gap-2 sm:gap-4 mb-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      {isSubPart ? (
                        <span className="text-lg font-semibold shrink-0">({subPart})</span>
                      ) : (
                        <Badge variant="outline" className="shrink-0 font-bold">Q{question.question_number}</Badge>
                      )}
                      <span className="text-sm font-medium text-muted-foreground shrink-0">
                        ({question.marks} {question.marks === 1 ? 'mark' : 'marks'})
                      </span>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                      {/* Help button: AI explain for self-study, feedback thread for tutor-assigned */}
                      {isTutorAssigned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedQuestionForFeedback({ id: question.id, number: question.question_number });
                            setFeedbackModalOpen(true);
                          }}
                          className="gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Ask for Help</span>
                        </Button>
                      ) : null}
                      {getStatusIcon(answer)}
                      {!scoresHidden && answer && (
                        <Badge className={getStatusColor(answer)}>
                          {Math.round(answer.score)}/{question.marks}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <MathRenderer 
                    content={question.question_text}
                    latex={(question as any).question_latex}
                    hasMath={(question as any).has_math}
                    className="mb-4"
                  />

                   {/* Box Plot Chart */}
                   {!isMcq && isBoxPlotQuestion((question as any).options) && (
                     <BoxPlotChart chartData={(question as any).options} className="mb-4" />
                   )}
                   {!isMcq && isHistogramQuestion((question as any).options) && (
                     <HistogramChart chartData={(question as any).options} className="mb-4" />
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

                  {question.figure_urls && question.figure_urls.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {question.figure_urls.map((url, idx) => (
                        <img key={idx} src={url} alt={`Figure ${idx + 1}`} className="rounded-lg border" />
                      ))}
                    </div>
                  )}

                  {/* MCQ Options display */}
                  {isMcq && question.options && Array.isArray(question.options) && question.options.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {question.options.map((opt, idx) => {
                        const optText = typeof opt === "string" ? opt : (opt as any)?.text ?? "";
                        const label = getOptionLabel(idx);
                        const studentSelected = answer?.answer_text?.trim().toUpperCase() === label || answer?.answer_text?.trim() === optText;
                        const isCorrectOpt = question.correct_answer === optText || question.correct_answer === label || question.correct_answer?.trim() === optText;

                        let optClass = "p-3 rounded-lg border text-sm flex items-start gap-2 transition-colors ";
                        if (!scoresHidden && isCorrectOpt) {
                          optClass += "border-green-500 bg-green-500/10 ";
                        }
                        if (studentSelected && !scoresHidden && !isCorrectOpt) {
                          optClass += "border-destructive bg-destructive/10 ";
                        }
                        if (!studentSelected && !isCorrectOpt) {
                          optClass += "border-border bg-muted/30 ";
                        }

                        return (
                          <div key={idx} className={optClass}>
                            <span className="font-semibold shrink-0 w-6">{label})</span>
                            <span className="flex-1">{optText}</span>
                            {!scoresHidden && studentSelected && !isCorrectOpt && (
                              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            )}
                            {!scoresHidden && isCorrectOpt && (
                              <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            )}
                            {studentSelected && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">Your answer</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-4">
                  {/* For non-MCQ, show answer section */}
                  {!isMcq && (
                  <div>
                    <div className="text-sm font-semibold mb-2 text-muted-foreground">Your Answer:</div>
                    <div className="p-3 rounded-lg bg-muted space-y-3">
                      {/* Table grid answer display */}
                      {(() => {
                        const isTableGridQuestion = isTickXTable(question.question_text);
                        if (isTableGridQuestion && answer?.answer_text) {
                          const tableData = parseMarkdownToTableGrid(question.question_text);
                          const studentAnswers = deserializeTableGridAnswers(answer.answer_text);
                          let correctAnswers: Record<string, number[]> | undefined;
                          if (question.correct_answer && !scoresHidden) {
                            try {
                              const parsed = JSON.parse(question.correct_answer);
                              correctAnswers = parsed.correctAnswers || parsed;
                            } catch {}
                          }
                          if (tableData && Object.keys(studentAnswers).length > 0) {
                            return (
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground mb-2">Table completed:</div>
                                <TableGridQuestion
                                  tableData={tableData}
                                  questionId={question.id}
                                  answers={studentAnswers}
                                  onAnswerChange={() => {}}
                                  readOnly={true}
                                  showCorrectAnswers={!scoresHidden && !!correctAnswers}
                                  correctAnswers={correctAnswers}
                                />
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}

                      {answer?.table_answers && Object.keys(answer.table_answers).length > 0 && !isTickXTable(question.question_text) && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground mb-1">Table Responses:</div>
                          <div className="grid gap-1 text-sm">
                            {Object.entries(answer.table_answers).map(([cellKey, value]) => {
                              const displayValue = value === true ? '✓' : value === false ? '—' : String(value || '');
                              if (!displayValue || displayValue === '—') return null;
                              return (
                                <div key={cellKey} className="flex gap-2">
                                  <span className="text-muted-foreground">{cellKey}:</span>
                                  <span className="font-medium">{displayValue}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {answer?.answer_text ? (
                        (() => {
                          try {
                            const parsed = JSON.parse(answer.answer_text);
                            if (parsed._type === 'table_grid') return null;
                            if (parsed.workingOut || parsed.finalAnswer) {
                              return (
                                <>
                                  {parsed.workingOut && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1">Working Out:</div>
                                      <MathRenderer content={parsed.workingOut} hasMath={!!question.has_math} className="font-mono text-sm" />
                                    </div>
                                  )}
                                  {parsed.finalAnswer && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1">Final Answer:</div>
                                      <MathRenderer content={parsed.finalAnswer} hasMath={!!question.has_math} className="font-semibold" />
                                    </div>
                                  )}
                                </>
                              );
                            }
                          } catch {}
                          return <MathRenderer content={answer.answer_text} hasMath={!!question.has_math} />;
                        })()
                      ) : !answer?.table_answers || Object.keys(answer.table_answers).length === 0 ? (
                        <span className="text-muted-foreground italic">No answer provided</span>
                      ) : null}
                    </div>
                  </div>
                  )}

                  {/* For MCQ: show a compact "Your answer / Correct answer" summary below options */}
                  {isMcq && (
                    <div className="text-sm space-y-1">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground">Your answer:</span>
                        <span className="font-medium">
                          {answer?.answer_text 
                            ? (() => {
                                const resolved = resolveOptionText(answer.answer_text, question.options);
                                return resolved 
                                  ? `${answer.answer_text.trim().toUpperCase()}) ${resolved}` 
                                  : answer.answer_text;
                              })()
                            : <span className="italic text-muted-foreground">No answer</span>
                          }
                        </span>
                      </div>
                      {!scoresHidden && question.correct_answer && (
                        <div className="flex gap-2">
                          <span className="text-green-600 dark:text-green-400">Correct:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">{question.correct_answer}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Non-MCQ correct answer */}
                  {!isMcq && !scoresHidden && (
                    <div>
                      <div className="text-sm font-semibold mb-2 text-green-600">Correct Answer:</div>
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        {(() => {
                          if (isTickXTable(question.question_text) && question.correct_answer) {
                            try {
                              const parsed = JSON.parse(question.correct_answer);
                              const correctAnswers = parsed.correctAnswers || parsed;
                              const tableData = parseMarkdownToTableGrid(question.question_text);
                              if (tableData && correctAnswers && typeof correctAnswers === 'object') {
                                const display = generateCorrectAnswerDisplay(tableData, undefined, correctAnswers);
                                if (display) {
                                  return (
                                    <div className="space-y-1 text-sm">
                                      {display.split('\n').map((line, idx) => (
                                        <div key={idx}>{line}</div>
                                      ))}
                                    </div>
                                  );
                                }
                              }
                            } catch {}
                          }
                          return question.correct_answer ? (
                            <MathRenderer content={question.correct_answer} hasMath={!!question.has_math} />
                          ) : (
                            <span className="text-muted-foreground italic">Not provided</span>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                    {!scoresHidden && answer?.feedback && (
                      <div>
                        <div className="text-sm font-semibold mb-2 text-muted-foreground">Feedback:</div>
                        <div className="p-3 rounded-lg bg-accent text-sm">
                          {answer.feedback}
                        </div>
                      </div>
                    )}

                    {/* AI Explain for non-tutor exams */}
                    {!isTutorAssigned && !scoresHidden && (
                      <AIExplainPanel question={question} answer={answer} />
                    )}
                  </div>
                </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedQuestionForFeedback && (
        <FeedbackThreadModal
          open={feedbackModalOpen}
          onOpenChange={setFeedbackModalOpen}
          examId={examId!}
          questionId={selectedQuestionForFeedback.id}
          questionNumber={selectedQuestionForFeedback.number}
        />
      )}

      {/* Content Disclaimer Footer */}
      <div className="border-t border-border bg-muted/30 py-3 px-6 text-center">
        <p className="text-xs text-muted-foreground">
          Original AI-generated content for educational practice. Not affiliated with or endorsed by any official examination board.
        </p>
      </div>
    </div>
  );
};

export default ExamReview;
