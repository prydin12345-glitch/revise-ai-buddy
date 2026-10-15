import { useRef, useState, type MouseEvent } from 'react';
import { addMonths, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { useDayRender, type CaptionProps, type DateRange, type DayProps } from 'react-day-picker';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dateKey, parseDay, resolveStudyPeriod, shiftStudyPeriod, type StudyPeriod } from '@/lib/dashboard-stats';
import { cn } from '@/lib/utils';

function CalendarMark() {
  return <svg viewBox="0 0 24 24" fill="none" className="stats-calendar-mark" aria-hidden="true" focusable="false">
    <rect x="3" y="5" width="18" height="16" rx="4" fill="currentColor" fillOpacity=".09" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 3v4m8-4v4M3 10h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="7" y="13" width="3.5" height="3.5" rx="1" fill="currentColor" />
    <path d="M14 14h3m-3 3h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>;
}

function MonthGrid({ year, onYear, selected, now, onSelect }: {
  year: number; onYear: (year: number) => void; selected: Date; now: Date; onSelect: (month: Date) => void;
}) {
  return <div className="stats-month-grid-surface">
    <div className="mb-4 flex items-center justify-between">
      <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full" aria-label="Previous year" onClick={() => onYear(year - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-base font-semibold tabular-nums" aria-live="polite">{year}</span>
      <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full" aria-label="Next year" disabled={year >= now.getFullYear()} onClick={() => onYear(year + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>
    <div className="stats-month-grid" role="group" aria-label={`Months in ${year}`}>
      {Array.from({ length: 12 }, (_, month) => {
        const date = new Date(year, month, 1);
        return <button type="button" key={month} aria-label={format(date, 'MMMM yyyy')} aria-pressed={isSameMonth(date, selected)} disabled={date > startOfMonth(now)} onClick={() => onSelect(date)}>{format(date, 'MMM')}</button>;
      })}
    </div>
  </div>;
}

// Retain the calendar grid's accessible name; navigation is in our month/year toolbar.
function RangeCaption({ id, displayMonth }: CaptionProps) {
  return <span id={id} className="sr-only">{format(displayMonth, 'MMMM yyyy')}</span>;
}

function RangeDay({ date, displayMonth }: DayProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const day = useDayRender(date, displayMonth, buttonRef);
  if (day.isHidden) return <div role="gridcell" />;
  return <button {...day.buttonProps} ref={buttonRef} type="button" aria-label={format(date, 'EEEE d MMMM yyyy')} aria-current={day.activeModifiers.today ? 'date' : undefined} />;
}

