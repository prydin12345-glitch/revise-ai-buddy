import type { ProfileEvidence } from "./profile-evidence.ts";
import { foldSourceText, sourceTextIncludes } from "./source-text-match.ts";
import { scopeDocumentQualification } from "./profile-document-index.ts";

/**
 * Specifications often scope a paper as "Sections 1 - 5 and 6.1" and list the
 * actual topic names elsewhere in the same document. These helpers turn such
 * pointers into named topics using literal headings from the same upload, so
 * every expanded topic stays quote-backed.
 */
const REF_WORD =
  /^(?:(?:sections?|topics?|units?|modules?|chapters?|content|parts?)\s*)?/i;
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function stripHints(topic: string) {
  const hints: string[] = [];
  const bare = topic.replace(/\(([^)]{1,120})\)/g, (_, h: string) => {
    hints.push(h.trim());
    return " ";
  });
  return { bare: bare.replace(/\s+/g, " ").trim(), hints };
}

/** True when a topic is only a pointer to numbered sections, not a topic name. */
export function isSectionReferenceTopic(topic: string): boolean {
  const { bare } = stripHints(topic);
  const rest = bare.replace(REF_WORD, "");
  if (!/\d/.test(rest)) return false;
  return /^[\d.\s,;&\u2013\u2014-]*(?:(?:and|to|through)[\d.\s,;&\u2013\u2014-]+)*$/i.test(
    rest.replace(/\b(?:and|to|through)\b/gi, (m) => ` ${m} `),
  );
}

/** "Sections 1 - 5 and 6.1" -> ["1","2","3","4","5","6.1"]; null if unparsable. */
export function parseSectionRefs(topic: string): string[] | null {
  if (!isSectionReferenceTopic(topic)) return null;
  const rest = stripHints(topic).bare.replace(REF_WORD, "");
  const refs: string[] = [];
  for (const piece of rest.split(/\s*(?:,|;|&|\band\b)\s*/i)) {
    const p = piece.trim();
    if (!p) continue;
    const range = p.match(
      /^(\d{1,2})\s*(?:to|through|[\u2013\u2014-])\s*(\d{1,2})$/i,
    );
    if (range) {
      const a = Number(range[1]),
        b = Number(range[2]);
      if (b < a || b - a > 20) return null;
      for (let n = a; n <= b; n++) refs.push(String(n));
    } else if (/^\d{1,2}(?:\.\d{1,2}){0,2}$/.test(p)) refs.push(p);
    else return null;
  }
  return refs.length && refs.length <= 30 ? [...new Set(refs)] : null;
}

