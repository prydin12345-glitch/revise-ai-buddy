import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { StatsDrilldownDrawer } from '@/components/dashboard/StatsDrilldownDrawer';
import { StudyDateControls } from '@/components/dashboard/stats/StudyDateControls';
import { initialStudyPeriod, type DrilldownType, type ExamItem, type StudyPeriod } from '@/lib/dashboard-stats';

const device = vi.hoisted(() => ({ mobile: true }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => device.mobile }));
const now = new Date(2026, 9, 14, 12);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); device.mobile = true;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const exams: ExamItem[] = [
  { id: 'english', title: 'ENG P1', subject: 'English', dateTaken: '2026-10-12T09:00:00', isReleased: true, score: 0, totalMarks: 20, earnedMarks: 0, status: 'graded' },
  { id: 'biology', title: 'Explain', subject: 'Biology', dateTaken: '2026-10-13T09:00:00', isReleased: false, score: 78, totalMarks: 20, earnedMarks: 16, status: 'graded' },
  { id: 'failed', title: 'Mechanics', subject: 'Physics', dateTaken: '2026-10-14T09:00:00', isReleased: false, score: 93, totalMarks: 20, earnedMarks: 18, status: 'marking_failed' },
];

function Location() { const location = useLocation(); return <output aria-label="Current route">{location.pathname}</output>; }
function DrawerExample({ initial = 'scores' as DrilldownType, items = [] as ExamItem[] }) {
  const [type, setType] = useState<DrilldownType>(initial);
  return <MemoryRouter><StatsDrilldownDrawer type={type} onNavigate={setType} onClose={() => setType(null)} completedExams={items} studyPeriod={initialStudyPeriod(now)} onStudyPeriodChange={() => {}} streakMonth="2026-10-01" onStreakMonthChange={() => {}} /><Location /></MemoryRouter>;
}
function horizontalSwipe(target: Element, from: number, to: number, dy = 0) {
  const touch = (x: number, y: number) => ({ clientX: x, clientY: y, identifier: 1 });
  fireEvent.touchStart(target, { touches: [touch(from, 200)], changedTouches: [touch(from, 200)] });
  fireEvent.touchMove(target, { touches: [touch(to, 200 + dy)], changedTouches: [touch(to, 200 + dy)] });
  fireEvent.touchEnd(target, { touches: [], changedTouches: [touch(to, 200 + dy)] });
}
const selector = () => screen.getByRole('navigation', { name: 'Stats sections' });

