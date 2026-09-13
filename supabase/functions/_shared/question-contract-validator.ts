// Shared answerability gate for generated exam questions.
//
// A scored part must contain an ASSESSED TASK, not just experimental context.
// The two fixtures that motivated this file (a diffusion stem and an antibiotic
// stem) both carried a full mark scheme while asking the student nothing.
//
// Detection is STRUCTURAL, never punctuation-based:
//  - a command clause anywhere in the part (not only the final sentence),
//  - or a completion / tick-box / table-entry instruction,
//  - or an explicit `task` field supplied by the generation contract.
// A valid instruction may end with a full stop, may appear before a table, and
// never needs a question mark.

export const CONTRACT_VERSION = 1;

export type DefectCode =
  | "missing_task"
  | "missing_required_resource"
  | "missing_answer"
  | "answer_mismatch"
  | "invalid_options"
  | "incorrect_mark_total";

export interface QuestionDefect {
  /** Stable identity of the offending part. */
  partId: string;
  parentId: string | null;
  code: DefectCode;
  detail: string;
}

export interface CandidatePart {
  /** Stable id: draft row id when known, otherwise the question number. */
  id?: string | null;
  question_number?: string | null;
  parent_question_number?: string | null;
  root_question_number?: string | null;
  question_type?: string | null;
  /** Unmarked stimulus/context. Never assessed on its own. */
  context?: string | null;
  /** The explicit instruction for this scored part. */
  task?: string | null;
  question_text?: string | null;
  marks?: number | null;
  options?: unknown;
  correct_answer?: unknown;
  has_figures?: boolean | null;
  figure_urls?: unknown;
  diagram_config?: unknown;
  requires_resource?: boolean | null;
}

export interface ValidationResult {
  defects: QuestionDefect[];
  /** Part ids that carry at least one blocking defect. */
  failedPartIds: string[];
  /** Parent/root groups that must be repaired together. */
  failedGroupIds: string[];
  ok: boolean;
}

/** Command verbs that constitute an assessed instruction. */
const COMMAND_VERBS = [
  "calculate", "work out", "determine", "evaluate", "explain", "describe",
  "state", "name", "identify", "give", "suggest", "compare", "contrast",
  "discuss", "justify", "outline", "define", "list", "predict", "estimate",
  "measure", "draw", "sketch", "plot", "label", "complete", "compute",
  "show that", "write", "select", "choose", "tick", "circle", "match",
  "deduce", "analyse", "analyze", "interpret", "comment on", "find",
  "use", "use the", "using the", "using", "add to", "annotate", "convert", "balance",
];

/** Interrogative openers ("Which of these…", "What is the…"). */
const INTERROGATIVES = ["which", "what", "why", "how", "when", "where", "who"];

const words = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Split into clauses on sentence terminators, newlines and colons/semicolons. */
const clauses = (s: string): string[] =>
  s
    .split(/(?<=[.?!])\s+|\n+|;\s+|:\s+/)
    .map((c) => c.trim())
    .filter(Boolean);

/**
 * Does this text ask the student to DO something?
 * Only imperative/interrogative clauses count — a narrative sentence such as
 * "They measured the diameter of the zone of inhibition" must not.
 */
