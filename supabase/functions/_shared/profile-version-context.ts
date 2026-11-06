/**
 * Student-supplied teaching dates help identify a source, but are not a
 * specification issue identifier. Unknown or mixed input stays explicit so
 * genuine version/cohort constraints are never silently discarded.
 */
export interface SpecificationVersionContext {
  kind: "unspecified" | "timeline" | "explicit";
  /** Trimmed original text, retained as context rather than invented metadata. */
  value: string;
  teachingYear?: number;
  firstAssessmentYear?: number;
}

const plain = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ");

const month =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const date =
  `(?:${month}(?:\\s*(?:/|and|-)\\s*${month})?\\s+)?` +
  "((?:19|20)\\d{2})\\b(?:\\s+onwards)?";
const teachingClause = new RegExp(
  "^(?:(?:for\\s+)?first\\s+(?:teaching|taught)(?:\\s+(?:from|in))?|(?:for\\s+)?teaching\\s+from|taught\\s+from)\\s+" +
    date,
  "i",
);
const assessmentClause = new RegExp(
  "^(?:for\\s+)?first\\s+(?:exams?|examinations?|assessments?)(?:\\s+(?:from|in))?\\s+" +
    date,
  "i",
);

export function classifySpecificationVersion(
  input: string,
): SpecificationVersionContext {
  const value = input.trim();
  const text = plain(value);
  if (["", "not verified", "unknown"].includes(text))
    return { kind: "unspecified", value };

  // Consume the complete input using narrow date clauses. Finding one date
  // inside arbitrary version text must not turn the whole input into a hint.
  let remaining = text.replace(/\s*:\s*/g, " ");
  const teaching = new Set<number>(),
    assessment = new Set<number>();
  let clauses = 0;
  while (remaining) {
    const taught = remaining.match(teachingClause);
    const examined = taught ? null : remaining.match(assessmentClause);
    const match = taught ?? examined;
    if (!match) return { kind: "explicit", value };
    (taught ? teaching : assessment).add(Number(match[1]));
    clauses++;
    remaining = remaining
      .slice(match[0].length)
      .replace(/^(?:[\s,;./&-]+|and\b)+/i, "");
  }
  if (!clauses || teaching.size > 1 || assessment.size > 1)
    return { kind: "explicit", value };
  return {
    kind: "timeline",
    value,
    ...(teaching.size ? { teachingYear: [...teaching][0] } : {}),
    ...(assessment.size ? { firstAssessmentYear: [...assessment][0] } : {}),
  };
}

/** A hint may be replaced only by source-backed identity in the caller. */
export function isSpecificationVersionHint(value: string): boolean {
  return classifySpecificationVersion(value).kind !== "explicit";
}

function explicitVersionKey(value: string): string {
  const normalized = plain(value);
  const labelled = normalized.match(
    /^(version|v|issue|edition|cohort)\s*[:=-]?\s*(?=\d)(.+)$/,
  );
  const decimal = normalized.match(/^(\d+\.\d+(?:\.\d+)*(?:\b.*)?)$/);
  if (!labelled && !decimal) return `literal:${normalized}`;
  const family = labelled
    ? ["v", "version"].includes(labelled[1])
      ? "version"
      : labelled[1]
    : "version";
  const identifier = (labelled?.[2] ?? decimal![1])
    .replace(/\s*([./:])\s*/g, "$1")
    // Month/year separators and label spacing are typography. Digit-to-digit
    // separators and decimal precision retain their identity: 1.4 != 14,
    // 1-4 != 14, and cohort 2025-2026 != cohort 20252026.
    .replace(/([a-z])[\s_-]+(?=[a-z0-9])/g, "$1")
    .replace(/(\d)[\s_-]+(?=[a-z])/g, "$1");
  return `${family}:${identifier}`;
}

/**
 * Conservative display equivalence for real version constraints. This does
 * not make teaching timelines equivalent to a source's specification issue.
 */
export function specificationVersionsEquivalent(a: string, b: string): boolean {
  const left = classifySpecificationVersion(a),
    right = classifySpecificationVersion(b);
  if (left.kind !== right.kind) return false;
  if (left.kind === "unspecified") return true;
  if (left.kind === "timeline") return plain(a) === plain(b);
  return explicitVersionKey(a) === explicitVersionKey(b);
}
