export interface SourceValidationIssue {
  attempt: number;
  stage: "extraction" | "draft";
  code: string;
  field?: string;
  message: string;
}
export interface SourceValidationRecord extends SourceValidationIssue {
  /** Private owned checkpoint only; never returned by sourceJobView. */
  detail: string;
}

export type SourceIdentityField = "country" | "educationSystem" | "stage" | "qualification" |
  "subject" | "organisation" | "course" | "component" | "specificationVersion" | "tier" |
  "institution" | "module" | "mode";
const identityNames: Record<SourceIdentityField, string> = {
  country: "country", educationSystem: "education system", stage: "education stage",
  qualification: "qualification", subject: "subject", organisation: "exam board or institution",
  course: "course code", component: "paper or assessment", specificationVersion: "specification edition",
  tier: "tier", institution: "institution", module: "optional topic or module", mode: "practice mode",
};
/** Schema-owned field and reason only; rejected values never enter public diagnostics. */
export class SourceIdentityValidationError extends Error {
  constructor(public field: SourceIdentityField, public reason: "conflict" | "removed" | "reference" = "conflict") {
    super(`Assessment identity ${reason}: ${field}.`);
  }
}
export class SourceCallUncertainError extends Error {
  constructor() { super("The source service did not confirm this call's outcome."); }
}

/** Controlled student-facing reasons, without rejected JSON, quotes or tokens. */
export function sourceValidationRecord(
  error: unknown,
  stage: SourceValidationIssue["stage"],
  attempt: number,
): SourceValidationRecord {
  const detail = error instanceof Error ? error.message : "Validation failed.";
  let code = "invalid_structure",
    field: string | undefined;
  let message =
    stage === "draft"
      ? "The draft did not match the supported profile structure."
      : "The returned assessment data did not match the supported source format.";
  if (error instanceof SourceIdentityValidationError) {
    return {
      attempt: Math.max(1, Math.min(3, attempt)), stage,
      code: error.reason === "reference" ? "missing_reference" : "identity_conflict",
      field: error.field,
      message: error.reason === "reference"
        ? `The returned ${identityNames[error.field]} needs a matching source reference.`
        : error.reason === "removed"
          ? `The returned assessment omitted the selected ${identityNames[error.field]}.`
          : `The returned ${identityNames[error.field]} did not match your selection.`,
      detail: detail.slice(0, 800),
    };
  }
  if (error instanceof SourceCallUncertainError) {
    return { attempt: Math.max(1, Math.min(3, attempt)), stage,
      code: "provider_outcome_unknown",
      message: "The source service did not confirm whether this attempt completed. It will not be retried automatically.",
      detail };
  }
  const missing = detail.match(
    /Known source fact lacks a mandatory reference: (\w+)/,
  );
  if (missing) {
    code = "missing_reference";
    field = missing[1];
    const names: Record<string, string> = {
      topics: "The topic list",
      marks: "The mark total",
      durationMinutes: "The duration",
      tier: "The tier",
      formats: "The question formats",
      selection: "The question-choice rule",
      calculator: "The calculator rule",
      mathsRequirement: "The mathematical requirement",
      practicalRequirement: "The practical requirement",
    };
    message = `${names[field] ?? "An assessment fact"} needs a matching source reference.`;
  } else if (
    /reference does not resolve|reference could not be matched|location.*not in the document/i.test(
      detail,
    )
  ) {
    code = "unmatched_quote";
    message =
      "A quoted source passage did not match the supplied document text.";
  } else if (/topic.*not supported|topics are outside/i.test(detail)) {
    code = "unsupported_fact";
    field = "topics";
    // The rejected topic name stays in the private detail only; student-facing
    // reasons never echo rejected model output.
    message =
      "The topic list was not fully supported by the quoted syllabus text.";
  } else if (/totals\/duration/i.test(detail)) {
    code = "contradictory_fact";
    message =
      "The draft's total marks or duration did not match the assessment evidence.";
  } else if (/marks/i.test(detail)) {
    code = "contradictory_fact";
    field = "marks";
    message = "The mark total did not match the assessment evidence.";
  } else if (/duration/i.test(detail)) {
    code = "contradictory_fact";
    field = "durationMinutes";
    message = "The duration did not match the assessment evidence.";
  } else if (/calculator/i.test(detail)) {
    code = "unsupported_fact";
    field = "calculator";
    message =
      "Calculator use needs explicit assessment instructions; a maths-skills example is insufficient.";
  } else if (/tier|Foundation|Higher/i.test(detail)) {
    code = "unsupported_fact";
    field = "tier";
    message =
      "The tier could not be verified from the selected course or source evidence.";
  } else if (/selection|optional|compulsory/i.test(detail)) {
    code = "unsupported_selection";
    field = "selection";
    message =
      "The question-choice rule needs matching assessment instructions.";
  } else if (/Response format|unsupported source format/i.test(detail)) {
    code = "unsupported_fact";
    field = "formats";
    message =
      "The question formats need direct support in the assessment instructions.";
  } else if (/Requirement is not supported/i.test(detail)) {
    code = "unsupported_fact";
    field = /mathsRequirement/.test(detail)
      ? "mathsRequirement"
      : "practicalRequirement";
    message =
      "An assessment requirement needs a complete matching source quote.";
  } else if (
    /different specification|specification.*while your|different course|different paper|assessment.*confirmed|different optional|course.*differs/i.test(
      detail,
    )
  ) {
    code = "identity_conflict";
    message =
      "The source or draft describes different assessment details from those selected.";
  } else if (
    /authority|ownership|checksum|Every supplied document|Duplicate source/i.test(
      detail,
    )
  ) {
    code = "source_identity";
    message = "The source identity or references could not be verified.";
  }
  return {
    attempt: Math.max(1, Math.min(3, attempt)),
    stage,
    code,
    ...(field ? { field } : {}),
    message,
    detail: detail.slice(0, 800),
  };
}
