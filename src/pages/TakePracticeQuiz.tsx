import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MathRenderer } from "@/components/MathRenderer";

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
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    loadQuiz();
  }, [setId]);

  useEffect(() => {
    updateProgress();
  }, [userAnswers]);

  const loadQuiz = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from('practice_question_sets')
        .select('*')
        .eq('id', setId)
        .single();

      if (setError) throw setError;
      setPracticeSet(setData);

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

  const updateProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const attempted = Object.keys(userAnswers).length;
      const correct = Object.values(userAnswers).filter(a => a.isCorrect).length;
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);

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
      console.error('Error updating progress:', error);
    }
  };

  const handleAnswerChange = (answer: string) => {
    const currentQuestion = questions[currentIndex];
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        answer,
        submitted: false,
      }
    }));
    setShowFeedback(false);
  };

  const handleSubmitAnswer = () => {
    const currentQuestion = questions[currentIndex];
    const userAnswer = userAnswers[currentQuestion.id]?.answer || '';
    const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.correct_answer?.trim().toLowerCase();

    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        isCorrect,
        submitted: true,
      }
    }));
    setShowFeedback(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowFeedback(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowFeedback(false);
    }
  };

  const handleFinish = () => {
    const attempted = Object.keys(userAnswers).length;
    const correct = Object.values(userAnswers).filter(a => a.isCorrect).length;
    
    toast({
      title: "Quiz Complete!",
      description: `You got ${correct} out of ${attempted} questions correct.`,
    });
    
    navigate('/quizzes');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">No questions found</p>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = userAnswers[currentQuestion.id];
  const progress = (Object.keys(userAnswers).length / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-lg font-bold">{practiceSet?.set_name}</h1>
            <Badge>
              Question {currentIndex + 1} of {questions.length}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </header>

      {/* Question */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <Badge variant="outline">{currentQuestion.question_number}</Badge>
            <Badge>{currentQuestion.marks} marks</Badge>
          </div>

          <div className="prose dark:prose-invert max-w-none mb-6">
            {currentQuestion.has_math && currentQuestion.question_latex ? (
              <MathRenderer content={currentQuestion.question_text} latex={currentQuestion.question_latex} hasMath={true} />
            ) : (
              <p className="text-lg">{currentQuestion.question_text}</p>
            )}
          </div>

          {/* Answer Input */}
          {currentQuestion.question_type === 'multiple-choice' && currentQuestion.options ? (
            <RadioGroup
              value={currentAnswer?.answer || ''}
              onValueChange={handleAnswerChange}
              disabled={currentAnswer?.submitted}
            >
              {currentQuestion.options.map((option: any, idx: number) => (
                <div key={idx} className="flex items-center space-x-2 p-3 rounded border mb-2">
                  <RadioGroupItem value={option.key} id={`option-${idx}`} />
                  <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                    {option.key}) {option.text}
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
              rows={4}
              className="mb-4"
            />
          )}

          {/* Feedback */}
          {showFeedback && currentAnswer?.submitted && (
            <div className={`mt-4 p-4 rounded-lg ${currentAnswer.isCorrect ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
              <div className="flex items-center gap-2 mb-2">
                {currentAnswer.isCorrect ? (
                  <>
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-700 dark:text-green-400">Correct!</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 text-red-600" />
                    <span className="font-semibold text-red-700 dark:text-red-400">Incorrect</span>
                  </>
                )}
              </div>
              {!currentAnswer.isCorrect && (
                <p className="text-sm text-muted-foreground">
                  Correct answer: <span className="font-medium">{currentQuestion.correct_answer}</span>
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              {!currentAnswer?.submitted && (
                <Button onClick={handleSubmitAnswer} disabled={!currentAnswer?.answer}>
                  Submit Answer
                </Button>
              )}
              
              {currentIndex < questions.length - 1 ? (
                <Button onClick={handleNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleFinish}>
                  Finish Quiz
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default TakePracticeQuiz;