import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Clock, Check, X, Menu, ChevronLeft, ChevronRight, MoreVertical, Flag, Eye, EyeOff, Send, Trophy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MathRenderer } from "@/components/MathRenderer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Helper to add opacity to hex color
const addOpacity = (hex: string, opacity: number): string => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

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
}

interface UserAnswer {
  answer: string;
  isCorrect?: boolean;
  submitted: boolean;
}

const TakePracticeQuiz = () => {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [practiceSet, setPracticeSet] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjectColor, setSubjectColor] = useState<string>('#3B82F6');
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerEnabled] = useState(false); // Can be enabled later
  const startTime = useRef<number>(Date.now());
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadQuiz();
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [setId]);

  // Timer effect
  useEffect(() => {
    timerInterval.current = setInterval(() => {
      setTimeElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFlag();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, questions]);

  const loadQuiz = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from('practice_question_sets')
        .select('*')
        .eq('id', setId)
        .single();

      if (setError) throw setError;
      setPracticeSet(setData);

      // Get subject color
      const { data: subjectData } = await supabase
        .from('user_subjects')
        .select('subject_color')
        .eq('subject_name', setData.subject_id)
        .single();
      
      if (subjectData?.subject_color) {
        setSubjectColor(subjectData.subject_color);
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('practice_questions')
        .select('*')
        .eq('set_id', setId)
        .order('question_number');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Initialize or load progress
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progressData } = await supabase
          .from('practice_set_progress')
          .select('*')
          .eq('user_id', user.id)
          .eq('set_id', setId)
          .maybeSingle();

        if (!progressData) {
          await supabase
            .from('practice_set_progress')
            .insert({
              user_id: user.id,
              set_id: setId,
              questions_attempted: 0,
              questions_correct: 0,
            });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const attempted = Object.keys(userAnswers).length;
      const correct = Object.values(userAnswers).filter(a => a.isCorrect).length;
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);

      await supabase
        .from('practice_set_progress')
        .update({
          questions_attempted: attempted,
          questions_correct: correct,
          time_spent_seconds: timeSpent,
          last_accessed_at: new Date().toISOString(),
          completed_at: attempted === questions.length ? new Date().toISOString() : null,
        })
        .eq('user_id', user.id)
        .eq('set_id', setId);
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  }, [userAnswers, questions, setId, startTime]);

  useEffect(() => {
    updateProgress();
  }, [userAnswers, updateProgress]);

  const handleAnswerChange = (answer: string) => {
    const currentQuestion = questions[currentIndex];
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        answer,
        submitted: false,
      }
    }));
  };

  const handleSubmitAnswer = () => {
    const currentQuestion = questions[currentIndex];
    const currentAnswer = userAnswers[currentQuestion.id];
    
    if (!currentAnswer?.answer?.trim()) {
      toast({ title: "No Answer", description: "Please provide an answer before submitting.", variant: "destructive" });
      return;
    }

    const isCorrect = currentAnswer.answer.trim().toLowerCase() === currentQuestion.correct_answer?.toLowerCase();
    
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        isCorrect,
        submitted: true,
      }
    }));

    toast({
      title: isCorrect ? "Correct! ✓" : "Incorrect ✗",
      description: isCorrect 
        ? "Well done! Your answer is correct." 
        : `The correct answer is: ${currentQuestion.correct_answer}`,
      variant: isCorrect ? "default" : "destructive",
    });
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleFlag = () => {
    const currentQuestion = questions[currentIndex];
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestion.id)) {
        newSet.delete(currentQuestion.id);
        toast({ title: "Flag Removed", description: "Question unflagged for review." });
      } else {
        newSet.add(currentQuestion.id);
        toast({ title: "Flagged", description: "Question flagged for review." });
      }
      return newSet;
    });
  };

  const handleFinishQuiz = async () => {
    setIsSubmitting(true);
    await updateProgress();
    setShowSubmitDialog(false);
    setShowResultsDialog(true);
    setIsSubmitting(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!questions.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">No questions found in this quiz.</p>
        <Button onClick={() => navigate('/quizzes')}>Back to My Quizzes</Button>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = userAnswers[currentQuestion.id];
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = Object.values(userAnswers).filter(a => a.isCorrect).length;
  const isFlagged = flaggedQuestions.has(currentQuestion.id);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left: Practice Set Name */}
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{practiceSet?.set_name || 'Practice Quiz'}</h1>
            <Badge variant="outline">{practiceSet?.subject_id}</Badge>
          </div>
          
          {/* Center: Timer */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
            <Clock className="w-5 h-5" />
            <span className="font-mono text-lg">{formatTime(timeElapsed)}</span>
          </div>
          
          {/* Right: Options Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
              <DropdownMenuLabel>Quiz Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="cursor-pointer"
              >
                {sidebarOpen ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {sidebarOpen ? 'Hide' : 'Show'} Navigation
              </DropdownMenuItem>
              
              <DropdownMenuItem
                onClick={toggleFlag}
                className="cursor-pointer"
              >
                <Flag className={`mr-2 h-4 w-4 ${isFlagged ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                {isFlagged ? 'Unflag' : 'Flag'} Question
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={() => setShowSubmitDialog(true)}
                className="cursor-pointer text-primary focus:text-primary"
              >
                <Send className="mr-2 h-4 w-4" />
                Finish Quiz
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Sidebar - Collapsible */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 border-r bg-card/30 overflow-hidden sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto`}>
          <div className="p-6 flex flex-col gap-6 h-full">
            <div>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">QUESTIONS</h2>
              <div className="grid grid-cols-4 gap-2">
                {questions.map((q, idx) => {
                  const answer = userAnswers[q.id];
                  const hasAnswer = Boolean(answer?.answer?.trim());
                  const isAnswered = answer?.submitted;
                  const isFlaggedQ = flaggedQuestions.has(q.id);
                  
                  let colorClass = '';
                  let inlineStyle: React.CSSProperties | undefined = undefined;
                  
                  if (isAnswered && answer.isCorrect === true) {
                    colorClass = 'bg-green-500 text-white'; // Correct
                  } else if (isAnswered && answer.isCorrect === false) {
                    colorClass = 'bg-red-500 text-white'; // Incorrect
                  } else if (hasAnswer) {
                    colorClass = 'text-white';
                    inlineStyle = { backgroundColor: subjectColor };
                  } else {
                    colorClass = 'bg-muted text-muted-foreground hover:bg-muted/80';
                  }
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      style={inlineStyle}
                      className={`relative aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all hover:scale-105 ${colorClass} ${currentIndex === idx ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                      title={`Question ${q.question_number}${isFlaggedQ ? ' (Flagged)' : ''}`}
                    >
                      {q.question_number}
                      {isFlaggedQ && (
                        <Flag className="absolute -top-1 -right-1 w-3 h-3 fill-yellow-500 text-yellow-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto space-y-2">
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Answered:</span>
                  <span className="font-medium">{answeredCount} / {questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Correct:</span>
                  <span className="font-medium text-green-600">{correctCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Flagged:</span>
                  <span className="font-medium text-yellow-600">{flaggedQuestions.size}</span>
                </div>
              </div>
              
              <Button 
                size="lg" 
                onClick={() => setShowSubmitDialog(true)}
                disabled={isSubmitting}
                variant="default"
                className="w-full"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
                Finish Quiz
              </Button>
            </div>
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toggle Navigation Bar */}
          <div className="border-b bg-muted/30 px-6 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-2"
            >
              <Menu className="h-4 w-4" />
              {sidebarOpen ? 'Hide' : 'Show'} Navigation
            </Button>
            <div className="text-sm text-muted-foreground">
              Question {currentIndex + 1} of {questions.length}
            </div>
          </div>

          {/* Question Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card className="p-6" style={{ backgroundColor: addOpacity(subjectColor, 0.05) }}>
                {/* Question Header */}
                <div className="flex items-center gap-3 mb-4">
                  <Badge 
                    className="text-white"
                    style={{ backgroundColor: subjectColor }}
                  >
                    Q{currentQuestion.question_number}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className="text-white border-white/20"
                    style={{ backgroundColor: subjectColor }}
                  >
                    {currentQuestion.marks} {currentQuestion.marks === 1 ? 'mark' : 'marks'}
                  </Badge>
                  {isFlagged && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                      <Flag className="w-3 h-3 mr-1 fill-yellow-500" />
                      Flagged
                    </Badge>
                  )}
                  <Badge variant="secondary" className="ml-auto">
                    {currentQuestion.subtopic}
                  </Badge>
                </div>

                {/* Question Text */}
                <div className="prose prose-sm max-w-none mb-6">
                  <MathRenderer 
                    content={currentQuestion.question_text}
                    latex={currentQuestion.question_latex}
                    hasMath={currentQuestion.has_math}
                  />
                </div>

                {/* Answer Input */}
                <div className="space-y-4">
                  {currentQuestion.question_type === 'multiple_choice' && currentQuestion.options ? (
                    <RadioGroup
                      value={currentAnswer?.answer || ''}
                      onValueChange={handleAnswerChange}
                      disabled={currentAnswer?.submitted}
                    >
                      {(Array.isArray(currentQuestion.options) ? currentQuestion.options : []).map((option: string, idx: number) => (
                        <div key={idx} className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50">
                          <RadioGroupItem value={option} id={`option-${idx}`} />
                          <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <Textarea
                      placeholder="Type your answer here..."
                      value={currentAnswer?.answer || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      disabled={currentAnswer?.submitted}
                      className="min-h-[120px]"
                    />
                  )}

                  {/* Feedback */}
                  {currentAnswer?.submitted && (
                    <div className={`flex items-center gap-2 p-4 rounded-lg ${currentAnswer.isCorrect ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                      {currentAnswer.isCorrect ? (
                        <>
                          <Check className="w-5 h-5" />
                          <span className="font-medium">Correct!</span>
                        </>
                      ) : (
                        <>
                          <X className="w-5 h-5" />
                          <div>
                            <span className="font-medium">Incorrect.</span>
                            <span className="ml-2">Correct answer: {currentQuestion.correct_answer}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Submit Answer Button */}
                  {!currentAnswer?.submitted && (
                    <Button
                      onClick={handleSubmitAnswer}
                      disabled={!currentAnswer?.answer?.trim()}
                      className="w-full"
                    >
                      Submit Answer
                    </Button>
                  )}
                </div>
              </Card>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between gap-4">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  size="lg"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleNext}
                  disabled={currentIndex === questions.length - 1}
                  size="lg"
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish Quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-yellow-600 font-medium">
                  Warning: {questions.length - answeredCount} question(s) are unanswered.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Practicing</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinishQuiz}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Finish Quiz
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Quiz Complete!
            </DialogTitle>
            <DialogDescription>
              Here's how you performed:
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-3xl font-bold">{correctCount}</div>
                <div className="text-sm text-muted-foreground">Correct</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <div className="text-3xl font-bold">{answeredCount}</div>
                <div className="text-sm text-muted-foreground">Answered</div>
              </div>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-primary/10">
              <div className="text-2xl font-bold text-primary">
                {answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Score</div>
            </div>
            
            <div className="text-center text-sm text-muted-foreground">
              Time: {formatTime(timeElapsed)}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={() => navigate('/quizzes')} className="w-full">
              Back to My Quizzes
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowResultsDialog(false);
                setCurrentIndex(0);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full"
            >
              Review Answers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TakePracticeQuiz;