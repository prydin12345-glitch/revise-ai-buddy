import { useState, useEffect, useMemo, useRef, useCallback, type KeyboardEvent } from 'react';
import { Loader2, MessageSquare, ChevronDown, Sparkles, ArrowDown } from 'lucide-react';
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
  /** Optional metadata for the sticky header (subject · board level) */
  metaLine?: string;
}

type FilterKey = 'all' | 'correct' | 'lost' | 'partial';

/* Hand-drawn pen marks (inline SVG, not icon font) */
const PenTick = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 13.5 9 19l11-13" />
  </svg>
);
const PenCross = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5l14 14M19 5 5 19" />
  </svg>
);
const PenHalf = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 19 19 5" />
    <path d="M5 13l4 4" />
  </svg>
);

const status = (q: QuestionResult): 'correct' | 'partial' | 'lost' =>
  q.score >= q.totalMarks ? 'correct' : q.score === 0 ? 'lost' : 'partial';

export const ExamReviewPanel = ({
  examId,
  examTitle,
  totalScore,
  totalMarks,
  onQuestionClick,
  activeQuestionId,
  metaLine,
}: ExamReviewPanelProps) => {
  const [questions, setQuestions] = useState<QuestionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const session = useSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
              rationale,
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
                correctAnswer: q.correct_answer ?? q.rationale ?? '',
                score: awarded,
                totalMarks: total,
                isCorrect: a.is_correct === true || awarded >= total,
                isPartial: a.is_correct !== true && awarded > 0 && awarded < total,
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
  const pctTone =
    pct >= 75 ? 'text-success' : pct >= 50 ? 'text-warning' : 'text-danger';

  const counts = useMemo(() => {
    const c = { all: questions.length, correct: 0, lost: 0, partial: 0 };
    questions.forEach((q) => {
      const s = status(q);
      c[s]++;
    });
    return c;
  }, [questions]);

  const filtered = useMemo(
    () => (filter === 'all' ? questions : questions.filter((q) => status(q) === filter)),
    [questions, filter],
  );

  /* "Where you lost marks" — group by topic_tag */
  const lostByTopic = useMemo(() => {
    const m = new Map<string, { lost: number; total: number }>();
    questions.forEach((q) => {
      const t = q.subtopic ?? 'Uncategorised';
      const entry = m.get(t) ?? { lost: 0, total: 0 };
      entry.total += q.totalMarks;
      entry.lost += Math.max(0, q.totalMarks - q.score);
      m.set(t, entry);
    });
    return Array.from(m.entries())
      .filter(([, v]) => v.lost > 0)
      .sort((a, b) => b[1].lost - a[1].lost);
  }, [questions]);

  const scrollToRow = useCallback((id: string) => {
    const el = rowRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const jumpToNextMistake = useCallback(() => {
    const next = questions.find((q) => status(q) !== 'correct');
    if (!next) return;
    setFilter('all');
    setExpandedId(next.id);
    setFocusedIdx(questions.indexOf(next));
    requestAnimationFrame(() => scrollToRow(next.id));
  }, [questions, scrollToRow]);

  /* Keyboard nav scoped to the panel */
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(filtered.length - 1, Math.max(0, focusedIdx + 1));
      setFocusedIdx(next);
      scrollToRow(filtered[next].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.max(0, focusedIdx - 1);
      setFocusedIdx(next);
      scrollToRow(filtered[next].id);
    } else if (e.key === 'Enter' && focusedIdx >= 0 && filtered[focusedIdx]) {
      e.preventDefault();
      const id = filtered[focusedIdx].id;
      setExpandedId((cur) => (cur === id ? null : id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[hsl(var(--surface-panel))]">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKey}
      className="flex flex-col h-full bg-[hsl(var(--surface-panel))] focus:outline-none"
    >
      {/* Sticky header */}
      <div className="sticky top-0 z-20 px-5 pt-4 pb-3 bg-[hsl(var(--surface-panel))] border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-serif font-bold text-lg leading-tight text-foreground truncate">
              {examTitle}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              {metaLine ? `${metaLine} · ` : ''}{questions.length} questions
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`font-serif text-3xl font-bold leading-none ${pctTone}`}>{pct}%</div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1">
              {totalScore}/{totalMarks}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          {([
            { key: 'all',     label: 'All',     count: counts.all,     active: 'bg-foreground text-background border-foreground' },
            { key: 'correct', label: 'correct', count: counts.correct, active: 'bg-success text-success-foreground border-success' },
            { key: 'lost',    label: 'lost',    count: counts.lost,    active: 'bg-danger text-danger-foreground border-danger' },
            { key: 'partial', label: 'partial', count: counts.partial, active: 'bg-warning text-warning-foreground border-warning' },
          ] as const).map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  active
                    ? chip.active
                    : 'text-muted-foreground bg-transparent border-border hover:bg-[hsl(var(--surface-hover))]'
                }`}
              >
                {chip.label} <span className="font-mono opacity-80">{chip.count}</span>
              </button>
            );
          })}
          <button
            onClick={jumpToNextMistake}
            disabled={counts.lost + counts.partial === 0}
            className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-danger/40 text-danger bg-danger/5 hover:bg-danger/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next mistake <ArrowDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Where you lost marks */}
      {lostByTopic.length > 0 && (
        <div className="px-5 py-3 border-b border-border bg-[hsl(var(--surface-panel-2))]">
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-2">
            Where you lost marks
          </div>
          <div className="space-y-1.5">
            {lostByTopic.slice(0, 4).map(([topic, v]) => {
              const w = Math.min(100, Math.round((v.lost / Math.max(1, v.total)) * 100));
              return (
                <div key={topic} className="flex items-center gap-2.5">
                  <span className="text-[11px] text-foreground/80 flex-shrink-0 min-w-[110px] max-w-[160px] truncate">{topic}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[hsl(var(--surface-hover))] overflow-hidden">
                    <div className="h-full bg-danger rounded-full" style={{ width: `${w}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-danger flex-shrink-0">−{v.lost}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Question rows */}
      <div className="flex-1 overflow-y-auto scroll-themed">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-[12px] text-muted-foreground">No questions match this filter</p>
          </div>
        ) : (
          filtered.map((q, idx) => {
            const s = status(q);
            const isExpanded = expandedId === q.id;
            const isActive = activeQuestionId === q.id || focusedIdx === idx;
            const tone =
              s === 'correct' ? 'text-success' : s === 'lost' ? 'text-danger' : 'text-warning';
            const insetBorder =
              s === 'correct' ? 'border-l-success' : s === 'lost' ? 'border-l-danger' : 'border-l-warning';

            const pen =
              s === 'correct' ? <PenTick  className="w-6 h-6 text-success" /> :
              s === 'lost'    ? <PenCross className="w-6 h-6 text-danger" /> :
                                <PenHalf  className="w-6 h-6 text-warning" />;

            return (
              <div
                key={q.id}
                ref={(el) => (rowRefs.current[q.id] = el)}
                className={`border-b border-border transition-colors ${
                  isActive ? 'bg-primary/[0.06] shadow-[inset_3px_0_0_0_hsl(var(--primary))]' : ''
                }`}
              >
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : q.id);
                    setFocusedIdx(idx);
                  }}
                  className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-[hsl(var(--surface-hover))]/40 transition-colors"
                >
                  {/* left margin: question number + pen mark */}
                  <div className="flex flex-col items-center gap-1.5 w-9 flex-shrink-0 pt-0.5">
                    <span className="font-serif font-bold text-[15px] text-foreground leading-none">
                      Q{q.questionNumber}
                    </span>
                    {pen}
                  </div>

                  {/* body */}
                  <div className="flex-1 min-w-0">
                    {q.subtopic && (
                      <span className="inline-block px-2 py-0.5 mb-1.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[hsl(var(--surface-panel-2))] text-muted-foreground border border-border">
                        {q.subtopic}
                      </span>
                    )}
                    <p className="font-serif text-[14px] leading-snug text-foreground line-clamp-2">
                      {q.questionText}
                    </p>
                  </div>

                  {/* right margin: teacher score */}
                  <div className="flex items-start gap-2 flex-shrink-0 pt-0.5">
                    <span className={`font-serif font-bold text-[15px] ${tone}`}>
                      {q.score}/{q.totalMarks}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {/* Inline expand via grid-rows trick */}
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-1 pl-[3.75rem] space-y-3">
                      {/* Your response */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            Your response
                          </div>
                          <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${tone}`}>
                            <span className="font-serif">{q.score}/{q.totalMarks} marks</span>
                            <span className="w-3.5 h-3.5">
                              {s === 'correct' ? <PenTick className="w-3.5 h-3.5" /> :
                               s === 'lost'    ? <PenCross className="w-3.5 h-3.5" /> :
                                                 <PenHalf  className="w-3.5 h-3.5" />}
                            </span>
                          </div>
                        </div>
                        <div className={`bg-[hsl(var(--surface-panel-2))] border-l-2 ${insetBorder} rounded-r-md px-3 py-2 text-[13px] text-foreground whitespace-pre-wrap leading-snug`}>
                          {q.studentAnswer || <span className="italic text-muted-foreground">No answer recorded</span>}
                        </div>
                      </div>

                      {/* Mark scheme — only if marks lost */}
                      {s !== 'correct' && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-success mb-1.5">
                            Mark scheme
                          </div>
                          <div className="bg-success/10 border border-success/20 rounded-md px-3 py-2 text-[13px] text-foreground whitespace-pre-wrap leading-snug">
                            {q.correctAnswer || <span className="italic text-muted-foreground">See mark scheme</span>}
                          </div>
                        </div>
                      )}

                      {/* Examiner's note */}
                      {q.feedback && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-1.5">
                            Examiner's note
                          </div>
                          <div className="border border-dashed border-border rounded-md px-3 py-2 text-[13px] text-foreground/85 leading-snug flex items-start gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                            <span>{q.feedback}</span>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => onQuestionClick(q)}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-tutor-gradient text-primary-foreground text-[12px] font-semibold shadow-sm hover:opacity-95 transition-opacity"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Discuss with AI tutor
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
