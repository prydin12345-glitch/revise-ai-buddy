import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScoreBreakdownPanel } from '@/components/dashboard/stats/ScoreBreakdownPanel';
import { ScoreCalendar } from '@/components/dashboard/stats/ScoreCalendar';
import { EMPTY_SCORES, initialScorePeriod, type ScoreAttempt, type ScoreData, type ScorePeriod } from '@/lib/dashboard-scores';

const device = vi.hoisted(() => ({ mobile: true }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => device.mobile }));
const now = new Date(2026, 9, 14, 12);
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); device.mobile = true; Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

const attempt = (patch: Partial<ScoreAttempt> = {}): ScoreAttempt => ({ id: 'exam', source: 'exam', subject: 'Biology', title: 'Paper 1', date: '2026-10-14T09:00:00', profileId: 'p1', profileName: 'Paper 1 Higher', score: 80, earnedMarks: 80, totalMarks: 100, ...patch });
const scores: ScoreData = { subjects: ['Biology', 'Physics'], attempts: [attempt(), attempt({ id: 'quiz', source: 'quiz', score: 40, earnedMarks: 4, totalMarks: 10 }), attempt({ id: 'physics', subject: 'Physics', profileName: 'Mechanics', profileId: 'physics-profile', score: 90, earnedMarks: 90 }), attempt({ id: 'older', date: '2026-10-13T23:59:59', score: 0, earnedMarks: 0 })], pending: [{ id: 'pending', source: 'quiz', subject: 'Biology', date: '2026-10-14T10:00:00' }, { id: 'hidden', source: 'exam', subject: 'Physics', date: '2026-10-14T10:00:00' }] };
function mountPanel({ data = scores, loading = false, error = undefined as string | undefined, initial = initialScorePeriod(now) } = {}) {
  const periodChange = vi.fn(); const subjectChange = vi.fn(); const retry = vi.fn();
  function Example() {
    const [period, setPeriod] = useState(initial); const [subject, setSubject] = useState('Biology');
    return <ScoreBreakdownPanel data={data} period={period} onPeriodChange={next => { periodChange(next); setPeriod(next); }} subject={subject} onSubjectChange={next => { subjectChange(next); setSubject(next); }} loading={loading} error={error} onRetry={retry} />;
  }
  render(<Example />); return { periodChange, subjectChange, retry };
}
// These checks assert DOM/data transitions, not CSS layout; include hidden nodes to
// avoid jsdom's expensive visibility walk. Subject absence is checked in the DOM.
const byRole = (role: Parameters<typeof screen.getByRole>[0], options: Parameters<typeof screen.getByRole>[1] = {}) => screen.getByRole(role, { hidden: true, ...options });
const queryRole = (role: Parameters<typeof screen.queryByRole>[0], options: Parameters<typeof screen.queryByRole>[1] = {}) => screen.queryByRole(role, { hidden: true, ...options });
function chooseMode(value: 'day' | 'month' | 'year') {
  fireEvent.change(byRole('combobox', { name: 'Score calendar view' }), { target: { value } });
}
function swipe(target: Element, x: number, y: number, from = { x: 190, y: 250 }) {
  const point = (dx: number, dy: number, id = 1) => ({ identifier: id, clientX: dx, clientY: dy });
  fireEvent.touchStart(target, { touches: [point(from.x, from.y)], changedTouches: [point(from.x, from.y)] });
  fireEvent.touchMove(target, { touches: [point(from.x + x, from.y + y)], changedTouches: [point(from.x + x, from.y + y)] });
  fireEvent.touchEnd(target, { touches: [], changedTouches: [point(from.x + x, from.y + y)] });
}

