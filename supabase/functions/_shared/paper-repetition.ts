// Whole-paper checks for exact tasks, narrowly recognisable recall and reused
// data. These are deterministic defects, not a fuzzy similarity/quality score.
import type { PaperPlan } from "./paper-contract-types.ts";

export interface RepetitionDefect {
  partId: string;
  parentId: string | null;
  code: "repeated_concept";
  detail: string;
}
type Row = Record<string, any>;
const rootOf = (r: Row): string =>
  String(
    r.root_question_number ??
      r.parent_question_number ??
      String(r.question_number ?? "")
        .replace(/^Q/i, "")
        .match(/^\d+/)?.[0] ??
      r.question_number ??
      "",
  );
const idOf = (r: Row): string => String(r.id ?? r.question_number);
const label = (r: Row): string =>
  `Q${String(r.question_number ?? "").replace(/^Q/i, "")}`;
const plain = (t: string): string =>
  String(t ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[${}]/g, " ")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const literalTaskKey = (value: string): string =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(
      /\\(?:text|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}/g,
      "$1",
    )
    .replace(/&minus;/gi, "-")
    .replace(/&nbsp;/gi, " ")
    .replace(/[${}]/g, "")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.?!]+$/, "");
const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const scalar = (value: unknown): unknown =>
  typeof value === "string" &&
  /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()) &&
  Number.isFinite(Number(value))
    ? Number(value)
    : value;
const record = (value: unknown): Row | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;

const taskSentences = (text: string): string[] =>
  instructions({ question_text: text })
    .split(/(?<=[.?!;])\s+|\n+/)
    .filter(Boolean);
function definitionInSentence(sentence: string): string | null {
  const t = plain(sentence);
  const match = t.match(
    /\b(define|defines|definition of|what is meant by|meaning of)\s+(?:the\s+|a\s+|an\s+)?([a-z][a-z ]{2,70}?)(?=\s+(?:at|of a|of an|in|for|as|and|is|when)\b|$)/,
  );
  if (!match) return null;
  if (
    match[1] === "definition of" &&
    !/\b(?:give|state|write|which|what|correct|choose|select)\b/.test(
      t.slice(0, match.index),
    )
  )
    return null;
  const concept = match[2].replace(/^(?:term|quantity)\s+/, "").trim();
  return concept.split(" ").length <= 6
    ? concept.replace(/^electrostatic potential$/, "electric potential")
    : null;
}
/** Only explicit definition tasks; context/application of a concept is different. */
export function definedConcept(text: string): string | null {
  for (const sentence of taskSentences(text)) {
    const concept = definitionInSentence(sentence);
    if (concept) return concept;
  }
  return null;
}

/** Conservative, explicit recall intents. Repeated formulas/application alone do not qualify. */
export function recalledConcepts(text: string): string[] {
  const t = plain(instructions({ question_text: text })),
    full = plain(text),
    found = new Set<string>();
  for (const sentence of taskSentences(text)) {
    const definition = definitionInSentence(sentence);
    if (definition) found.add(`definition:${definition}`);
  }
  const asksRecall =
    /\b(?:state|give|write|which|what|why|describe|explain|identify|name|select|choose|list)\b/.test(
      t,
    );
  const sentences = taskSentences(text).map(plain);
  // Identifying a failed assumption at a physical limit is an application,
  // rather than another request to recite the ideal-gas assumption set.
  if (sentences.some(sentence =>
    /\b(?:state|give|write|which|what|describe|explain|identify|name|select|choose|list)\b/.test(sentence) &&
    /\b(?:assumptions?|assumes?|assumed)\b/.test(sentence) &&
    /\b(?:ideal gas|kinetic theory|kinetic model|molecular model of a gas)\b/.test(sentence) &&
    !/\b(?:real gas|high pressures?|low temperatures?|no longer|not valid|invalid|fails?|breaks? down|limitations?|deviat(?:e|es|ion|ions))\b/.test(sentence)
  )) found.add("recall:ideal-gas-assumptions");
  if (sentences.some(sentence =>
    /\bfaraday(?: s)? law\b|\blaw of (?:electromagnetic )?induction\b/.test(sentence) &&
    /\b(?:state|states|statement|give|write|what does|which|identify|select|choose|describe|express)\b/.test(sentence) &&
    !/\b(?:calculate|determine|estimate|deduce|doubl(?:e|es|ing)|halv(?:e|es|ing)|increase|decrease|changes? (?:in|by)|(?:use|using|apply|applying) faraday)\b/.test(sentence)
  )) found.add("recall:faradays-law");
  if (
    asksRecall &&
    /\bmoderator\b/.test(t) &&
    /(?:\b(?:role|function|purpose)\b|\bwhat (?:does (?:a |the )?moderator|(?:a |the )?moderator does)\b|\b(?:why (?:is|are) (?:a |the )?moderators? (?:used|needed)|moderators? (?:is|are) (?:used|needed) for)\b)/.test(
      t,
    ) &&
    !/\b(?:calculate|determine|estimate)\b/.test(t)
  )
    found.add("recall:reactor-moderator-function");
  // These comparisons have fixed particle properties. Distinct equal-speed,
  // equal-momentum and equal-energy comparisons test different relationships.
  if (
    /\b(?:alpha particle|alpha particles)\b/.test(full) &&
    /\bprotons?\b/.test(full) &&
    /\b(?:radius|radii|curvature)\b/.test(t) &&
    /\bmagnetic\b/.test(full)
  ) {
    const condition = full.match(
      /\bsame (speed|momentum|kinetic energy)\b/,
    )?.[1];
    if (condition)
      found.add(`comparison:alpha-proton-magnetic-radius:${condition}`);
  }
  return [...found];
}

