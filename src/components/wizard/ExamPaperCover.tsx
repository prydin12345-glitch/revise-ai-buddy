// FILE: src/components/wizard/ExamPaperCover.tsx
// The review step rendered as an Examly practice-paper front cover, styled
// after a real UK exam paper (title box top-left, prose instructions below).
// Pure presentation: receives raw config from CreateExam and writes it as
// candidate-facing prose. Each editable section has a pencil that jumps back
// to the relevant wizard step (and returns here on save).
//
// LEGAL: the masthead is ALWAYS "Examly". The board is only ever shown as
// "modelled on the <board> style" so this can never be mistaken for an
// official paper from AQA / Edexcel / OCR.

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
  timerEnabled: boolean;
  durationMinutes: number;
  topics: string[];
  useOriginalStructure: boolean;
  includeMCQ: boolean;
  notes: string;
}

const EditButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={`Edit ${label}`}
    className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-foreground z-10"
  >
    <Pencil className="h-3 w-3" />
    Edit
  </button>
);

export function ExamPaperCover({
  examName, subjectId, subjectColor, boardLabel, levelLabel,
  totalQuestions, timerEnabled, durationMinutes, topics,
  useOriginalStructure, includeMCQ, notes,
}: ExamPaperCoverProps) {
  const { editStep } = useReviewEdit();
  const hasBoard = boardLabel && boardLabel !== "Generic style";

  const timeSentence = timerEnabled
    ? `You should spend about ${durationMinutes} minute${durationMinutes === 1 ? "" : "s"} on this paper.`
    : "There is no time limit on this paper — work at your own pace.";

  const structureSentence = useOriginalStructure
    ? "This paper follows the structure of the original it was modelled on."
    : `The marks for each question are shown in brackets — use this as a guide to how much time to spend on each question.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-xl"
    >
      {/* The paper — A4 aspect so it reads as a real exam cover */}
      <div
        className="relative rounded-sm border border-border bg-card shadow-[0_18px_50px_-20px_rgba(0,0,0,0.35)] flex flex-col"
        style={{ aspectRatio: "1 / 1.414" }}
      >
        {/* Subject-colour spine */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-sm" style={{ backgroundColor: subjectColor }} />

        <div className="px-7 sm:px-9 py-8 flex-1 flex flex-col overflow-y-auto">
          {/* Masthead */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[13px] font-bold text-white" style={{ backgroundColor: subjectColor }}>
                E
              </span>
              <span className="text-sm font-bold tracking-tight">Examly</span>
            </div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Practice paper</p>
          </div>

          {/* Title box — like the real paper: board/level small, subject large,
              exam name beneath. Grouped top-left in a bordered block. */}
          <div className="group relative mt-5 rounded-md border-2 border-foreground/80 p-5">
            <p className="text-xs font-semibold text-muted-foreground">
              {hasBoard ? <>Modelled on the {boardLabel} style</> : "Generic exam style"}
              {levelLabel && levelLabel !== "Not set" && <> · {levelLabel}</>}
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight leading-none mt-2">
              {subjectId || "Subject"}
            </h2>
            <p className="font-serif text-lg text-foreground/80 mt-1.5">
              {examName || "Untitled exam"}
            </p>
            <EditButton onClick={() => editStep(0)} label="name, subject and board" />
          </div>

          {/* Question/time bar — the strip a real paper has under the title */}
          <div className="group relative mt-3 flex items-stretch rounded-md border border-border overflow-hidden text-sm">
            <div className="flex-1 px-4 py-3">
              <p className="text-muted-foreground text-xs">Questions</p>
              <p className="font-semibold mt-0.5">{totalQuestions}</p>
            </div>
            <div className="w-px bg-border" />
            <div className="flex-1 px-4 py-3">
              <p className="text-muted-foreground text-xs">Time allowed</p>
              <p className="font-semibold mt-0.5">{timerEnabled ? `${durationMinutes} min` : "None"}</p>
            </div>
            <EditButton onClick={() => editStep(1)} label="structure and timing" />
          </div>

          {/* Instructions — prose, like a real paper (not crammed tokens) */}
          <div className="group relative mt-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground mb-2">
              Information for candidates
            </p>
            <ul className="space-y-1.5 text-sm text-foreground/90 leading-relaxed list-disc pl-5">
              <li>
                There {totalQuestions === 1 ? "is" : "are"} {totalQuestions} question{totalQuestions === 1 ? "" : "s"} in this paper{includeMCQ ? ", including a multiple-choice section" : ""}.
              </li>
              <li>{structureSentence}</li>
              <li>Answer all questions in the spaces provided.</li>
              <li>Show your working — answers without working may not gain full marks.</li>
              <li>{timeSentence}</li>
            </ul>
            <EditButton onClick={() => editStep(1)} label="structure" />
          </div>

          {/* Topics — prose sentence, like "the topics covered are..." */}
          {topics.length > 0 && (
            <div className="group relative mt-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-foreground mb-2">
                Topics covered
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">
                This paper draws on {topics.length} topic{topics.length === 1 ? "" : "s"}: {topics.join(", ")}.
              </p>
              <EditButton onClick={() => editStep(0)} label="topics" />
            </div>
          )}

          {/* Custom instructions if the student added notes */}
          {notes.trim() && (
            <div className="group relative border-l-2 pl-4 py-1 mt-5" style={{ borderColor: subjectColor + "66" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-foreground mb-1">
                Your instructions
              </p>
              <p className="font-serif text-sm text-foreground/80 italic leading-relaxed">"{notes.trim()}"</p>
              <EditButton onClick={() => editStep(0)} label="notes" />
            </div>
          )}

          <p className="mt-auto text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-8">
            Do not begin until you are ready
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Hover any section to edit it — changes bring you straight back here.
      </p>
    </motion.div>
  );
}
