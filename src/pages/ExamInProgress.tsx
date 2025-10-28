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
import { Loader2, Clock, Check, Circle, AlertCircle, Menu, ChevronLeft, ChevronRight, MoreVertical, Send } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MathRenderer } from "@/components/MathRenderer";
import { MathField } from "@/components/MathField";

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
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [savedAnswers, setSavedAnswers] = useState<Set<string>>(new Set());
  const [isTeacher, setIsTeacher] = useState(false);
  const treatAsStudent = modeParam === 'student';
  const isReadOnly = isTeacher && !treatAsStudent;
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [existingAnswers, setExistingAnswers] = useState<any[]>([]);
  const [submission, setSubmission] = useState<any>(null);
  const [examSubject, setExamSubject] = useState<string>('');
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const startTime = useRef<number>(Date.now());
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

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
      // Initialize start time if not set
      if (startTime.current === null || startTime.current === 0) {
        startTime.current = Date.now();
      }

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
  }, [isReadOnly, loading, timerEnabled, isSubmitting]);

  const loadQuestions = async () => {
    try {
      // Fetch exam metadata to get subject
      const { data: examData } = await supabase
        .from('exams')
        .select('subject_id')
        .eq('id', examId)
        .single();
      
      if (examData) {
        setExamSubject(examData.subject_id || '');
      }

      const { data, error } = await supabase.functions.invoke('get-exam-questions', {
        body: { examId }
      });

      if (error) throw error;

      if (data.submission) {
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
      setIsTeacher(data.isTeacher);
      setExistingAnswers(data.existingAnswers || []);
      setSubmission(data.submission || null);
      
      if (data.timer?.enabled) {
        setTimerEnabled(true);
        setTimeRemaining(data.timer.duration_minutes * 60);
        startTime.current = Date.now(); // Initialize start time when timer loads
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
                {currentGroup.parent}
                {currentGroup.questions.length > 1 && (
                  <span className="text-muted-foreground ml-2">
                    — Scroll through {currentGroup.questions.map(q => q.question_number).join(', ')}
                  </span>
                )}
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
                      <Badge className="text-base px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200">
                        Q{question.question_number}
                      </Badge>
                    </div>
                    <Badge className="text-base px-3 py-1">{question.marks} marks</Badge>
                  </div>

                  <MathRenderer 
                    content={question.question_text}
                    latex={(question as any).question_latex}
                    hasMath={(question as any).has_math}
                    className="mb-6"
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
                      value={userAnswers[question.id] || ''} 
                      onValueChange={(val) => handleAnswerChange(question.id, val)}
                      disabled={isReadOnly}
                      className="space-y-2"
                    >
                      {question.options.map((option, idx) => {
                        const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D...
                        const isSelected = userAnswers[question.id] === optionLetter;
                        return (
                          <div 
                            key={idx} 
                            className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                              isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-accent'
                            }`}
                          >
                            <RadioGroupItem value={optionLetter} id={`${question.id}-${idx}`} />
                            <Label htmlFor={`${question.id}-${idx}`} className="flex-1 cursor-pointer text-base">
                              {option}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  ) : examSubject.toLowerCase().includes('math') ? (
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Working Out</Label>
                        <Textarea 
                          placeholder="Show your working here..."
                          value={(() => {
                            try {
                              const parsed = JSON.parse(userAnswers[question.id] || '{}');
                              return parsed.workingOut || '';
                            } catch {
                              return '';
                            }
                          })()}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(userAnswers[question.id] || '{}');
                              const updated = { ...parsed, workingOut: e.target.value };
                              handleAnswerChange(question.id, JSON.stringify(updated));
                            } catch {
                              handleAnswerChange(question.id, JSON.stringify({ workingOut: e.target.value, finalAnswer: '' }));
                            }
                          }}
                          className="min-h-[300px] resize-y text-base font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Final Answer <span className="text-destructive">*</span></Label>
                        <MathField
                          value={(() => {
                            try {
                              const parsed = JSON.parse(userAnswers[question.id] || '{}');
                              return parsed.finalAnswer || '';
                            } catch {
                              return '';
                            }
                          })()}
                          onChange={(latex) => {
                            try {
                              const parsed = JSON.parse(userAnswers[question.id] || '{}');
                              const updated = { ...parsed, finalAnswer: latex };
                              handleAnswerChange(question.id, JSON.stringify(updated));
                            } catch {
                              handleAnswerChange(question.id, JSON.stringify({ 
                                workingOut: '', 
                                finalAnswer: latex 
                              }));
                            }
                          }}
                          placeholder="Type your final answer..."
                          className="min-h-[60px]"
                        />
                      </div>
                    </div>
                  ) : (
                    <Textarea 
                      placeholder="Your Answer"
                      value={userAnswers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      onBlur={(e) => {
                        if (e.target.value) {
                          handleSaveAnswer(question.id, e.target.value);
                        }
                      }}
                      className="min-h-[200px] resize-y text-base"
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
    </div>
  );
};

export default ExamInProgress;
