import type { PaperPlan } from "@/lib/biology-paper-contract";

export interface ProfileLayoutSection {
  title: string;
  questions: Array<{ marks: number; style: string }>;
  answerCount?: number;
}

interface ProfilePaperPreviewProps {
  plan?: PaperPlan | null;
  sections?: ProfileLayoutSection[];
  structure: string;
  writtenCount: number;
  mcqCount: number;
  mcqOptionsCount?: number;
  parentCount: number;
  maxParts: number;
  subjectName: string;
  expanded?: boolean;
}

const responseLabels: Record<string, string> = {
  mcq_single: "Tick one box",
  short_answer: "Short response",
  long_form: "Extended response",
  essay: "Essay",
};

function AnswerLines({
  choice = false,
  options = 4,
}: {
  choice?: boolean;
  options?: number;
}) {
  return choice ? (
    <div className="mt-2 flex gap-3" aria-hidden="true">
      {["A", "B", "C", "D"].slice(0, options).map((letter) => (
        <span
          key={letter}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <span className="h-3 w-3 rounded-sm border border-border-strong" />
          {letter}
        </span>
      ))}
    </div>
  ) : (
    <div className="mt-2 space-y-2" aria-hidden="true">
      <div className="h-px w-full bg-border" />
    </div>
  );
}

/** A structural preview only. It never invents questions, resources or marks. */
export function ProfilePaperPreview({
  plan,
  sections,
  structure,
  writtenCount,
  mcqCount,
  mcqOptionsCount = 4,
  parentCount,
  maxParts,
  subjectName,
  expanded = false,
}: ProfilePaperPreviewProps) {
  const groups = plan
    ? Array.from(new Set(plan.parts.map((part) => part.parentId))).map(
        (id) => ({
          id,
          parts: plan.parts.filter((part) => part.parentId === id),
        }),
      )
    : [];
  const previewParts = Math.min(maxParts, 3);
  let number = 0;
  const illustrativeGroups =
    writtenCount === 0
      ? []
      : structure === "sub_questions"
        ? [
            { number: 1, parts: previewParts },
            ...(parentCount > 1 ? [{ number: 2, parts: previewParts }] : []),
          ]
        : structure === "mixed" && parentCount > 0
          ? [
              ...(writtenCount > parentCount ? [{ number: 1, parts: 1 }] : []),
              {
                number: writtenCount > parentCount ? 2 : 1,
                parts: previewParts,
              },
            ]
          : Array.from({ length: Math.min(3, writtenCount) }, (_, i) => ({
              number: i + 1,
              parts: 1,
            }));

  return (
    <div
      className="min-w-0 overflow-hidden rounded-lg border border-border bg-background"
      data-testid="profile-paper-preview"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="font-serif text-base text-foreground">
          {subjectName}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {plan || sections?.length ? "Paper layout" : "Example layout"}
        </span>
      </div>
      <div
        className={`${expanded ? "max-h-[340px]" : plan || sections?.length ? "max-h-[256px]" : "max-h-[288px]"} overflow-y-auto overscroll-contain px-4 py-3`}
        tabIndex={0}
        aria-label="Paper layout preview"
      >
        {plan ? (
          <div className="space-y-4">
            {groups.map((group, index) => (
              <div key={group.id} className="space-y-3">
                {group.parts[0]?.section &&
                  (index === 0 ||
                    groups[index - 1].parts[0]?.section !==
                      group.parts[0].section) && (
                    <h4 className="border-b border-border pb-2 font-serif text-sm">
                      Section {group.parts[0].section}
                    </h4>
                  )}
                {group.parts.map((part) => (
                  <div key={part.partId} className="text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="mr-2 font-semibold">
                          Q{part.questionNumber}
                        </span>
                        <span className="text-muted-foreground">
                          {responseLabels[part.responseType] ??
                            "Written response"}
                        </span>
                      </div>
                      <span className="shrink-0 tabular-nums">
                        [{part.marks}]
                      </span>
                    </div>
                    {part.resource !== "none" && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {
                          {
                            data_table: "Data table",
                            graph: "Graph",
                            diagram: "Figure",
                            passage: "Reading passage",
                            essay_choice: "Essay choice",
                          }[part.resource]
                        }
                      </p>
                    )}
                    <AnswerLines choice={part.responseType === "mcq_single"} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : sections?.length ? (
          <div className="space-y-4">
            {sections.map((section, i) => (
              <section key={i}>
                <p className="mb-2 font-serif text-sm">
                  {section.title || `Section ${i + 1}`}
                </p>
                {section.answerCount &&
                  section.answerCount < section.questions.length && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      Answer {section.answerCount} of {section.questions.length}
                    </p>
                  )}
                <div className="space-y-3">
                  {section.questions.map((question, j) => (
                    <div key={j} className="text-xs">
                      <div className="flex justify-between gap-3">
                        <span>
                          <span className="mr-2 font-semibold">
                            Q{++number}
                          </span>
                          <span className="text-muted-foreground">
                            {question.style || "Written response"}
                          </span>
                        </span>
                        <span className="shrink-0">
                          [{question.marks || "?"}]
                        </span>
                      </div>
                      <AnswerLines
                        choice={/multiple choice|mcq/i.test(question.style)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {mcqCount > 0 && (
              <div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold">Multiple choice</span>
                  <span className="text-muted-foreground">
                    {mcqCount} items
                  </span>
                </div>
                <AnswerLines choice options={mcqOptionsCount} />
              </div>
            )}
            {illustrativeGroups.map((group) => (
              <div key={group.number}>
                <p className="text-xs font-semibold">Q{group.number}</p>
                {group.parts > 1 && (
                  <div className="my-2 rounded bg-muted/50 px-2 py-1.5 text-[11px] text-muted-foreground">
                    Shared question context
                  </div>
                )}
                <div className="space-y-3">
                  {Array.from({ length: group.parts }, (_, i) => (
                    <div key={i} className={group.parts > 1 ? "pl-3" : ""}>
                      <p className="text-xs text-muted-foreground">
                        {group.parts > 1 && (
                          <span className="mr-2 font-semibold text-foreground">
                            ({String.fromCharCode(97 + i)})
                          </span>
                        )}
                        Your question
                      </p>
                      <AnswerLines />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
