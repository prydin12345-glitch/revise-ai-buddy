import { useMemo, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  formatStudyMinutes, resolveStudyPeriod, studySummary,
  type StudyPeriod, type StudySession, type StudySource,
} from '@/lib/dashboard-stats';
import { StudyDateControls } from './StudyDateControls';

const CATEGORIES = [
  { source: 'exam', label: 'Exams', color: 'hsl(var(--primary))' },
  { source: 'practice', label: 'Practice Questions', color: 'hsl(var(--stats-practice))' },
  { source: 'feedback', label: 'Reviewing Feedback', color: 'hsl(var(--success))' },
  { source: 'revision', label: 'Revision Tasks', color: 'hsl(var(--warning))' },
] satisfies { source: StudySource; label: string; color: string }[];

interface Props { sessions: StudySession[]; period: StudyPeriod; onChange: (period: StudyPeriod) => void; loading?: boolean }

export function StudyHoursPanel({ sessions, period, onChange, loading = false }: Props) {
  const now = new Date();
  const interval = resolveStudyPeriod(period, now);
  const summary = useMemo(() => studySummary(sessions, interval), [sessions, interval.start.getTime(), interval.end.getTime()]);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedBucket = summary.buckets.find(bucket => bucket.key === selected);
  const maximum = Math.max(...summary.buckets.map(bucket => bucket.total), 1);
  const change = (next: StudyPeriod) => { setSelected(null); onChange(next); };

  return (
    <div className="stats-study-surface space-y-5" aria-busy={loading}>
      <StudyDateControls period={period} onChange={change} />

      <section className="stats-study-card" aria-label="Study time chart">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Total study time</p>
            {loading ? <Skeleton className="h-10 w-32" /> : <p className="text-4xl font-semibold tracking-tight tabular-nums">{formatStudyMinutes(summary.totalMinutes)}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{period.mode === 'week' ? 'Week total' : period.mode === 'month' ? 'Month total' : 'Selected range'}</p>
          </div>
          <span className="rounded-2xl bg-primary/10 p-3 text-primary"><Clock3 className="h-5 w-5" /></span>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"><span>{summary.bucketDays === 1 ? 'Daily study time' : `${summary.bucketDays}-day totals`}</span><span>{loading ? 'Loading…' : formatStudyMinutes(maximum === 1 && summary.totalMinutes === 0 ? 0 : maximum)}</span></div>
        <div className="stats-study-plot" data-testid="study-time-plot">
          <div className="stats-study-guides" aria-hidden="true"><i /><i /><i /></div>
          {loading ? <div className="flex h-full w-full items-end justify-around gap-2 pb-6" aria-label="Loading study time">{[60, 85, 40, 75, 55, 90, 65].map((height, index) => <Skeleton key={index} className="w-full rounded-xl" style={{ height: `${height}%` }} />)}</div> : summary.buckets.map((bucket, index) => {
            const showLabel = summary.buckets.length <= 10 || index === 0 || index === summary.buckets.length - 1 || index % (summary.buckets.length > 20 ? 7 : 4) === 0;
            const description = `${bucket.fullLabel}: ${formatStudyMinutes(bucket.total)}. ${CATEGORIES.map(category => `${category.label}: ${formatStudyMinutes(bucket.minutes[category.source])}`).join('; ')}`;
            return <button type="button" key={bucket.key} className={cn('stats-study-column', selected === bucket.key && 'is-selected')} aria-label={description} aria-pressed={selected === bucket.key} onClick={() => setSelected(bucket.key)} title={description}>
              <span className="stats-study-column-space"><span className={cn('stats-study-bar', !bucket.total && 'is-empty')} style={{ height: bucket.total ? `${bucket.total / maximum * 100}%` : undefined }}>
                {CATEGORIES.filter(category => bucket.minutes[category.source] > 0).map(category => <span key={category.source} data-source={category.source} style={{ backgroundColor: category.color, height: `${bucket.minutes[category.source] / bucket.total * 100}%` }} />)}
              </span></span>
              <span aria-hidden="true" className="stats-study-day">{showLabel ? bucket.label : '\u00a0'}</span>
            </button>;
          })}
        </div>
        {!loading && <p className="mt-3 min-h-8 text-xs leading-relaxed text-muted-foreground" aria-live="polite">{selectedBucket ? `${selectedBucket.fullLabel} · ${formatStudyMinutes(selectedBucket.total)}` : summary.totalMinutes === 0 ? 'No study time recorded for these dates.' : 'Tap a bar to see its date and total.'}</p>}
      </section>

      <dl className="stats-study-totals" aria-label="Study time by category">
        {CATEGORIES.map(category => <div key={category.source}>
          <dt><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />{category.label}</dt>
          <dd>{loading ? <Skeleton className="h-5 w-16" /> : formatStudyMinutes(summary.totals[category.source])}</dd>
        </div>)}
      </dl>
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">Revision uses the duration of completed tasks. Feedback review time isn’t tracked yet.</p>
    </div>
  );
}
