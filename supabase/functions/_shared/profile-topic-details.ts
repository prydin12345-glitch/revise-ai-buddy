import type { ProfileEvidence } from "./profile-evidence.ts";
import {
  indexDocumentPages,
  scopeDocumentQualification,
  type DocumentSelection,
} from "./profile-document-index.ts";
import { topicDetailsSchema, type ProfileTopicDetail } from "./profile-topic-detail-schema.ts";
import { foldSourceText, sourceTextIncludes } from "./source-text-match.ts";
import { resolveSectionTopic } from "./profile-topic-sections.ts";

export interface TopicDetailDocument {
  id: string;
  pages: Array<{ page: number; text: string }>;
}

export const TOPIC_DETAIL_CAPACITY_WARNING =
  "The detailed syllabus exceeds the supported topic or source-text limits. The original topic list was kept; add a shorter source to include all detailed outcomes.";

const LIMITS = { topics: 400, nodes: 2000, path: 4, sources: 3, excerpt: 2400, total: 160_000, input: 600_000, pages: 240 };
const normalized = (text: string) => text.replace(/\s+/g, " ").trim();
const identityKey = (text: string) => foldSourceText(text).replace(/[\s-]/g, "");
const codePattern = /^\s*(\d{1,3}(?:\.\d{1,3}){0,5})(?:[.)])?(?:\s+(.+?))?\s*$/;
const namedPattern = /^\s*(?:Theme|Topic|Module|Chapter|Section|Part|Unit)\s+(\d{1,3})\b\s*[:.\u2013\u2014-]?\s*\S/i;
const outcome = /^\s*(?:[a-z]\)|[ivx]+\)|[\u2022\u25cf\u25a0\u25aa\u2013-]\s|o\s|(?:students?|learners?|candidates?)\s+(?:will|should|must|can|need)|(?:understand|explain|describe|evaluate|calculate|demonstrate|identify|analyse|analyze|assess|compare|discuss)\b)/i;
const furniture = (line: string) => !line.trim() || /^\s*(?:Subject content(?:\s+What students need to learn:?)?|What students need to learn:?)\s*$/i.test(line)
  || /^\s*(?:Specification\s*[\u2010-\u2015-]|.*(?:\u00a9|Copyright)\s|Pearson Edexcel Level|AQA\s+(?:AS|A-level)|Contents\s*$|Table of contents\s*$)/i.test(line);
const boundary = /^(?:Overview|Content|Assessment(?: objectives)?|Appendix(?:\s+\d+)?|Qualification at a glance|Specification overview|Subject content|What students need to learn)\s*[:.]?$/i;
const scopeBoundary = /^\s*(?:(?:Paper|Component|Assessment)\s+\d|(?:AS(?:[- ]level)?|A[\s\u2010-\u2015-]*level)\b|Contents\s*$|Table of contents\s*$|Assessment objectives\s*$|Appendix\b)/i;

interface Line { text: string; start: number; end: number }
interface Heading { code: string; label: string; title: string; last: number }
interface Node {
  code: string;
  label: string;
  title: string;
  sources: ProfileTopicDetail["sources"];
  body: boolean;
}
interface Parsed { nodes: Node[]; ambiguous: boolean; capacity: boolean }

function linesOf(text: string): Line[] {
  let offset = 0;
  return text.split("\n").map(line => {
    const row = { text: line, start: offset, end: Math.min(text.length, offset + line.length + 1) };
    offset += line.length + 1;
    return row;
  });
}

