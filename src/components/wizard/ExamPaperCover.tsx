// FILE: src/components/wizard/ExamPaperCover.tsx
// The review step rendered as an Examly practice-paper front cover.
// Pure presentation: it receives already-computed display values from
// CreateExam and shows them in exam-paper styling. Each editable section
// has a pencil that jumps back to the relevant wizard step (and returns
// here on save) via the wizard's useReviewEdit() context.
//
// IMPORTANT (legal): the masthead is ALWAYS "Examly", never the exam board.
// The board is shown only as "Modelled on the <board> style" so the cover
// can never be mistaken for an official paper from AQA / Edexcel / OCR.

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
  topics: string[];
  structureLabel: string;
  notes: string;
  includeMCQ: boolean;
}

const EditButton = ({ onClick, label, step }: { onClick: () => void; label: string; step: number }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Edit ${label}`}
    className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-foreground z-10"
  >
    <Pencil className="h-3 w-3" />
    Edit
  </button>
);

export function ExamPaperCover({
  examName, subjectId, subjectColor, boardLabel, levelLabel,
  totalQuestions, timerLabel, topics, structureLabel, notes, includeMCQ,
}: ExamPaperCoverProps) {
  const { editStep } = useReviewEdit();
  const hasBoard = boardLabel && boardLabel !== "Generic style";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-xl"
    >
      {/* The paper — A4 aspect (1:√2) so it reads as a real exam cover */}
      <div
        className="relative rounded-sm border border-border bg-card shadow-[0_18px_50px_-20px_rgba(0,0,0,0.35)] flex flex-col"
        style={{ aspectRatio: "1 / 1.414" }}
      >
        {/* Coloured spine down the left edge — the subject colour */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-sm" style={{ backgroundColor: subjectColor }} />

        <div className="px-8 sm:px-12 py-9 flex-1 flex flex-col overflow-y-auto">
          {/* Masthead — Examly is the publisher, never the board */}
          <div className="group relative flex items-start justify-between gap-4 pb-4 border-b-2 border-foreground/80">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: subjectColor }}>
                E
              </span>
              <span className="text-sm font-bold tracking-tight">Examly</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Practice paper
              </p>
            </div>
          </div>

          {/* Board alignment line — clearly "modelled on", not the board's own */}
          <div className="group relative flex items-center justify-between gap-3 py-3 border-b border-border">
            <p className="text-[11px] text-muted-foreground">
              {hasBoard
                ? <>Modelled on the <span className="font-semibold text-foreground">{boardLabel}</span> style</>
                : <>Generic exam style</>}
              {levelLabel && levelLabel !== "Not set" && (
                <> · <span className="font-medium text-foreground/80">{levelLabel}</span></>
              )}
            </p>
            <EditButton onClick={() => editStep(2)} label="board and level" step={2} />
          </div>

          {/* Title block */}
          <div className="group relative text-center py-10">
            <p className="font-serif text-sm text-muted-foreground mb-2">
              {subjectId || "Subject"}
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
              {examName || "Untitled exam"}
            </h2>
            <EditButton onClick={() => editStep(0)} label="name and subject" step={0} />
          </div>

          {/* Information for candidates */}
          <div className="group relative rounded-sm border border-border bg-background/60 p-5">
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
                <dd className="font-medium text-right">{structureLabel}{includeMCQ ? " · incl. MCQ section" : ""}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Time allowed</dt>
                <dd className="font-medium text-right">{timerLabel}</dd>
              </div>
            </dl>
            <EditButton onClick={() => editStep(1)} label="structure" step={1} />
          </div>

          {/* Topics covered — every name shown as a chip */}
          {topics.length > 0 && (
            <div className="group relative mt-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                Topics covered ({topics.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topics.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border px-2.5 py-1 text-xs font-medium"
                    style={{ borderColor: subjectColor + "55", color: subjectColor, backgroundColor: subjectColor + "10" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <EditButton onClick={() => editStep(0)} label="topics" step={0} />
            </div>
          )}

          {/* Notes as an examiner's note */}
          {notes.trim() && (
            <div className="group relative border-l-2 pl-4 py-1 mt-5" style={{ borderColor: subjectColor + "66" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Custom instructions
              </p>
              <p className="font-serif text-sm text-foreground/80 italic leading-relaxed">
                "{notes.trim()}"
              </p>
              <EditButton onClick={() => editStep(0)} label="notes" step={0} />
            </div>
          )}

          {/* Footer */}
          <p className="mt-auto text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-8">
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
