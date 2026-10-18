import type { ReactNode } from "react";
import type { DashboardData } from "./types";
import StudyWelcomeBanner from "./StudyWelcomeBanner";
import DashboardSummaryStrip from "./DashboardSummaryStrip";
import DashboardContextCards from "./DashboardContextCards";
import CreateBanner from "./CreateBanner";
import "@/styles/home-dashboard-components.css";
import "@/styles/tablet-dashboard.css";

interface Props extends Pick<DashboardData, "profile" | "profileStats" | "classes" | "announcements" |
  "onCreateExam" | "onCreateQuiz" | "onContinue" | "onOpenAnnouncement" | "onViewClasses" | "onJoinClass"> {
  isLaptop: boolean;
  statistics: ReactNode;
  activity: ReactNode;
}

/** Shared presentation only: data, navigation and retained selections stay with their existing owners. */
export default function StudentHomeLayout({ isLaptop, profile, profileStats, classes, announcements,
  onCreateExam, onCreateQuiz, onContinue, onOpenAnnouncement, onViewClasses, onJoinClass, statistics, activity }: Props) {
  const context = <DashboardContextCards classes={classes} announcements={announcements}
    onContinue={onContinue} onOpenAnnouncement={onOpenAnnouncement} onViewClasses={onViewClasses} onJoinClass={onJoinClass} />;
  const summary = <DashboardSummaryStrip stats={profileStats}
    profile={isLaptop ? undefined : profile}
    actions={isLaptop ? undefined : <CreateBanner compact onCreateExam={onCreateExam} onCreateQuiz={onCreateQuiz} />} />;

  return (
    <main className="student-home-dashboard">
      <div className={`student-home-grid${isLaptop ? "" : " student-home-tablet"}`}>
        <StudyWelcomeBanner name={profile.name} className="student-home-welcome" />
        {isLaptop ? <>
          <div className="student-home-primary flex min-w-0 flex-col gap-5">{summary}{statistics}</div>
          <aside className="student-home-secondary flex min-w-0 flex-col gap-5 lg:sticky lg:top-[88px]">{context}{activity}</aside>
        </> : <>
          {summary}
          {statistics}
          {context}
          {activity}
        </>}
      </div>
    </main>
  );
}
