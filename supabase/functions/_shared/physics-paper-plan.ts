// Generation sidecar only: the reviewed contract, its marks and its fingerprint
// remain unchanged. Source silence never supplies an official weighting/quota.
import type { PaperPlan, PlannedPart } from "./paper-contract-types.ts";
import { validateEvidence, type ProfileEvidence } from "./profile-evidence.ts";
import { recalledConcepts, repeatedConceptDefects } from "./paper-repetition.ts";

type Row = Record<string, any>;
export interface PhysicsPlanningIssue {
  repairable?: boolean;
  partId: string;
  parentId: string | null;
  code: "plan_mismatch" | "repeated_concept";
  detail: string;
}
export interface PhysicsTopicAllocation {
  topic: string;
  marks: number;
  plannedPercent: number;
  /** Only an explicitly quoted, validated official per-paper percentage. */
  officialPercent?: number;
  sourceReferences?: string[];
}
export interface PhysicsPartIntent {
  partId: string;
  questionNumber: string;
  parentId: string;
  topic: string;
  marks: number;
  demand: PlannedPart["demand"];
  intent: "recall_or_explain" | "application" | "reasoning";
  practical: boolean;
}
export interface PhysicsPaperPlan {
  version: 1;
  courseId: string;
  paperId: string;
  totalMarks: number;
  topicAllocationBasis: "official_source" | "reviewed_layout_advisory";
  topics: PhysicsTopicAllocation[];
  parts: PhysicsPartIntent[];
  practical: {
    status: "required" | "forbidden" | "advisory" | "unknown";
    extendedParentId: string | null;
    sourceReferences: string[];
    explanation: string;
  };
  advisories: string[];
}
const norm = (value: unknown) => String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const percent = (marks: number, total: number) => Math.round(marks / total * 10_000) / 100;
const scored = (row: Row) => Number(row.marks ?? 0) > 0;

/** Invalid, stale, conflicted or different-profile evidence confers no authority. */
function sourceFor(plan: PaperPlan, raw: unknown): ProfileEvidence | null {
  if (!raw) return null;
  try {
    const evidence = validateEvidence(raw);
    if (evidence.conflicts.length ||
      norm(evidence.identity.component) !== norm(plan.paperId) ||
      (plan.courseId.startsWith("profile_template:") &&
        norm(evidence.identity.course) !== norm(plan.courseId.slice("profile_template:".length))) ||
      (plan.specificationVersion && norm(evidence.identity.specificationVersion) !== norm(plan.specificationVersion))) return null;
    return evidence;
  } catch {
    return null;
  }
}
type Reference = { text: string; quote: string; reference: string; official: boolean };
function references(evidence: ProfileEvidence | null, field: string): Reference[] {
  return (evidence?.claims ?? []).flatMap(claim => {
    if (claim.field !== field || claim.rule === "unknown") return [];
    const document = evidence!.documents.find(item => item.id === claim.documentId);
    const location = document?.locations.find(item => item.id === claim.locationId);
    if (!document || !location || document.state !== "active" ||
      !["specification", "institution_brief"].includes(document.kind)) return [];
    return [{
      // Scope inference uses the cited span. Unrelated material on a source
      // page must not silently become a requirement for this paper.
      text: claim.quote,
      quote: claim.quote,
      reference: `${document.id}:${location.id}`,
      official: document.authority === "official_registered" && claim.rule === "mandatory",
    }];
  });
}
function officialWeights(evidence: ProfileEvidence | null, topics: string[]): Map<string, { percent: number; references: string[] }> | null {
  const refs = [...references(evidence, "topicWeights"), ...references(evidence, "topics")].filter(item => item.official);
  const out = new Map<string, { percent: number; references: string[] }>();
  for (const topic of topics) {
    const values = refs.flatMap(reference => {
      // Require a literal topic/value pairing; AO percentages and qualification
      // percentages elsewhere on the page are not topic-weight evidence.
      const matches = [...reference.quote.matchAll(new RegExp(`(?:^|[;\\n])\\s*${escape(topic)}\\s*[:=–-]\\s*(\\d+(?:\\.\\d+)?)\\s*%`, "gi"))];
      return matches.map(match => ({ percent: Number(match[1]), reference: reference.reference }));
    });
    if (!values.length || values.some(item => item.percent <= 0 || item.percent > 100) ||
      new Set(values.map(item => item.percent)).size !== 1) return null;
    out.set(topic, { percent: values[0].percent, references: [...new Set(values.map(item => item.reference))] });
  }
  // Partial weights, conflicting rows and qualification-level sample mixes are
  // advisory. A full per-paper distribution must explicitly identify this paper.
  const paperScope = refs.some(reference =>
    /\b(?:this paper|this component|paper topic weight|component topic weight)\b/i.test(reference.text) ||
    reference.text.includes(evidence?.identity.component ?? "\u0000"));
  return paperScope && Math.abs([...out.values()].reduce((sum, item) => sum + item.percent, 0) - 100) < 0.01 ? out : null;
}
const practicalBan = /\bno\s+(?:(?:required|core)\s+)?practical(?:\s+(?:skills?|questions?|assessment|work))?\b|\bpractical(?:\s+(?:skills?|questions?|work|assessment))?\s+(?:(?:is|are|will be)\s+)?(?:not assessed|excluded|forbidden|prohibited)\b|\b(?:do|does|must) not (?:include|assess)\s+(?:(?:required|core)\s+)?practical/i;
const paperPractical = /\b(?:this (?:paper|component)|in (?:this|the) (?:paper|component))\b[\s\S]{0,160}\b(?:practical|experimental)\b|\b(?:practical|experimental)\b[\s\S]{0,160}\b(?:in|on|by) this (?:paper|component)\b/i;
const practicalAssessment = /\b(?:assess(?:ed|ment|es)?|questions?|must|required|include[sd]?)\b/i;