/** Narrowly identifiable numerical capacitor tasks. A shared relationship is
 * allowed; repeating the same requested quantity with the same givens is not.
 * Unit prefixes remain case sensitive, and no model-provided concept ID is used. */
function capacitorTask(text: string): string | null {
  const full = String(text ?? "")
    .replace(/\\(?:mathrm|text|operatorname)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:mu|micro)\b/g, "u")
    .replace(/μ|µ/g, "u")
    .replace(/[${}]/g, "")
    .replace(/\\,/g, " ");
  if (!/\bcapacitor\b/i.test(full)) return null;
  const task = plain(instructions({ question_text: text }));
  const requested = /\b(?:calculate|determine|find|what|which|how much)\b/.test(task)
    ? /\b(?:energy|work done)\b/.test(task) ? "energy"
      : /\b(?:charge|number of coulombs)\b/.test(task) ? "charge"
      : /\b(?:capacitance)\b/.test(task) ? "capacitance"
      : /\b(?:time constant)\b/.test(task) ? "time-constant"
      : null
    : null;
  if (!requested) return null;
  const data = [...full.matchAll(/(^|[^a-zA-Z0-9.+-])([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(pF|nF|uF|mF|kF|MF|F|mV|kV|MV|V|pC|nC|uC|mC|C|mJ|kJ|MJ|J|kΩ|MΩ|Ω|kohm|Mohm|ohm)(?=$|[^a-zA-Z0-9])/g)]
    .map(match => [Number(match[2]), match[3]] as const)
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0] - b[0]);
  // Two physical givens are needed. Complex compound units/formula strings are
  // intentionally left to the exact-task/resource checks.
  if (data.length < 2 || data.length > 4 ||
    /\b(?:series|parallel|network|dielectric|plate separation|distance|different|two capacitors?|three capacitors?)\b/i.test(full) ||
    /(?:\^|×|\\times)/.test(full)) return null;
  const units = data.map(item => item[1]);
  const has = (pattern: RegExp) => units.some(unit => pattern.test(unit));
  if ((requested === "charge" || requested === "energy") && (!has(/F$/) || !has(/V$/))) return null;
  if (requested === "capacitance" && (!has(/C$/) || !has(/V$/))) return null;
  if (requested === "time-constant" && (!has(/F$/) || !has(/Ω$|ohm$/))) return null;
  // Charging/discharging at a specified instant are separate tasks and require
  // time/context data beyond this conservative two-given fingerprint.
  if (/\b(?:after|instant|initial|remaining|discharg\w*|charg(?:ing|ed from)|time|seconds?|resistor)\b/i.test(full) && requested !== "time-constant") return null;
  return `calculation:capacitor:${requested}:${stable(data)}`;
}

/** Server-derived canonical concepts for every scored task. Unknown tasks get
 * an exact-task ID, without pretending to infer arbitrary semantic equivalence. */
export function canonicalTaskConceptIds(row: Row): string[] {
  const text = String(row.question_text ?? row.task ?? "");
  const concepts = recalledConcepts(text);
  const capacitor = capacitorTask(text);
  if (capacitor) concepts.push(capacitor);
  const exact = literalTaskKey(text);
  if (exact) concepts.push(`task:${digest(exact)}`);
  return [...new Set(concepts)];
}

export interface CoveredConceptEntry {
  partId: string;
  questionNumber: string;
  conceptIds: string[];
  task: string;
  resourceIds: string[];
}
/** Complete cross-batch ledger, recomputed from public tasks and resources.
 * Private keys/options and model-nominated concept IDs confer no authority. */
