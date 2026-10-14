import { FileText, ListChecks } from 'lucide-react';
import { useRetainedState } from '@/hooks/use-workspace-session';
import type { MockExam, Quiz } from '../types';

interface Props {
  mockExams: MockExam[];
  quizzes: Quiz[];
  onOpenExam?: (id: string) => void;
  onStartQuiz?: (id: string) => void;
  onViewAll?: (kind: 'exams' | 'quizzes') => void;
}

export default function MobileActivityStats({ mockExams, quizzes, onOpenExam, onStartQuiz, onViewAll }: Props) {
  const [tab, setTab] = useRetainedState<'exams' | 'quizzes'>('dashboard:activity-tab', 'exams');
  const empty = tab === 'exams' ? !mockExams.length : !quizzes.length;
  return <section aria-labelledby="home-activity-heading" className="min-w-0">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id="home-activity-heading" className="text-[17px] font-bold tracking-tight">Recent practice</h2>
      <button type="button" onClick={() => onViewAll?.(tab)} className="min-h-11 text-xs font-semibold text-primary">View all <span aria-hidden="true">↗</span></button>
    </div>
    <div className="overflow-hidden rounded-2xl border border-border bg-card px-4 pb-1 pt-2">
      <div role="group" aria-label="Recent practice type" className="flex gap-5 border-b border-border">
        {(['exams', 'quizzes'] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`min-h-11 border-b-2 text-xs font-semibold ${tab === value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}>{value === 'exams' ? 'Exams' : 'Quizzes'}</button>)}
      </div>
      {empty ? <p className="py-6 text-sm text-muted-foreground">Your recent {tab === 'exams' ? 'papers' : 'quizzes'} will appear here.</p>
        : tab === 'exams' ? mockExams.slice(0, 4).map(exam => <button key={exam.id} type="button" onClick={() => onOpenExam?.(exam.id)} className="flex min-h-[76px] w-full items-center gap-3 border-b border-border py-3 text-left last:border-0">
          <FileText aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-primary" />
          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{exam.title}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{exam.subject} · {exam.when}</span></span>
          <span className={`shrink-0 rounded-lg px-2 py-1.5 text-[11px] font-semibold tabular-nums ${exam.status === 'done' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{exam.status === 'done' ? `${exam.score}%` : exam.status === 'in-progress' ? 'In progress' : 'New'}</span>
        </button>) : quizzes.slice(0, 4).map(quiz => <button key={quiz.id} type="button" onClick={() => onStartQuiz?.(quiz.id)} className="flex min-h-[76px] w-full items-center gap-3 border-b border-border py-3 text-left last:border-0">
          <ListChecks aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-primary" />
          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{quiz.title}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{quiz.subject} · {quiz.questions} questions</span></span>
          <span className="shrink-0 rounded-lg bg-accent px-2 py-1.5 text-[11px] font-semibold text-accent-foreground">{quiz.best === null ? 'Start' : 'Retry'}</span>
        </button>)}
    </div>
  </section>;
}
