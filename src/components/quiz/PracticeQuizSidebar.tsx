/**
 * PracticeQuizSidebar — "Paper Index" (Proposal C)
 *
 * A vertical, typeset hierarchical question navigator. Replaces the generic
 * 4-column numbered tile grid with an exam-paper-style index:
 *   - Parent questions render as bold rows
 *   - Sub-parts (a, b, c…) indent beneath the parent
 *   - Status uses icon + colour (colour-blind safe)
 *   - Flag pennant sits in its own 16px column, never overlaps the number
 *   - Progress ring + counts pinned at the top
 *
 * Props are kept close to the previous surface so it can drop into the
 * inline sidebar in TakePracticeQuiz / ExamInProgress with minimal churn.
 */
import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Flag, Check, Circle, CircleDot, X, Minus } from "lucide-react";
import type { PracticeQuestion, UserAnswer } from "./types";

interface PracticeQuizSidebarProps {
  questions: PracticeQuestion[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  userAnswers: Record<string, UserAnswer>;
  flaggedQuestions: Set<string>;
  subjectColor: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  hideNavigation: boolean;
  isReviewMode: boolean;
  answeredCount: number;
  totalQuestions?: number;
  onNavigateToQuizzes: () => void;
  onSubmitAll?: () => void;
  /** Optional slot rendered below the primary action (e.g. resources collapsible) */
  bottomSlot?: React.ReactNode;
  /** Optional guard for navigation (unsaved drawings, etc.) */
  guardNavigation?: (action: () => void) => void;
}

// ─── Question number parsing ────────────────────────────────────────────────
// Handles "1", "1a", "2b", "10", "10c", "3(a)", "3 a" etc.
interface ParsedNumber {
  parent: string;   // "1", "2", "10"
  part: string;     // "", "a", "b"
}
const parseNumber = (raw: string): ParsedNumber => {
  const m = String(raw ?? "").trim().match(/^(\d+)\s*[\(\)]?\s*([a-z]?)\)?/i);
  if (!m) return { parent: raw, part: "" };
  return { parent: m[1], part: (m[2] || "").toLowerCase() };
};

// ─── Status derivation ──────────────────────────────────────────────────────
type Status = "unanswered" | "progress" | "correct" | "partial" | "incorrect";
const getStatus = (q: PracticeQuestion, ans?: UserAnswer): Status => {
  if (!ans) return "unanswered";
  const hasText = Boolean(ans.answer?.trim() || ans.answerLatex?.trim());
  if (!ans.submitted) return hasText ? "progress" : "unanswered";
  const score = ans.score ?? 0;
  const marks = q.marks || 1;
  if (score >= marks) return "correct";
  if (score > 0) return "partial";
  return "incorrect";
};

const StatusGlyph: React.FC<{ status: Status }> = ({ status }) => {
  switch (status) {
    case "correct":
      return <Check className="w-3.5 h-3.5 status-correct" strokeWidth={3} aria-label="Correct" />;
    case "partial":
      return <Minus className="w-3.5 h-3.5 status-partial" strokeWidth={3} aria-label="Partial credit" />;
    case "incorrect":
      return <X className="w-3.5 h-3.5 status-incorrect" strokeWidth={3} aria-label="Incorrect" />;
    case "progress":
      return <CircleDot className="w-3 h-3 status-progress" aria-label="In progress" />;
    default:
      return <Circle className="w-3 h-3 status-unanswered" aria-label="Not answered" />;
  }
};

