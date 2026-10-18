// src/components/dashboard/DashboardShell.tsx
// Top-level presentational dashboard. Pass it DashboardData (see types.ts).
// No data fetching / routing / auth — wire those yourself via the callback props.
import Topbar from "./Topbar";
import CreateBanner from "./CreateBanner";
import Announcements from "./Announcements";
import ClassesGrid from "./ClassesGrid";
import ActivityPanel from "./ActivityPanel";
import ProfileCard from "./ProfileCard";
import DashboardSummaryStrip from "./DashboardSummaryStrip";
import DashboardContextCards from "./DashboardContextCards";
import StudyWelcomeBanner from "./StudyWelcomeBanner";
import SubjectDonut from "./SubjectDonut";
import { useIsLaptop } from "@/hooks/use-mobile";
import type { DashboardData } from "./types";

export default function DashboardShell(props: DashboardData) {
  const isLaptop = useIsLaptop();
  const {
    profile, profileStats, subjects, averageScore, classes, mockExams, quizzes, announcements,
    onCreateExam, onCreateQuiz, onCreateClass, onJoinClass,
    onContinue, onOpenExam, onStartQuiz, onOpenAnnouncement,
  } = props;

  const activityPanel = (
    <ActivityPanel
      mockExams={mockExams}
      quizzes={quizzes}
      onOpenExam={onOpenExam}
      onStartQuiz={onStartQuiz}
    />
  );
  const statisticsPanel = (<SubjectDonut subjects={subjects} centerValue={averageScore} />);

  return (
    <div className="examly-home-route min-h-screen bg-background font-sans text-foreground">
      <Topbar
        initials={profile.initials}
        onCreateExam={onCreateExam}
        onCreateQuiz={onCreateQuiz}
        onCreateClass={onCreateClass}
        onJoinClass={onJoinClass}
      />

      <main className="student-home-dashboard">
        <div className="student-home-grid">
          <StudyWelcomeBanner name={profile.name} className="student-home-welcome" />
          {/* LEFT — scrolls with the page */}
          <div className="student-home-primary flex min-w-0 flex-col gap-5">
            <div className="student-home-tablet-content flex flex-col gap-5">
              <CreateBanner onCreateExam={onCreateExam} onCreateQuiz={onCreateQuiz} />
              <Announcements items={announcements} onOpen={onOpenAnnouncement} />
              <ClassesGrid classes={classes} onContinue={onContinue} />
            </div>
            <DashboardSummaryStrip stats={profileStats} />
            {isLaptop ? statisticsPanel : activityPanel}
          </div>

          {/* RIGHT — sticky on desktop */}
          <aside className="student-home-secondary flex min-w-0 flex-col gap-5 lg:sticky lg:top-[88px]">
            <div className="student-home-tablet-profile"><ProfileCard profile={profile} stats={profileStats} /></div>
            <DashboardContextCards classes={classes} announcements={announcements}
              onContinue={onContinue} onOpenAnnouncement={onOpenAnnouncement}
              onViewClasses={props.onViewClasses} onJoinClass={onJoinClass} />
            {isLaptop ? activityPanel : statisticsPanel}
          </aside>
        </div>
      </main>
    </div>
  );
}
