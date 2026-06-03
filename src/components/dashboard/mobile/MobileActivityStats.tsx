// src/components/dashboard/mobile/MobileActivityStats.tsx
// Mobile "Recent Activity" / "Statistics" panel. Tab-toggled (no horizontal
// swipe) so the view stays put. Statistics uses the full desktop SubjectDonut
// component so users get the same Subjects → Exam Profiles → Topics drill-down.
import { useState } from "react";
import SubjectDonut from "../SubjectDonut";
import type { MockExam, Quiz, Subject } from "../types";

interface Props {
  mockExams: MockExam[];
  quizzes: Quiz[];
  subjects: Subject[];
  averageScore?: string;
  onOpenExam?: (id: string) => void;
  onStartQuiz?: (id: string) => void;
}

export default function MobileActivityStats({
  mockExams, quizzes, subjects, averageScore = "—", onOpenExam, onStartQuiz,
}: Props) {
  const [page, setPage] = useState<0 | 1>(0);

  return (
    <section className="min-w-0">
      <div className="mb-3 flex gap-[18px] px-[18px]">
        <button
          onClick={() => setPage(0)}
          className={`relative pb-[5px] text-base font-extrabold tracking-tight ${page === 0 ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-primary" : "text-muted-foreground"}`}
        >
          Recent Activity
        </button>
        <button
          onClick={() => setPage(1)}
          className={`relative pb-[5px] text-base font-extrabold tracking-tight ${page === 1 ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[2.5px] after:rounded-full after:bg-primary" : "text-muted-foreground"}`}
        >
          Statistics
        </button>
      </div>

      <div className="px-[18px]">
        {page === 0 ? (
          <ActivityCard mockExams={mockExams} quizzes={quizzes} onOpenExam={onOpenExam} onStartQuiz={onStartQuiz} />
        ) : (
          <SubjectDonut subjects={subjects} centerValue={averageScore} />
        )}
      </div>
    </section>
  );
}

function ActivityCard({
  mockExams, quizzes, onOpenExam, onStartQuiz,
}: { mockExams: MockExam[]; quizzes: Quiz[]; onOpenExam?: (id: string) => void; onStartQuiz?: (id: string) => void }) {
  const [tab, setTab] = useState<"exams" | "quizzes">("exams");
  return (
    <div className="rounded-[20px] border border-border bg-card p-[18px]">
      <div className="flex gap-1 rounded-[13px] border border-border bg-panel-2 p-1">
        <button onClick={() => setTab("exams")} className={`flex flex-1 min-w-0 items-center justify-center gap-2 rounded-[9px] py-2.5 text-[13px] font-bold transition-colors ${tab === "exams" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-muted-foreground"}`}>
          Mock Exams <Count active={tab === "exams"}>{mockExams.length}</Count>
        </button>
        <button onClick={() => setTab("quizzes")} className={`flex flex-1 min-w-0 items-center justify-center gap-2 rounded-[9px] py-2.5 text-[13px] font-bold transition-colors ${tab === "quizzes" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-muted-foreground"}`}>
          Quizzes <Count active={tab === "quizzes"}>{quizzes.length}</Count>
        </button>
      </div>
      <div className="mt-1.5 flex flex-col">
        {tab === "exams"
          ? mockExams.slice(0, 4).map((m) => <ExamRow key={m.id} m={m} onClick={() => onOpenExam?.(m.id)} />)
          : quizzes.map((q) => <QuizRow key={q.id} q={q} onClick={() => onStartQuiz?.(q.id)} />)}
      </div>
    </div>
  );
}

function Count({ children, active }: { children: React.ReactNode; active: boolean }) {
  return <span className={`rounded-full px-1.5 text-[10.5px] font-extrabold ${active ? "bg-white/20 text-white" : "bg-white/[0.07] text-muted-foreground"}`}>{children}</span>;
}

function scoreChip(score: number) {
  if (score >= 70) return "bg-success/15 text-success";
  if (score >= 40) return "bg-warning/15 text-warning";
  if (score > 0) return "bg-danger/15 text-danger";
  return "bg-white/[0.07] text-muted-foreground";
}
const STATUS: Record<MockExam["status"], string> = { done: "Done", "in-progress": "Doing", "not-started": "New" };

function ExamRow({ m, onClick }: { m: MockExam; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 border-b border-border py-3.5 text-left last:border-0">
      <span className="h-8 w-[3px] flex-none rounded-full" style={{ background: m.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{m.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
          {m.subject}<span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />{m.when}
        </span>
      </span>
      {m.status === "not-started"
        ? <span className="flex-none rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{STATUS[m.status]}</span>
        : <span className={`flex-none rounded-[9px] px-2.5 py-1.5 text-xs font-extrabold tabular-nums ${scoreChip(m.score)}`}>{m.score}%</span>}
    </button>
  );
}

function QuizRow({ q, onClick }: { q: Quiz; onClick: () => void }) {
  const v = q.best ?? 0, size = 32, sw = 4, r = (size - sw) / 2, c = 2 * Math.PI * r;
  return (
    <button onClick={onClick} className="flex items-center gap-3 border-b border-border py-3.5 text-left last:border-0">
      <span className="h-8 w-[3px] flex-none rounded-full" style={{ background: q.color }} />
      <svg width={size} height={size} className="-rotate-90 flex-none">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={q.color} strokeWidth={sw} strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} strokeLinecap="round" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{q.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
          {q.questions} Qs{q.best != null && <><span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />best {q.best}%</>}
        </span>
      </span>
      <span className="flex-none rounded-[9px] bg-primary/15 px-3 py-1.5 text-xs font-extrabold text-primary">{q.best == null ? "Start" : "Retry"}</span>
    </button>
  );
}
