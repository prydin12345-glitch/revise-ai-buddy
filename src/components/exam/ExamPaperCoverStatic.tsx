// Static, read-only "front cover" of an Examly practice paper.
// Used by the new ExamCover page (no editing affordances).

interface ExamPaperCoverStaticProps {
  examName: string;
  subjectId: string;
  subjectColor: string;
  boardLabel: string;
  levelLabel: string;
  totalQuestions: number;
  timerEnabled: boolean;
  durationMinutes: number;
  topics: string[];
  includeMCQ?: boolean;
  notes?: string;
}

export function ExamPaperCoverStatic({
  examName,
  subjectId,
  subjectColor,
  boardLabel,
  levelLabel,
  totalQuestions,
  timerEnabled,
  durationMinutes,
  topics,
  includeMCQ = false,
  notes = "",
}: ExamPaperCoverStaticProps) {
  const hasBoard = boardLabel && boardLabel !== "Generic style";

  const timeSentence = timerEnabled
    ? `You should spend about ${durationMinutes} minute${durationMinutes === 1 ? "" : "s"} on this paper.`
    : "There is no time limit on this paper — work at your own pace.";

  return (
    <div
      className="relative rounded-sm border border-border bg-card shadow-[0_18px_50px_-20px_rgba(0,0,0,0.35)] flex flex-col w-full"
      style={{ aspectRatio: "1 / 1.414" }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-sm"
        style={{ backgroundColor: subjectColor }}
      />

      <div className="px-6 sm:px-9 py-7 sm:py-8 flex-1 flex flex-col overflow-y-auto">
        {/* Masthead */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[13px] font-bold text-white"
              style={{ backgroundColor: subjectColor }}
            >
              E
            </span>
            <span className="text-sm font-bold tracking-tight">Examly</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Practice paper
          </p>
        </div>

        {/* Title block */}
        <div className="mt-5 rounded-md border-2 border-foreground/80 p-4 sm:p-5">
          <p className="text-xs font-semibold text-muted-foreground">
            {hasBoard ? `Modelled on the ${boardLabel} style` : "Generic exam style"}
            {levelLabel && levelLabel !== "Not set" ? ` · ${levelLabel}` : ""}
          </p>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight leading-none mt-2">
            {subjectId || "Subject"}
          </h2>
          <p className="font-serif text-base sm:text-lg text-foreground/80 mt-1.5">
            {examName || "Untitled exam"}
          </p>
        </div>

        {/* Question / time bar */}
        <div className="mt-3 flex items-stretch rounded-md border border-border overflow-hidden text-sm">
          <div className="flex-1 px-4 py-3">
            <p className="text-muted-foreground text-xs">Questions</p>
            <p className="font-semibold mt-0.5">{totalQuestions || "—"}</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 px-4 py-3">
            <p className="text-muted-foreground text-xs">Time allowed</p>
            <p className="font-semibold mt-0.5">
              {timerEnabled ? `${durationMinutes} min` : "None"}
            </p>
          </div>
        </div>

        {/* Information for candidates */}
        <div className="mt-5 sm:mt-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground mb-2">
            Information for candidates
          </p>
          <ul className="space-y-1.5 text-sm text-foreground/90 leading-relaxed list-disc pl-5">
            <li>
              There {totalQuestions === 1 ? "is" : "are"} {totalQuestions || "—"} question
              {totalQuestions === 1 ? "" : "s"} in this paper
              {includeMCQ ? ", including a multiple-choice section" : ""}.
            </li>
            <li>Answer all questions in the spaces provided.</li>
            <li>Show your working — answers without working may not gain full marks.</li>
            <li>{timeSentence}</li>
          </ul>
        </div>

        {/* Topics */}
        {topics.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground mb-2">
              Topics covered
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              This paper draws on {topics.length} topic{topics.length === 1 ? "" : "s"}:{" "}
              {topics.join(", ")}.
            </p>
          </div>
        )}

        {/* Notes */}
        {notes.trim() && (
          <div
            className="border-l-2 pl-4 py-1 mt-5"
            style={{ borderColor: subjectColor + "66" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground mb-1">
              Your instructions
            </p>
            <p className="font-serif text-sm text-foreground/80 italic leading-relaxed">
              "{notes.trim()}"
            </p>
          </div>
        )}

        <p className="mt-auto text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-8">
          Do not begin until you are ready
        </p>
      </div>
    </div>
  );
}