function readHeading(lines: Line[], at: number): Heading | null {
  const raw = lines[at].text, named = raw.match(namedPattern), numbered = raw.match(codePattern);
  if (!named && !numbered) return null;
  // Page labels occur after running headers, never as a syllabus unit.
  if (!named && !numbered![2] && !numbered![1].includes(".") &&
    (at === lines.length - 1 || lines.slice(Math.max(0, at - 2), at).some(line => furniture(line.text)))) return null;
  let title = named ? raw.trim() : numbered![2]?.trim() ?? "";
  let last = at;
  for (let next = at + 1; next < Math.min(lines.length, at + 5); next++) {
    const value = lines[next].text.trim();
    if (!value || furniture(value) || boundary.test(value) || outcome.test(value) ||
      namedPattern.test(value) || codePattern.test(value) || /[.!?;:]$/.test(value)) break;
    if (title && !/(?:\band|\bor|\bof|\bin|\bto|\bthe|\ba|[,/\u2013-])\s*$/i.test(title)
      && !/^[a-z(]/.test(value)) break;
    title = title ? `${title} ${value}` : value;
    last = next;
  }
  if (!title || boundary.test(title) || outcome.test(title) ||
    !/\p{L}/u.test(title) || /[.!?;:]$/.test(title)) return null;
  const label = normalized(lines.slice(at, last + 1).map(line => line.text).join("\n"));
  return { code: named?.[1] ?? numbered![1], label, title: named ? normalized(raw.replace(/^\s*(?:Theme|Topic|Module|Chapter|Section|Part|Unit)\s+\d+\s*[:.\u2013\u2014-]?\s*/i, "")) : title, last };
}

function parseSpans(documentId: string, spans: Array<{ page: number; text: string }>, roots?: string[]): Parsed {
  const nodes: Node[] = [], byCode = new Map<string, Node>();
  let current: Node | undefined, previousPage: number | undefined;
  let ambiguous = false, capacity = false;
  for (const span of spans) {
    const lines = linesOf(span.text);
    let start: number | undefined;
    let pageFurniture = false;
    const flush = (end: number) => {
      if (!current || start === undefined) return;
      let text = span.text.slice(start, end).trim();
      while (text) {
        const piece = text.slice(0, LIMITS.excerpt);
        // Identical repeated text can be separate source content. Deduplicating
        // by wording would silently discard repeated rows and bypass limits.
        current.sources.push({ documentId, page: span.page, text: piece });
        text = text.slice(piece.length);
      }
      start = undefined;
    };
    if (previousPage !== undefined && span.page > previousPage + 1) current = undefined;
    for (let at = 0; at < lines.length; at++) {
      let heading = readHeading(lines, at);
      // A bare table row such as "1 Mass" is not a new syllabus section.
      // Single-number roots require an exact, already-evidenced root label.
      if (heading && !heading.code.includes(".") && !namedPattern.test(lines[at].text)
        && !roots?.some(root => [heading!.label, heading!.title].some(label => foldSourceText(label) === foldSourceText(root)))) heading = null;
      if (!heading && codePattern.test(lines[at].text) && normalized(lines[at].text).length > 180)
        return { nodes: [], ambiguous, capacity: true };
      if (heading) {
        flush(lines[at].start);
        const prior = byCode.get(heading.code);
        if (prior && foldSourceText(prior.label) !== foldSourceText(heading.label)) ambiguous = true;
        if (!prior && nodes.length >= LIMITS.nodes) return { nodes: [], ambiguous, capacity: true };
        current = prior ?? { ...heading, sources: [], body: false };
        if (!prior) { nodes.push(current); byCode.set(heading.code, current); }
        start = lines[at].start;
        pageFurniture = false;
        at = heading.last;
      } else if (scopeBoundary.test(lines[at].text)) {
        flush(lines[at].start);
        current = undefined;
      } else if (!lines[at].text.trim()) {
        // Keep paragraph spacing within a literal span; it is not a new source.
        continue;
      } else if (furniture(lines[at].text)) {
        flush(lines[at].start);
        pageFurniture = true;
      } else if (pageFurniture && /^\s*\d{1,3}\s*$/.test(lines[at].text)) {
        // Printed labels are skipped only immediately after a running header.
        continue;
      } else if (current) {
        start ??= lines[at].start;
        current.body = true;
        pageFurniture = false;
      }
    }
    flush(span.text.length);
    previousPage = span.page;
  }
  return { nodes, ambiguous, capacity };
}

function detailsFromNodes(documentId: string, nodes: Node[]): ProfileTopicDetail[] | null {
  const leaves = nodes.filter(node => !nodes.some(other => other.code.startsWith(node.code + ".")));
  if (!leaves.length || leaves.some(node => !node.body || !node.sources.length)) return null;
  return leaves.map(node => ({
    topic: node.label,
    path: nodes.filter(parent => node.code.startsWith(parent.code + "."))
      .sort((a, b) => a.code.split(".").length - b.code.split(".").length)
      .map(parent => parent.label),
    sources: node.sources.map(source => ({ ...source, documentId })),
  }));
}

function coversTopic(topic: string, nodes: Node[]): boolean {
  if (nodes.some(node => [node.label, node.title].some(label => foldSourceText(label) === foldSourceText(topic)))) return true;
  const pointer = topic.match(/^(?:themes?|topics?|modules?|sections?|chapters?|units?|parts?)\s+(\d{1,3}(?:\s*(?:,|and|&|to|through|[\u2013\u2014-])\s*\d{1,3})*)\s*$/i);
  if (!pointer) return false;
  const numbers = pointer[1].match(/\d+/g)!.map(Number);
  if (/\b(?:to|through)\b|[\u2013\u2014-]/i.test(pointer[1])) {
    if (numbers.length !== 2 || numbers[1] < numbers[0] || numbers[1] - numbers[0] > 40) return false;
    const end = numbers[1];
    numbers.length = 1;
    for (let next = numbers[0] + 1; next <= end; next++) numbers.push(next);
  }
  return numbers.every(number => nodes.some(node => node.code === String(number)));
}

function capacityResult(evidence: ProfileEvidence): ProfileEvidence {
  if (evidence.unresolved.includes(TOPIC_DETAIL_CAPACITY_WARNING)) return evidence;
  return evidence.unresolved.length < 30
    ? { ...evidence, unresolved: [...evidence.unresolved, TOPIC_DETAIL_CAPACITY_WARNING] }
    : evidence;
}

/**
 * Server-only expansion. Paths contain ancestor headings; topic is the complete
 * literal numbered leaf heading. Sources are individual original-page slices.
 * Failure leaves the original scope intact, never a partial list of leaves.
 */
export function expandDetailedTopics(
  evidence: ProfileEvidence,
  documents: TopicDetailDocument[],
  selection: DocumentSelection,
): ProfileEvidence {
  if ((selection.course && identityKey(selection.course) !== identityKey(evidence.identity.course)) ||
    (selection.qualification && identityKey(selection.qualification) !== identityKey(evidence.identity.qualification))) return evidence;
  if (![selection.component, ...(selection.componentAliases ?? [])].some(component =>
    identityKey(component) === identityKey(evidence.identity.component))) return evidence;
  const selected = { ...selection, course: selection.course ?? evidence.identity.course,
    qualification: selection.qualification ?? evidence.identity.qualification };
  if (new Set(documents.map(document => document.id)).size !== documents.length) return evidence;
  const pageCount = documents.reduce((count, document) => count + document.pages.length, 0);
  const characters = documents.reduce((count, document) => count + document.pages.reduce((sum, page) => sum + page.text.length, 0), 0);
  if (pageCount > LIMITS.pages || characters > LIMITS.input) return capacityResult(evidence);
  // Bound candidate work before the document index or hierarchy comparisons.
  // This is only a capacity check; it grants no paper/qualification ownership.
  let candidates = 0;
  for (const document of documents)
    for (const page of document.pages)
      for (const line of page.text.split("\n"))
        if ((namedPattern.test(line) || codePattern.test(line)) && ++candidates > LIMITS.nodes)
          return capacityResult(evidence);
  const details: ProfileTopicDetail[] = [];
  const covered = new Set<string>();
  for (const document of documents) {
    const active = evidence.documents.find(source => source.id === document.id && source.state === "active"
      && ["specification", "institution_brief"].includes(source.kind));
    if (!active) continue;
    if (!document.pages.length || new Set(document.pages.map(page => page.page)).size !== document.pages.length ||
      document.pages.some(page => !Number.isInteger(page.page) || page.page < 1 || page.page > LIMITS.pages)) return evidence;
    const texts = Array<string>(Math.max(...document.pages.map(page => page.page))).fill("");
    for (const page of document.pages) texts[page.page - 1] = page.text;
    const scope = scopeDocumentQualification(texts, selected.qualification, selected.course);
    if (scope.ambiguous) return evidence;
    const index = indexDocumentPages(texts, { ...selected, includeTopicContent: true });
    if (!index.coverage.complete && index.coverage.code !== "evidence_capacity") return evidence;
    let spans = index.topicContent ?? [];
    let roots: string[] | undefined;
    if (!spans.length) {
      const scopedPages = scope.fragments.map(fragment => ({ page: fragment.page, text: fragment.text }));
      const pointerRoots = new Set<string>();
      const governingSets: string[] = [];
      for (const claim of evidence.claims) {
        if (claim.field !== "topics" || claim.rule !== "mandatory" || claim.documentId !== document.id) continue;
        const location = active.locations.find(location => location.id === claim.locationId);
        if (!location || !texts[location.page - 1]?.includes(location.text) || !sourceTextIncludes(location.text, claim.quote)) continue;
        const passages = index.chunks.flatMap(chunk => chunk.pages).filter(page => page.page === location.page
          && sourceTextIncludes(page.text, claim.quote));
        for (const passage of passages) {
          // The entire literal selected-paper range governs, even if the model
          // quoted just its beginning. Resolve against qualification-scoped text.
          const pointers = passage.text.matchAll(/\b(?:sections?|topics?|modules?|chapters?|parts?|units?)\s+\d{1,2}(?:\.\d{1,2}){0,2}(?:\s*(?:to|through|[,;&\u2013\u2014-]|and)\s*\d{1,2}(?:\.\d{1,2}){0,2})*/gi);
          for (const match of pointers) {
            if (!sourceTextIncludes(match[0], claim.quote) && !sourceTextIncludes(claim.quote, match[0])) continue;
            const expansion = resolveSectionTopic(match[0], scopedPages);
            if (!expansion) return evidence;
            const keys = expansion.topics.map(heading => foldSourceText(heading.title));
            governingSets.push([...keys].sort().join("\n"));
            keys.forEach(key => pointerRoots.add(key));
          }
        }
      }
      if (new Set(governingSets).size > 1) return evidence;
      // A fallback root needs a mandatory, literal quote in a selected passage.
      // Model-only names and headings in another qualification cannot allocate it.
      roots = evidence.facts.topics.filter(topic => pointerRoots.has(foldSourceText(topic)) || evidence.claims.some(claim => {
        if (claim.field !== "topics" || claim.rule !== "mandatory" || claim.documentId !== document.id) return false;
        const location = active.locations.find(location => location.id === claim.locationId);
        return location && texts[location.page - 1]?.includes(location.text)
          && sourceTextIncludes(location.text, claim.quote) && sourceTextIncludes(claim.quote, topic)
          && index.chunks.some(chunk => chunk.pages.some(page => page.page === location.page && page.text.includes(location.text)));
      }));
      if (!roots.length) continue;
      if (roots.length !== evidence.facts.topics.length) return evidence;
      // A named subset cannot silently truncate a governing section range.
      if (pointerRoots.size && [...pointerRoots].some(root => !roots!.some(topic => foldSourceText(topic) === root))) return evidence;
      spans = scopedPages;
    }
    if (spans.some(span => !texts[span.page - 1]?.includes(span.text))) return evidence;
    const parsed = parseSpans(document.id, spans, roots);
    if (parsed.ambiguous) return evidence;
    if (parsed.capacity) return capacityResult(evidence);
    let nodes = parsed.nodes;
    if (roots) {
      const rootNodes = roots.map(root => nodes.filter(node =>
        foldSourceText(node.label) === foldSourceText(root) || foldSourceText(node.title) === foldSourceText(root)));
      if (rootNodes.some(matches => matches.length !== 1)) return evidence;
      const selectedRoots = rootNodes.map(matches => matches[0]);
      if (selectedRoots.some(root => !nodes.some(node => node.code.startsWith(root.code + ".")))) return evidence;
      nodes = nodes.filter(node => selectedRoots.some(root => node === root || node.code.startsWith(root.code + ".")));
    }
    const expanded = detailsFromNodes(document.id, nodes);
    if (!expanded) return evidence;
    if (expanded.some(detail => detail.sources.length > LIMITS.sources || detail.path.length > LIMITS.path || detail.topic.length > 180)) return capacityResult(evidence);
    for (const topic of evidence.facts.topics) if (coversTopic(topic, nodes)) covered.add(topic);
    details.push(...expanded);
  }
  if (!details.length) return evidence;
  if (evidence.facts.topics.some(topic => !covered.has(topic))) return evidence;
  const labels = new Set(details.map(detail => foldSourceText(detail.topic)));
  if (labels.size !== details.length) return evidence;
  if (details.length > LIMITS.topics || new TextEncoder().encode(details.flatMap(detail => detail.sources.map(source => source.text)).join("")).length > LIMITS.total)
    return capacityResult(evidence);
  const checked = topicDetailsSchema.safeParse(details);
  if (!checked.success) return capacityResult(evidence);
  // A normalized heading must still occur within one unmodified source span.
  if (checked.data.some(detail => !detail.sources.some(source => sourceTextIncludes(source.text, detail.topic)))) return evidence;
  return { ...evidence, facts: { ...evidence.facts, topics: checked.data.map(detail => detail.topic) }, topicDetails: checked.data } as ProfileEvidence;
}