interface Heading {
  title: string;
  page: number;
  line: string;
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function cleanTitle(raw: string) {
  const t = raw
    .replace(/\s*\.{2,}.*$/, "")
    .replace(/\s+\d{1,3}$/, "")
    .trim();
  if (
    t.length < 3 ||
    t.length > 90 ||
    !/^[A-Z]/.test(t) ||
    t.split(/\s+/).length > 12 ||
    /[.:;]$/.test(t)
  )
    return null;
  return t;
}

/** Candidate headings per prefix ("" or "3") for one section ref. */
function findHeadings(
  ref: string,
  pages: Array<{ page: number; text: string }>,
): Map<string, Heading[]> {
  const out = new Map<string, Heading[]>();
  const rx = new RegExp(
    `^\\s*(?:(\\d{1,2})\\.)?${esc(ref)}(?![.\\d])\\s+(.+?)\\s*$`,
  );
  for (const page of pages)
    for (const rawLine of page.text.split("\n")) {
      const m = rawLine.match(rx);
      if (!m) continue;
      const title = cleanTitle(m[2]);
      if (!title) continue;
      const key = m[1] ?? "";
      const list = out.get(key) ?? [];
      list.push({ title, page: page.page, line: rawLine.trim() });
      out.set(key, list);
    }
  return out;
}

function consistentHeading(list: Heading[]): Heading | null {
  // Repeated contents/body headings may differ in case or whitespace. Different
  // titles for the same numbering are ambiguity, not a majority-vote question.
  return new Set(list.map((heading) => norm(heading.title))).size === 1
    ? list[0]
    : null;
}

export interface SectionExpansion {
  label: string;
  topics: Heading[];
}

/** Resolve every ref under one numbering prefix, or return null (ambiguous/missing). */
export function resolveSectionTopic(
  label: string,
  pages: Array<{ page: number; text: string }>,
): SectionExpansion | null {
  const refs = parseSectionRefs(label);
  if (!refs) return null;
  const hints = stripHints(label).hints.map(norm);
  const perRef = refs.map((ref) => findHeadings(ref, pages));
  const prefixes = new Set(perRef.flatMap((m) => [...m.keys()]));
  const scored = [...prefixes]
    .map((prefix) => {
      const resolved = perRef.map((m) => m.get(prefix));
      const complete = resolved.every((r) => r?.length && consistentHeading(r));
      const hintHits = complete
        ? resolved.filter((r) =>
            hints.some((h) => norm(consistentHeading(r!)!.title).includes(h)),
          ).length
        : 0;
      return { prefix, complete, score: hintHits };
    })
    .filter((s) => s.complete)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  // Two numbering schemes that fit equally well cannot be guessed between.
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  if (hints.length && scored[0].score === 0) return null;
  const prefix = scored[0].prefix;
  return {
    label,
    topics: perRef.map((m) => consistentHeading(m.get(prefix)!)!),
  };
}

/**
 * Replace section-pointer topics in owner-supplied evidence with named,
 * quote-backed headings from the same document. Unresolvable pointers are left
 * untouched so the safety net can ask the student for the right page.
 */
export function expandSectionTopics(
  evidence: ProfileEvidence,
  documents: Array<{
    id: string;
    pages: Array<{ page: number; text: string }>;
  }>,
): ProfileEvidence {
  const e = structuredClone(evidence);
  for (const label of [...e.facts.topics]) {
    if (!isSectionReferenceTopic(label)) continue;
    const claim =
      e.claims.find(
        (c) => c.field === "topics" && norm(label).includes(norm(c.quote)),
      ) ?? e.claims.find((c) => c.field === "topics");
    const doc = e.documents.find(
      (d) =>
        d.authority === "owner_supplied" &&
        d.id === (claim?.documentId ?? d.id),
    );
    const pages = documents.find((d) => d.id === doc?.id)?.pages;
    if (!doc || !pages?.length) continue;
    // Assessment pointers must resolve within the selected qualification/course,
    // not an AS-only section elsewhere in a combined specification. Scoping
    // preserves literal spans; map back to original physical page numbers.
    const ordered = [...pages].sort((a, b) => a.page - b.page);
    const scoped = scopeDocumentQualification(
      ordered.map((page) => page.text),
      e.identity.qualification,
      e.identity.course,
    );
    if (scoped.ambiguous) continue;
    const scopedPages = scoped.fragments.map((fragment) => ({
      page: ordered[fragment.page - 1].page,
      text: fragment.text,
    }));
    const expansion = resolveSectionTopic(label, scopedPages);
    if (!expansion) continue;
    const names = [...new Set(expansion.topics.map((t) => t.title))];
    const newLocations = expansion.topics.filter(
      (t, i, all) => all.findIndex((x) => x.line === t.line) === i,
    );
    if (
      doc.locations.length + newLocations.length > 40 ||
      e.claims.length + names.length > 60 ||
      e.facts.topics.length - 1 + names.length > 80
    )
      continue;
    const ids = new Map<string, string>();
    newLocations.forEach((t, i) => {
      const id = `${doc.id}-topic-${doc.locations.length + i + 1}`.slice(
        0,
        100,
      );
      ids.set(t.line, id);
      doc.locations.push({
        id,
        page: t.page,
        section: "Subject content",
        text: t.line.slice(0, 1000),
      });
    });
    for (const t of expansion.topics)
      if (!e.claims.some((c) => c.field === "topics" && c.quote === t.title))
        e.claims.push({
          field: "topics",
          documentId: doc.id,
          locationId: ids.get(t.line)!,
          quote: t.title.slice(0, 200),
          rule: "mandatory",
        });
    const at = e.facts.topics.indexOf(label);
    e.facts.topics.splice(
      at,
      1,
      ...names.filter((n) => !e.facts.topics.includes(n)),
    );
  }
  return e;
}

export const SECTION_TOPIC_NEED =
  "This paper's topics are listed only as section numbers. Choose the PDF page that names those sections (for example the subject content list), so each topic can be checked.";

const pageSuffix = (s: string) =>
  s
    .replace(/\s*\((?:page|p\.?)\s*\d{1,3}\)\s*$/i, "")
    .replace(/\s*\.{2,}\s*\d{1,3}\s*$/, "")
    .replace(/\s{2,}\d{1,3}\s*$/, "")
    .trim();
const loose = (s: string) =>
  foldSourceText(pageSuffix(s)).replace(/\s*\((?:as and )?a-level only\)\s*$/, "");

/**
 * Find the specification's own numbered heading for a topic name, within the
 * selected qualification. Returns the literal heading line and title, or null.
 */
function findTopicHeading(
  topic: string,
  pages: Array<{ page: number; text: string }>,
): Heading | null {
  const want = loose(topic);
  if (want.length < 3) return null;
  const found: Heading[] = [];
  for (const page of pages)
    for (const rawLine of page.text.split("\n")) {
      const m = rawLine.match(/^\s*\d{1,2}(?:\.\d{1,2}){0,4}\s+(.+?)\s*$/);
      if (!m) continue;
      const title = cleanTitle(pageSuffix(m[1]));
      if (title && loose(title) === want)
        found.push({ title, page: page.page, line: rawLine.trim() });
    }
  // The same heading may appear in contents and body; differing titles are ambiguous.
  return consistentHeading(found);
}

export interface TopicReconciliation {
  evidence: ProfileEvidence;
  replaced: Array<{ from: string; to: string }>;
  dropped: string[];
}

/**
 * Before a reading batch is checked, make every model-proposed topic either
 * literally quote-backed or replace it with the document's own heading. A topic
 * that matches neither is removed and recorded as unresolved; it is never kept
 * without a literal source quote. Operates on unvalidated model evidence.
 */
export function reconcileTopics(
  evidence: ProfileEvidence,
  documents: Array<{ id: string; pages: Array<{ page: number; text: string }> }>,
  scope: {
    qualification: string | null;
    course: string | null;
    maxLocations?: number;
    maxClaims?: number;
  },
): TopicReconciliation {
  const maxLocations = Math.min(40, scope.maxLocations ?? 40),
    maxClaims = Math.min(60, scope.maxClaims ?? 60);
  const e = structuredClone(evidence);
  const replaced: TopicReconciliation["replaced"] = [];
  const dropped: string[] = [];
  const supportText = () =>
    e.claims
      .filter((c) => c.field === "topics")
      .map((c) => {
        const loc = e.documents
          .find((d) => d.id === c.documentId)
          ?.locations.find((l) => l.id === c.locationId);
        // Only quotes that resolve to their cited passage can support a topic.
        if (!loc || !sourceTextIncludes(loc.text, c.quote)) return "";
        return c.rule === "mandatory" ? loc.text : c.quote;
      })
      .join(" \n ");
  const doc = e.documents.find((d) => d.authority === "owner_supplied");
  const raw = documents.find((d) => d.id === doc?.id)?.pages ?? [];
  let pages = raw;
  if (raw.length) {
    const ordered = [...raw].sort((a, b) => a.page - b.page);
    const scoped = scopeDocumentQualification(
      ordered.map((p) => p.text),
      scope.qualification ?? undefined,
      scope.course ?? undefined,
    );
    pages = scoped.ambiguous
      ? []
      : scoped.fragments.map((f) => ({
          page: ordered[f.page - 1].page,
          text: f.text,
        }));
  }
  const next: string[] = [];
  for (const topic of e.facts.topics) {
    if (sourceTextIncludes(supportText(), topic)) {
      next.push(topic);
      continue;
    }
    const heading = doc && pages.length ? findTopicHeading(topic, pages) : null;
    if (
      heading &&
      doc &&
      doc.locations.length < maxLocations &&
      e.claims.length < maxClaims
    ) {
      let loc = doc.locations.find((l) => l.text === heading.line.slice(0, 1000));
      if (!loc) {
        let n = doc.locations.length + 1,
          id = `${doc.id}-heading-${n}`;
        while (doc.locations.some((l) => l.id === id)) id = `${doc.id}-heading-${++n}`;
        loc = {
          id: id.slice(0, 100),
          page: heading.page,
          section: "Subject content",
          text: heading.line.slice(0, 1000),
        };
        doc.locations.push(loc);
      }
      e.claims.push({
        field: "topics",
        documentId: doc.id,
        locationId: loc.id,
        quote: heading.title.slice(0, 200),
        rule: "mandatory",
      });
      if (!next.includes(heading.title)) next.push(heading.title);
      replaced.push({ from: topic, to: heading.title });
      continue;
    }
    dropped.push(topic);
    if (e.unresolved.length < 30)
      e.unresolved.push(
        // Rejected model wording is never echoed back as if it were evidence.
        "A topic proposed while reading was removed because the source text does not name it. Add any missing topic yourself when reviewing the profile.",
      );
  }
  e.facts.topics = next;
  return { evidence: e, replaced, dropped };
}
