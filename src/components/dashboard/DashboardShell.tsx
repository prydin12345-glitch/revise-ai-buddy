// src/components/dashboard/DashboardShell.tsx
// Top-level presentational dashboard. Pass it DashboardData (see types.ts).
// No data fetching / routing / auth — wire those yourself via the callback props.
import Topbar from "./Topbar";
import CreateBanner from "./CreateBanner";
import Announcements from "./Announcements";
import ClassesGrid from "./ClassesGrid";
import ActivityPanel from "./ActivityPanel";
import ProfileCard from "./ProfileCard";
import SubjectDonut from "./SubjectDonut";
import type { DashboardData } from "./types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardShell(props: DashboardData) {
  const {
    profile, profileStats, subjects, averageScore, classes, mockExams, quizzes, announcements,
    onCreateExam, onCreateQuiz, onCreateClass, onJoinClass,
    onContinue, onOpenExam, onStartQuiz, onOpenAnnouncement,
  } = props;

  const firstName = profile.name.split(" ")[0];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Topbar
        initials={profile.initials}
        onCreateExam={onCreateExam}
        onCreateQuiz={onCreateQuiz}
        onCreateClass={onCreateClass}
        onJoinClass={onJoinClass}
      />

      <main className="mx-auto max-w-[1480px] px-6 py-7 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_332px] lg:items-start">
          {/* LEFT — scrolls with the page */}
          <div className="flex min-w-0 flex-col gap-5">
            <header className="mb-1">
              <h1 className="text-[25px] font-extrabold tracking-tight">
                Welcome back, {firstName}! 👋
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {greeting()} — here's your study overview.
              </p>
            </header>

            <CreateBanner onCreateExam={onCreateExam} onCreateQuiz={onCreateQuiz} />
            <Announcements items={announcements} onOpen={onOpenAnnouncement} />
            <ClassesGrid classes={classes} onContinue={onContinue} />
            <ActivityPanel
              mockExams={mockExams}
              quizzes={quizzes}
              onOpenExam={onOpenExam}
              onStartQuiz={onStartQuiz}
            />
          </div>

          {/* RIGHT — sticky on desktop */}
          <aside className="flex flex-col gap-5 lg:sticky lg:top-[88px]">
            <ProfileCard profile={profile} stats={profileStats} />
            <SubjectDonut subjects={subjects} centerValue={averageScore} />
          </aside>
        </div>
      </main>
    </div>
  );
}
