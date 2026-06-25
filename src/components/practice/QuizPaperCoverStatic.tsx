// Static, read-only "front cover" of an Examly practice quiz.

interface QuizPaperCoverStaticProps {
  setName: string;
  subjectId: string;
  subjectColor: string;
  boardLabel: string;
  levelLabel: string;
  totalQuestions: number;
  difficulty: string;
  subtopics: string[];
}

export function QuizPaperCoverStatic({
  setName,
  subjectId,
  subjectColor,
  boardLabel,
  levelLabel,
  totalQuestions,
  difficulty,
  subtopics,
}: QuizPaperCoverStaticProps) {
  const hasBoard = boardLabel && boardLabel !== "Generic style";
  const estimatedTime = totalQuestions * 2;

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
            Practice quiz
          </p>
        </div>

        {/* Title block */}
        <div className="mt-5 rounded-md border-2 border-foreground/80 p-4 sm:p-5">
          <p className="text-xs font-semibold text-muted-foreground">
            {hasBoard ? `Modelled on the ${boardLabel} style` : "Generic quiz style"}
            {levelLabel && levelLabel !== "Not set" ? ` · ${levelLabel}` : ""}
          </p>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold tracking-tight leading-none mt-2">
            {subjectId || "Subject"}
          </h2>
          <p className="font-serif text-base sm:text-lg text-foreground/80 mt-1.5">
            {setName || "Untitled quiz"}
          </p>
        </div>

        {/* Stat bar */}
        <div className="mt-3 flex items-stretch rounded-md border border-border overflow-hidden text-sm">
          <div className="flex-1 px-4 py-3">
            <p className="text-muted-foreground text-xs">Questions</p>
            <p className="font-semibold mt-0.5">{totalQuestions || "—"}</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 px-4 py-3">
            <p className="text-muted-foreground text-xs">Est. time</p>
            <p className="font-semibold mt-0.5">~{estimatedTime} min</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1 px-4 py-3">
            <p className="text-muted-foreground text-xs">Difficulty</p>
            <p className="font-semibold mt-0.5 capitalize truncate">{difficulty}</p>
          </div>
        </div>

        {/* Information */}
        <div className="mt-5 sm:mt-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-foreground mb-2">
            Information for candidates
          </p>
          <ul className="space-y-1.5 text-sm text-foreground/90 leading-relaxed list-disc pl-5">
            <li>
              There {totalQuestions === 1 ? "is" : "are"} {totalQuestions || "—"} question
              {totalQuestions === 1 ? "" : "s"} in this quiz.
            </li>
            <li>Answer each question and submit to receive feedback.</li>
            <li>You can revisit and retake this quiz at any time.</li>
            <li>Work at your own pace — there is no time limit.</li>
          </ul>
        </div>

        {/* Subtopics */}
        {subtopics.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground mb-2">
              Subtopics covered
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">
              This quiz draws on {subtopics.length} subtopic{subtopics.length === 1 ? "" : "s"}:{" "}
              {subtopics.join(", ")}.
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
