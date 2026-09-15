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

import { resolveQuestionResources, type ResourceQuestion } from './question-resources.ts';
import { gcseBiologyIssue, type BiologyScope } from './gcse-biology-scope.ts';

export const CONTRACT_VERSION = 2;

export type DefectCode =
  | "missing_task"
  | "missing_required_resource"
  | "missing_answer"
  | "answer_mismatch"
  | "invalid_options"
  | "incorrect_mark_total"
  | "conflicting_resource_data"
  | "invalid_resource"
  | "inappropriate_graph"
  | "out_of_level";

export interface QuestionDefect {
  /** Stable identity of the offending part. */
  partId: string;
  parentId: string | null;
  code: DefectCode;
  detail: string;
}

export interface CandidatePart extends ResourceQuestion {
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

export interface NormalizedRepairPart {
  questionNumber: string;
  questionText: string;
  correctAnswer: string;
  options?: string[];
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

/**
 * Split into clauses on real boundaries. Newlines are preserved (a task very
 * often sits on its own line after a table), and a clause may also start after
 * a closing bracket/quote that follows a full stop — "…afterwards.) Explain …"
 * — or after a markdown table row ends with "|".
 */
const clauses = (s: string): string[] =>
  s
    .split(/(?<=[.?!][)"'\]]?)\s+|[\r\n]+|(?<=\|)\s+|;\s+|:\s+/)
    .map((c) => c.trim())
    .filter(Boolean);

const startsWithCommand = (c: string): boolean =>
  COMMAND_VERBS.some((v) => c.startsWith(v + " ") || c === v) ||
  INTERROGATIVES.some((w) => c.startsWith(w + " "));

/**
 * Does this text ask the student to DO something?
 * Only imperative/interrogative clauses count — a narrative sentence such as
 * "They measured the diameter of the zone of inhibition" must not.
 */
export function hasAssessedTask(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const text = String(raw).toLowerCase().replace(/[ \t]+/g, " ").trim();
  if (!text) return false;

  for (const clause of clauses(text)) {
    const c = clause.replace(/^[\s"'(\[|*\-–—]+/, "").trim();
    // Imperative or interrogative opener (question mark optional).
    if (startsWithCommand(c)) return true;
    // A command clause can also follow a bracketed aside or a table cell
    // inside the same "sentence": "…(assume a graph.) explain the effect…".
    for (const seg of c.split(/(?<=[).\]])\s+|\s\|\s/)) {
      const s = seg.replace(/^[\s"'(\[|*\-–—]+/, "").trim();
      if (s !== c && startsWithCommand(s)) return true;
    }
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

/**
 * Normalise the two answer-key field names used by supported model outputs.
 * Generation asks for `correct_answer`, but Gemini may return the semantically
 * equivalent `expected_answer`. A repair is usable only when its number, task,
 * and rewritten key are all present.
 */
export function normalizeRepairPart(raw: unknown): NormalizedRepairPart | null {
  if (!raw || typeof raw !== "object") return null;
  const part = raw as Record<string, unknown>;
  const questionNumber = String(part.question_number ?? "").trim();
  const answerValue = part.correct_answer ?? part.expected_answer;
  const correctAnswer = typeof answerValue === "string" ? answerValue.trim() : "";
  const questionText = assembleQuestionText({
    context: typeof part.context === "string" ? part.context : null,
    task: typeof part.task === "string" ? part.task : null,
    question_text: typeof part.question_text === "string" ? part.question_text : null,
  });
  if (!questionNumber || !questionText || !correctAnswer || !hasAssessedTask(questionText)) {
    return null;
  }
  const options = Array.isArray(part.options)
    ? part.options.map((option) => String(option ?? "").trim()).filter(Boolean)
    : undefined;
  return {
    questionNumber,
    questionText,
    correctAnswer,
    options: options?.length ? options : undefined,
  };
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
  if (p.diagramConfig && typeof p.diagramConfig === "object") return true;
  const resources = resolveQuestionResources(p);
  if (!resources.issues.length && (resources.chart || resources.table)) return true;
  return false;
};

/** Does the text point at a resource that must therefore exist? */
export const referencesResource = (text: string): boolean =>
  /\b(figure|fig\.?|table|graph|diagram|chart|image)\s*\d+(\.\d+)?\b/i.test(text) ||
  /\b(the (table|graph|diagram) (above|below|shown))\b/i.test(text);

export interface ValidateOptions {
  /** Server-resolved qualification, distinct from difficulty. */
  scope?: BiologyScope;
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

    const resources = resolveQuestionResources({ ...part, question_text: displayed });
    resources.issues.forEach(issue => push(issue.code, issue.detail));
    const levelIssue = options.scope ? gcseBiologyIssue({ ...part, question_text: displayed }, options.scope) : null;
    if (levelIssue) push('out_of_level', levelIssue);

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
