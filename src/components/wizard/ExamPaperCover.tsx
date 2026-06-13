// FILE: src/components/wizard/ExamPaperCover.tsx
// The review step rendered as the front cover of a real exam paper.
// Pure presentation: it receives already-computed display values from
// CreateExam and shows them in exam-paper styling. Each editable section
// has a pencil that jumps back to the relevant wizard step (and returns
// here on save) via the wizard's useReviewEdit() context.

import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { useReviewEdit } from "./StepWizard";

interface ExamPaperCoverProps {
  examName: string;
  subjectId: string;
  subjectColor: string;
  boardLabel: string;
  levelLabel: string;
  totalQuestions: number;
  timerLabel: string;
  topicSummary: string;
  notes: string;
  includeMCQ: boolean;
}

const EditButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Edit ${label}`}
    className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-foreground"
  >
    <Pencil className="h-3 w-3" />
    Edit
  </button>
);

export function ExamPaperCover({
  examName, subjectId, subjectColor, boardLabel, levelLabel,
  totalQuestions, timerLabel, topicSummary, notes, includeMCQ,
}: ExamPaperCoverProps) {
  const { editStep } = useReviewEdit();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-xl"
    >
      {/* The paper — A4-ish aspect (1:√2) so it reads as a real exam cover */}
      <div
        className="relative rounded-sm border border-border bg-card shadow-[0_18px_50px_-20px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col"
        style={{ minHeight: "min(820px, 90vh)", aspectRatio: "1 / 1.414" }}
      >
        {/* Coloured spine down the left edge — the subject colour */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: subjectColor }} />

        <div className="p-8 sm:p-10 flex-1 flex flex-col">
          {/* Board + level header row, exam-paper style */}
          <div className="group relative flex items-start justify-between gap-4 pb-5 border-b-2 border-foreground/80">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {boardLabel}
              </p>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
                {levelLabel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Examly
              </p>
            </div>
            <EditButton onClick={() => editStep(2)} label="board and level" />
          </div>

          {/* Title block — centred in the upper portion of the page */}
          <div className="group relative text-center py-10 sm:py-14">
            <p className="font-serif text-sm text-muted-foreground mb-2">
              {subjectId || "Subject"}
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
              {examName || "Untitled exam"}
            </h2>
            <EditButton onClick={() => editStep(0)} label="name and subject" />
          </div>

          {/* Instructions panel — the "Materials / Instructions" box every paper has */}
          <div className="group relative rounded-sm border border-border bg-background/60 p-5 mt-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Information for candidates
            </p>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Questions</dt>
                <dd className="font-medium text-right">{totalQuestions} parent question{totalQuestions === 1 ? "" : "s"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Structure</dt>
                <dd className="font-medium text-right">{topicSummary}{includeMCQ ? " · incl. MCQ section" : ""}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Time allowed</dt>
                <dd className="font-medium text-right">{timerLabel}</dd>
              </div>
            </dl>
            <EditButton onClick={() => editStep(1)} label="structure" />
          </div>

          {/* Notes, shown as an examiner's note if present */}
          {notes.trim() && (
            <div className="group relative rounded-sm border-l-2 border-border pl-4 py-1 mt-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Custom instructions
              </p>
              <p className="font-serif text-sm text-foreground/80 italic leading-relaxed">
                "{notes.trim()}"
              </p>
              <EditButton onClick={() => editStep(0)} label="notes" />
            </div>
          )}

          {/* Footer line, like the bottom of a real cover */}
          <p className="mt-auto text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-6">
            Do not turn over until told to do so
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Hover any section to edit it — changes bring you straight back here.
      </p>
    </motion.div>
  );
}
