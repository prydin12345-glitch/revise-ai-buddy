/**
 * QuestionCardShell — Proposal A "Paper Sheet"
 *
 * A grounded, max-720px card with:
 *   - Single-line header:  Q2 (a)  ·  Subtopic  ·  3 marks
 *   - Info popover holding extra metadata (difficulty, topic, "AI generated")
 *   - Sticky, dimmed parent-stem strip (shown once per parent)
 *   - Subject-colour left accent stripe on the active card
 *   - Children slot for the question body (rendered stem + inputs)
 *
 * Typography (15px / 1.6, tabular numerals on marks/labels) is enforced via
 * the `.quiz-paper-card` global class in index.css so KaTeX sits on baseline.
 */
import React from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface QuestionCardShellProps {
  /** Parent number ("2") and optional part letter ("a"). */
  parent: string;
  part?: string;
  /** Subtopic or topic to show inline in the header. */
  subtopic?: string;
  /** Total marks for this sub-part. */
  marks: number;
  /** Sticky parent stem — rendered once above sub-parts. Falsy = hidden. */
  parentStem?: React.ReactNode;
  /** Extra metadata surfaced inside the (i) popover. */
  metadata?: {
    topic?: string;
    difficulty?: string;
    aiGenerated?: boolean;
    tier?: string;
    extra?: React.ReactNode;
  };
  /** Subject accent colour (hex or CSS colour). Applied to the left stripe. */
  subjectColor?: string;
  /** Whether this card is the active/current question — enables the stripe. */
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const QuestionCardShell: React.FC<QuestionCardShellProps> = ({
  parent,
  part,
  subtopic,
  marks,
  parentStem,
  metadata,
  subjectColor,
  active = true,
  className = "",
  children,
}) => {
  const hasMeta =
    metadata &&
    (metadata.topic || metadata.difficulty || metadata.aiGenerated || metadata.tier || metadata.extra);

  return (
    <article
      className={`quiz-paper-card ${className}`}
      data-active={active ? "true" : "false"}
      style={subjectColor ? ({ ["--subject-accent" as string]: subjectColor } as React.CSSProperties) : undefined}
    >
      {parentStem ? (
        <div className="quiz-parent-stem" aria-label="Parent question context">
          {parentStem}
        </div>
      ) : null}

      {/* ─── One-line header ─────────────────────────────────────────── */}
      <header className="flex items-baseline gap-3 mb-4 text-[13px] text-muted-foreground">
        <span className="text-foreground font-semibold tabular-nums text-[15px]">
          Q{parent}
          {part ? <span className="text-muted-foreground"> ({part})</span> : null}
        </span>
        {subtopic ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{subtopic}</span>
          </>
        ) : null}
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {marks} {marks === 1 ? "mark" : "marks"}
        </span>

        {hasMeta ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Question details"
                className="ml-auto inline-flex items-center justify-center rounded-full w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-64 rounded-token-sm bg-surface-elevated"
              sideOffset={6}
            >
              <div className="text-xs space-y-2">
                {metadata?.topic ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Topic</span>
                    <span className="text-foreground text-right">{metadata.topic}</span>
                  </div>
                ) : null}
                {metadata?.difficulty ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Difficulty</span>
                    <span className="text-foreground capitalize text-right">{metadata.difficulty}</span>
                  </div>
                ) : null}
                {metadata?.tier ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Tier</span>
                    <span className="text-foreground text-right">{metadata.tier}</span>
                  </div>
                ) : null}
                {metadata?.aiGenerated ? (
                  <div className="pt-1 text-[11px] text-muted-foreground italic border-t border-border">
                    AI-generated question
                  </div>
                ) : null}
                {metadata?.extra}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </header>

      {children}
    </article>
  );
};

export default QuestionCardShell;
