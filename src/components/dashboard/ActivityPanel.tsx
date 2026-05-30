// src/components/dashboard/ActivityPanel.tsx
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { MockExam, Quiz } from "./types";

interface ActivityPanelProps {
  mockExams: MockExam[];
  quizzes: Quiz[];
  onOpenExam?: (id: string) => void;
  onStartQuiz?: (id: string) => void;
  onViewAll?: (tab: "exams" | "quizzes") => void;
}

type Tab = "exams" | "quizzes";

const MAX_ROWS = 5;

export default function ActivityPanel({
  mockExams, quizzes, onOpenExam, onStartQuiz, onViewAll,
}: ActivityPanelProps) {
  const [tab, setTab] = useState<Tab>("exams");
  const visibleExams = mockExams.slice(0, MAX_ROWS);
  const visibleQuizzes = quizzes.slice(0, MAX_ROWS);
  const hasMore = tab === "exams" ? mockExams.length > MAX_ROWS : quizzes.length > MAX_ROWS;

  return (
    <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">Recent Activity</h2>
        <button
          onClick={() => onViewAll?.(tab)}
          className="flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* segmented toggle */}
      <div className="inline-flex gap-1 rounded-[11px] border border-border bg-panel-2 p-1">
        <SegButton active={tab === "exams"} onClick={() => setTab("exams")} label="Mock Exams" count={mockExams.length} />
        <SegButton active={tab === "quizzes"} onClick={() => setTab("quizzes")} label="Practice Quizzes" count={quizzes.length} />
      </div>

      <div className="mt-1.5 flex flex-col">
        {tab === "exams"
          ? visibleExams.map((m) => <ExamRow key={m.id} exam={m} onClick={() => onOpenExam?.(m.id)} />)
          : visibleQuizzes.map((q) => <QuizRow key={q.id} quiz={q} onClick={() => onStartQuiz?.(q.id)} />)}
      </div>

      {hasMore && (
        <button
          onClick={() => onViewAll?.(tab)}
          className="mt-2 w-full rounded-[10px] border border-border bg-panel-2 py-2 text-[13px] font-bold text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          View all {tab === "exams" ? mockExams.length : quizzes.length}
        </button>
      )}
    </section>
  );
}

function SegButton({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-bold transition-colors ${
        active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? "bg-white/20 text-white" : "bg-white/[0.06] text-muted-foreground"}`}>
        {count}
      </span>
    </button>
  );
}

function scoreChipClass(score: number): string {
  if (score >= 70) return "bg-success/15 text-success";
  if (score >= 40) return "bg-warning/15 text-warning";
  if (score > 0) return "bg-danger/15 text-danger";
  return "bg-white/[0.06] text-muted-foreground";
}

const STATUS_LABEL: Record<MockExam["status"], string> = {
  done: "Completed",
  "in-progress": "In progress",
  "not-started": "Not started",
};

function ExamRow({ exam, onClick }: { exam: MockExam; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3.5 border-b border-border px-2 py-3.5 text-left transition-colors last:border-0 hover:bg-panel-2"
    >
      <span className="h-[34px] w-[3px] flex-none rounded-full" style={{ background: exam.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{exam.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {exam.subject}
          <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
          {exam.when}
        </span>
      </span>
      {exam.status === "not-started" ? (
        <span className="flex-none rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {STATUS_LABEL[exam.status]}
        </span>
      ) : (
        <span className={`flex-none rounded-[9px] px-2.5 py-1.5 text-[12.5px] font-extrabold tabular-nums ${scoreChipClass(exam.score)}`}>
          {exam.score}%
        </span>
      )}
      <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
    </button>
  );
}

function QuizRow({ quiz, onClick }: { quiz: Quiz; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3.5 border-b border-border px-2 py-3.5 text-left transition-colors last:border-0 hover:bg-panel-2"
    >
      <span className="h-[34px] w-[3px] flex-none rounded-full" style={{ background: quiz.color }} />
      <MiniRing value={quiz.best ?? 0} color={quiz.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{quiz.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {quiz.subject}
          <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
          {quiz.questions} questions
          {quiz.best != null && (
            <>
              <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
              best {quiz.best}%
            </>
          )}
        </span>
      </span>
      <span className="flex-none rounded-[9px] bg-primary/15 px-3.5 py-1.5 text-[12.5px] font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {quiz.best == null ? "Start" : "Retry"}
      </span>
    </button>
  );
}

function MiniRing({ value, color }: { value: number; color: string }) {
  const size = 34, sw = 4, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90 flex-none">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
      />
    </svg>
  );
}
