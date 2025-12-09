import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Play, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { MathRenderer } from "@/components/MathRenderer";

interface Question {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: any;
  has_math?: boolean;
  question_latex?: string;
  subtopic: string;
  difficulty_level?: string;
}

interface PracticeSet {
  id: string;
  set_name: string;
  subject_id: string;
  subtopics: string[];
  difficulty_mode: string;
  difficulty_level: string;
  question_count: number;
  educational_tier?: string;
  exam_board?: string;
}

const PracticeSetPreview = () => {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreview();
  }, [setId]);

  const loadPreview = async () => {
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
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!practiceSet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Practice set not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/quizzes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Badge variant="outline" className="bg-muted">
              <Eye className="w-3 h-3 mr-1" />
              Preview Mode
            </Badge>
            <h1 className="text-xl font-bold">{practiceSet.set_name}</h1>
          </div>
          <Button onClick={() => navigate(`/practice-questions/${setId}/take`)} size="lg">
            <Play className="h-4 w-4 mr-2" />
            Start Quiz
          </Button>
        </div>
      </header>

      {/* Metadata */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Subject</p>
              <p className="font-semibold">{practiceSet.subject_id}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Questions</p>
              <p className="font-semibold">{questions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Difficulty</p>
              <p className="font-semibold capitalize">{practiceSet.difficulty_level || practiceSet.difficulty_mode}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Est. Time</p>
              <p className="font-semibold">{questions.length * 2} minutes</p>
            </CardContent>
          </Card>
        </div>

        {/* Topics */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2">Topics Covered</h3>
          <div className="flex flex-wrap gap-2">
            {practiceSet.subtopics.map((topic, idx) => (
              <Badge key={idx} variant="secondary">{topic}</Badge>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((question, idx) => (
            <Card key={question.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{question.question_number}</Badge>
                    <Badge variant="secondary">{question.subtopic}</Badge>
                    {question.difficulty_level && (
                      <Badge variant="outline" className="capitalize">{question.difficulty_level}</Badge>
                    )}
                  </div>
                  <Badge>{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</Badge>
                </div>

                <div className="prose dark:prose-invert max-w-none mb-4">
                  {question.has_math && question.question_latex ? (
                    <MathRenderer content={question.question_text} latex={question.question_latex} hasMath={true} />
                  ) : (
                    <p>{question.question_text}</p>
                  )}
                </div>

                {question.options && Array.isArray(question.options) && (
                  <div className="space-y-2 mt-4">
                    {question.options.map((option: any, optIdx: number) => (
                      <div key={optIdx} className="flex items-start gap-2 p-3 rounded border bg-muted/30">
                        <span className="font-medium">{option.key})</span>
                        <span>{option.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PracticeSetPreview;