/** Derives an immutable generation plan from the already approved fixed parts. */
export function buildPhysicsPaperPlan(
  plan: PaperPlan,
  options: { subject?: string; evidence?: unknown } = {},
): PhysicsPaperPlan | null {
  const evidence = sourceFor(plan, options.evidence);
  if (!/\bphysics\b/i.test(`${options.subject ?? ""} ${evidence?.identity.subject ?? ""} ${plan.label}`)) return null;
  const totals = new Map<string, number>();
  for (const part of plan.parts) totals.set(part.topic, (totals.get(part.topic) ?? 0) + part.marks);
  const weights = officialWeights(evidence, [...totals.keys()]);
  const topics = [...totals].map(([topic, marks]) => ({
    topic, marks, plannedPercent: percent(marks, plan.totalMarks),
    ...(weights?.has(topic) ? { officialPercent: weights.get(topic)!.percent, sourceReferences: weights.get(topic)!.references } : {}),
  }));
  const practicalRefs = references(evidence, "practicalRequirement");
  const requirement = evidence?.facts.practicalRequirement;
  const practicalText = practicalRefs.map(item => item.text).join(" ");
  const authoredPractical = plan.parts.filter(part => Number(part.practicalMarks ?? 0) > 0 || part.mcqStyle === "practical");
  const forbidden = practicalBan.test(practicalText);
  const explicitlyRequired = !!requirement && practicalRefs.some(reference => practicalAssessment.test(reference.text) && paperPractical.test(reference.text));
  const status = forbidden ? "forbidden" : authoredPractical.length || explicitlyRequired ? "required" : requirement ? "advisory" : "unknown";
  const groups = [...new Set(plan.parts.map(part => part.parentId))].map(parentId => {
    const parts = plan.parts.filter(part => part.parentId === parentId);
    return { parentId, parts, marks: parts.reduce((sum, part) => sum + (part.responseType === "mcq_single" ? 0 : part.marks), 0) };
  });
  // A known requirement may select an existing substantial written group. It
  // cannot create a new part, alter marks, invent a named required practical,
  // or repurpose a topic outside the reviewed scope.
  const eligible = groups.filter(group => group.marks >= 6 && group.parts.some(part => part.responseType !== "mcq_single"));
  const extended = status === "required" ? eligible.find(group => group.parts.some(part => authoredPractical.includes(part))) ?? eligible.find(group => group.parts.some(part => part.demand === "AO3")) ?? eligible[0] : undefined;
  const advisories: string[] = [];
  if (!weights) advisories.push("No validated official per-paper topic percentages. These exact topic marks come from the reviewed layout; balanced coverage is advisory, not an official weighting.");
  else for (const topic of topics) if (Math.abs(topic.plannedPercent - topic.officialPercent!) > 0.01) advisories.push(`${topic.topic}: reviewed layout allocates ${topic.marks} marks (${topic.plannedPercent}%); cited source gives ${topic.officialPercent}%. Preserve the approved marks and expose this difference.`);
  if (status === "required" && !extended) advisories.push("Practical assessment is applicable, but the reviewed layout contains no written parent of at least six marks. An extended practical question cannot be added without changing the reviewed layout.");
  if (forbidden && authoredPractical.length) advisories.push("The source practical prohibition conflicts with practical flags in the reviewed layout. Do not invent a practical question to resolve it.");
  return {
    version: 1, courseId: plan.courseId, paperId: plan.paperId, totalMarks: plan.totalMarks,
    topicAllocationBasis: weights ? "official_source" : "reviewed_layout_advisory", topics,
    parts: plan.parts.map(part => ({
      partId: part.partId, questionNumber: part.questionNumber, parentId: part.parentId,
      topic: part.topic, marks: part.marks, demand: part.demand,
      intent: part.demand === "AO3" || part.responseType === "long_form" && part.marks >= 4 ? "reasoning" : part.demand === "AO2" ? "application" : "recall_or_explain",
      practical: !forbidden && (part.parentId === extended?.parentId || authoredPractical.includes(part)),
    })),
    practical: {
      status, extendedParentId: extended?.parentId ?? null,
      sourceReferences: practicalRefs.map(item => item.reference),
      explanation: forbidden ? "The cited source explicitly excludes practical assessment." : status === "required" ? "Practical assessment is applicable from the cited paper requirement or reviewed practical part flags." : status === "advisory" ? "The source mentions practical work without establishing an extended practical requirement for this paper." : "No source-backed practical requirement is known; do not invent a required-practical quota or named experiment.",
    }, advisories,
  };
}

