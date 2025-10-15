import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Question {
  id: string;
  question_number: number;
  question_type: string;
  question_text: string;
  marks: number;
  options?: any;
  correct_answer?: string;
  has_figures?: boolean;
  has_tables?: boolean;
  figure_urls?: string[];
}

export default function ExamInProgress() {
  const { examId } = useParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, [examId]);

  const loadQuestions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-exam-questions', {
        body: { examId }
      });

      if (error) throw error;

      setQuestions(data.questions || []);
      setIsTeacher(data.isTeacher);
    } catch (error) {
      console.error('Load questions error:', error);
      toast.error('Failed to load exam questions');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitAnswer = async (questionId: string) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('submit-student-answer', {
        body: {
          examId,
          questionId,
          answerText: answers[questionId] || '',
        }
      });

      if (error) throw error;
      toast.success('Answer saved');
    } catch (error) {
      console.error('Submit answer error:', error);
      toast.error('Failed to save answer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {isTeacher ? 'Exam Questions & Answer Key' : 'Exam Questions'}
            </h1>
            <p className="text-muted-foreground">
              {isTeacher 
                ? 'Review all questions and correct answers' 
                : 'Answer all questions and submit when ready'}
            </p>
          </div>

          <div className="space-y-6">
            {questions.map((question) => (
              <Card key={question.id} className="p-6 bg-card border-border">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-sm">
                      Q{question.question_number}
                    </Badge>
                    <Badge variant="secondary" className="text-sm capitalize">
                      {question.question_type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    {question.marks} marks
                  </Badge>
                </div>

                <p className="text-foreground text-lg mb-4 font-medium whitespace-pre-wrap">
                  {question.question_text}
                </p>

                {question.has_figures && question.figure_urls && question.figure_urls.length > 0 && (
                  <div className="my-4 space-y-2">
                    {question.figure_urls.map((url, idx) => (
                      <div key={idx} className="border rounded-lg p-4 bg-muted">
                        <img 
                          src={`${supabase.storage.from('exam-files').getPublicUrl(url).data.publicUrl}`}
                          alt={`Figure ${idx + 1} for Question ${question.question_number}`}
                          className="max-w-full h-auto rounded"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {question.question_type === 'mcq' && question.options && (
                  <div className="space-y-3">
                    {isTeacher ? (
                      <div className="space-y-2">
                        {Object.entries(question.options).map(([key, value]) => (
                          <div 
                            key={key} 
                            className={`p-3 rounded-md border ${
                              key === question.correct_answer 
                                ? 'bg-green-500/10 border-green-500/50' 
                                : 'bg-muted border-border'
                            }`}
                          >
                            <span className="font-semibold">{key.toUpperCase()}:</span> {value as string}
                            {key === question.correct_answer && (
                              <Badge className="ml-2 bg-green-500">Correct</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <RadioGroup 
                        value={answers[question.id] || ''} 
                        onValueChange={(val) => handleAnswerChange(question.id, val)}
                      >
                        {Object.entries(question.options).map(([key, value]) => (
                          <div key={key} className="flex items-center space-x-2 p-3 rounded-md border border-border hover:bg-muted/50">
                            <RadioGroupItem value={key} id={`${question.id}-${key}`} />
                            <Label htmlFor={`${question.id}-${key}`} className="flex-1 cursor-pointer">
                              <span className="font-semibold">{key.toUpperCase()}:</span> {value as string}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  </div>
                )}

                {question.question_type !== 'mcq' && !isTeacher && (
                  <Textarea 
                    placeholder="Type your answer here..."
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    className="min-h-[120px] bg-background border-border"
                  />
                )}

                {question.question_type !== 'mcq' && isTeacher && question.correct_answer && (
                  <div className="mt-4 p-4 bg-muted rounded-md border border-border">
                    <p className="text-sm font-semibold text-muted-foreground mb-2">Suggested Answer Key:</p>
                    <p className="text-foreground">{question.correct_answer}</p>
                  </div>
                )}

                {!isTeacher && (
                  <Button 
                    onClick={() => handleSubmitAnswer(question.id)}
                    disabled={submitting || !answers[question.id]}
                    className="mt-4"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Answer'}
                  </Button>
                )}
              </Card>
            ))}
          </div>

          {!isTeacher && questions.length > 0 && (
            <div className="mt-8 flex justify-center">
              <Button size="lg" className="px-8">
                Submit Exam
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