// ─── Progress ring ──────────────────────────────────────────────────────────
const ProgressRing: React.FC<{ value: number; total: number }> = ({ value, total }) => {
  const pct = total > 0 ? value / total : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  return (
    <svg viewBox="0 0 44 44" className="progress-ring" aria-hidden="true">
      <circle className="track" cx="22" cy="22" r={r} />
      <circle
        className="fill"
        cx="22"
        cy="22"
        r={r}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
};

const PracticeQuizSidebar: React.FC<PracticeQuizSidebarProps> = ({
  questions,
  currentIndex,
  setCurrentIndex,
  userAnswers,
  flaggedQuestions,
  subjectColor,
  sidebarOpen,
  setSidebarOpen,
  hideNavigation,
  isReviewMode,
  answeredCount,
  totalQuestions,
  onNavigateToQuizzes,
  onSubmitAll,
  bottomSlot,
  guardNavigation,
}) => {
  const total = totalQuestions ?? questions.length;

  // Group questions by parent number. Keep original order within each parent.
  const grouped = useMemo(() => {
    const map = new Map<string, { parent: string; items: Array<PracticeQuestion & { _part: string }> }>();
    for (const q of questions) {
      const { parent, part } = parseNumber(q.question_number);
      if (!map.has(parent)) map.set(parent, { parent, items: [] });
      map.get(parent)!.items.push({ ...q, _part: part });
    }
    return Array.from(map.values());
  }, [questions]);

  const currentId = questions[currentIndex]?.id;

  const handleNavigate = (q: PracticeQuestion) => {
    const action = () => {
      setCurrentIndex(questions.indexOf(q));
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (typeof window !== "undefined" && window.innerWidth < 1024) setSidebarOpen(false);
    };
    if (guardNavigation) guardNavigation(action);
    else action();
  };

  return (
    <aside
      className={`${
        hideNavigation
          ? "w-0 overflow-hidden"
          : sidebarOpen
          ? "w-64 lg:w-72"
          : "w-0 overflow-hidden"
      } lg:block ${
        sidebarOpen && !hideNavigation
          ? "fixed lg:relative inset-0 lg:inset-auto z-40 lg:z-auto"
          : ""
      } transition-all duration-300 border-r bg-sidebar flex-shrink-0`}
      style={{ ["--subject-accent" as string]: subjectColor }}
    >
      {sidebarOpen && !hideNavigation && (
        <div
          className="fixed inset-0 bg-black/50 lg:hidden z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="relative z-40 bg-sidebar h-full sticky top-[3.5rem] max-h-[calc(100vh-3.5rem)] overflow-y-auto scroll-themed">
        {/* ─── Header: progress ring + counts ─────────────────────────── */}
        <div className="px-5 pt-5 pb-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <ProgressRing value={answeredCount} total={total} />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Progress
              </div>
              <div className="text-sm text-foreground tabular-nums">
                <span className="font-semibold">{answeredCount}</span>
                <span className="text-muted-foreground"> / {total}</span>
                <span className="text-muted-foreground"> answered</span>
              </div>
              {flaggedQuestions.size > 0 && (
                <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5 flex items-center gap-1">
                  <Flag className="w-2.5 h-2.5" style={{ color: "hsl(var(--warning))" }} />
                  {flaggedQuestions.size} flagged
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Paper index ────────────────────────────────────────────── */}
        <nav className="paper-index py-3 px-2" aria-label="Question navigator">
          {grouped.map(({ parent, items }) => {
            const hasParts = items.some((i) => i._part);
            // Section header per parent Q — small caps with per-parent progress
            const answered = items.filter((i) => {
              const a = userAnswers[i.id];
              return a && (a.submitted || a.answer?.trim() || a.answerLatex?.trim());
            }).length;
            return (
              <div key={parent} className="mb-1">
                {hasParts && (
                  <div className="idx-section-header">
                    <span>Question {parent}</span>
                    <span className="tabular-nums">{answered}/{items.length}</span>
                  </div>
                )}
                {items.map((q) => {
                  const isCurrent = q.id === currentId;
                  const status = getStatus(q, userAnswers[q.id]);
                  const isPart = Boolean(q._part);
                  const label = isPart
                    ? `(${q._part})`
                    : parent;
                  const title =
                    q.subtopic || `Question ${q.question_number}`;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      className="idx-row"
                      data-current={isCurrent}
                      data-parent={!isPart && !hasParts ? "true" : undefined}
                      data-part={isPart ? "true" : undefined}
                      onClick={() => handleNavigate(q)}
                    >
                      <span className="idx-status">
                        <StatusGlyph status={status} />
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {label}
                      </span>
                      <span className="truncate">{title}</span>
                      <span className="idx-marks">{q.marks}</span>
                      <span className="flex items-center justify-center">
                        {flaggedQuestions.has(q.id) && (
                          <Flag className="idx-flag" fill="currentColor" aria-label="Flagged" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ─── Footer: primary action + optional bottom slot ──────────── */}
        <div className="px-4 py-4 border-t border-sidebar-border space-y-3 mt-auto">
          {isReviewMode ? (
            <Button
              onClick={onNavigateToQuizzes}
              className="w-full rounded-token-sm"
              variant="outline"
            >
              Exit Review
            </Button>
          ) : onSubmitAll ? (
            <Button
              onClick={onSubmitAll}
              className="w-full rounded-token-sm"
              variant="destructive"
            >
              Submit all
            </Button>
          ) : (
            <Button
              onClick={onNavigateToQuizzes}
              className="w-full rounded-token-sm"
              variant="outline"
            >
              Save & quit
            </Button>
          )}
          {bottomSlot}
        </div>
      </div>
    </aside>
  );
};

export default PracticeQuizSidebar;
