import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, Award, Save, MessageCircle, EyeOff } from "lucide-react";
import { MathRenderer } from "@/components/MathRenderer";
import { FeedbackThreadModal } from "@/components/exam/FeedbackThreadModal";
import { BoxPlotChart, isBoxPlotQuestion } from "@/components/graph/BoxPlotChart";
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
  options?: { text: string }[];
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

const ExamReview = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoresHidden, setScoresHidden] = useState(false);
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

      // If it's an assigned exam and grades aren't released, hide scores
      const isAssignedExam = assignment || exam?.assigned_by;
      const gradesReleased = assignment?.is_grades_released || exam?.grade_released;
      setScoresHidden(!!isAssignedExam && !gradesReleased);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const scrollToQuestion = (questionId: string) => {
    questionRefs.current[questionId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex items-center justify-between h-16 px-6">
          <Button variant="ghost" onClick={() => navigate('/my-exams')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Exams
          </Button>
          <h1 className="text-xl font-bold">Exam Review</h1>
          <Button onClick={handleSaveToDashboard} className="gap-2">
            <Save className="w-4 h-4" />
            Save to Dashboard
          </Button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <div className="w-64 border-r bg-card/30 p-6 flex flex-col gap-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          <div>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground">QUESTIONS</h2>
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q) => {
                const answer = answers[q.id];
                
                if (scoresHidden) {
                  return (
                    <button
                      key={q.id}
                      onClick={() => scrollToQuestion(q.id)}
                      className="aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-105 bg-muted text-muted-foreground"
                      title="Score hidden"
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

        {/* Main Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="container max-w-4xl py-8 px-6 space-y-6">
            {questions.map((question) => {
              const answer = answers[question.id];
              
              return (
                <Card 
                  key={question.id} 
                  ref={(el) => questionRefs.current[question.id] = el}
                  className="p-6"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <Badge variant="outline" className="shrink-0">Q{question.question_number}</Badge>
                    <Badge variant="secondary" className="capitalize shrink-0">{question.question_type}</Badge>
                    <Badge className="shrink-0">{question.marks} marks</Badge>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedQuestionForFeedback({ id: question.id, number: question.question_number });
                          setFeedbackModalOpen(true);
                        }}
                        className="gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Ask for Help
                      </Button>
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
                  {isBoxPlotQuestion((question as any).options) && (
                    <BoxPlotChart chartData={(question as any).options} className="mb-4" />
                  )}

                  {question.figure_urls && question.figure_urls.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {question.figure_urls.map((url, idx) => (
                        <img key={idx} src={url} alt={`Figure ${idx + 1}`} className="rounded-lg border" />
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold mb-2 text-muted-foreground">Your Answer:</div>
                    <div className="p-3 rounded-lg bg-muted space-y-3">
                      {/* Check if this is a table_grid question and render visually */}
                      {(() => {
                        // Check if question contains a tick/X table
                        const isTableGridQuestion = isTickXTable(question.question_text);
                        
                        if (isTableGridQuestion && answer?.answer_text) {
                          // Parse the table data and student answers
                          const tableData = parseMarkdownToTableGrid(question.question_text);
                          const studentAnswers = deserializeTableGridAnswers(answer.answer_text);
                          
                          // Parse correct answers if available
                          let correctAnswers: Record<string, number[]> | undefined;
                          if (question.correct_answer && !scoresHidden) {
                            try {
                              const parsed = JSON.parse(question.correct_answer);
                              correctAnswers = parsed.correctAnswers || parsed;
                            } catch {
                              // Not JSON
                            }
                          }
                          
                          if (tableData && Object.keys(studentAnswers).length > 0) {
                            return (
                              <div>
                                <div className="text-xs font-semibold text-muted-foreground mb-2">Table completed:</div>
                                <TableGridQuestion
                                  tableData={tableData}
                                  questionId={question.id}
                                  answers={studentAnswers}
                                  onAnswerChange={() => {}} // Read-only
                                  readOnly={true}
                                  showCorrectAnswers={!scoresHidden && !!correctAnswers}
                                  correctAnswers={correctAnswers}
                                />
                              </div>
                            );
                          }
                        }
                        
                        // Fall back to regular answer display
                        return null;
                      })()}
                      
                      {/* Display table answers if present (legacy format) */}
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
                      
                      {/* Display text answer - skip if already rendered as table grid */}
                      {answer?.answer_text ? (
                        (() => {
                          // Skip if this was rendered as table grid
                          try {
                            const parsed = JSON.parse(answer.answer_text);
                            if (parsed._type === 'table_grid') {
                              // Already rendered above, skip
                              return null;
                            }
                            if (parsed.workingOut || parsed.finalAnswer) {
                              return (
                                <>
                                  {parsed.workingOut && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1">Working Out:</div>
                                      <MathRenderer 
                                        content={parsed.workingOut}
                                        hasMath={!!question.has_math}
                                        className="font-mono text-sm"
                                      />
                                    </div>
                                  )}
                                  {parsed.finalAnswer && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1">Final Answer:</div>
                                      <MathRenderer 
                                        content={parsed.finalAnswer}
                                        hasMath={!!question.has_math}
                                        className="font-semibold"
                                      />
                                    </div>
                                  )}
                                </>
                              );
                            }
                          } catch {
                            // Not JSON, render as regular text
                          }
                          return (
                            <MathRenderer 
                              content={answer.answer_text}
                              hasMath={!!question.has_math}
                            />
                          );
                        })()
                      ) : !answer?.table_answers || Object.keys(answer.table_answers).length === 0 ? (
                        <span className="text-muted-foreground italic">No answer provided</span>
                      ) : null}
                    </div>
                  </div>

                  {!scoresHidden && (
                    <div>
                      <div className="text-sm font-semibold mb-2 text-green-600">Correct Answer:</div>
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        {(() => {
                          // For table_grid questions, show structured correct answer
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
                            } catch {
                              // Not JSON
                            }
                          }
                          
                          // Default display
                          return question.correct_answer ? (
                            <MathRenderer 
                              content={question.correct_answer}
                              hasMath={!!question.has_math}
                            />
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
                        <div className="p-3 rounded-lg bg-accent">
                          {answer.feedback}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
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