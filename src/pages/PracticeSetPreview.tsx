import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Play, ArrowLeft, ChevronRight, RotateCcw } from "lucide-react";
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

const formatQuestionType = (type: string) => {
  const map: Record<string, string> = {
    'short_answer': 'Short answer',
    'long_answer': 'Long answer',
    'graph_plotting': 'Graph plotting',
    'graph_sketch': 'Graph sketch',
    'multiple_choice': 'Multiple choice',
    'mcq': 'Multiple choice',
    'show_that': 'Show that',
    'proof': 'Proof',
  };
  return map[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getDifficultyColor = (level: string | undefined | null) => {
  const l = (level || '').toLowerCase();
  if (l === 'easy') return '#22c55e';
  if (l === 'medium') return '#f97316';
  if (l === 'hard') return '#ef4444';
  return undefined;
};

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
      const { data: setData, error: setError } = await supabase
        .from('practice_question_sets')
        .select('*')
        .eq('id', setId)
        .single();

      if (setError) throw setError;
      setPracticeSet(setData);

      const { data: questionsResponse, error: questionsError } = await supabase.functions.invoke('get-practice-questions', {
        body: { setId }
      });
      const questionsData = questionsResponse?.questions ?? [];

      if (questionsError) throw questionsError;
      
      const sortedQuestions = (questionsData || []).sort((a, b) => {
        const numA = a.question_number_int ?? (parseInt(a.question_number) || 0);
        const numB = b.question_number_int ?? (parseInt(b.question_number) || 0);
        if (numA !== numB) return numA - numB;
        
        const suffixA = a.question_number.replace(/^\d+/, '') || '';
        const suffixB = b.question_number.replace(/^\d+/, '') || '';
        return suffixA.localeCompare(suffixB);
      });
      
      setQuestions(sortedQuestions);

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

  const diffLevel = practiceSet.difficulty_level || practiceSet.difficulty_mode;
  const diffColor = getDifficultyColor(diffLevel);

  return (
    <div className="min-h-screen bg-background">
      {/* Header - 3-zone layout */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b">
        <div className="max-w-[1000px] mx-auto px-8 h-16 flex items-center justify-between">
          {/* Left: Back button */}
          <Button
            variant="ghost"
            onClick={() => navigate('/quizzes')}
            className="py-2 px-3 ml-6 text-[15px]"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </Button>

          {/* Center: Preview Mode + divider + Set name */}
          <div className="flex items-center">
            <span className="text-[13px]" style={{ color: '#64748b' }}>
              <Eye className="w-3 h-3 inline mr-1" />
              Preview Mode
            </span>
            <span
              className="inline-block mx-4"
              style={{ width: 1, height: 20, background: '#e2e8f0' }}
            />
            <span className="text-[16px] font-semibold text-foreground truncate max-w-[200px] lg:max-w-[400px]">
              {practiceSet.set_name}
            </span>
          </div>

          {/* Right: Circular action button */}
          <div className="mr-6 flex-shrink-0">
            {isCompleted ? (
              <button
                onClick={handleStartOrContinue}
                title="Review Answers"
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-0"
                style={{ background: '#3b82f6' }}
              >
                <Eye className="w-[18px] h-[18px] text-white" />
              </button>
            ) : (
              <button
                onClick={handleStartOrContinue}
                title={hasProgress ? "Continue" : "Start Quiz"}
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-0"
                style={{ background: '#3b82f6' }}
              >
                {hasProgress ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <polyline points="21 3 21 8 16 8" />
                  </svg>
                ) : (
                  <Play className="w-[18px] h-[18px] text-white fill-white" />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[1000px] mx-auto px-8 py-6">
        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-3 px-[18px]">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Subject</p>
              <p className="text-[15px] font-semibold mt-1">{practiceSet.subject_id}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-[18px]">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Total Questions</p>
              <p className="text-[15px] font-semibold mt-1">{questions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-[18px]">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Difficulty</p>
              <p className="text-[15px] font-semibold mt-1 capitalize" style={diffColor ? { color: diffColor } : undefined}>
                {diffLevel}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-[18px]">
              <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Est. Time</p>
              <p className="text-[15px] font-semibold mt-1">{questions.length * 2} minutes</p>
            </CardContent>
          </Card>
        </div>

        {/* Topics Covered */}
        <div className="mt-5">
          <h3
            className="mb-2 text-[12px] uppercase font-medium"
            style={{ color: '#64748b', letterSpacing: '0.1em' }}
          >
            Topics Covered
          </h3>
          <div className="flex flex-wrap gap-2">
            {practiceSet.subtopics.map((topic, idx) => (
              <span
                key={idx}
                className="text-[11px] rounded-full"
                style={{
                  background: '#1e3a5f',
                  color: '#93c5fd',
                  border: '1px solid #1d4ed8',
                  padding: '3px 10px',
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div className="mt-4 space-y-3">
          {questions.map((question) => {
            const qDiffColor = getDifficultyColor(question.difficulty_level);
            return (
              <div
                key={question.id}
                className="rounded-lg overflow-hidden"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderLeft: '3px solid #3b82f6',
                  padding: '16px 20px',
                }}
              >
                {/* Question header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold" style={{ color: '#94a3b8' }}>
                    Q{question.question_number}
                  </span>
                  <span className="text-[11px]" style={{ color: '#94a3b8' }}>
                    {formatQuestionType(question.question_type)}
                  </span>
                  <span
                    className="text-[11px] rounded-full"
                    style={{ padding: '2px 8px', background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}
                  >
                    {question.subtopic}
                  </span>
                  {question.difficulty_level && (
                    <span
                      className="text-[11px] rounded-full capitalize"
                      style={{
                        padding: '2px 8px',
                        background: qDiffColor ? `${qDiffColor}22` : undefined,
                        color: qDiffColor || undefined,
                        border: qDiffColor ? `1px solid ${qDiffColor}44` : undefined,
                      }}
                    >
                      {question.difficulty_level}
                    </span>
                  )}
                  <span
                    className="text-[11px] font-semibold rounded-full ml-auto shrink-0"
                    style={{ padding: '2px 8px', background: '#3b82f622', color: '#3b82f6' }}
                  >
                    {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
                  </span>
                </div>

                {/* Question text */}
                <div className="mt-3 text-[14px] leading-[1.7] overflow-x-auto">
                  <MathRenderer content={question.question_text} hasMath={true} />
                </div>

                {/* MCQ Options */}
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
              </div>
            );
          })}
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