describe('subject-only score panels', () => {
  it('renders exactly the average and profile panels for one subject, with real exam/quiz values', () => {
    mountPanel();
    expect(byRole('img', { name: 'Biology: 60 out of 100 across 2 marked attempts' })).toBeInTheDocument();
    expect(byRole('region', { name: 'Biology average score' })).toBeInTheDocument();
    expect(byRole('region', { name: 'Biology scores by profile' })).toBeInTheDocument();
    const table = byRole('table', { name: 'Biology average marks out of 100 by profile' });
    expect(within(table).getByRole('cell', { hidden: true, name: '80 out of 100' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { hidden: true, name: '40 out of 100' })).toBeInTheDocument();
    expect(queryRole('region', { name: 'Physics average score' })).not.toBeInTheDocument();
    expect(screen.queryByText('Weak topics')).not.toBeInTheDocument();
    expect(screen.getByText(/1 quiz awaiting complete marks/)).toBeInTheDocument();
    expect(screen.queryByText(/1 unmarked or unreleased exam/)).not.toBeInTheDocument();
  });
  it('changes the whole view to another subject instead of adding another subject card', () => {
    const { subjectChange } = mountPanel();
    fireEvent.change(byRole('combobox', { name: 'Score subject' }), { target: { value: 'Physics' } });
    expect(subjectChange).toHaveBeenCalledWith('Physics');
    expect(byRole('img', { name: 'Physics: 90 out of 100 across 1 marked attempt' })).toBeInTheDocument();
    expect(queryRole('region', { name: 'Biology average score' })).not.toBeInTheDocument();
    expect(screen.queryByText(/quiz awaiting complete/)).not.toBeInTheDocument();
    expect(screen.getByText(/1 unmarked or unreleased exam/)).toBeInTheDocument();
  });
  it('filters both panels and the excluded count to the chosen day, preserving a real zero', () => {
    mountPanel();
    fireEvent.click(byRole('button', { name: 'Tuesday 13 October 2026' }));
    expect(byRole('img', { name: 'Biology: 0 out of 100 across 1 marked attempt' })).toBeInTheDocument();
    const table = byRole('table');
    expect(within(table).getByRole('cell', { hidden: true, name: '0 out of 100' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { hidden: true, name: 'No marked quizzes' })).toBeInTheDocument();
    expect(screen.queryByText(/Not included/)).not.toBeInTheDocument();
  });
  it('uses month and year modes and Today returns to the current seven-day strip', () => {
    mountPanel();
    chooseMode('month');
    expect(byRole('group', { name: 'Monthly score dates' })).toBeInTheDocument();
    expect(byRole('img', { name: 'Biology: 40 out of 100 across 3 marked attempts' })).toBeInTheDocument();
    chooseMode('year');
    expect(byRole('group', { name: 'Yearly score dates' })).toBeInTheDocument();
    expect(byRole('button', { name: '2027' })).toBeDisabled();
    chooseMode('day');
    expect(within(byRole('group', { name: 'Daily score dates' })).getAllByRole('button', { hidden: true })).toHaveLength(7);
    expect(byRole('button', { name: 'Wednesday 14 October 2026' })).toHaveAttribute('aria-current', 'date');
    fireEvent.click(byRole('button', { name: 'Tuesday 13 October 2026' }));
    expect(byRole('combobox', { name: 'Score calendar view' })).toHaveValue('selected-day');
    chooseMode('day');
    expect(byRole('button', { name: 'Wednesday 14 October 2026' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('shows no-data as a dash and keeps dates usable during loading and errors', () => {
    const { unmount } = render(<ScoreBreakdownPanel data={{ ...EMPTY_SCORES, subjects: ['Biology'] }} period={initialScorePeriod(now)} onPeriodChange={() => {}} subject="Biology" onSubjectChange={() => {}} />);
    expect(byRole('img', { name: /Biology: no marked scores/ })).toBeInTheDocument();
    expect(screen.getByText('No marked scores for these dates.')).toBeInTheDocument();
    unmount();
    mountPanel({ loading: true });
    expect(screen.getByLabelText('Loading scores')).toBeInTheDocument();
    expect(byRole('combobox', { name: 'Score calendar view' })).toBeEnabled();
    expect(queryRole('img')).not.toBeInTheDocument();
  });
  it('keeps the calendar above a retryable score error instead of showing a partial average', () => {
    const { retry } = mountPanel({ error: 'Couldn’t load your activity.' });
    expect(byRole('alert')).toHaveTextContent('Couldn’t load');
    expect(byRole('group', { name: 'Daily score dates' })).toBeInTheDocument();
    expect(queryRole('img')).not.toBeInTheDocument();
    fireEvent.click(byRole('button', { name: 'Try again' })); expect(retry).toHaveBeenCalledOnce();
  });
  it('pages four profiles at a time without a sideways overflow list or hidden subject cards', () => {
    mountPanel({ data: { subjects: ['Biology'], pending: [], attempts: Array.from({ length: 6 }, (_, index) => attempt({ id: `e${index}`, profileId: `p${index}`, profileName: `Profile ${index}` })) } });
    expect(within(byRole('table')).getAllByRole('row', { hidden: true })).toHaveLength(5);
    fireEvent.click(byRole('button', { name: 'Next profiles' }));
    expect(screen.getByText('5–6 of 6 profiles')).toBeInTheDocument();
    expect(within(byRole('table')).getAllByRole('row', { hidden: true })).toHaveLength(3);
    expect(byRole('button', { name: 'Next profiles' })).toBeDisabled();
    fireEvent.click(byRole('button', { name: 'Tuesday 13 October 2026' }));
    expect(queryRole('button', { name: 'Next profiles' })).not.toBeInTheDocument();
  });
});

function mountCalendar(initial: ScorePeriod = { view: 'day', anchor: '2026-10-07' }) {
  const change = vi.fn(); const onSwipe = vi.fn();
  function Example() { const [period, setPeriod] = useState(initial); return <ScoreCalendar period={period} onChange={next => { change(next); setPeriod(next); }} onSwipe={onSwipe} />; }
  render(<Example />); return { change, onSwipe };
}
describe('calendar-local swipes', () => {
  it.each([[-90, 0, '2026-09-30'], [90, 0, '2026-10-14'], [0, -90, '2026-09-30'], [0, 90, '2026-10-14']])('moves dates with swipe (%s,%s) without a section-navigation gesture', (x, y, anchor) => {
    const { change, onSwipe } = mountCalendar();
    swipe(byRole('group', { name: 'Daily score dates' }), Number(x), Number(y));
    expect(change).toHaveBeenCalledExactlyOnceWith({ view: 'day', anchor });
    expect(onSwipe).toHaveBeenCalledOnce();
  });
  it('does not also tap a date after a committed swipe and never advances into the future', () => {
    const { change } = mountCalendar();
    swipe(byRole('button', { name: 'Tuesday 6 October 2026' }), 90, 0);
    fireEvent.click(byRole('button', { name: 'Tuesday 13 October 2026' }), { detail: 1 });
    expect(change).toHaveBeenCalledTimes(1);
    expect(byRole('button', { name: 'Wednesday 14 October 2026' })).toHaveAttribute('aria-pressed', 'true');
    swipe(byRole('group', { name: 'Daily score dates' }), 90, 0);
    expect(change).toHaveBeenCalledTimes(1);
    expect(byRole('button', { name: 'Next score week' })).toBeDisabled();
  });
  it('leaves short, diagonal, browser-edge and pinch gestures alone', () => {
    const { change } = mountCalendar(); const area = byRole('group', { name: 'Daily score dates' });
    swipe(area, 20, 0); swipe(area, 65, 60); swipe(area, 90, 0, { x: 5, y: 200 });
    const p = (x: number, identifier: number) => ({ identifier, clientX: x, clientY: 200 });
    fireEvent.touchStart(area, { touches: [p(190, 1), p(100, 2)], changedTouches: [p(190, 1), p(100, 2)] });
    fireEvent.touchEnd(area, { touches: [], changedTouches: [p(100, 1)] });
    expect(change).not.toHaveBeenCalled();
  });
  it('keeps desktop date arrows but does not capture touch swipes there', () => {
    device.mobile = false; const { change } = mountCalendar();
    swipe(byRole('group', { name: 'Daily score dates' }), -90, 0);
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(byRole('button', { name: 'Previous score week' }));
    expect(change).toHaveBeenCalledOnce();
  });
  it('uses the active month or year as the swipe unit', () => {
    const monthChange = vi.fn();
    const { unmount } = render(<ScoreCalendar period={{ view: 'month', anchor: '2026-10-01' }} onChange={monthChange} />);
    swipe(byRole('group', { name: 'Monthly score dates' }), -90, 0);
    expect(monthChange).toHaveBeenCalledExactlyOnceWith({ view: 'month', anchor: '2026-09-01' });
    unmount();
    const { change } = mountCalendar({ view: 'year', anchor: '2026-01-01' });
    swipe(byRole('group', { name: 'Yearly score dates' }), 0, -90);
    expect(change).toHaveBeenCalledExactlyOnceWith({ view: 'year', anchor: '2025-01-01' });
  });

});
