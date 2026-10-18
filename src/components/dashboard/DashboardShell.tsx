// src/components/dashboard/DashboardShell.tsx
// Top-level presentational dashboard. Pass it DashboardData (see types.ts).
// No data fetching / routing / auth — wire those yourself via the callback props.
import Topbar from "./Topbar";
import ActivityPanel from "./ActivityPanel";
import SubjectDonut from "./SubjectDonut";
import StudentHomeLayout from "./StudentHomeLayout";
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

      <StudentHomeLayout isLaptop={isLaptop} profile={profile} profileStats={profileStats}
        classes={classes} announcements={announcements} statistics={statisticsPanel} activity={activityPanel}
        onCreateExam={onCreateExam} onCreateQuiz={onCreateQuiz} onContinue={onContinue}
        onOpenAnnouncement={onOpenAnnouncement} onViewClasses={props.onViewClasses} onJoinClass={onJoinClass} />
    </div>
  );
}
