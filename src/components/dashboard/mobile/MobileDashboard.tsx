import { ArrowUpRight, BookOpen, FileText, ListChecks, Plus } from 'lucide-react';
import { getBoardDisplayName } from '@/lib/board-scrubber';
import ClassCarousel from './ClassCarousel';
import MobileActivityStats from './MobileActivityStats';
import MobileStatsStrip from './MobileStatsStrip';
import StudyCorner from './StudyCorner';
import type { DashboardData } from '../types';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export default function MobileDashboard({
  profile, profileStats, homeSubjects = [], classes, mockExams, quizzes,
  onCreateExam, onCreateQuiz, onContinue, onOpenExam, onStartQuiz,
  onViewSubjects, onOpenSubject, onViewClasses, onViewPractice,
}: DashboardData) {
  return (
    <div className="mobile-home min-w-0">
      <header className="mobile-home-hero relative min-h-[220px] px-5 pb-12 pt-7">
        <div className="relative z-10 w-[57%]">
          <p className="text-sm font-medium text-foreground/75">{greeting()},</p>
          <h1 className="mt-1.5 break-words text-[30px] font-bold leading-[1.15] tracking-tight">{profile.name.split(' ')[0]}</h1>
          <p className="mt-4 max-w-[170px] text-[13px] leading-relaxed text-foreground/75">Make a little room for revision.</p>
        </div>
        <StudyCorner />
      </header>

      <div className="relative -mt-6 space-y-7 rounded-t-[28px] bg-background px-5 pb-3 pt-5">
        <MobileStatsStrip stats={profileStats} />

        <section aria-label="Start practising" className="grid grid-cols-2 gap-3">
          {[{ label: 'Mock exam', detail: 'Build a paper', icon: FileText, onClick: onCreateExam }, { label: 'Quick quiz', detail: 'Practise a topic', icon: ListChecks, onClick: onCreateQuiz }].map(action => (
            <button key={action.label} type="button" onClick={action.onClick} className="flex min-h-[120px] flex-col rounded-2xl border border-border bg-card p-4 text-left transition-colors active:bg-accent">
              <span className="mb-4 flex w-full items-center justify-between"><action.icon aria-hidden="true" className="h-5 w-5 text-primary" /><ArrowUpRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" /></span>
              <span className="text-sm font-bold">{action.label}</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">{action.detail}</span>
            </button>
          ))}
        </section>

        <section aria-labelledby="home-subjects-heading" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="home-subjects-heading" className="text-[17px] font-bold tracking-tight">My subjects</h2>
            <button type="button" onClick={onViewSubjects} className="min-h-11 text-xs font-semibold text-primary">View all <span aria-hidden="true">↗</span></button>
          </div>
          {homeSubjects.length ? <div className="no-scrollbar -mx-5 flex snap-x snap-proximity gap-3 overflow-x-auto px-5 pb-1" data-scroll-restoration="home-subjects" aria-label="Your subjects">
            {homeSubjects.map(subject => <button key={subject.key} type="button" onClick={() => onOpenSubject?.(subject.name)} className="w-[142px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card text-left" aria-label={`Open ${subject.name}`}>
              <span className="flex h-[64px] items-end justify-between bg-panel-2 p-3.5">
                <span className="font-serif text-[25px] font-semibold leading-none text-foreground/80" aria-hidden="true">{subject.name.slice(0, 2)}</span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden="true" />
              </span>
              <span className="block p-3.5"><span className="line-clamp-2 text-xs font-bold leading-snug">{subject.name}</span>{subject.board && <span className="mt-1 block truncate text-[10px] text-muted-foreground">{getBoardDisplayName(subject.board)}</span>}</span>
            </button>)}
          </div> : <button type="button" onClick={onViewSubjects} className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-dashed border-border-strong p-4 text-left text-sm font-semibold">
            <BookOpen aria-hidden="true" className="h-5 w-5 text-primary" />Add your subjects<Plus aria-hidden="true" className="ml-auto h-4 w-4" />
          </button>}
        </section>

        {classes.length > 0 && <ClassCarousel classes={classes} onContinue={onContinue} onViewAll={onViewClasses} />}

        <MobileActivityStats mockExams={mockExams} quizzes={quizzes} onOpenExam={onOpenExam} onStartQuiz={onStartQuiz} onViewAll={onViewPractice} />
      </div>
    </div>
  );
}