/** Prompt sidecar is separate from the contract to retain approved fingerprints. */
export function physicsPaperPlanPrompt(plan: PhysicsPaperPlan | null, batch?: PlannedPart[]): string {
  if (!plan) return "";
  const ids = batch && new Set(batch.map(part => part.partId));
  return `PHYSICS WHOLE-PAPER PLAN (generation guidance; preserve every reviewed part/mark/topic):\n${JSON.stringify({
    totalMarks: plan.totalMarks, topicAllocationBasis: plan.topicAllocationBasis, topics: plan.topics,
    parts: plan.parts.filter(part => !ids || ids.has(part.partId)), practical: plan.practical, advisories: plan.advisories,
  })}\nWithin the fixed topics and demands, write distinct assessed concepts and independently checked keys. Use realistic explain, justify, evaluate and experimental-reasoning tasks for substantial written reasoning parts; do not fill the paper with definition recall. A different application of a shared law is allowed. Never repeat an equivalent written task as an MCQ. Plan one extended practical investigation in the designated existing parent only when applicable; connect method, measurements/control, analysis and evaluation to its reviewed topic. Never claim an unnamed experiment is an official required practical. Source practical bans and unknown applicability remain as stated. Topic marks above are fixed; advisory balancing does not authorize moving marks.`;
}

const taskOf = (row: Row) => String([row.task, row.assessed_task, row.question_task, row.question_text].find(value => typeof value === "string" && value.trim()) ?? "");
const reasoning = /\b(?:explain|justify|evaluate|assess|discuss|suggest|deduce|compare|analyse|analyze|design|plan|why|how|predict|conclude|comment|critici[sz]e)\b/i;
const application = /\b(?:calculate|determine|estimate|show|derive|use|using|draw|sketch|plot|read|find|complete|predict)\b/i;
const practicalTask = /\b(?:experiment|investigat(?:e|ion)|method|procedure|apparatus|measurement|measur(?:e|ing)|uncertaint(?:y|ies)|control(?:led)? variable|systematic|random error|repeat(?:s|ed)?|reliability)\b/i;

/** Deterministic final-paper checks. The existing bounded repair pipeline can
 * consume these ordinary plan_mismatch/repeated_concept defects unchanged. */
export function physicsPaperPlanIssues(
  rows: Row[],
  contract: PaperPlan,
  sidecar: PhysicsPaperPlan | null = buildPhysicsPaperPlan(contract),
  options: { checkRepetition?: boolean } = {},
): PhysicsPlanningIssue[] {
  if (!sidecar) return [];
  const issues: PhysicsPlanningIssue[] = options.checkRepetition === false ? [] : repeatedConceptDefects(rows, contract);
  const lookup = new Map(rows.filter(scored).map(row => [String(row.question_number), row]));
  for (const target of sidecar.parts) {
    const row = lookup.get(target.questionNumber);
    if (!row || target.marks < 3 || contract.parts.find(part => part.partId === target.partId)?.responseType === "mcq_single") continue;
    const task = taskOf(row);
    // Restrict blocking inference to explicit recall with no application or
    // reasoning. Keyword absence alone is not a reliable cognitive-demand test.
    if (target.intent !== "recall_or_explain" && recalledConcepts(task).length && !reasoning.test(task.replace(/\bexplain (?:what is meant by|the meaning of)\b/gi, "define")) && !application.test(task)) {
      issues.push({ repairable:true, partId: String(row.id ?? row.question_number), parentId: target.parentId, code: "plan_mismatch", detail: `Q${target.questionNumber} is planned for ${target.intent} (${target.demand}), but asks only familiar recall. Replace the assessed task and its checked key within the same ${target.marks} marks and topic.` });
    }
  }
  if (sidecar.practical.extendedParentId) {
    const targets = sidecar.parts.filter(part => part.parentId === sidecar.practical.extendedParentId);
    const written = targets.map(target => lookup.get(target.questionNumber)).filter((row): row is Row => !!row);
    const text = written.map(taskOf).join(" ");
    if (written.length === targets.length && (!practicalTask.test(text) || !reasoning.test(text))) {
      const target = targets.find(part => part.marks >= 3) ?? targets[0];
      const row = lookup.get(target.questionNumber)!;
      issues.push({ repairable:true, partId: String(row.id ?? row.question_number), parentId: target.parentId, code: "plan_mismatch", detail: `Q${target.parentId} is the existing extended practical parent. Assess an investigation in its reviewed topic with practical method/measurements and reasoning or evaluation. Preserve all planned parts and marks; do not invent an official named required practical.` });
    }
  }
  return issues;
}
