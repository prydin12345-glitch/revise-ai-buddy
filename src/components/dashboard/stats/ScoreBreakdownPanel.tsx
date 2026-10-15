import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { parseDay } from '@/lib/dashboard-stats';
import { summariseScores, type ScoreData, type ScorePeriod } from '@/lib/dashboard-scores';
import { ScoreCalendar } from './ScoreCalendar';

type Summary = ReturnType<typeof summariseScores>;
const display = (value: number | null) => value === null ? '—' : String(Math.round(value));

function ProfileScores({ profiles, subject }: { profiles: Summary['profiles']; subject: string }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(profiles.length / 4);
  const selected = Math.min(page, Math.max(pages - 1, 0));
  const visible = profiles.slice(selected * 4, selected * 4 + 4);
  return <section className="stats-score-card stats-profile-scores" aria-label={`${subject} scores by profile`}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">By profile</h3>
      <div className="stats-score-legend"><span><i data-source="exam" />Exams</span><span><i data-source="quiz" />Quizzes</span></div>
    </div>
    {!profiles.length ? <p className="flex min-h-52 items-center justify-center px-4 text-center text-sm text-muted-foreground">No marked scores for these dates.</p> : <>
      <div className="stats-profile-chart" aria-hidden="true">
        <div className="stats-profile-axis"><span>100</span><span>50</span><span>0</span></div>
        <div className="stats-profile-bars">
          <div className="stats-profile-guides"><i /><i /><i /></div>
          {visible.map(profile => <div className="stats-profile-group" key={profile.id}>
            <div className="stats-profile-pair">
              {(['exams', 'quizzes'] as const).map(source => <div className="stats-profile-bar-space" key={source}>
                <span className="stats-profile-bar-value">{display(profile[source])}</span>
                {profile[source] !== null ? <i className="stats-profile-bar" data-source={source === 'exams' ? 'exam' : 'quiz'} style={{ height: `${profile[source]}%`, minHeight: '2px' }} /> : <i className="stats-profile-no-bar" />}
              </div>)}
            </div>
            <span className="stats-profile-label" title={profile.name}>{profile.name}</span>
          </div>)}
        </div>
      </div>
      <table className="sr-only"><caption>{subject} average marks out of 100 by profile</caption><thead><tr><th>Profile</th><th>Exams</th><th>Quizzes</th><th>Marked attempts</th></tr></thead><tbody>{visible.map(profile => <tr key={profile.id}><th>{profile.name}</th><td>{profile.exams === null ? 'No marked exams' : `${display(profile.exams)} out of 100`}</td><td>{profile.quizzes === null ? 'No marked quizzes' : `${display(profile.quizzes)} out of 100`}</td><td>{profile.attempts.length}</td></tr>)}</tbody></table>
      {pages > 1 && <div className="mt-4 flex items-center justify-end gap-2">
        <span className="mr-auto text-[11px] text-muted-foreground" aria-live="polite">{selected * 4 + 1}–{Math.min(selected * 4 + 4, profiles.length)} of {profiles.length} profiles</span>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Previous profiles" disabled={selected === 0} onClick={() => setPage(selected - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Next profiles" disabled={selected === pages - 1} onClick={() => setPage(selected + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>}
    </>}
  </section>;
}

export function ScoreBreakdownPanel({ data, period, onPeriodChange, subject, onSubjectChange, loading = false, error, onRetry, onCalendarSwipe }: {
  data: ScoreData; period: ScorePeriod; onPeriodChange: (period: ScorePeriod) => void;
  subject: string; onSubjectChange: (subject: string) => void; loading?: boolean; error?: string; onRetry?: () => void; onCalendarSwipe?: () => void;
}) {
  const currentSubject = data.subjects.includes(subject) ? subject : data.subjects[0] ?? '';
  const summary = useMemo(() => summariseScores(data, currentSubject, period), [data, currentSubject, period]);
  const caption = format(parseDay(period.anchor), period.view === 'day' ? 'd MMMM yyyy' : period.view === 'month' ? 'MMMM yyyy' : 'yyyy');
  const circumference = 2 * Math.PI * 66;
  const excludedExams = summary.pending.filter(row => row.source === 'exam').length;
  const excludedQuizzes = summary.pending.length - excludedExams;

  return <div className="stats-score-surface space-y-6" aria-busy={loading}>
    <ScoreCalendar period={period} onChange={onPeriodChange} onSwipe={onCalendarSwipe} />
    {error ? <div role="alert" className="rounded-2xl border border-border bg-panel p-5"><p className="text-sm">{error}</p>{onRetry && <Button variant="outline" className="mt-4" onClick={onRetry}><RotateCcw className="mr-2 h-4 w-4" />Try again</Button>}</div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="stats-score-select-wrap max-w-full" data-stats-no-swipe>
          <select aria-label="Score subject" className="stats-score-subject-select" value={currentSubject} onChange={event => onSubjectChange(event.target.value)} disabled={!data.subjects.length}>
            {!data.subjects.length && <option value="">{loading ? 'Loading subjects…' : 'Choose subject'}</option>}
            {data.subjects.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <ChevronDown className="stats-score-select-chevron" aria-hidden="true" />
        </div>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
      {loading ? <div className="stats-score-panels" aria-label="Loading scores"><Skeleton className="h-80 rounded-3xl" /><Skeleton className="h-80 rounded-3xl" /></div> : !currentSubject ? <p className="py-12 text-center text-sm text-muted-foreground">Your subjects and marked scores will appear here.</p> : <>
        <div className="stats-score-panels">
          <section className="stats-score-card" aria-label={`${currentSubject} average score`}>
            <h3 className="text-sm font-semibold">Average score</h3>
            <div className="stats-score-gauge" role="img" aria-label={summary.average === null ? `${currentSubject}: no marked scores for ${caption}` : `${currentSubject}: ${display(summary.average)} out of 100 across ${summary.attempts.length} marked ${summary.attempts.length === 1 ? 'attempt' : 'attempts'}`}>
              <svg viewBox="0 0 160 160" aria-hidden="true" focusable="false"><circle cx="80" cy="80" r="66" className="stats-score-gauge-track" /><circle cx="80" cy="80" r="66" className="stats-score-gauge-fill" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - (summary.average ?? 0) / 100)} /></svg>
              <span className="stats-score-gauge-value"><strong>{display(summary.average)}</strong><span>out of 100</span></span>
            </div>
            <p className="mb-5 text-center text-xs text-muted-foreground">{summary.attempts.length} marked {summary.attempts.length === 1 ? 'attempt' : 'attempts'}</p>
            <p className="sr-only">Each marked exam and fully marked completed quiz contributes equally to this average.</p>
            <dl className="stats-score-source-totals"><div><dt>Exams</dt><dd>{display(summary.exams)}{summary.exams !== null && <span>%</span>}</dd></div><div><dt>Quizzes</dt><dd>{display(summary.quizzes)}{summary.quizzes !== null && <span>%</span>}</dd></div></dl>
          </section>
          <ProfileScores key={`${currentSubject}:${period.view}:${period.anchor}`} profiles={summary.profiles} subject={currentSubject} />
        </div>
        {summary.pending.length > 0 && <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">Not included: {[
          excludedExams ? `${excludedExams} unmarked or unreleased exam${excludedExams === 1 ? '' : 's'}` : '',
          excludedQuizzes ? `${excludedQuizzes} quiz${excludedQuizzes === 1 ? '' : 'zes'} awaiting complete marks` : '',
        ].filter(Boolean).join(' · ')}.</p>}
      </>}
    </>}
  </div>;
}
