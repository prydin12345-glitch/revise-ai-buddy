/**
 * AnswerSlate — Proposal B + D
 *
 * A grounded "answer paper" surface anchored to the bottom of a question card.
 *   - Segmented labeled [ Math | Text ] mode toggle (no floating icons)
 *   - Marks-adaptive height (1 mark → 1 line, 3 marks → 3 lines, essay → 6+)
 *   - Optional Working / Final Answer split for multi-mark questions
 *   - Slot for a docked keypad (renders directly below the slate)
 *   - Primary action pinned bottom-right (Submit / Next); secondary actions
 *     live in the parent's header overflow, not here.
 *
 * The slate is a controlled surface — the caller passes in the actual
 * `<textarea>` / `<math-field>` inside `workingSlot` and `finalSlot`, so the
 * existing question-type wiring in TakePracticeQuiz / ExamInProgress is
 * preserved. This component only enforces layout, contrast and typography.
 */
import React from "react";
import { Button } from "@/components/ui/button";

export type AnswerMode = "math" | "text";

interface AnswerSlateProps {
  /** Total marks for this question — drives default height. */
  marks: number;
  /** Current input mode. */
  mode: AnswerMode;
  onModeChange: (mode: AnswerMode) => void;
  /** Show the Math/Text toggle. Hide for non-math subjects. */
  showModeToggle?: boolean;

  /** Working-out slot. For single-mark questions this is the only slot. */
  workingSlot: React.ReactNode;
  /** Final-answer slot. Enables the Working/Final split when provided. */
  finalSlot?: React.ReactNode;
  /** Label for the working zone. Defaults to "Working". */
  workingLabel?: string;
  /** Label for the final zone. Defaults to "Final answer". */
  finalLabel?: string;

  /** Docked keypad slot — rendered directly under the slate. */
  keypadSlot?: React.ReactNode;

  /** Primary CTA. Omit to hide the action bar entirely (e.g. section-level nav elsewhere). */
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** Optional secondary CTA (e.g. Previous). Rendered left of primary. */
  secondaryLabel?: string;
  onSecondary?: () => void;

  /** Subject accent colour applied to the primary button. */
  subjectColor?: string;

  className?: string;
}

export const AnswerSlate: React.FC<AnswerSlateProps> = ({
  marks,
  mode,
  onModeChange,
  showModeToggle = true,
  workingSlot,
  finalSlot,
  workingLabel = "Working",
  finalLabel = "Final answer",
  keypadSlot,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  subjectColor,
  className = "",
}) => {
  return (
    <>
      <section
        className={`answer-slate ${className}`}
        aria-label="Answer area"
      >
        {/* ─── Slate header: labeled segmented mode toggle ─────────── */}
        <div className="flex items-center justify-between mb-3">
          {showModeToggle ? (
            <div
              role="tablist"
              aria-label="Answer mode"
              className="inline-flex items-center p-0.5 rounded-token-sm bg-background border border-border text-[12px]"
            >
              <button
                role="tab"
                type="button"
                aria-selected={mode === "math"}
                onClick={() => onModeChange("math")}
                className={`px-3 py-1 rounded-[6px] font-medium transition-colors ${
                  mode === "math"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Math
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={mode === "text"}
                onClick={() => onModeChange("text")}
                className={`px-3 py-1 rounded-[6px] font-medium transition-colors ${
                  mode === "text"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Text
              </button>
            </div>
          ) : (
            <span />
          )}
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground tabular-nums">
            {marks} {marks === 1 ? "mark" : "marks"}
          </span>
        </div>

        {/* ─── Working zone ───────────────────────────────────────── */}
        {finalSlot ? (
          <div className="slate-zone-label mb-1.5">{workingLabel}</div>
        ) : null}
        <div>{workingSlot}</div>

        {/* ─── Final answer zone (optional split for multi-mark) ─── */}
        {finalSlot ? (
          <div className="slate-final">
            <div className="slate-zone-label mb-1.5">{finalLabel}</div>
            <div>{finalSlot}</div>
          </div>
        ) : null}

        {/* ─── Action bar ─────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
          {secondaryLabel ? (
            <Button
              variant="ghost"
              onClick={onSecondary}
              className="rounded-token-sm"
            >
              {secondaryLabel}
            </Button>
          ) : null}
          <Button
            onClick={onPrimary}
            disabled={primaryDisabled || primaryLoading}
            className="rounded-token-sm px-5 font-semibold"
            style={
              subjectColor
                ? { backgroundColor: subjectColor, color: "#fff" }
                : undefined
            }
          >
            {primaryLoading ? "…" : primaryLabel}
          </Button>
        </div>
      </section>

      {/* ─── Docked keypad — sits flush under the slate, not floating ─── */}
      {keypadSlot ? (
        <div className="docked-keypad" role="toolbar" aria-label="Math keypad">
          {keypadSlot}
        </div>
      ) : null}
    </>
  );
};

export default AnswerSlate;
