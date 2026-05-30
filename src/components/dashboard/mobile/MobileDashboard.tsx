// src/components/dashboard/mobile/MobileDashboard.tsx
// The mobile Home/Dashboard layout. Takes the SAME props as the desktop
// DashboardShell (DashboardData) so the data/logic wires through identically.
//
// This renders ONLY the dashboard body (header + classes + activity/stats).
// Put it inside your existing mobile shell, or wrap with <MobileShell> (see README).
import { Bell } from "lucide-react";
import ClassCarousel from "./ClassCarousel";
import MobileActivityStats from "./MobileActivityStats";
import type { DashboardData } from "../types";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function MobileDashboard(props: DashboardData) {
  const {
    profile, profileStats, subjects, averageScore, classes, mockExams, quizzes,
    onContinue, onOpenExam, onStartQuiz,
  } = props;

  const firstName = profile.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6 pt-1">
      {/* header: greeting + bell on top, icon+number stats below */}
      <header className="flex flex-col gap-[15px] px-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-muted-foreground">{greeting()},</div>
            <div className="text-[23px] font-extrabold leading-tight tracking-tight">{firstName} 👋</div>
          </div>
          <button className="relative grid h-[42px] w-[42px] flex-none place-items-center rounded-[13px] border border-border bg-panel text-muted-foreground">
            <Bell className="h-[19px] w-[19px]" />
            <span className="absolute right-[11px] top-2.5 h-[7px] w-[7px] rounded-full border-2 border-panel bg-danger" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          {profileStats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center gap-1.5 text-base font-extrabold tracking-tight">
                <Icon className={`h-[17px] w-[17px] ${s.iconClass}`} />
                <span className="tabular-nums">{s.value}</span>
              </div>
            );
          })}
        </div>
      </header>

      {/* classes carousel — first */}
      <ClassCarousel classes={classes} onContinue={onContinue} />

      {/* activity ⇄ statistics swipe pager */}
      <MobileActivityStats
        mockExams={mockExams}
        quizzes={quizzes}
        subjects={subjects}
        averageScore={averageScore}
        onOpenExam={onOpenExam}
        onStartQuiz={onStartQuiz}
      />
    </div>
  );
}
