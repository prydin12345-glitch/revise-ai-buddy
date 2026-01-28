import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Play, ArrowLeft, ChevronRight, LogOut, RotateCcw } from "lucide-react";
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

interface Progress {
  current_question_index: number | null;
  questions_attempted: number | null;
  questions_correct: number | null;
  completed_at: string | null;
  session_data: any;
}

const PracticeSetPreview = () => {
  const { setId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProgress, setHasProgress] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [savedQuestionIndex, setSavedQuestionIndex] = useState<number | null>(null);

  useEffect(() => {
    loadPreview();
  }, [setId]);

  const loadPreview = async () => {
    try {
      // Fetch practice set data
      const { data: setData, error: setError } = await supabase
        .from('practice_question_sets')
        .select('*')
        .eq('id', setId)
        .single();

      if (setError) throw setError;
      setPracticeSet(setData);

      // Fetch questions with proper sorting
      const { data: questionsData, error: questionsError } = await supabase
        .from('practice_questions')
        .select('*')
        .eq('set_id', setId)
        .order('question_number_int')
        .order('question_number');

      if (questionsError) throw questionsError;
      
      // Sort questions: first by numeric part, then by suffix (a, b, c)
      const sortedQuestions = (questionsData || []).sort((a, b) => {
        const numA = a.question_number_int ?? (parseInt(a.question_number) || 0);
        const numB = b.question_number_int ?? (parseInt(b.question_number) || 0);
        if (numA !== numB) return numA - numB;
        
        const suffixA = a.question_number.replace(/^\d+/, '') || '';
        const suffixB = b.question_number.replace(/^\d+/, '') || '';
        return suffixA.localeCompare(suffixB);
      });
      
      setQuestions(sortedQuestions);

      // Check for existing progress
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progress } = await supabase
          .from('practice_set_progress')
          .select('current_question_index, questions_attempted, questions_correct, completed_at, session_data')
          .eq('user_id', user.id)
          .eq('set_id', setId)
          .single();

        if (progress) {
          const sessionData = progress.session_data as { draft_answers?: Record<string, any> } | null;
          const hasAttempted = (progress.questions_attempted && progress.questions_attempted > 0) ||
            (sessionData?.draft_answers && Object.keys(sessionData.draft_answers).length > 0);
          
          if (hasAttempted) {
            setHasProgress(true);
            setSavedQuestionIndex(progress.current_question_index);
          }
          
          // Check if quiz is completed (has completed_at timestamp)
          if (progress.completed_at) {
            setIsCompleted(true);
          }
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleStartOrContinue = () => {
    navigate(`/practice-questions/${setId}/take`);
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
      {/* Header - 3-zone layout */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center">
          {/* Left: Back button */}
          <div className="flex-1 flex justify-start">
            <Button variant="ghost" size="icon" onClick={() => navigate('/quizzes')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* Center: Preview Mode + Set name */}
          <div className="flex-1 flex justify-center items-center gap-3">
            <Badge variant="outline" className="bg-muted whitespace-nowrap">
              <Eye className="w-3 h-3 mr-1" />
              Preview Mode
            </Badge>
            <h1 className="text-lg font-semibold truncate max-w-[200px] lg:max-w-[400px]">
              {practiceSet.set_name}
            </h1>
          </div>

          {/* Right: Start/Continue/Review button */}
          <div className="flex-1 flex justify-end">
            {isCompleted ? (
              <Button onClick={handleStartOrContinue} size="lg" variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Review Answers
              </Button>
            ) : (
              <Button onClick={handleStartOrContinue} size="lg">
                {hasProgress ? (
                  <>
                    <ChevronRight className="h-4 w-4 mr-2" />
                    Continue
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Quiz
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Metadata */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
          {questions.map((question) => (
            <Card key={question.id} className="overflow-hidden">
              <CardContent className="p-6">
                {/* Question header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="font-mono">Q{question.question_number}</Badge>
                    <Badge variant="secondary">{question.subtopic}</Badge>
                    {question.difficulty_level && (
                      <Badge variant="outline" className="capitalize">{question.difficulty_level}</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">{question.question_type}</Badge>
                  </div>
                  <Badge className="ml-2 shrink-0">
                    {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                  </Badge>
                </div>

                {/* Question text - always use MathRenderer */}
                <div className="text-base leading-relaxed mb-4 overflow-x-auto">
                  <MathRenderer content={question.question_text} hasMath={true} />
                </div>

                {/* MCQ Options - match quiz attempt styling */}
                {question.options && Array.isArray(question.options) && question.options.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {question.options.map((option: any, optIdx: number) => (
                      <div 
                        key={optIdx} 
                        className="flex items-start gap-3 p-4 rounded-lg border bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <span className="font-semibold text-primary shrink-0 w-6">
                          {option.key || String.fromCharCode(65 + optIdx)})
                        </span>
                        <div className="flex-1 overflow-x-auto">
                          <MathRenderer content={option.text} hasMath={true} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        {questions.length > 0 && (
          <div className="mt-8 flex justify-center pb-8">
            {isCompleted ? (
              <Button onClick={handleStartOrContinue} size="lg" className="px-8" variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                Review Answers
              </Button>
            ) : (
              <Button onClick={handleStartOrContinue} size="lg" className="px-8">
                {hasProgress ? (
                  <>
                    <ChevronRight className="h-4 w-4 mr-2" />
                    Continue Quiz
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Quiz
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticeSetPreview;
