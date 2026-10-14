import { useMemo, useState } from 'react';
import { addDays, addMonths, format, isSameMonth, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Flame, Target, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { activityCount, activityDescriptions, calendarDays, dateKey, parseDay, type StreakData } from '@/lib/dashboard-stats';

interface Props { data?: StreakData; month: string; onMonthChange: (month: string) => void; loading?: boolean }

export function StreakPanel({ data, month, onMonthChange, loading = false }: Props) {
  const now = new Date();
  const today = dateKey(now);
  const displayedMonth = startOfMonth(parseDay(month));
  const days = calendarDays(month);
  const activity = useMemo(() => new Map((data?.activity ?? []).map(day => [day.date, day])), [data?.activity]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const week = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(now, { weekStartsOn: 1 }), index));
  const weekActive = week.filter(day => activityCount(activity.get(dateKey(day))) > 0).length;
  const goalComplete = activityCount(activity.get(today)) > 0;
  const current = data?.currentStreak ?? 0;
  const nextMilestone = [7, 14, 30, 60, 100, 180, 365].find(value => value > current) ?? Math.ceil((current + 1) / 100) * 100;
  const last = data?.lastActiveDate ? parseISO(data.lastActiveDate) : null;
  const selected = selectedDay ? activity.get(selectedDay) : undefined;
  const navigateMonth = (direction: -1 | 1) => { setSelectedDay(null); onMonthChange(dateKey(addMonths(displayedMonth, direction))); };

  return (
    <div className="space-y-5" aria-busy={loading}>
      <div className="stats-streak-summary">
        <div className="min-w-0">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Flame className="h-4 w-4 text-warning" />Current streak</p>
          {loading ? <Skeleton className="h-10 w-28" /> : <p className="text-4xl font-semibold tracking-tight tabular-nums">{current}<span className="ml-1.5 text-base font-medium text-muted-foreground">{current === 1 ? 'day' : 'days'}</span></p>}
        </div>
        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div className={cn('stats-goal-ring', goalComplete && 'is-complete')} role="progressbar" aria-label="Daily goal: complete one activity" aria-valuemin={0} aria-valuemax={1} aria-valuenow={loading ? undefined : goalComplete ? 1 : 0} aria-valuetext={loading ? 'Loading activity' : goalComplete ? 'Complete' : 'Not yet complete'}>{goalComplete && !loading ? <Check className="h-5 w-5" /> : <Target className="h-5 w-5" />}</div>
          <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Daily goal</p><p className="mt-1 text-sm font-semibold">{loading ? '…' : goalComplete ? 'Done for today' : 'One activity'}</p><p className="mt-1 text-[10px] text-muted-foreground">Exam, quiz or revision</p></div>
        </div>
      </div>

      <section className="stats-calendar-card" aria-label="Streak calendar">
        <div className="mb-4 flex items-center justify-between gap-2" data-stats-no-swipe>
          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Previous streak month" onClick={() => navigateMonth(-1)}><ChevronLeft className="h-5 w-5" /></Button>
          <div className="text-center"><h3 className="text-base font-semibold tracking-tight">{format(displayedMonth, 'MMMM yyyy')}</h3>{!isSameMonth(displayedMonth, now) && <button type="button" className="mt-0.5 rounded px-2 py-1 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setSelectedDay(null); onMonthChange(dateKey(startOfMonth(now))); }}>Back to this month</button>}</div>
          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Next streak month" disabled={displayedMonth >= startOfMonth(now)} onClick={() => navigateMonth(1)}><ChevronRight className="h-5 w-5" /></Button>
        </div>
        <table className="stats-calendar" aria-busy={loading}>
          <caption className="sr-only">{format(displayedMonth, 'MMMM yyyy')} completed exams, quizzes and revision tasks</caption>
          <thead><tr>{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => <th scope="col" key={day} abbr={day}>{day.slice(0, 1)}</th>)}</tr></thead>
          <tbody>{Array.from({ length: days.length / 7 }, (_, row) => <tr key={row}>
            {days.slice(row * 7, row * 7 + 7).map((day, column) => {
              const key = dateKey(day);
              const inMonth = isSameMonth(day, displayedMonth);
              const active = !loading && activityCount(activity.get(key)) > 0;
              const future = key > today;
              const before = column > 0 && isSameMonth(addDays(day, -1), displayedMonth) && activityCount(activity.get(dateKey(addDays(day, -1)))) > 0;
              const after = column < 6 && isSameMonth(addDays(day, 1), displayedMonth) && activityCount(activity.get(dateKey(addDays(day, 1)))) > 0;
              const description = `${format(day, 'EEEE d MMMM yyyy')}: ${loading ? 'loading' : future ? 'upcoming' : activityDescriptions(activity.get(key)).join(', ') || 'no completed activity'}`;
              return <td key={key} className={cn(active && inMonth && 'is-active', active && before && 'joins-left', active && after && 'joins-right')}>
                {inMonth ? <button type="button" className={cn('stats-calendar-day', active && 'is-active', key === today && 'is-today', selectedDay === key && 'is-selected')} disabled={future || loading} aria-label={description} aria-current={key === today ? 'date' : undefined} aria-pressed={selectedDay === key} title={description} onClick={() => setSelectedDay(key)}><time dateTime={key}>{format(day, 'd')}</time></button> : <span className="stats-calendar-spacer" />}
              </td>;
            })}
          </tr>)}</tbody>
        </table>
        <div className="mt-4 flex items-center justify-between gap-3 text-[10px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" />Active day</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-primary bg-primary/10" />Today</span></div>
        {selectedDay && isSameMonth(parseDay(selectedDay), displayedMonth) && <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground" aria-live="polite">{format(parseDay(selectedDay), 'd MMM')} · {activityDescriptions(selected).join(' · ') || 'No completed activity'}</p>}
      </section>

      <section className="stats-week-card" aria-label="This week's activity">
        <div className="stats-week-flame" aria-hidden="true"><Flame className="h-9 w-9" strokeWidth={1.6} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">This week</h3><p className="text-xs text-muted-foreground">{loading ? '…' : `${weekActive} of 7 active days`}</p></div>
          <div className="stats-week-progress" role="progressbar" aria-label="Active days this week" aria-valuemin={0} aria-valuemax={7} aria-valuenow={loading ? undefined : weekActive}><span style={{ width: loading ? 0 : `${weekActive / 7 * 100}%` }} /></div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {week.map(day => {
              const key = dateKey(day);
              const active = !loading && activityCount(activity.get(key)) > 0;
              return <div key={key} className="text-center" aria-label={`${format(day, 'EEEE')}: ${loading ? 'loading' : active ? 'active' : key > today ? 'upcoming' : 'no activity'}`}><span className={cn('stats-week-check', active && 'is-active', key === today && 'is-today')}>{active ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="h-1 w-1 rounded-full bg-current opacity-40" />}</span><span className="mt-1.5 block text-[9px] font-medium text-muted-foreground">{format(day, 'EEEEE')}</span></div>;
            })}
          </div>
        </div>
      </section>

      <section aria-labelledby="streak-history-title">
        <h3 id="streak-history-title" className="mb-3 text-sm font-semibold">History</h3>
        <dl className="stats-history-grid">
          <div><dt><Trophy className="h-3.5 w-3.5" />Best streak</dt><dd>{loading ? '…' : `${data?.longestStreak ?? 0} days`}</dd></div>
          <div><dt><Target className="h-3.5 w-3.5" />Next milestone</dt><dd>{loading ? '…' : `${nextMilestone} days`}</dd></div>
          <div className="col-span-2 border-t border-border pt-3"><dt>Last activity</dt><dd>{loading ? '…' : last && isValid(last) ? format(last, 'd MMM yyyy') : 'No activity yet'}</dd></div>
        </dl>
      </section>
      <section aria-labelledby="streak-today-title">
        <h3 id="streak-today-title" className="mb-3 text-sm font-semibold">Today’s Activity</h3>
        {loading ? <Skeleton className="h-16 w-full rounded-2xl" /> : data?.todayActivity.length ? <ul className="space-y-2">{data.todayActivity.map(item => <li key={item} className="flex items-center gap-2.5 rounded-xl border border-success/20 bg-success/5 px-3.5 py-3 text-xs font-medium"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" />{item}</li>)}</ul> : <div className="rounded-2xl border border-dashed border-border bg-panel px-4 py-4"><p className="text-sm font-medium">Your next small win starts here.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Submit an exam, finish a quiz or complete a revision task to meet today’s goal.</p></div>}
      </section>
    </div>
  );
}