export function StudyDateControls({ period, onChange }: { period: StudyPeriod; onChange: (period: StudyPeriod) => void }) {
  const now = new Date();
  const interval = resolveStudyPeriod(period, now);
  const [monthOpen, setMonthOpen] = useState(false);
  const [year, setYear] = useState(interval.start.getFullYear());
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeTrigger = useRef<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState<DateRange>();
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(interval.start));
  const [monthView, setMonthView] = useState(false);
  const canGoForward = interval.start < (period.mode === 'month' ? startOfMonth(now) : startOfWeek(now, { weekStartsOn: 1 }));

  const openRange = (event: MouseEvent<HTMLButtonElement>) => {
    rangeTrigger.current = event.currentTarget;
    const saved = { from: parseDay(period.from), to: parseDay(period.to) };
    setDraft(saved);
    setChoosingEnd(false);
    setCalendarMonth(startOfMonth(saved.from));
    setYear(saved.from.getFullYear());
    setMonthView(false);
    setRangeOpen(true);
  };
  const selectDay = (day: Date) => {
    if (day > now) return;
    if (!choosingEnd || !draft?.from) {
      setDraft({ from: day, to: undefined });
      setChoosingEnd(true);
    } else {
      // A second tap can precede the first: keep the saved range chronological.
      setDraft(day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day });
      setChoosingEnd(false);
    }
  };
  let error = '';
  let proposal: StudyPeriod | undefined;
  if (draft?.from && draft.to) {
    const candidate: StudyPeriod = { ...period, mode: 'custom', from: dateKey(draft.from), to: dateKey(draft.to) };
    try { resolveStudyPeriod(candidate, now); proposal = candidate; }
    catch (caught) { error = caught instanceof Error ? caught.message : 'Choose a valid date range.'; }
  }

  return <div className="space-y-4" data-stats-no-swipe>
    <div className="stats-range-switch" role="group" aria-label="Study time range">
      {(['week', 'month', 'custom'] as const).map(mode => <button type="button" key={mode} aria-pressed={period.mode === mode} onClick={event => mode === 'custom' ? openRange(event) : onChange({ ...period, mode, anchor: dateKey(now) })} className={cn('stats-range-option', period.mode === mode && 'is-selected')}>{mode === 'custom' ? 'Custom range' : mode === 'week' ? 'Week' : 'Month'}</button>)}
    </div>
    {period.mode === 'custom' ? <button type="button" className="stats-date-trigger w-full" onClick={openRange} aria-haspopup="dialog">
      <span className="min-w-0 text-left"><span className="block text-sm font-semibold">Select date</span><span className="mt-1 block text-xs text-muted-foreground">{format(interval.start, 'd MMM yyyy')} – {format(interval.end, 'd MMM yyyy')}</span></span><CalendarMark />
    </button> : <div className="flex min-w-0 items-center justify-between gap-2">
      <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0 rounded-full" aria-label={`Previous ${period.mode}`} onClick={() => onChange(shiftStudyPeriod(period, -1))}><ChevronLeft className="h-5 w-5" /></Button>
      {period.mode === 'month' ? <Popover open={monthOpen} onOpenChange={open => { setMonthOpen(open); if (open) setYear(interval.start.getFullYear()); }}>
        <PopoverTrigger asChild><button type="button" className="stats-date-trigger min-w-0" aria-label="Choose study month"><CalendarMark /><span className="text-sm font-semibold">{format(interval.start, 'MMMM yyyy')}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></button></PopoverTrigger>
        <PopoverContent className="w-[min(21rem,calc(100vw-2rem))] rounded-3xl p-4" align="center" data-stats-no-swipe>
          <MonthGrid year={year} onYear={setYear} selected={interval.start} now={now} onSelect={month => { onChange({ ...period, anchor: dateKey(month) }); setMonthOpen(false); }} />
        </PopoverContent>
      </Popover> : <p className="text-center text-sm font-semibold">{format(interval.start, 'd MMM')} – {format(interval.end, 'd MMM yyyy')}</p>}
      <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0 rounded-full" aria-label={`Next ${period.mode}`} disabled={!canGoForward} onClick={() => onChange(shiftStudyPeriod(period, 1))}><ChevronRight className="h-5 w-5" /></Button>
    </div>}

    <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
      <DialogContent hideCloseButton className="max-h-[calc(100dvh-2rem)] max-w-sm gap-4 overflow-y-auto rounded-3xl p-5 sm:rounded-3xl sm:p-6" data-stats-no-swipe onCloseAutoFocus={event => { event.preventDefault(); rangeTrigger.current?.focus(); }}>
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2.5"><CalendarMark />Select date</DialogTitle>
          <DialogDescription>Choose a start date, then an end date.</DialogDescription>
        </DialogHeader>
        <p className="min-h-6 text-sm font-medium tabular-nums" aria-live="polite">{draft?.from ? draft.to ? `${format(draft.from, 'd MMM yyyy')} – ${format(draft.to, 'd MMM yyyy')}` : `${format(draft.from, 'd MMM yyyy')} – choose end date` : 'Choose a start date'}</p>
        {monthView ? <MonthGrid year={year} onYear={setYear} selected={calendarMonth} now={now} onSelect={month => { setCalendarMonth(month); setMonthView(false); }} /> : <div>
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Previous calendar month" onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <button type="button" className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" onClick={() => { setYear(calendarMonth.getFullYear()); setMonthView(true); }} aria-label="Choose calendar month and year">{format(calendarMonth, 'MMMM yyyy')}<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Next calendar month" disabled={calendarMonth >= startOfMonth(now)} onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Calendar mode="range" month={calendarMonth} onMonthChange={setCalendarMonth} selected={draft} onDayClick={selectDay} disabled={{ after: now }} toMonth={now} weekStartsOn={1} fixedWeeks showOutsideDays={false}
            className="stats-date-calendar min-h-0 p-0" components={{ Caption: RangeCaption, Day: RangeDay }}
            classNames={{ months: '', month: '', caption: '', table: 'stats-date-table', head_row: '', row: '', head_cell: 'stats-date-weekday', cell: 'stats-date-cell', day: 'stats-date-day', day_selected: 'is-selected', day_range_start: 'is-range-start', day_range_end: 'is-range-end', day_range_middle: 'is-range-middle', day_outside: 'is-outside', day_disabled: 'is-disabled', day_today: 'is-today', day_hidden: 'invisible' }} />
        </div>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <DialogFooter className="flex-row justify-end gap-2 border-t border-border pt-4 sm:space-x-0">
          <Button type="button" variant="ghost" className="rounded-full px-5" onClick={() => setRangeOpen(false)}>Cancel</Button>
          <Button type="button" className="rounded-full px-6" disabled={!proposal} onClick={() => { if (proposal) { onChange(proposal); setRangeOpen(false); } }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
