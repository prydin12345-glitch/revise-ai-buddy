import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, MinusCircle, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/useSession';

export interface QuestionResult {
  id: string;
  questionNumber: string;
  questionNumberSort: number;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  score: number;
  totalMarks: number;
  isCorrect: boolean;
  isPartial: boolean;
  feedback: string | null;
  subtopic: string | null;
}

interface ExamReviewPanelProps {
  examId: string;
  examTitle: string;
  totalScore: number;
  totalMarks: number;
  onQuestionClick: (question: QuestionResult) => void;
  activeQuestionId?: string | null;
}

export const ExamReviewPanel = ({
  examId,
  examTitle,
  totalScore,
  totalMarks,
  onQuestionClick,
  activeQuestionId,
}: ExamReviewPanelProps) => {
  const [questions, setQuestions] = useState<QuestionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'wrong' | 'correct'>('all');
  const session = useSession();

  useEffect(() => {
    const load = async () => {
      if (!session?.user?.id || !examId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('student_answers')
          .select(`
            id,
            answer_text,
            score,
            is_correct,
            feedback,
            exam_questions (
              id,
              question_text,
              correct_answer,
              marks,
              question_number,
              topic_tag
            )
          `)
          .eq('exam_id', examId)
          .eq('student_id', session.user.id);

        if (error) throw error;

        if (data) {
          const mapped = data
            .filter((a: any) => a.exam_questions)
            .map((a: any) => {
              const q = a.exam_questions;
              const awarded = Number(a.score ?? 0);
              const total = Number(q.marks ?? 1);
              const numStr = String(q.question_number ?? '0');
              const numSort = parseFloat(numStr.replace(/[^0-9.]/g, '')) || 0;
              return {
                id: a.id,
                questionNumber: numStr,
                questionNumberSort: numSort,
                questionText: q.question_text ?? '',
                studentAnswer: a.answer_text ?? '',
                correctAnswer: q.correct_answer ?? '',
                score: awarded,
                totalMarks: total,
                isCorrect: a.is_correct === true,
                isPartial: a.is_correct !== true && awarded > 0,
                feedback: a.feedback,
                subtopic: q.topic_tag,
              };
            })
            .sort((a, b) => a.questionNumberSort - b.questionNumberSort);
          setQuestions(mapped);
        }
      } catch (err) {
        console.error('Failed to load exam questions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [examId, session?.user?.id]);

  const pct = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : 0;
  const pctColor = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500';

  const wrongCount = questions.filter(q => !q.isCorrect && !q.isPartial).length;
  const correctCount = questions.filter(q => q.isCorrect).length;
  const partialCount = questions.filter(q => q.isPartial).length;

  const filtered = questions.filter(q => {
    if (filter === 'wrong') return !q.isCorrect;
    if (filter === 'correct') return q.isCorrect;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground truncate">{examTitle}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {questions.length} questions · Click any question to discuss it
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-xl font-bold ${pctColor}`}>{pct}%</div>
            <div className="text-[10px] text-muted-foreground">{totalScore}/{totalMarks} marks</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: `${correctCount} correct`, value: 'correct' as const, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
            { label: `${wrongCount} wrong`, value: 'wrong' as const, color: 'text-red-500 bg-red-500/10 border-red-500/20' },
          ].map(chip => (
            <button
              key={chip.value}
              onClick={() => setFilter(filter === chip.value ? 'all' : chip.value)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                filter === chip.value
                  ? chip.color
                  : 'text-muted-foreground bg-muted/40 border-border hover:border-border/80'
              }`}
            >
              {chip.label}
            </button>
          ))}
          {partialCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20">
              {partialCount} partial
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden min-h-0">
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border/60 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50">

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-[12px] text-muted-foreground">No questions match this filter</p>
          </div>
        ) : (
          filtered.map(q => {
            const isActive = activeQuestionId === q.id;
            const statusIcon = q.isCorrect
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              : q.isPartial
                ? <MinusCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
            const statusBg = q.isCorrect
              ? 'border-l-emerald-500'
              : q.isPartial
                ? 'border-l-amber-500'
                : 'border-l-red-500';

            return (
              <button
                key={q.id}
                onClick={() => onQuestionClick(q)}
                className={`w-full text-left px-4 py-3.5 border-b border-border border-l-2 ${statusBg} hover:bg-muted/40 transition-all duration-150 group ${
                  isActive ? 'bg-primary/5 border-l-primary' : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {statusIcon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-foreground">
                        Q{q.questionNumber}
                        {q.subtopic && <span className="text-muted-foreground font-normal"> · {q.subtopic}</span>}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">
                        {q.score}/{q.totalMarks}
                      </span>
                    </div>
                    <p className="text-[12px] text-foreground/80 line-clamp-2 leading-snug">
                      {q.questionText}
                    </p>
                    {!q.isCorrect && q.studentAnswer && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                        Your answer: <span className="text-foreground/70">{q.studentAnswer}</span>
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 mt-0.5" />
                </div>
              </button>
            );
          })
        )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
      </div>
    </div>
  );
};
