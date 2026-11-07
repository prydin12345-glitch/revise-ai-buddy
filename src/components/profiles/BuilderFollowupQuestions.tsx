import { useEffect, useId, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Only server-requested details are editable here; answers are rechecked by the server. */
export interface BuilderMissingItem {
  field: string;
  question: string;
  choices?: Array<{ value: string; label: string }>;
}
interface Props {
  jobId: string;
  items: BuilderMissingItem[];
  summary: Array<{ label: string; value: string }>;
  busy?: boolean;
  onAnswer: (answers: Record<string, string>) => void;
  onChange: () => void;
  sourcePicker?: React.ReactNode;
}

export function BuilderFollowupQuestions({
  jobId,
  items,
  summary,
  busy = false,
  onAnswer,
  onChange,
  sourcePicker,
}: Props) {
  const id = useId();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const signature = JSON.stringify(items);
  useEffect(() => setAnswers({}), [jobId, signature]);
  // The server can refine later choices after each answer. Never guess which
  // dependent options apply based on a browser-selected qualification/course.
  const questions = items.slice(0, 1);
  const complete = questions.every((item) => !!answers[item.field]?.trim());
  return (
    <section
      aria-label="Missing assessment details"
      className="min-w-0 space-y-4"
    >
      <div className="rounded-xl border border-border bg-background/45 p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Your saved choices
          </p>
          <Button
            type="button"
            variant="link"
            size="sm"
            disabled={busy}
            onClick={onChange}
            className="h-auto min-h-8 px-0"
          >
            Change
          </Button>
        </div>
        <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {summary
            .filter((item) => item.value)
            .map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="break-words font-medium [overflow-wrap:anywhere]">
                  {item.value}
                </dd>
              </div>
            ))}
        </dl>
      </div>
      {questions[0]?.field === "source" && sourcePicker ? (
        <div className="min-w-0 space-y-3">
          <h3 className="text-base font-semibold leading-snug">
            {questions[0].question}
          </h3>
          {sourcePicker}
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (complete && !busy)
              onAnswer(
                Object.fromEntries(
                  questions.map((item) => [
                    item.field,
                    answers[item.field].trim(),
                  ]),
                ),
              );
          }}
          className="min-w-0 space-y-3"
        >
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            {questions.map((item, index) => {
              const inputId = `${id}-${index}`;
              return (
                <div key={item.field} className="min-w-0 space-y-2">
                  <label
                    htmlFor={inputId}
                    className="block text-base font-semibold leading-snug"
                  >
                    {item.question}
                  </label>
                  {item.field === "source_pages" ? (
                    <div className="min-w-0 space-y-2">
                      <Input
                        id={inputId}
                        value={answers[item.field] ?? ""}
                        maxLength={180}
                        inputMode="numeric"
                        placeholder="e.g. 8-10 or 8, 9, 12"
                        onChange={(event) =>
                          setAnswers((previous) => ({
                            ...previous,
                            [item.field]: event.target.value,
                          }))
                        }
                        className="min-h-11"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Type one page, a range like 8-10, or several pages
                        separated by commas (up to 10 pages).
                      </p>
                      {!!item.choices?.length && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="w-full text-xs text-muted-foreground">
                            Suggested pages — tap to add:
                          </span>
                          {item.choices.map((choice) => (
                            <Button
                              key={choice.value}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-9"
                              onClick={() =>
                                setAnswers((previous) => {
                                  // One PDF: show plain page numbers.
                                  const page = item.choices!.every((c) =>
                                    c.value.startsWith("1:"),
                                  )
                                    ? choice.value.slice(2)
                                    : choice.value;
                                  const current = (previous[item.field] ?? "")
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  return current.includes(choice.value)
                                    ? previous
                                    : {
                                        ...previous,
                                        [item.field]: [
                                          ...current,
                                          choice.value,
                                        ].join(", "),
                                      };
                                })
                              }
                            >
                              {choice.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : item.choices?.length ? (
                    <select
                      id={inputId}
                      value={answers[item.field] ?? ""}
                      onChange={(event) =>
                        setAnswers((previous) => ({
                          ...previous,
                          [item.field]: event.target.value,
                        }))
                      }
                      className="min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                      required
                    >
                      <option value="">Choose an option</option>
                      {item.choices.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={inputId}
                      value={answers[item.field] ?? ""}
                      maxLength={180}
                      placeholder={
                        item.field === "source_pages"
                          ? "e.g. 9-10, 15"
                          : undefined
                      }
                      onChange={(event) =>
                        setAnswers((previous) => ({
                          ...previous,
                          [item.field]: event.target.value,
                        }))
                      }
                      className="min-h-11"
                      required
                    />
                  )}
                </div>
              );
            })}
          </fieldset>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your files and completed reading are kept.
          </p>
          <Button
            type="submit"
            disabled={busy || !complete}
            className="min-h-11 w-full sm:w-auto"
          >
            {busy ? "Checking…" : "Continue"}
          </Button>
        </form>
      )}
    </section>
  );
}