describe('temporary stats selectors', () => {
  beforeEach(() => { vi.useRealTimers(); vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(now); });
  it('shows all four named selectors, marks the current one and fades after seven seconds', () => {
    render(<DrawerExample />);
    expect(within(selector()).getAllByRole('button')).toHaveLength(4);
    expect(within(selector()).getByRole('button', { name: 'Score Breakdown' })).toHaveAttribute('aria-current', 'page');
    expect(selector()).toHaveAttribute('data-visible', 'true');
    act(() => vi.advanceTimersByTime(6999));
    expect(selector()).toHaveAttribute('data-visible', 'true');
    act(() => vi.advanceTimersByTime(1));
    expect(selector()).toHaveAttribute('data-visible', 'false');
  });
  it('reveals and resets the timer on a swipe, including a swipe at a section boundary', () => {
    render(<DrawerExample />);
    act(() => vi.advanceTimersByTime(7000));
    horizontalSwipe(screen.getByLabelText('Score Breakdown details'), 280, 100);
    expect(selector()).toHaveAttribute('data-visible', 'true');
    expect(screen.getByRole('heading', { name: 'Exams Taken' })).toBeVisible();
    act(() => vi.advanceTimersByTime(6500));
    horizontalSwipe(screen.getByLabelText('Exams Taken details'), 280, 100);
    act(() => vi.advanceTimersByTime(1000));
    expect(selector()).toHaveAttribute('data-visible', 'true');
    act(() => vi.advanceTimersByTime(6000));
    expect(selector()).toHaveAttribute('data-visible', 'false');
  });
  it('resets after direct selection, header navigation and keyboard focus without visible text labels', () => {
    render(<DrawerExample />);
    const selectHours = within(selector()).getByRole('button', { name: 'Study Hours' });
    expect(selectHours).toHaveTextContent('');
    act(() => vi.advanceTimersByTime(6500));
    fireEvent.click(selectHours);
    act(() => vi.advanceTimersByTime(1000));
    expect(selector()).toHaveAttribute('data-visible', 'true');
    expect(selectHours).toHaveAttribute('aria-current', 'page');
    act(() => vi.advanceTimersByTime(6000));
    expect(selector()).toHaveAttribute('data-visible', 'false');
    act(() => selectHours.focus());
    expect(selector()).toHaveAttribute('data-visible', 'true');
    act(() => vi.advanceTimersByTime(7000));
    fireEvent.click(screen.getByRole('button', { name: 'Previous section: Score Breakdown' }));
    expect(selector()).toHaveAttribute('data-visible', 'true');
  });
  it('does not reveal the selector for ordinary vertical scrolling and clears its timer on close', () => {
    render(<DrawerExample />);
    act(() => vi.advanceTimersByTime(7000));
    horizontalSwipe(screen.getByLabelText('Score Breakdown details'), 180, 184, 180);
    expect(selector()).toHaveAttribute('data-visible', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.queryByRole('navigation', { name: 'Stats sections' })).not.toBeInTheDocument();
  });
  it('also offers the four selectors on desktop while retaining arrow navigation', () => {
    device.mobile = false;
    render(<DrawerExample />);
    fireEvent.click(within(selector()).getByRole('button', { name: 'Day Streak' }));
    expect(screen.getByRole('heading', { name: 'Day Streak' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous section: Study Hours' })).toBeEnabled();
  });
});

function mountDates(initial = initialStudyPeriod(now)) {
  const change = vi.fn();
  function Example() {
    const [period, setPeriod] = useState<StudyPeriod>(initial);
    return <StudyDateControls period={period} onChange={next => { change(next); setPeriod(next); }} />;
  }
  render(<Example />);
  return change;
}
const day = (label: string) => screen.getByRole('gridcell', { name: label });
function chooseCalendarMonth(month: string, previousYears = 0) {
  fireEvent.click(screen.getByRole('button', { name: 'Choose calendar month and year' }));
  for (let i = 0; i < previousYears; i++) fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
  fireEvent.click(screen.getByRole('button', { name: month }));
}

describe('study date pickers', () => {
  it('browses years in the twelve-month picker without applying until a month is chosen', () => {
    const change = mountDates({ ...initialStudyPeriod(now), mode: 'month' });
    fireEvent.click(screen.getByRole('button', { name: 'Choose study month' }));
    expect(within(screen.getByRole('group', { name: 'Months in 2026' })).getAllByRole('button')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'October 2026' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'November 2026' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next year' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'December 2025' }));
    expect(change).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mode: 'month', anchor: '2025-12-01' }));
    expect(screen.queryByRole('group', { name: 'Months in 2025' })).not.toBeInTheDocument();
    expect(screen.getByText('December 2025')).toBeVisible();
  });
  it('uses a start/end selection and saves a chronological range even when tapped backwards', () => {
    const change = mountDates();
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    fireEvent.click(day('Wednesday 14 October 2026'));
    expect(day('Wednesday 14 October 2026')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(day('Monday 12 October 2026'));
    expect(day('Tuesday 13 October 2026')).toHaveAttribute('aria-selected', 'true');
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(change).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mode: 'custom', from: '2026-10-12', to: '2026-10-14' }));
    expect(screen.getByRole('button', { name: /Select date/ })).toBeVisible();
    expect(screen.queryByLabelText('Study range start')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Study range end')).not.toBeInTheDocument();
  });
  it('cancels a partial range without changing the period, then reopens the saved dates', () => {
    const initial: StudyPeriod = { ...initialStudyPeriod(now), mode: 'custom', from: '2026-09-01', to: '2026-09-04' };
    const change = mountDates(initial);
    fireEvent.click(screen.getByRole('button', { name: /Select date/ }));
    fireEvent.click(day('Wednesday 2 September 2026'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByText('1 Sep 2026 – 4 Sep 2026')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Select date/ }));
    expect(day('Tuesday 1 September 2026')).toHaveAttribute('aria-selected', 'true');
    expect(day('Friday 4 September 2026')).toHaveAttribute('aria-selected', 'true');
  });
  it('supports single-day ranges, keeps today selectable and disables future dates', () => {
    const change = mountDates();
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    expect(day('Thursday 15 October 2026')).toBeDisabled();
    expect(day('Wednesday 14 October 2026')).toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('button', { name: 'Next calendar month' })).toBeDisabled();
    fireEvent.click(day('Wednesday 14 October 2026'));
    fireEvent.click(day('Wednesday 14 October 2026'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(change).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ from: '2026-10-14', to: '2026-10-14' }));
  });
  it('closes on Escape without applying and returns keyboard focus to the opening control', async () => {
    const change = mountDates();
    const trigger = screen.getByRole('button', { name: 'Custom range' });
    fireEvent.click(trigger);
    fireEvent.click(day('Monday 12 October 2026'));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Select date' }), { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(change).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('retains a start date when navigating across years and only commits on Save', () => {
    const change = mountDates();
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    chooseCalendarMonth('December 2025', 1);
    fireEvent.click(day('Wednesday 31 December 2025'));
    fireEvent.click(screen.getByRole('button', { name: 'Next calendar month' }));
    fireEvent.click(day('Friday 2 January 2026'));
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(change).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ from: '2025-12-31', to: '2026-01-02' }));
  });
  it('blocks ranges exceeding 366 days, without losing the current chart period', () => {
    const change = mountDates();
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    chooseCalendarMonth('September 2025', 1);
    fireEvent.click(day('Monday 1 September 2025'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose calendar month and year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    fireEvent.click(screen.getByRole('button', { name: 'October 2026' }));
    fireEvent.click(day('Wednesday 14 October 2026'));
    expect(screen.getByRole('alert')).toHaveTextContent('up to 366 days');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(change).not.toHaveBeenCalled();
  });
  it('keeps the keyboard calendar navigation and normal selection behaviour', () => {
    mountDates();
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    const start = day('Monday 12 October 2026');
    act(() => start.focus());
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    expect(day('Tuesday 13 October 2026')).toHaveFocus();
    fireEvent.click(day('Tuesday 13 October 2026'));
    expect(screen.getByText('13 Oct 2026 – choose end date')).toBeVisible();
  });
  it('leaves the parent drawer on Study Hours when a date-picker gesture is horizontal', () => {
    render(<DrawerExample initial="study-hours" />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    horizontalSwipe(day('Monday 12 October 2026'), 280, 100);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Study Hours' })).toBeVisible();
  });
});

describe('mobile exam rows', () => {
  it('keeps released zero scores, hides unreleased results and displays failed marking honestly', () => {
    render(<DrawerExample initial="exams" items={exams} />);
    const list = screen.getByRole('list', { name: 'Exam history' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(within(list).getByText('0%')).toBeVisible();
    expect(within(list).getByText('Awaiting marks')).toBeVisible();
    expect(within(list).getByText('Marking incomplete')).toBeVisible();
    expect(within(list).queryByText('78%')).not.toBeInTheDocument();
    expect(within(list).queryByText('93%')).not.toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Review Explain' })).toHaveAccessibleDescription('Biology 13 Oct 2026 Awaiting marks');
    expect(screen.getByLabelText('3 exams')).toBeVisible();
    expect(list.querySelectorAll('img')).toHaveLength(0);
  });
  it('preserves search, filters and full-row navigation to the existing review route', () => {
    render(<DrawerExample initial="exams" items={exams} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Search exams' }), { target: { value: 'Biology' } });
    expect(within(screen.getByRole('list', { name: 'Exam history' })).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Review Explain' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/exam/biology/review');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search exams' }), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(within(screen.getByRole('list', { name: 'Exam history' })).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Review ENG P1' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('retains desktop exam controls without switching to the illustrated mobile list', () => {
    device.mobile = false;
    render(<DrawerExample initial="exams" items={exams} />);
    expect(screen.getByRole('combobox', { name: 'Sort exams' })).toBeVisible();
    expect(screen.queryByRole('list', { name: 'Exam history' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review ENG P1' })).toBeVisible();
  });
});