export function hasAssessedTask(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const text = words(raw);
  if (!text) return false;

  for (const clause of clauses(text)) {
    const c = clause.replace(/^[\s"'(\[]+/, "");
    // Imperative: the clause OPENS with a command verb.
    if (COMMAND_VERBS.some((v) => c.startsWith(v + " ") || c === v)) return true;
    // Interrogative opener, wherever it sits (question mark optional).
    if (INTERROGATIVES.some((w) => c.startsWith(w + " "))) return true;
    // Explicit completion / selection instructions.
    if (/\b(complete the (table|diagram|sentence|graph)|fill in|tick (one|two|the) box|choose one answer|select one)\b/.test(c)) {
      return true;
    }
    // "Your answer should include…" style directed responses.
    if (/\byour answer should\b/.test(c)) return true;
  }
  return false;
}

/** Deterministically assemble displayed text so the task survives every transform. */
export function assembleQuestionText(part: CandidatePart): string {
  const context = (part.context ?? "").trim();
  const task = (part.task ?? "").trim();
  if (context && task) return `${context}\n\n${task}`;
  return task || context || (part.question_text ?? "").trim();
}

const partIdOf = (p: CandidatePart, index: number) =>
  String(p.id ?? p.question_number ?? `part_${index + 1}`);

const groupIdOf = (p: CandidatePart, index: number) =>
  String(
    p.root_question_number ??
      p.parent_question_number ??
      String(p.question_number ?? `part_${index + 1}`).match(/^\d+/)?.[0] ??
      partIdOf(p, index),
  );

const hasResourcePayload = (p: CandidatePart): boolean => {
  if (Array.isArray(p.figure_urls) && p.figure_urls.length > 0) return true;
  if (p.diagram_config && typeof p.diagram_config === "object") return true;
  return false;
};

/** Does the text point at a resource that must therefore exist? */
export const referencesResource = (text: string): boolean =>
  /\b(figure|fig\.?|table|graph|diagram|chart|image)\s*\d+(\.\d+)?\b/i.test(text) ||
  /\b(the (table|graph|diagram) (above|below|shown))\b/i.test(text);

export interface ValidateOptions {
  /** Expected total marks from the plan; omitted when there is no plan. */
  expectedTotalMarks?: number | null;
  /** Expected number of scored parts from the plan. */
  expectedPartCount?: number | null;
  /** Resource ids/labels that are resolvable (question-local or shared). */
  availableResources?: Set<string> | string[];
}

export function validateQuestionCandidates(
  parts: CandidatePart[],
  options: ValidateOptions = {},
): ValidationResult {
  const defects: QuestionDefect[] = [];
  const available = new Set(
    Array.isArray(options.availableResources)
      ? options.availableResources
      : [...(options.availableResources ?? [])],
  );

  let totalMarks = 0;

  parts.forEach((part, index) => {
    const partId = partIdOf(part, index);
    const parentId = part.parent_question_number ?? part.root_question_number ?? null;
    const marks = Number(part.marks ?? 0);
    const scored = marks > 0;
    const displayed = assembleQuestionText(part);
    const type = String(part.question_type ?? "").toLowerCase();
    const push = (code: DefectCode, detail: string) =>
      defects.push({ partId, parentId, code, detail });

    totalMarks += Number.isFinite(marks) ? marks : 0;

    if (!scored) return; // unmarked context parents are legitimate

    // 1. Assessed task
    const taskText = (part.task ?? "").trim();
    const taskPresent = taskText
      ? hasAssessedTask(taskText)
      : hasAssessedTask(displayed);
    if (!taskPresent) {
      push("missing_task", "Scored part contains context but no assessed instruction.");
    }

    // 2. Options
    if (type === "mcq") {
      const opts = Array.isArray(part.options) ? part.options : null;
      if (!opts || opts.length < 3 || opts.some((o) => !String(o ?? "").trim())) {
        push("invalid_options", "Single-select MCQ needs at least 3 non-empty options.");
      }
    }

    // 3. Answer key
    const answer = typeof part.correct_answer === "string"
      ? part.correct_answer.trim()
      : part.correct_answer;
    if (answer === undefined || answer === null || answer === "") {
      push("missing_answer", "Scored part has no expected answer / mark scheme.");
    } else if (type === "mcq" && Array.isArray(part.options)) {
      const answerText = String(answer).trim();
      const letter = /^[A-Za-z]$/.test(answerText)
        ? answerText.toUpperCase().charCodeAt(0) - 65
        : -1;
      const matchesOption = part.options.some(
        (o) => words(String(o ?? "")) === words(answerText),
      );
      const validLetter = letter >= 0 && letter < part.options.length;
      if (!matchesOption && !validLetter) {
        push("answer_mismatch", "MCQ answer matches no option.");
      }
    }

    // 4. Required resources
    if (referencesResource(displayed) || part.requires_resource) {
      const resolvable = hasResourcePayload(part) ||
        [...available].some((label) =>
          displayed.toLowerCase().includes(String(label).toLowerCase()),
        );
      if (!resolvable) {
        push(
          "missing_required_resource",
          "Part references a figure/table that has no payload.",
        );
      }
    }
  });

  // 5. Mark / count totals against the plan
  if (options.expectedTotalMarks != null && totalMarks !== options.expectedTotalMarks) {
    defects.push({
      partId: "paper",
      parentId: null,
      code: "incorrect_mark_total",
      detail: `Total marks ${totalMarks} does not match planned ${options.expectedTotalMarks}.`,
    });
  }
  if (options.expectedPartCount != null) {
    const scoredParts = parts.filter((p) => Number(p.marks ?? 0) > 0).length;
    if (scoredParts !== options.expectedPartCount) {
      defects.push({
        partId: "paper",
        parentId: null,
        code: "incorrect_mark_total",
        detail: `Scored part count ${scoredParts} does not match planned ${options.expectedPartCount}.`,
      });
    }
  }

  const failedPartIds = [...new Set(defects.map((d) => d.partId))].filter((id) => id !== "paper");
  const failedGroupIds = [
    ...new Set(
      parts
        .map((p, i) => ({ group: groupIdOf(p, i), id: partIdOf(p, i) }))
        .filter((p) => failedPartIds.includes(p.id))
        .map((p) => p.group),
    ),
  ];

  return { defects, failedPartIds, failedGroupIds, ok: defects.length === 0 };
}

export const describeDefects = (defects: QuestionDefect[]): string =>
  defects.map((d) => `${d.partId}: ${d.code} — ${d.detail}`).join("; ");