export function coveredConceptLedger(rows: Row[]): CoveredConceptEntry[] {
  return rows.filter(row => Number(row.marks ?? 0) > 0).map(row => ({
    partId: idOf(row),
    questionNumber: String(row.question_number ?? ""),
    conceptIds: canonicalTaskConceptIds(row),
    task: instructions(row),
    resourceIds: resources(row).map(key => `${key.startsWith("graph:") ? "graph" : "table"}#${digest(key)}`),
  }));
}

const unitText = (value: unknown): string =>
  String(value ?? "")
    .replace(/\\(?:mathrm|text|operatorname)\s*\{([^{}]*)\}/g, "$1")
    .replace(/[${}\s]/g, "")
    .replace(/μ|µ/g, "u")
    .replace(/Ω/g, "ohm");
function axisKey(value: unknown): string {
  const original = String(value ?? "")
    .replace(/\\(?:mathrm|text)\s*\{([^{}]*)\}/g, "$1")
    .trim();
  const unit =
    original.match(/\(([^()]*)\)\s*$/)?.[1] ??
    original.match(/\s\/\s*(.+)$/)?.[1] ??
    "";
  const rawQuantity = plain(
    unit ? original.replace(/\([^()]*\)\s*$|\s\/\s*.+$/, "") : original,
  );
  const known = [
    [/^(?:time|t)\b/, "time"],
    [/^(?:potential difference|p d|voltage)\b/, "voltage"],
    [/^flux linkage\b/, "flux-linkage"],
    [/^magnetic flux\b/, "magnetic-flux"],
    [/^temperature\b/, "temperature"],
    [/^pressure\b/, "pressure"],
    [/^current\b/, "current"],
    [/^force\b/, "force"],
    [/^distance\b/, "distance"],
    [/^length\b/, "length"],
    [/^charge\b/, "charge"],
  ] as const;
  const quantity =
    known.find(([pattern]) => pattern.test(rawQuantity))?.[1] ??
    literalTaskKey(
      unit ? original.replace(/\([^()]*\)\s*$|\s\/\s*.+$/, "") : original,
    );
  return `${quantity}|${unitText(unit)}`;
}
function tableKey(value: unknown): string | null {
  let candidate = value;
  if (typeof candidate === "string" && candidate.length < 200_000) {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (
    Array.isArray(candidate) &&
    candidate.length > 1 &&
    candidate.every(Array.isArray)
  )
    candidate = { headers: candidate[0], rows: candidate.slice(1) };
  const t = record(candidate);
  if (
    !t ||
    !Array.isArray(t.headers) ||
    !t.headers.length ||
    !Array.isArray(t.rows) ||
    !t.rows.length ||
    !t.rows.every(Array.isArray)
  )
    return null;
  return (
    "table:" +
    stable({
      headers: t.headers.map((header: unknown, i: number) => {
        const key = axisKey(header),
          explicitUnit = unitText(t.units?.[i]);
        return explicitUnit && !key.endsWith(`|${explicitUnit}`)
          ? `${key}|${explicitUnit}`
          : key;
      }),
      rows: t.rows.map((row: unknown[]) => row.map(scalar)),
    })
  );
}
function chartKey(value: unknown): string | null {
  const c = record(value);
  if (!c) return null;
  if (c.type === "data_table") return tableKey(c);
  if (
    c.type !== "line_chart" ||
    !Array.isArray(c.datasets) ||
    !c.datasets.length
  )
    return null;
  return (
    "graph:" +
    stable({
      x: axisKey(c.xLabel ?? c.xAxisLabel),
      y: axisKey(c.yLabel ?? c.yAxisLabel),
      datasets: c.datasets.map((dataset: any) => ({
        // A single curve cannot avoid detection merely by renaming its legend.
        ...(c.datasets.length > 1 ? { label: plain(dataset?.label) } : {}),
        data: Array.isArray(dataset?.data)
          ? dataset.data.map((point: any) => ({
              x: scalar(point?.x),
              y: scalar(point?.y),
            }))
          : null,
      })),
    })
  );
}
function resources(row: Row): string[] {
  const keys = new Set<string>();
  for (const value of [
    row.diagram_config,
    row.diagramConfig,
    row.chart_data,
    row.options,
  ]) {
    const key = chartKey(value);
    if (key) keys.add(key);
  }
  const storedTable = tableKey(row.table_data);
  if (storedTable) keys.add(storedTable);
  return [...keys];
}
function intentionalSharedResource(
  a: Row,
  b: Row,
  plan?: Pick<PaperPlan, "parts">,
): boolean {
  if (rootOf(a) && rootOf(a) === rootOf(b)) return true;
  if (!plan) return false;
  const planned = (row: Row) =>
    plan.parts.find(
      (part) => part.questionNumber === String(row.question_number),
    );
  const first = planned(a),
    next = planned(b);
  // IDs from rows/model payloads do not confer shared-resource authority.
  return !!first?.resourceId && first.resourceId === next?.resourceId;
}

/** A sentence written twice inside one part, including duplicated maths wrappers. */
export function repeatedSentence(text: string): string | null {
  const seen = new Set<string>();
  for (const sentence of String(text ?? "").split(/(?<=[.?!])\s+|\n+/)) {
    const key = literalTaskKey(sentence);
    if (key.split(" ").length < 6) continue;
    if (seen.has(key)) return sentence.trim();
    seen.add(key);
  }
  return null;
}
export function repeatedConceptDefects(
  parts: Row[],
  plan?: Pick<PaperPlan, "parts">,
): RepetitionDefect[] {
  const out: RepetitionDefect[] = [],
    concepts = new Map<string, Row>(),
    charts = new Map<string, Row>(),
    stems = new Map<string, Row>();
  for (const row of parts) {
    if (!(Number(row.marks ?? 0) > 0)) continue;
    const text = String(row.question_text ?? ""),
      details = new Set<string>();
    const duplicateSentence = repeatedSentence(text);
    if (duplicateSentence)
      details.add(
        `The stem states the same sentence twice ("${duplicateSentence.slice(0, 80)}"). Keep one clear wording.`,
      );
    const normalized = literalTaskKey(text);
    const exact =
      normalized.split(" ").length >= 8 ? stems.get(normalized) : undefined;
    if (exact)
      details.add(
        `${label(exact)} already asks exactly this task with the same stated context and data. Use a distinct task and independently checked key.`,
      );
    else if (normalized.split(" ").length >= 8) stems.set(normalized, row);
    for (const concept of canonicalTaskConceptIds(row).filter(id => !id.startsWith("task:"))) {
      const first = concepts.get(concept);
      if (first)
        details.add(
          `${label(first)} already assesses "${concept}". Assess a different task from the planned topic, with a new checked key.`,
        );
      else concepts.set(concept, row);
    }
    for (const key of resources(row)) {
      const first = charts.get(key);
      if (first && !intentionalSharedResource(first, row, plan))
        details.add(
          `${label(first)} already uses exactly the same graph/table measurements, axes and units. Supply distinct data and recalculate the key.`,
        );
      else if (!first) charts.set(key, row);
    }
    if (details.size)
      out.push({
        partId: idOf(row),
        parentId:
          row.parent_question_number ?? row.root_question_number ?? null,
        code: "repeated_concept",
        detail: [...details].join(" "),
      });
  }
  return out;
}

const digest = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++)
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
};
function instructions(row: Row): string {
  const explicit = [
    row.task,
    row.assessed_task,
    row.question_task,
    row.instruction,
    row.command,
  ].find((value) => typeof value === "string" && value.trim());
  if (explicit) return String(explicit).trim();
  const stem = String(row.question_text ?? "");
  const pieces = stem
    .split(/(?<=[.!?])\s+|\n+/)
    .map((piece) => piece.trim())
    .filter(Boolean);
  const commands = pieces.filter((piece) =>
    /\?|^(?:\(?[a-zivx]+\)?[.)]?\s+)?(?:define|state|give|write|calculate|determine|deduce|explain|describe|compare|suggest|evaluate|estimate|show|which|what|why|how)\b/i.test(
      piece,
    ),
  );
  return (commands.length ? commands : pieces).join(" ");
}
/** Bounded whole-paper tracker: every planned scored part, not just the first 40. */
export function coveredTasksNote(rows: Row[], max = 50): string {
  const scored = rows
    .filter((row) => Number(row.marks ?? 0) > 0)
    .slice(0, Math.max(0, Math.min(50, max)));
  if (!scored.length) return "";
  const perEntry = Math.floor(20_000 / scored.length);
  const lines = scored.map((row) => {
    const task = instructions(row),
      recall = canonicalTaskConceptIds(row).filter(id => !id.startsWith("task:")).join(", ");
    const data = resources(row)
      .map(
        (key) =>
          `${key.startsWith("graph:") ? "graph" : "table"}#${digest(key)}`,
      )
      .join(", ");
    const prefix = `${label(row)}${recall ? ` [${recall}]` : ""}${data ? ` [${data}]` : ""}: `;
    const allowance = Math.max(80, perEntry - prefix.length);
    return (
      prefix +
      (task.length <= allowance
        ? task
        : `${task.slice(0, Math.max(30, allowance - 58))} … [task ${digest(task)}; ${task.length} characters]`)
    );
  });
  return (
    "ALREADY WRITTEN ELSEWHERE IN THIS PAPER — avoid repeating the same recall/definition/assumption set or exact task/data. A different application of a shared topic or law is allowed. Resource IDs below fingerprint measurements AND axes/units; intentional shared resources within a parent stay together.\n" +
    lines.join("\n")
  );
}
