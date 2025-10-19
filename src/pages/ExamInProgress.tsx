import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Check, Circle, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

const ExamInProgress = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Set<string>>(new Set());
  const [isTeacher, setIsTeacher] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    loadQuestions();
  }, [examId]);

  useEffect(() => {
    if (!isTeacher && !loading) {
      const interval = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime.current) / 1000));
        
        if (timerEnabled) {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              handleAutoSubmit();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isTeacher, loading, timerEnabled]);

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-exam-questions', {
        body: { examId }
      });

      if (error) throw error;

      if (data.submission) {
        navigate(`/exam/${examId}/review`);
        return;
      }

      setQuestions(data.questions || []);
      setIsTeacher(data.isTeacher);
      
      if (data.timer?.enabled) {
        setTimerEnabled(true);
        setTimeRemaining(data.timer.duration_minutes * 60);
      }

      const answersMap: Record<string, string> = {};
      const savedSet = new Set<string>();
      (data.existingAnswers || []).forEach((ans: any) => {
        answersMap[ans.question_id] = ans.answer_text;
        savedSet.add(ans.question_id);
      });
      setUserAnswers(answersMap);
      setSavedAnswers(savedSet);

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = useCallback((questionId: string, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
    setSavedAnswers(prev => {
      const newSet = new Set(prev);
      newSet.delete(questionId);
      return newSet;
    });

    if (saveTimeouts.current[questionId]) {
      clearTimeout(saveTimeouts.current[questionId]);
    }

    saveTimeouts.current[questionId] = setTimeout(() => {
      handleSaveAnswer(questionId, answer);
    }, 1000);
  }, []);

  const handleSaveAnswer = async (questionId: string, answer: string) => {
    try {
      const { error } = await supabase.functions.invoke('submit-student-answer', {
        body: { examId, questionId, answerText: answer }
      });

      if (error) throw error;

      setSavedAnswers(prev => new Set(prev).add(questionId));
    } catch (error: any) {
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    }
  };

  const scrollToQuestion = (questionId: string) => {
    questionRefs.current[questionId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleAutoSubmit = () => {
    toast({ title: "Time's Up!", description: "Auto-submitting exam...", variant: "destructive" });
    submitExam();
  };

  const submitExam = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-exam', {
        body: { examId, timeTakenSeconds: timeElapsed }
      });

      if (error) throw error;

      toast({ 
        title: "Exam Submitted!", 
        description: `Score: ${data.totalScore}/${data.totalMarks} (${data.percentage.toFixed(1)}%)` 
      });
      
      navigate(`/exam/${examId}/review`);
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowSubmitDialog(false);
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

  const answeredCount = Object.keys(userAnswers).filter(id => userAnswers[id]?.trim()).length;
  const unansweredCount = questions.length - answeredCount;

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
        <div className="container flex items-center justify-between h-16 px-6">
          <h1 className="text-xl font-bold">Exam in Progress</h1>
          <div className="flex items-center gap-4">
            {timerEnabled && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${timeRemaining < 300 ? 'bg-destructive text-destructive-foreground' : 'bg-muted'}`}>
                <Clock className="w-5 h-5" />
                <span className="font-mono text-lg font-semibold">{formatTime(timeRemaining)}</span>
              </div>
            )}
            {!timerEnabled && !isTeacher && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                <Clock className="w-5 h-5" />
                <span className="font-mono text-lg">{formatTime(timeElapsed)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <div className="w-64 border-r bg-card/30 p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground">QUESTIONS</h2>
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q) => {
                const hasAnswer = userAnswers[q.id]?.trim();
                const isSaved = savedAnswers.has(q.id);
                
                return (
                  <button
                    key={q.id}
                    onClick={() => scrollToQuestion(q.id)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all hover:scale-105 ${
                      hasAnswer 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {hasAnswer ? <Check className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Answered:</span>
              <span className="font-semibold text-primary">{answeredCount}/{questions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-semibold">{unansweredCount}</span>
            </div>
          </div>

          {!isTeacher && (
            <Button 
              size="lg" 
              onClick={() => setShowSubmitDialog(true)}
              disabled={isSubmitting}
              className="mt-auto"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Exam
            </Button>
          )}
        </div>

        {/* Main Panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="container max-w-4xl py-8 px-6 space-y-6">
            {questions.map((question) => (
              <Card 
                key={question.id} 
                ref={(el) => questionRefs.current[question.id] = el}
                className="p-6"
              >
                <div className="flex items-start gap-4 mb-4">
                  <Badge variant="outline" className="shrink-0">Q{question.question_number}</Badge>
                  <Badge variant="secondary" className="capitalize shrink-0">{question.question_type}</Badge>
                  <Badge className="shrink-0">{question.marks} marks</Badge>
                  <div className="ml-auto">
                    {savedAnswers.has(question.id) ? (
                      <div className="flex items-center gap-1 text-sm text-primary">
                        <Check className="w-4 h-4" />
                        <span>Saved</span>
                      </div>
                    ) : userAnswers[question.id] && !savedAnswers.has(question.id) ? (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Circle className="w-3 h-3 animate-pulse" />
                        <span>Saving...</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="prose prose-sm max-w-none mb-4">
                  <p className="text-base leading-relaxed">{question.question_text}</p>
                </div>

                {question.figure_urls && question.figure_urls.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {question.figure_urls.map((url, idx) => (
                      <img key={idx} src={url} alt={`Figure ${idx + 1}`} className="rounded-lg border" />
                    ))}
                  </div>
                )}

                {question.question_type === 'mcq' && question.options ? (
                  <RadioGroup 
                    value={userAnswers[question.id] || ''} 
                    onValueChange={(val) => handleAnswerChange(question.id, val)}
                    disabled={isTeacher}
                  >
                    {question.options.map((option, idx) => (
                      <div key={idx} className="flex items-center space-x-2 p-3 rounded-lg hover:bg-accent">
                        <RadioGroupItem value={option.text} id={`${question.id}-${idx}`} />
                        <Label htmlFor={`${question.id}-${idx}`} className="flex-1 cursor-pointer">
                          {option.text}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Textarea 
                    placeholder={isTeacher ? "Answer key displayed for teachers" : "Type your answer here..."}
                    value={isTeacher ? question.correct_answer || '' : userAnswers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="min-h-[150px] resize-y"
                    disabled={isTeacher}
                  />
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              {unansweredCount > 0 ? (
                <div className="flex items-start gap-2 text-destructive">
                  <AlertCircle className="w-5 h-5 mt-0.5" />
                  <span>You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}. Are you sure you want to submit?</span>
                </div>
              ) : (
                "You've answered all questions. Ready to submit?"
              )}
              <p className="mt-2 text-muted-foreground">Once submitted, you cannot change your answers.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Answers</AlertDialogCancel>
            <AlertDialogAction onClick={submitExam} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExamInProgress;
