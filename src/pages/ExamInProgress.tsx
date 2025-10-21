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
import { Loader2, Clock, Check, Circle, AlertCircle, Menu, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [existingAnswers, setExistingAnswers] = useState<any[]>([]);
  const [submission, setSubmission] = useState<any>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const startTime = useRef<number>(Date.now());
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadQuestions();
  }, [examId]);

  useEffect(() => {
    if (!isTeacher && !loading && !isSubmitting) {
      timerInterval.current = setInterval(() => {
        setTimeElapsed(Math.floor((Date.now() - startTime.current) / 1000));
        
        if (timerEnabled) {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              if (timerInterval.current) clearInterval(timerInterval.current);
              handleAutoSubmit();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);

      return () => {
        if (timerInterval.current) clearInterval(timerInterval.current);
      };
    }
  }, [isTeacher, loading, timerEnabled, isSubmitting]);

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
      setExistingAnswers(data.existingAnswers || []);
      setSubmission(data.submission || null);
      
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

  // Group questions by parent number for pagination
  const groupedQuestions = questions.reduce((acc, question) => {
    const parentNum = question.question_number.split('.')[0];
    if (!acc[parentNum]) acc[parentNum] = [];
    acc[parentNum].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  const questionGroups = Object.entries(groupedQuestions).map(([parent, qs]) => ({
    parent,
    questions: qs
  }));

  const currentGroup = questionGroups[currentPage] || { parent: '1', questions: [] };
  const hasNextPage = currentPage < questionGroups.length - 1;
  const hasPrevPage = currentPage > 0;

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
        <div className="container flex items-center justify-between h-16 px-6 max-w-none">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Exam in Progress</h1>
            <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
              <span>Answered: <strong className="text-primary">{answeredCount}</strong></span>
              <span>•</span>
              <span>Remaining: <strong className="text-foreground">{unansweredCount}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {timerEnabled && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${timeRemaining < 300 ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-muted'}`}>
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

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Collapsible */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 border-r bg-card/30 overflow-hidden`}>
          <div className="p-6 flex flex-col gap-6 h-full">
            <div>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">QUESTIONS</h2>
              <div className="grid grid-cols-4 gap-2">
                {questions.map((q) => {
                  const hasAnswer = userAnswers[q.id]?.trim();
                  const answer = existingAnswers?.find((a: any) => a.question_id === q.id);
                  
                  // Determine color based on submission status
                  let colorClass = '';
                  if (submission && answer) {
                    // Post-submission colors
                    if (answer.is_correct === true) {
                      colorClass = 'bg-green-500 text-white'; // Correct
                    } else if (answer.score > 0 && answer.score < q.marks) {
                      colorClass = 'bg-orange-500 text-white'; // Partial
                    } else {
                      colorClass = 'bg-red-500 text-white'; // Incorrect
                    }
                  } else {
                    // Pre-submission colors
                    colorClass = hasAnswer 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80';
                  }
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        const groupIndex = questionGroups.findIndex(g => 
                          g.questions.some(question => question.id === q.id)
                        );
                        if (groupIndex !== -1) {
                          setCurrentPage(groupIndex);
                          setTimeout(() => scrollToQuestion(q.id), 100);
                        }
                      }}
                      className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all hover:scale-105 ${colorClass}`}
                      title={`Question ${q.question_number}`}
                    >
                      {q.question_number}
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
          <div className="border-b bg-muted/30 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:flex"
              >
                <Menu className="h-4 w-4 mr-2" />
                {sidebarOpen ? 'Hide' : 'Show'} Navigation
              </Button>
              <span className="text-sm font-medium">
                Section {currentGroup.parent} 
                <span className="text-muted-foreground ml-2">
                  ({currentGroup.questions.length} question{currentGroup.questions.length !== 1 ? 's' : ''})
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => prev - 1)}
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
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!hasNextPage}
              >
                Next Section
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>

          {/* Questions Container */}
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-5xl py-8 px-6 space-y-6">
              {currentGroup.questions.map((question) => (
                <Card 
                  key={question.id} 
                  ref={(el) => questionRefs.current[question.id] = el}
                  className="p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        Q{question.question_number}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {question.question_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
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
                      <Badge className="text-base px-3 py-1">{question.marks} marks</Badge>
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none mb-6">
                    <p className="text-base leading-relaxed text-foreground">{question.question_text}</p>
                  </div>

                  {question.figure_urls && question.figure_urls.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      {question.figure_urls.map((url, idx) => (
                        <img key={idx} src={url} alt={`Figure ${idx + 1}`} className="rounded-lg border w-full" />
                      ))}
                    </div>
                  )}

                  {question.question_type === 'mcq' && question.options ? (
                    <RadioGroup 
                      value={userAnswers[question.id] || ''} 
                      onValueChange={(val) => handleAnswerChange(question.id, val)}
                      disabled={isTeacher}
                      className="space-y-2"
                    >
                      {question.options.map((option, idx) => (
                        <div key={idx} className="flex items-center space-x-3 p-4 rounded-lg border hover:bg-accent transition-colors cursor-pointer">
                          <RadioGroupItem value={option.text} id={`${question.id}-${idx}`} />
                          <Label htmlFor={`${question.id}-${idx}`} className="flex-1 cursor-pointer text-base">
                            {option.text}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <Textarea 
                      placeholder={isTeacher ? "Answer key (read-only)" : "Your Answer"}
                      value={isTeacher ? question.correct_answer || '' : userAnswers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      onBlur={(e) => {
                        if (e.target.value && !isTeacher) {
                          handleSaveAnswer(question.id, e.target.value);
                        }
                      }}
                      className="min-h-[200px] resize-y text-base"
                      disabled={isTeacher}
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
              onClick={() => setCurrentPage(prev => prev - 1)}
              disabled={!hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous Section
            </Button>
            
            {hasNextPage ? (
              <Button
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next Section
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : !isTeacher && (
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
    </div>
  );
};

export default ExamInProgress;
