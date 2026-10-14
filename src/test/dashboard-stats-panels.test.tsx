import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StatsDrilldownDrawer } from '@/components/dashboard/StatsDrilldownDrawer';
import { StudyHoursPanel } from '@/components/dashboard/stats/StudyHoursPanel';
import { StreakPanel } from '@/components/dashboard/stats/StreakPanel';
import { initialStudyPeriod, type StatsSection, type StreakData, type StudyPeriod } from '@/lib/dashboard-stats';

const device = vi.hoisted(() => ({ mobile: true }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => device.mobile }));
const now = new Date(2026, 9, 14, 12);
const streak: StreakData = {
  currentStreak: 3, longestStreak: 12, lastActiveDate: '2026-10-14T10:00:00',
  activity: [12, 13, 14].map(day => ({ date: `2026-10-${day}`, exams: 1, quizzes: day === 14 ? 1 : 0, revision: 0 })),
  todayActivity: ['1 exam submitted', '1 quiz completed'],
};
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); device.mobile = true; Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

function mountDrawer(initial: StatsSection = 'scores', extra = {}) {
  const navigate = vi.fn(); const close = vi.fn(); const retry = vi.fn();
  function Example() {
    const [type, setType] = useState<StatsSection>(initial);
    const [period, setPeriod] = useState(initialStudyPeriod(now));
    const [month, setMonth] = useState('2026-10-01');
    return <MemoryRouter><StatsDrilldownDrawer type={type} onNavigate={next => { navigate(next); setType(next); }} onClose={close} onRetry={retry} studyPeriod={period} onStudyPeriodChange={setPeriod} streakMonth={month} onStreakMonthChange={setMonth} streakData={streak} {...extra} /></MemoryRouter>;
  }
  render(<Example />);
  return { navigate, close, retry };
}
const touch = (x: number, y: number, identifier = 1) => ({ clientX: x, clientY: y, identifier });
function sendTouchEvent(type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', target: Element, options: { touches?: ReturnType<typeof touch>[]; changedTouches?: ReturnType<typeof touch>[] } = {}) {
  fireEvent[type](target, { changedTouches: options.touches ?? [], ...options });
}
function swipe(target: Element, from: number, to: number, dy = 0) {
  sendTouchEvent('touchStart', target, { touches: [touch(from, 200)] });
  sendTouchEvent('touchMove', target, { touches: [touch(to, 200 + dy)] });
  sendTouchEvent('touchEnd', target, { touches: [], changedTouches: [touch(to, 200 + dy)] });
}

