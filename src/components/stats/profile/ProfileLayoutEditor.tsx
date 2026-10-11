import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaperPreset } from "@/lib/paperPresets";
import {
  ProfilePaperPreview,
  type ProfileLayoutSection,
} from "./ProfilePaperPreview";

const commonStyles = [
  "Explain / describe",
  "Compare",
  "Analyse data / calculation",
  "Evaluate a statement",
  "Extended writing task",
  "Multiple choice",
];
const textStyles = [
  "List / identify from the text",
  "Language analysis",
  "Structure analysis",
  "Passage-based question with linked essay",
  "Essay on two unseen poems",
  "Essay comparing two studied texts",
];
const geographyStyles = [
  "Identify from a figure",
  "Evaluate using a figure and own knowledge",
  "Extended response with case study",
];

export function ProfileLayoutEditor({
  sections,
  onChange,
  presets,
  presetId,
  onPresetChange,
  subjectName,
  onRemove,
}: {
  sections: ProfileLayoutSection[];
  onChange: (sections: ProfileLayoutSection[]) => void;
  presets: PaperPreset[];
  presetId: string;
  onPresetChange: (id: string) => void;
  subjectName: string;
  onRemove: () => void;
}) {
  const [active, setActive] = useState(0);
  const index = Math.min(active, Math.max(0, sections.length - 1));
  const section = sections[index];
  const styles = [
    ...commonStyles,
    ...(/english|literature/i.test(subjectName)
      ? textStyles
      : /geograph/i.test(subjectName)
        ? geographyStyles
        : []),
  ];
  const update = (patch: Partial<ProfileLayoutSection>) =>
    onChange(
      sections.map((value, i) =>
        i === index ? { ...value, ...patch } : value,
      ),
    );
  const countedMarks = sections.reduce(
    (sum, value) =>
      sum +
      value.questions
        .map((q) => Number(q.marks) || 0)
        .sort((a, b) => b - a)
        .slice(0, value.answerCount ?? value.questions.length)
        .reduce((total, marks) => total + marks, 0),
    0,
  );
  const questionStart = sections
    .slice(0, index)
    .reduce((sum, value) => sum + value.questions.length, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl">Sections & marks</h2>
        <button
          type="button"
          className="min-h-9 text-xs text-muted-foreground hover:text-foreground"
          onClick={onRemove}
        >
          Use simple structure
        </button>
      </div>
      <div>
        <label
          htmlFor="profile-layout-preset"
          className="mb-1.5 block text-xs font-medium text-muted-foreground"
        >
          Start from a layout
        </label>
        <select
          id="profile-layout-preset"
          value={presets.some((p) => p.id === presetId) ? presetId : ""}
          onChange={(event) => onPresetChange(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Custom layout</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Sections"
      >
        {sections.map((value, i) => (
          <button
            type="button"
            key={i}
            aria-pressed={index === i}
            onClick={() => setActive(i)}
            className={`min-h-10 rounded-md px-3 text-xs ${index === i ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            {value.title || `Section ${i + 1}`}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            onChange([
              ...sections,
              {
                title: `Section ${String.fromCharCode(65 + sections.length)}`,
                questions: [{ marks: 4, style: "Explain / describe" }],
              },
            ]);
            setActive(sections.length);
          }}
          className="flex min-h-10 items-center gap-1 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add section
        </button>
      </div>
      {section && (
        <section className="space-y-4 rounded-lg border border-border bg-background p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label
                htmlFor="profile-section-name"
                className="mb-1.5 block text-xs text-muted-foreground"
              >
                Section name
              </label>
              <Input
                id="profile-section-name"
                value={section.title}
                onChange={(event) => update({ title: event.target.value })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove section"
              onClick={() => onChange(sections.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[256px] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {section.questions.map((question, qi) => {
              const known = styles.includes(question.style);
              const changeQuestion = (patch: Partial<typeof question>) =>
                update({
                  questions: section.questions.map((q, i) =>
                    i === qi ? { ...q, ...patch } : q,
                  ),
                });
              return (
                <div
                  key={qi}
                  className="flex flex-wrap items-start gap-2 border-b border-border/60 pb-3 last:border-0"
                >
                  <span className="w-7 pt-2.5 text-xs font-semibold">
                    Q{questionStart + qi + 1}
                  </span>
                  <div className="min-w-[160px] flex-1">
                    <select
                      aria-label={`Question ${questionStart + qi + 1} type`}
                      value={known ? question.style : "other"}
                      onChange={(event) =>
                        changeQuestion({
                          style:
                            event.target.value === "other"
                              ? ""
                              : event.target.value,
                        })
                      }
                      className="h-10 w-full rounded-md border border-input bg-card px-2 text-xs"
                    >
                      {styles.map((style) => (
                        <option key={style}>{style}</option>
                      ))}
                      <option value="other">Custom type</option>
                    </select>
                    {!known && (
                      <Input
                        aria-label={`Question ${questionStart + qi + 1} custom type`}
                        placeholder="Question purpose"
                        className="mt-2"
                        value={question.style}
                        onChange={(event) =>
                          changeQuestion({ style: event.target.value })
                        }
                      />
                    )}
                  </div>
                  <div className="w-16">
                    <Input
                      type="number"
                      aria-label={`Question ${questionStart + qi + 1} marks`}
                      min={1}
                      max={100}
                      value={question.marks || ""}
                      onChange={(event) =>
                        changeQuestion({
                          marks: parseInt(event.target.value) || 0,
                        })
                      }
                      className="text-center tabular-nums"
                    />
                    <span className="mt-1 block text-center text-[10px] text-muted-foreground">
                      marks
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove question ${questionStart + qi + 1}`}
                    onClick={() =>
                      update({
                        questions: section.questions.filter((_, i) => i !== qi),
                      })
                    }
                    className="flex h-10 w-8 items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              update({
                questions: [
                  ...section.questions,
                  { marks: 4, style: "Explain / describe" },
                ],
              })
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add question
          </Button>
          {section.questions.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <label htmlFor="profile-answer-count" className="text-xs">
                Students answer
              </label>
              <Input
                id="profile-answer-count"
                type="number"
                min={1}
                max={section.questions.length}
                value={section.answerCount ?? section.questions.length}
                className="h-9 w-16 text-center"
                onChange={(event) => {
                  const value = parseInt(event.target.value);
                  update({
                    answerCount:
                      Number.isFinite(value) &&
                      value >= 1 &&
                      value < section.questions.length
                        ? value
                        : undefined,
                  });
                }}
              />
              <span className="text-xs text-muted-foreground">
                of {section.questions.length}
                {section.answerCount ? " · their choice" : " · all questions"}
              </span>
            </div>
          )}
        </section>
      )}
      {sections.some((value) =>
        value.questions.some(
          (question) => !question.marks || question.marks < 1,
        ),
      ) && (
        <p role="alert" className="text-xs text-destructive">
          Give each question at least one mark.
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {sections.reduce((sum, value) => sum + value.questions.length, 0)}{" "}
          questions
        </span>
        <span>{countedMarks} marks counted</span>
      </div>
      <ProfilePaperPreview
        sections={sections}
        subjectName={subjectName}
        structure="standalone"
        writtenCount={0}
        mcqCount={0}
        parentCount={0}
        maxParts={0}
      />
    </div>
  );
}
