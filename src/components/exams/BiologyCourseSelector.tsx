import { SelectorDetails } from "./SelectorDetails";
import type { AssessmentTier } from "@/lib/assessment-tier";
import {
  getCourseOptions,
  EDEXCEL_ALEVEL_BIOLOGY_B_ID,
  EDEXCEL_ALEVEL_BIOLOGY_A_ID,
  OCR_ALEVEL_BIOLOGY_ID,
  OCR_ALEVEL_BIOLOGY_B_ID,
  OCR_GATEWAY_BIOLOGY_ID,
  OCR_21C_BIOLOGY_ID,
  type CourseLookup,
} from "@/lib/assessment-tier";
import { gatewayComponent } from "@/lib/biology-paper-contract";

export function BiologyCourseSelector({
  lookup,
  value,
  tier,
  onChange,
  compact = false,
}: {
  compact?: boolean;
  lookup: CourseLookup;
  value: string | null;
  tier: AssessmentTier | null;
  onChange: (courseId: string) => void;
}) {
  const options = getCourseOptions(lookup);
  const pearson = options.some((course) =>
    [EDEXCEL_ALEVEL_BIOLOGY_B_ID, EDEXCEL_ALEVEL_BIOLOGY_A_ID].includes(
      course.id,
    ),
  );
  const alevel = options.some((course) => course.id === OCR_ALEVEL_BIOLOGY_ID);
  if (options.length < 2 && !pearson) return null;
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor="biology-course">
        {pearson
          ? "Pearson Edexcel Biology qualification"
          : "OCR Biology course"}
      </label>
      <select
        id="biology-course"
        className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" disabled>
          Choose the course your school teaches
        </option>
        {options.map((course) => (
          <option
            key={course.id}
            value={course.id}
            disabled={course.generationAvailable === false}
          >
            {pearson
              ? course.label
              : course.id === OCR_ALEVEL_BIOLOGY_ID
                ? "Biology A"
                : course.id === OCR_ALEVEL_BIOLOGY_B_ID
                  ? "Advancing Biology B"
                  : course.id === OCR_GATEWAY_BIOLOGY_ID
                    ? "Gateway Biology A"
                    : "Twenty First Century Biology B"}
            {course.generationAvailable === false ? " — not available" : ""}
          </option>
        ))}
      </select>
      <SelectorDetails compact={compact} title="Course details">
        <p className="text-xs text-muted-foreground">
          {pearson
            ? "Biology B: 9BI0 · Biology A (Salters-Nuffield): 9BN0 — coming later. A generic Edexcel Biology name does not select a qualification."
            : alevel
              ? "Biology A: H420 · Advancing Biology B: H422."
              : "Gateway Biology A: J247 · Twenty First Century Biology B: J257."}
        </p>
        {value === OCR_21C_BIOLOGY_ID && (
          <p className="text-xs text-muted-foreground">
            Choose Breadth or Depth below. Both assess B1–B6, with Ideas about
            Science (B7) and practical skills (B8). Full papers are 90 marks and
            105 minutes. Breadth uses short tasks; Depth includes six-mark
            extended responses.
          </p>
        )}
        {value === OCR_GATEWAY_BIOLOGY_ID && (
          <p className="text-xs text-muted-foreground">
            First paper:{" "}
            {tier
              ? `${gatewayComponent(tier)} · Paper ${tier === "foundation" ? "1" : "3"}`
              : "Paper 1 Foundation / Paper 3 Higher"}
            . B1 Cell level systems, B2 Scaling up, B3 Organism level systems,
            with practical skills. The second paper is coming later.
          </p>
        )}
      </SelectorDetails>
    </div>
  );
}