describe('full-screen stats navigation', () => {
  it('swipes left from Score Breakdown to Exams Taken, then right through the other sections', () => {
    const { navigate } = mountDrawer();
    swipe(screen.getByLabelText('Score Breakdown details'), 280, 110);
    expect(screen.getByRole('heading', { name: 'Exams Taken' })).toBeVisible();
    swipe(screen.getByLabelText('Exams Taken details'), 100, 280);
    expect(screen.getByRole('heading', { name: 'Score Breakdown', level: 2 })).toBeVisible();
    swipe(screen.getByLabelText('Score Breakdown details'), 100, 280);
    expect(screen.getByRole('heading', { name: 'Study Hours' })).toBeVisible();
    swipe(screen.getByLabelText('Study Hours details'), 100, 280);
    expect(screen.getByRole('heading', { name: 'Day Streak' })).toBeVisible();
    expect(navigate.mock.calls.map(call => call[0])).toEqual(['exams', 'scores', 'study-hours', 'streak']);
  });
  it('does not wrap at either end', () => {
    const { navigate } = mountDrawer('exams');
    swipe(screen.getByLabelText('Exams Taken details'), 280, 100);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Day Streak' }));
    swipe(screen.getByLabelText('Day Streak details'), 100, 280);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Next section' })).toBeDisabled();
  });
  it.each([[200, 205, 180], [200, 230, 0], [5, 180, 0], [385, 200, 0]])('ignores vertical, short and browser-edge gestures (%s→%s, dy=%s)', (from, to, dy) => {
    const { navigate } = mountDrawer();
    swipe(screen.getByLabelText('Score Breakdown details'), from, to, dy);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('never captures a scrolling gesture that turns sideways or a pinch/cancel', () => {
    const { navigate } = mountDrawer();
    const area = screen.getByLabelText('Score Breakdown details');
    Object.assign(area.style, { overflowY: 'auto' });
    Object.defineProperties(area, { scrollHeight: { configurable: true, value: 1200 }, clientHeight: { configurable: true, value: 500 }, scrollTop: { configurable: true, value: 100 } });
    sendTouchEvent('touchStart', area, { touches: [touch(200, 200)] });
    const vertical = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(vertical, 'touches', { value: [touch(200, 240)] });
    Object.defineProperty(vertical, 'changedTouches', { value: [touch(200, 240)] });
    fireEvent(area, vertical);
    expect(vertical.defaultPrevented).toBe(false);
    sendTouchEvent('touchEnd', area, { touches: [], changedTouches: [touch(100, 210)] });
    sendTouchEvent('touchStart', area, { touches: [touch(200, 200), touch(100, 200, 2)] });
    sendTouchEvent('touchEnd', area, { touches: [], changedTouches: [touch(100, 200)] });
    sendTouchEvent('touchStart', area, { touches: [touch(200, 200)] });
    sendTouchEvent('touchCancel', area);
    sendTouchEvent('touchEnd', area, { touches: [], changedTouches: [touch(100, 200)] });
    expect(navigate).not.toHaveBeenCalled();
  });
  it('leaves form fields alone and offers accessible navigation without gestures', () => {
    const { navigate, close } = mountDrawer('exams');
    swipe(screen.getByPlaceholderText('Search exams...'), 100, 280);
    expect(navigate).not.toHaveBeenCalled();
    const next = screen.getByRole('button', { name: 'Next section: Score Breakdown' });
    next.focus(); expect(next).toHaveFocus(); fireEvent.click(next);
    expect(screen.getByRole('button', { name: 'Score Breakdown' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('status')).toHaveTextContent('section 2 of 4');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).toHaveBeenCalledOnce();
  });
  it('allows swiping over chart/date buttons without accidentally activating them', () => {
    const { navigate } = mountDrawer('study-hours');
    const bar = within(screen.getByTestId('study-time-plot')).getAllByRole('button')[0];
    swipe(bar, 280, 100);
    expect(navigate).toHaveBeenLastCalledWith('scores');
    expect(screen.getByRole('heading', { name: 'Score Breakdown', level: 2 })).toBeVisible();
    // A synthetic compatibility click on a persistent header button is consumed.
    fireEvent.click(screen.getByRole('button', { name: 'Day Streak' }), { detail: 1 });
    expect(navigate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Day Streak' }));
    const date = screen.getByRole('button', { name: /Wednesday 14 October 2026/ });
    swipe(date, 280, 100);
    expect(navigate).toHaveBeenLastCalledWith('study-hours');
  });
  it('keeps desktop section controls while disabling touch paging there', () => {
    device.mobile = false;
    const { navigate } = mountDrawer();
    swipe(screen.getByLabelText('Score Breakdown details'), 280, 100);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Day Streak' }));
    expect(screen.getByRole('heading', { name: 'Day Streak' })).toBeVisible();
  });
  it('shows a retryable load failure instead of empty or stale statistics', () => {
    const { retry } = mountDrawer('study-hours', { error: 'Couldn’t load your activity.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load');
    expect(screen.queryByText('0h 0m')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

function StudyExample({ loading = false } = {}) {
  const [period, setPeriod] = useState<StudyPeriod>(initialStudyPeriod(now));
  return <StudyHoursPanel period={period} onChange={setPeriod} loading={loading} sessions={[
    { id: 'old', date: '2026-09-02', duration: 60, source: 'exam' },
    { id: 'a', date: '2026-10-12', duration: 12, source: 'exam' },
    { id: 'b', date: '2026-10-12', duration: 6, source: 'practice' },
    { id: 'c', date: '2026-10-14', duration: 20, source: 'revision' },
  ]} />;
}

describe('consolidated study chart', () => {
  it('stacks the sources in one chart and keeps a matching four-colour total key', () => {
    render(<StudyExample />);
    expect(screen.getByText('38m')).toBeVisible();
    expect(screen.queryByText('Daily Breakdown')).not.toBeInTheDocument();
    const categories = screen.getByLabelText('Study time by category');
    expect(within(categories).getByText('Exams')).toBeVisible();
    expect(within(categories).getByText('12m')).toBeVisible();
    expect(within(categories).getByText('6m')).toBeVisible();
    expect(within(categories).getByText('20m')).toBeVisible();
    expect(within(categories).getByText('0h 0m')).toBeVisible();
  });
  it('has no redundant daily breakdown and shows one selectable bar per day with honest zero values', () => {
    render(<StudyExample />);
    const chart = screen.getByTestId('study-time-plot');
    expect(within(chart).getAllByRole('button')).toHaveLength(7);
    const monday = within(chart).getByRole('button', { name: /Monday 12 October.*18m/ });
    expect(monday.querySelectorAll('[data-source]')).toHaveLength(2);
    fireEvent.click(monday);
    expect(screen.getByText(/Monday 12 October 2026 · 18m/)).toBeVisible();
    expect(screen.queryByText('Daily Breakdown')).not.toBeInTheDocument();
    expect(screen.getByText(/Feedback review time isn’t tracked yet/)).toBeVisible();
  });
  it('moves to historical months and selects a month directly without enabling future navigation', () => {
    render(<StudyExample />);
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('September 2026')).toBeVisible();
    expect(screen.getAllByText('1h 0m')[0]).toBeVisible();
    expect(within(screen.getByTestId('study-time-plot')).getAllByRole('button')).toHaveLength(30);
    fireEvent.change(screen.getByLabelText('Choose study month'), { target: { value: '2026-08' } });
    expect(screen.getByText('August 2026')).toBeVisible();
    expect(screen.getByText('No study time recorded for these dates.')).toBeVisible();
  });
  it('validates a custom range, then includes both selected dates', () => {
    render(<StudyExample />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom range' }));
    fireEvent.change(screen.getByLabelText('Study range start'), { target: { value: '2026-10-13' } });
    fireEvent.change(screen.getByLabelText('Study range end'), { target: { value: '2026-10-12' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Apply dates' }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('on or after');
    fireEvent.change(screen.getByLabelText('Study range start'), { target: { value: '2026-10-12' } });
    fireEvent.change(screen.getByLabelText('Study range end'), { target: { value: '2026-10-14' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Apply dates' }).closest('form')!);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('38m')).toBeVisible();
    expect(within(screen.getByTestId('study-time-plot')).getAllByRole('button')).toHaveLength(3);
  });
  it('keeps range controls during loading but does not display false zeros', () => {
    render(<StudyExample loading />);
    expect(screen.getByRole('button', { name: 'Month' })).toBeEnabled();
    expect(screen.queryByText('0h 0m')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Loading study time')).toBeVisible();
  });
});

function StreakExample({ loading = false, activity = streak }: { loading?: boolean; activity?: StreakData } = {}) {
  const [month, setMonth] = useState('2026-10-01');
  return <StreakPanel data={activity} month={month} onMonthChange={setMonth} loading={loading} />;
}

describe('calendar, weekly momentum and activity goal', () => {
  it('combines a full Monday-first calendar, weekly progress, history and today’s real activities without XP', () => {
    render(<StreakExample />);
    const calendar = screen.getByRole('table');
    expect(within(calendar).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(calendar).getAllByRole('button')).toHaveLength(31);
    const today = within(calendar).getByRole('button', { name: /Wednesday 14 October 2026/ });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(within(calendar).getByRole('button', { name: /Thursday 15 October/ })).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: 'Daily goal: complete one activity' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('progressbar', { name: 'Active days this week' })).toHaveAttribute('aria-valuenow', '3');
    expect(screen.getByRole('heading', { name: 'History' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Today’s Activity' })).toBeVisible();
    expect(screen.getByText('1 quiz completed')).toBeVisible();
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next streak month' })).toBeDisabled();
  });
  it('shows real date details, keeps this week when browsing history and returns to the current month', () => {
    render(<StreakExample />);
    fireEvent.click(screen.getByRole('button', { name: /Tuesday 13 October 2026/ }));
    expect(screen.getByText('13 Oct · 1 exam submitted')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Previous streak month' }));
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Active days this week' })).toHaveAttribute('aria-valuenow', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Back to this month' }));
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  });
  it('keeps the goal achievable with one completed activity and shows a useful empty state', () => {
    render(<StreakExample activity={{ currentStreak: 0, longestStreak: 0, activity: [], todayActivity: [] }} />);
    expect(screen.getByText('One activity')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Daily goal: complete one activity' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/Submit an exam, finish a quiz or complete a revision task/)).toBeVisible();
  });
  it('does not label an unfetched month inactive or expose stale progress during loading', () => {
    render(<StreakExample loading />);
    expect(screen.getByRole('progressbar', { name: 'Active days this week' })).not.toHaveAttribute('aria-valuenow');
    expect(screen.getByRole('button', { name: /Wednesday 14 October 2026: loading/ })).toBeDisabled();
    expect(screen.queryByText('Done for today')).not.toBeInTheDocument();
  });
});
