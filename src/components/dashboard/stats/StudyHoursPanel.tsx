import { useMemo, useState } from 'react';
import { endOfDay, format, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, FileText, Layers, MessageSquare, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  dateKey, formatStudyMinutes, parseDay, resolveStudyPeriod, shiftStudyPeriod, studySummary,
  type StudyPeriod, type StudySession, type StudySource,
} from '@/lib/dashboard-stats';

const CATEGORIES = [
  { source: 'exam', label: 'Exams', icon: FileText, color: 'hsl(var(--primary))' },
  { source: 'practice', label: 'Practice Questions', icon: Zap, color: 'hsl(var(--stats-practice))' },
  { source: 'feedback', label: 'Reviewing Feedback', icon: MessageSquare, color: 'hsl(var(--success))' },
  { source: 'revision', label: 'Revision Tasks', icon: Layers, color: 'hsl(var(--warning))' },
] satisfies { source: StudySource; label: string; icon: typeof FileText; color: string }[];

interface Props { sessions: StudySession[]; period: StudyPeriod; onChange: (period: StudyPeriod) => void; loading?: boolean }

export function StudyHoursPanel({ sessions, period, onChange, loading = false }: Props) {
  const now = new Date();
  const interval = resolveStudyPeriod(period, now);
  const summary = useMemo(() => studySummary(sessions, interval), [sessions, interval.start.getTime(), interval.end.getTime()]);
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const selectedBucket = summary.buckets.find(bucket => bucket.key === selected);
  const maximum = Math.max(...summary.buckets.map(bucket => bucket.total), 1);
  const title = period.mode === 'month' ? format(interval.start, 'MMMM yyyy')
    : period.mode === 'week' ? `${format(interval.start, 'd MMM')} – ${format(interval.end, 'd MMM yyyy')}`
    : `${format(interval.start, 'd MMM yyyy')} – ${format(interval.end, 'd MMM yyyy')}`;
  const canGoForward = period.mode === 'month' ? interval.start < startOfMonth(now) : interval.start < startOfWeek(now, { weekStartsOn: 1 });
  const change = (next: StudyPeriod) => { setSelected(null); setError(''); onChange(next); };
  const setMode = (mode: StudyPeriod['mode']) => {
    if (mode === 'custom') {
      setFrom(period.from); setTo(period.to);
      return change({ ...period, mode });
    }
    change({ ...period, mode, anchor: dateKey(now) });
  };
  const applyCustom = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const next = { ...period, mode: 'custom' as const, from, to };
      resolveStudyPeriod(next, now);
      change(next);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Choose a valid date range.'); }
  };

  return (
    <div className="stats-study-surface space-y-5" aria-busy={loading}>
      <div className="stats-range-switch" role="group" aria-label="Study time range">
        {(['week', 'month', 'custom'] as const).map(mode => <button type="button" key={mode} aria-pressed={period.mode === mode} onClick={() => setMode(mode)} className={cn('stats-range-option', period.mode === mode && 'is-selected')}>{mode === 'custom' ? 'Custom range' : mode === 'week' ? 'Week' : 'Month'}</button>)}
      </div>

      {period.mode === 'custom' ? (
        <form onSubmit={applyCustom} className="space-y-3 rounded-2xl border border-border bg-panel p-4" data-stats-no-swipe>
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 space-y-1.5 text-xs font-medium">From<Input aria-label="Study range start" type="date" required value={from} max={dateKey(now)} onChange={event => setFrom(event.target.value)} className="w-full min-w-0 bg-background text-sm" /></label>
            <label className="min-w-0 space-y-1.5 text-xs font-medium">To<Input aria-label="Study range end" type="date" required value={to} min={from || undefined} max={dateKey(now)} onChange={event => setTo(event.target.value)} className="w-full min-w-0 bg-background text-sm" /></label>
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Button size="sm" type="submit" className="w-full">Apply dates</Button>
        </form>
      ) : (
        <div className="flex min-w-0 items-center justify-between gap-2" data-stats-no-swipe>
          <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0 rounded-full" aria-label={`Previous ${period.mode}`} onClick={() => change(shiftStudyPeriod(period, -1))}><ChevronLeft className="h-5 w-5" /></Button>
          {period.mode === 'month' ? <label className="relative flex min-w-0 items-center justify-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" /><span>{title}</span><input type="month" aria-label="Choose study month" value={format(parseDay(period.anchor), 'yyyy-MM')} max={format(now, 'yyyy-MM')} className="stats-month-input" onChange={event => {
            const value = event.target.value;
            if (!/^\d{4}-\d{2}$/.test(value)) return;
            const anchor = parseDay(`${value}-01`);
            if (anchor <= endOfDay(now)) change({ ...period, anchor: dateKey(anchor) });
          }} /></label> : <p className="text-center text-sm font-semibold">{title}</p>}
          <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0 rounded-full" aria-label={`Next ${period.mode}`} disabled={!canGoForward} onClick={() => change(shiftStudyPeriod(period, 1))}><ChevronRight className="h-5 w-5" /></Button>
        </div>
      )}

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

      <dl className="grid grid-cols-2 gap-3" aria-label="Study time by category">
        {CATEGORIES.map(category => <div key={category.source} className="rounded-2xl border border-border bg-panel p-3.5 sm:p-4">
          <dt className="flex items-center gap-2 text-[11px] font-medium leading-snug text-muted-foreground sm:text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} /><span>{category.label}</span></dt>
          <dd className="mt-3 flex items-center justify-between gap-2 text-xl font-semibold tracking-tight tabular-nums">{loading ? <Skeleton className="h-7 w-16" /> : formatStudyMinutes(summary.totals[category.source])}<category.icon className="h-4 w-4 shrink-0 text-muted-foreground/70" /></dd>
        </div>)}
      </dl>
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">Revision uses the duration of completed tasks. Feedback review time isn’t tracked yet.</p>
    </div>
  );
}
