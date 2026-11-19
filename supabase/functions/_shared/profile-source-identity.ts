import type { TemplateIdentity } from "./profile-template.ts";
import { resolveSourceAssessment, type DiscoveredAssessment } from "./profile-assessment-discovery.ts";
import { foldSourceText } from "./source-text-match.ts";

const uk = (value: string) => ["gb", "uk", "united kingdom"].includes(foldSourceText(value));
const board = (value: string) => {
  const text = foldSourceText(value);
  return ["edexcel", "pearson edexcel"].includes(text) ? "pearson edexcel" : text;
};

/** Known presentation aliases only. Never choose a different assessment,
 * discover an unknown course, or promote a manual reference to source evidence.
 * The assessment must be the server's selection from this owner's upload. */
export function canonicaliseOwnedSourceIdentity(
  raw: TemplateIdentity,
  expected: TemplateIdentity,
  assessment?: DiscoveredAssessment,
): TemplateIdentity {
  const next = { ...raw };
  for (const key of Object.keys(expected) as Array<keyof TemplateIdentity>) {
    const value = next[key], trusted = expected[key];
    if (typeof value === "string" && typeof trusted === "string" &&
        foldSourceText(value) === foldSourceText(trusted))
      (next as Record<string, unknown>)[key] = trusted;
  }
  if (uk(expected.country) && uk(next.country)) next.country = expected.country;
  if (expected.stage !== "University" && board(next.organisation) === board(expected.organisation))
    next.organisation = expected.organisation;

  if (!assessment?.references.length) return next;
  const resolves = (value: string) => value !== assessment.id &&
    resolveSourceAssessment([assessment], value)?.id === assessment.id;
  const code = (value: string) => value.replace(/\s/g, "").toLowerCase();
  if (resolves(expected.component) && (resolves(next.component) ||
      (assessment.componentCode && code(next.component) === code(assessment.componentCode))))
    next.component = expected.component;

  // Identity spelling aliases for the source-declared 9BS0 course only;
  // never a curriculum fact, tier rule, course capability or approval grant.
  if (assessment.courseCode === "9BS0" && assessment.courseCodeReference &&
      assessment.componentCode?.startsWith("9BS0/") && expected.course.toUpperCase() === "9BS0" &&
      expected.qualification === "A-level" && uk(expected.country) &&
      board(expected.organisation) === "pearson edexcel" &&
      [expected.subject, next.subject].every(value => ["business", "business studies"].includes(foldSourceText(value))))
    next.subject = expected.subject;
  return next;
}
