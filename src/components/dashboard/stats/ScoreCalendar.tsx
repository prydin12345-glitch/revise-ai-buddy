import { format, isSameDay } from 'date-fns';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScoreCalendarSwipe } from '@/hooks/useScoreCalendarSwipe';
import { dateKey, parseDay } from '@/lib/dashboard-stats';
import { initialScorePeriod, scoreCalendarItems, shiftScorePeriod, type ScorePeriod, type ScoreView } from '@/lib/dashboard-scores';

export function ScoreCalendar({ period, onChange, onSwipe }: { period: ScorePeriod; onChange: (period: ScorePeriod) => void; onSwipe?: () => void }) {
  const now = new Date();
  const anchor = parseDay(period.anchor);
  const unit = period.view === 'day' ? 'week' : period.view;
  const mobile = useIsMobile();
  const shift = (direction: -1 | 1) => { const next = shiftScorePeriod(period, direction, now); if (next) onChange(next); };
  const swipe = useScoreCalendarSwipe(direction => { onSwipe?.(); shift(direction); }, mobile);
  const chooseView = (view: ScoreView) => onChange(view === 'day' ? initialScorePeriod(now) : { ...period, view });
  // A distinct historical-day value lets selecting Today reset the date even
  // while already in day mode. Native selects also use the phone's own picker.
  const historicalDay = period.view === 'day' && !isSameDay(anchor, now);
  const selectedView = historicalDay ? 'selected-day' : period.view;

  return <section className="stats-score-calendar" aria-label="Score calendar" data-stats-no-swipe>
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label={`Previous score ${unit}`} onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="min-w-0 text-sm font-semibold" aria-live="polite">{period.view === 'day' ? format(anchor, 'MMMM yyyy') : period.view === 'month' ? format(anchor, 'yyyy') : 'Years'}</span>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label={`Next score ${unit}`} disabled={!shiftScorePeriod(period, 1, now)} onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <div className="stats-score-select-wrap">
        <select className="stats-score-view-trigger" aria-label="Score calendar view" value={selectedView} onChange={event => chooseView(event.target.value as ScoreView)}>
          {historicalDay && <option value="selected-day" hidden>{format(anchor, 'd MMM')}</option>}
          <option value="day">Today</option><option value="month">Month</option><option value="year">Year</option>
        </select>
        <ChevronDown className="stats-score-select-chevron" aria-hidden="true" />
      </div>
    </div>
    <div className="stats-score-date-strip" role="group" aria-label={`${period.view === 'day' ? 'Daily' : period.view === 'month' ? 'Monthly' : 'Yearly'} score dates`} style={{ touchAction: mobile ? 'pinch-zoom' : 'pan-y pinch-zoom' }} {...swipe}>
      {scoreCalendarItems(period, now).map(item => <button type="button" key={item.key} aria-label={item.label} aria-pressed={item.selected} aria-current={period.view === 'day' && item.key === dateKey(now) ? 'date' : undefined} disabled={item.disabled} onClick={() => onChange({ ...period, anchor: item.key })}>
        <span>{period.view === 'year' ? 'Year' : item.top}</span><strong>{item.value}</strong><i aria-hidden="true" />
      </button>)}
    </div>
  </section>;
}
