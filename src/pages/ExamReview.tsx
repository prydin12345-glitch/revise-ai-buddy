import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CheckCircle, XCircle, AlertCircle, Clock, Award } from "lucide-react";
import { MathRenderer } from "@/components/MathRenderer";

interface Question {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: { text: string }[];
  figure_urls?: string[];
  correct_answer?: string;
}

interface Answer {
  question_id: string;
  answer_text: string;
  score: number;
  feedback: string;
  is_correct: boolean;
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
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
    if (!answer) return <XCircle className="w-5 h-5 text-destructive" />;
    if (answer.is_correct) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (answer.score > 0) return <AlertCircle className="w-5 h-5 text-orange-500" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  const getStatusColor = (answer?: Answer) => {
    if (!answer) return 'bg-destructive/10 text-destructive';
    if (answer.is_correct) return 'bg-green-500/10 text-green-600';
    if (answer.score > 0) return 'bg-orange-500/10 text-orange-600';
    return 'bg-destructive/10 text-destructive';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const percentage = submission ? (submission.total_score / submission.total_marks) * 100 : 0;
  const correctCount = Object.values(answers).filter(a => a.is_correct).length;
  const partialCount = Object.values(answers).filter(a => !a.is_correct && a.score > 0).length;
  const incorrectCount = questions.length - correctCount - partialCount;

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
          <div />
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
                
                return (
                  <button
                    key={q.id}
                    onClick={() => scrollToQuestion(q.id)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-105 ${
                      answer?.is_correct 
                        ? 'bg-green-500 text-white' 
                        : answer?.score > 0
                        ? 'bg-orange-500 text-white'
                        : 'bg-destructive text-destructive-foreground'
                    }`}
                  >
                    {q.question_number}
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <span className="font-semibold">Your Score</span>
            </div>
            <div className="text-3xl font-bold text-primary">
              {submission?.total_score}/{submission?.total_marks}
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
                      {getStatusIcon(answer)}
                      {answer && (
                        <Badge className={getStatusColor(answer)}>
                          {answer.score}/{question.marks}
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
                      {answer?.answer_text ? (
                        (() => {
                          try {
                            const parsed = JSON.parse(answer.answer_text);
                            if (parsed.workingOut || parsed.finalAnswer) {
                              return (
                                <>
                                  {parsed.workingOut && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1">Working Out:</div>
                                      <MathRenderer 
                                        content={parsed.workingOut}
                                        hasMath={!!(question as any).has_math}
                                        className="font-mono text-sm"
                                      />
                                    </div>
                                  )}
                                  {parsed.finalAnswer && (
                                    <div>
                                      <div className="text-xs font-semibold text-muted-foreground mb-1">Final Answer:</div>
                                      <MathRenderer 
                                        content={parsed.finalAnswer}
                                        hasMath={!!(question as any).has_math}
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
                              hasMath={!!(question as any).has_math}
                            />
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground italic">No answer provided</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-semibold mb-2 text-green-600">Correct Answer:</div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      {question.correct_answer ? (
                        <MathRenderer 
                          content={question.correct_answer}
                          hasMath={!!(question as any).has_math}
                        />
                      ) : (
                        <span className="text-muted-foreground italic">Not provided</span>
                      )}
                    </div>
                  </div>

                    {answer?.feedback && (
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
    </div>
  );
};

export default ExamReview;
