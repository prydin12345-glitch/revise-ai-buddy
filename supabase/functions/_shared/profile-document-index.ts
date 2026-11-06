/**
 * A bounded, deterministic source index. This is retrieval, not an assertion
 * that a syllabus has been interpreted correctly. The evidence validator must
 * still check the selected facts against the original physical pages.
 *
 * Private page text belongs only in the owned preparation receipt. Only an
 * explicitly reviewed public source pack may enter a shared catalogue.
 */
export const DOCUMENT_INDEX_VERSION = 2;
export const INDEXED_DOCUMENT_LIMITS = {
  maxBytes: 3_000_000,
  maxPages: 240,
  maxCharacters: 600_000,
  maxChunkCharacters: 18_000,
  maxChunks: 2,
} as const;

export interface SourceDocumentPage {
  /** One-based physical PDF page, never the printed page label. */
  page: number;
  text: string;
  headings: string[];
  printedPage?: number;
}
export interface SourceDocumentChunk {
  id: string;
  pages: Array<{ page: number; text: string }>;
  characterCount: number;
}
export interface DocumentSelection {
  component: string;
  componentAliases?: string[];
  subject?: string;
  course?: string;
  qualification?: string;
}
export type SourceQualification = "AS" | "A-level";
export interface QualificationFragment {
  page: number;
  text: string;
  startOffset: number;
  endOffset: number;
  qualification?: SourceQualification;
  qualificationReference?: { page: number; text: string };
}
export interface QualificationScope {
  fragments: QualificationFragment[];
  qualifications: SourceQualification[];
  ambiguous: boolean;
  reason?: string;
}

const qualificationKey = (value?: string): SourceQualification | undefined => {
  const key = value
    ?.trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-");
  if (key && /^(?:a[ -]?level|advanced level)$/.test(key)) return "A-level";
  if (key && /^(?:as|as[ -]?level)$/.test(key)) return "AS";
  return undefined;
};
function qualificationHeading(line: string): SourceQualification | undefined {
  const text = line.trim().replace(/^\d+(?:\.\d+)*[.)]?\s*/, "");
  // Mentions in prose, combined titles, and "A-level only" content annotations
  // do not establish a section boundary. AS is intentionally uppercase: the
  // chemical symbol As or the ordinary word "as" is not a qualification.
  if (
    text.length > 120 ||
    /\b(?:and|only|students?|candidates?|will|should|must)\b/i.test(text)
  )
    return undefined;
  const tail =
    "(?:\\s+(?:assessment(?:s| overview)?|qualification|specification|physics|chemistry|biology))?(?:\\s*\\([A-Za-z0-9 ,/]+\\))?";
  if (new RegExp("^AS(?:[- ]level)?" + tail + "$", "").test(text)) return "AS";
  if (new RegExp("^A[\\s\\u2010-\\u2015-]*level" + tail + "$", "i").test(text))
    return "A-level";
  return undefined;
}

/**
 * Scopes only explicit qualification headings. Fragments remain contiguous
 * literal spans at their original physical pages, including shared-page
 * AS/A-level sections. Neutral cover/general material stays unqualified.
 */
export function scopeDocumentQualification(
  texts: string[],
  qualification?: string,
): QualificationScope {
  const requested = qualificationKey(qualification),
    fragments: QualificationFragment[] = [],
    qualifications = new Set<SourceQualification>();
  let current: SourceQualification | undefined,
    reference: { page: number; text: string } | undefined;
  texts.forEach((text, pageIndex) => {
    const lines = text.split("\n");
    let start = 0,
      offset = 0;
    const add = (end: number) => {
      if (end <= start || !text.slice(start, end).trim()) return;
      fragments.push({
        page: pageIndex + 1,
        text: text.slice(start, end),
        startOffset: start,
        endOffset: end,
        ...(current
          ? { qualification: current, qualificationReference: reference }
          : {}),
      });
    };
    lines.forEach((line) => {
      const heading = qualificationHeading(line);
      if (heading) {
        add(offset);
        start = offset;
        current = heading;
        reference = { page: pageIndex + 1, text: line.trim() };
        qualifications.add(heading);
      }
      offset += line.length + 1;
    });
    add(text.length);
  });
  const combinedTitle = texts.some((text) =>
    /\bAS\s+(?:and|&|\/)\s+A[\s\u2010-\u2015-]*level\b/i.test(text),
  );
  let reason: string | undefined;
  if (qualifications.size > 1 && !requested)
    reason = "Choose AS or A-level before using this combined specification.";
  if (requested && qualifications.size && !qualifications.has(requested))
    reason =
      "The source qualification does not match your selected AS or A-level course.";
  if (requested && combinedTitle && !qualifications.has(requested))
    reason =
      "We could not separate the AS and A-level assessment sections. Add the assessment overview for your qualification.";
  // An unscoped comparison can contain two Paper 1 totals. Keep it visibly
  // ambiguous instead of assigning its marks to whichever course was chosen.
  if (
    requested &&
    (qualifications.size > 1 || combinedTitle) &&
    fragments.some(
      (fragment) =>
        !fragment.qualification &&
        /\b(?:paper|unit|component)\s*\d+\b/i.test(fragment.text) &&
        /\b(?:\d+\s*marks?|marks?\s*[:\u2013-]?\s*\d+)\b/i.test(fragment.text),
    )
  )
    reason ??=
      "The source combines AS and A-level assessment rules without a clear qualification heading. Add the relevant assessment overview.";
  return {
    fragments: requested
      ? fragments.filter(
          (fragment) =>
            !fragment.qualification || fragment.qualification === requested,
        )
      : fragments,
    qualifications: [...qualifications],
    ambiguous: !!reason,
    ...(reason ? { reason } : {}),
  };
}
export interface SourceDocumentIndex {
  version: typeof DOCUMENT_INDEX_VERSION;
  pages: SourceDocumentPage[];
  chunks: SourceDocumentChunk[];
  selectedPages: number[];
  omittedPages: number[];
  coverage: { complete: boolean; reason?: string };
  warnings: string[];
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u2010-\u2015_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Keep CR characters in offsets so every retrieved span remains a literal
// substring of the original page, including text-file CRLF line endings.
const pageLines = (text: string) => text.split("\n");
const componentPattern = /\b(?:paper|unit|component)\s+(\d{1,2}(?:[a-z])?)\b/gi;
const topicPattern = /^\s*(?:Topic|Module)\s+(\d{1,2})\b/i;
const rulePattern =
  /^(?:assessment(?:\s+(?:overview|information|objectives|requirements|guidance))?\s*$|(?:appendix\s+\d+\s*[:.\u2013-]\s*)?(?:qualification at a glance|(?:mathematical|maths|practical|experimental)\s+(?:skills|requirements)|command words|mark(?:ing)?\s+scheme(?:\s+conventions)?|(?:total\s+)?marks|duration|time allowed|calculator(?:s|\s+policy)?|answer all questions|all questions are compulsory|tier(?:s|ing)?|(?:this (?:paper|assessment) is )?untiered)\b)/i;
const headingPattern =
  /^\s*(?:[A-Z][A-Z\s\d,/:&()\u2013-]{3,}|(?:\d+(?:\.\d+)*\s+)?(?:Paper|Unit|Component|Topic|Module|Appendix|Assessment|Qualification|Content|Specification|Mathematical|Practical|Command words)\b)/;

function componentsIn(text: string) {
  return [...text.matchAll(componentPattern)].map((match) =>
    normalize(match[0]),
  );
}
function requestedPattern(selection: DocumentSelection) {
  const values = [selection.component, ...(selection.componentAliases ?? [])]
    .map(normalize)
    .filter(Boolean);
  if (!values.length) throw Error("Choose the paper or assessment first.");
  return new RegExp(
    "(?:^|[^a-z0-9])(?:" +
      [...new Set(values)].map((value) => escape(value)).join("|") +
      ")(?:$|[^a-z0-9])",
    "i",
  );
}

/** Physical page numbers stay stable even when the document has a long preface. */
function makePages(texts: string[]): SourceDocumentPage[] {
  if (!texts.length || texts.length > INDEXED_DOCUMENT_LIMITS.maxPages)
    throw Error("A readable source must contain between 1 and 240 pages.");
  let characters = 0;
  const pages = texts.map((text, index) => {
    if (typeof text !== "string") throw Error("Invalid extracted page text.");
    characters += text.length;
    if (characters > INDEXED_DOCUMENT_LIMITS.maxCharacters)
      throw Error("The source exceeds the indexed text limit.");
    const lines = pageLines(text),
      last = [...lines].reverse().find((line) => line.trim());
    return {
      page: index + 1,
      text,
      headings: lines
        .filter(
          (line) => line.trim().length <= 220 && headingPattern.test(line),
        )
        .map((line) => line.trim()),
      ...(last && /^\s*\d{1,3}\s*$/.test(last)
        ? { printedPage: Number(last.trim()) }
        : {}),
    };
  });
  if (!pages.some((page) => page.text.trim()))
    throw Error(
      "The source has no readable text. Upload a text-based syllabus.",
    );
  return pages;
}

function topicsIn(text: string) {
  const result = new Set<number>();
  for (const match of text.matchAll(
    /\b(?:topics?|modules?)\s+(\d{1,2})\s*(?:to|through|[\u2013\u2014-])\s*(\d{1,2})\b/gi,
  )) {
    const first = Number(match[1]),
      last = Number(match[2]);
    if (first <= last && last - first < 40)
      for (let n = first; n <= last; n++) result.add(n);
  }
  for (const match of text.matchAll(
    /\b(?:topics?|modules?)\s+((?:\d{1,2}\s*(?:,|and|&)\s*)+\d{1,2})\b/gi,
  ))
    for (const number of match[1].match(/\d{1,2}/g) ?? [])
      result.add(Number(number));
  for (const match of text.matchAll(/\b(?:topics?|modules?)\s+(\d{1,2})\b/gi))
    result.add(Number(match[1]));
  return result;
}

function packPages(pages: Array<{ page: number; text: string }>) {
  const chunks: SourceDocumentChunk[] = [];
  let chunk: SourceDocumentChunk = {
    id: "chunk_1",
    pages: [],
    characterCount: 0,
  };
  for (const page of pages) {
    // An unusually dense single page is split at character boundaries. Every
    // piece retains its physical page and must validate against that full page.
    for (let offset = 0; offset < page.text.length; ) {
      if (chunk.characterCount === INDEXED_DOCUMENT_LIMITS.maxChunkCharacters) {
        chunks.push(chunk);
        chunk = {
          id: "chunk_" + (chunks.length + 1),
          pages: [],
          characterCount: 0,
        };
      }
      const text = page.text.slice(
        offset,
        offset +
          INDEXED_DOCUMENT_LIMITS.maxChunkCharacters -
          chunk.characterCount,
      );
      chunk.pages.push({ page: page.page, text });
      chunk.characterCount += text.length;
      offset += text.length;
    }
  }
  if (chunk.pages.length) chunks.push(chunk);
  return chunks;
}

/**
 * Read every page before selecting evidence. Short briefs are retained whole.
 * Large specifications use matched component pages, component topic headings,
 * shared assessment rules and explicit page cross-references. A failed match,
 * unresolved reference or overflow is returned as incomplete; no budget-based
 * truncation turns an incomplete source into a generation-ready one.
 */
export function indexDocumentPages(
  texts: string[],
  selection: DocumentSelection,
): SourceDocumentIndex {
  const pages = makePages(texts),
    scope = scopeDocumentQualification(texts, selection.qualification),
    allowed = new Map<number, Array<[number, number]>>();
  for (const fragment of scope.fragments)
    allowed.set(fragment.page, [
      ...(allowed.get(fragment.page) ?? []),
      [fragment.startOffset, fragment.endOffset],
    ]);
  // Masking is used only to locate candidate lines. Retrieval below always
  // slices the original page at allowed offsets, so no invented whitespace or
  // AS-only text can enter a supplied evidence excerpt.
  const scanPages = pages.map((page) => {
    let offset = 0,
      text = "";
    for (const [start, end] of allowed.get(page.page) ?? []) {
      text += page.text.slice(offset, start).replace(/[^\r\n]/g, " ");
      text += page.text.slice(start, end);
      offset = end;
    }
    text += page.text.slice(offset).replace(/[^\r\n]/g, " ");
    return { ...page, text };
  });
  const requested = requestedPattern(selection),
    total = pages.reduce((sum, page) => sum + page.text.length, 0),
    matches = scanPages.filter((page) => requested.test(normalize(page.text))),
    allComponents = new Set(
      scanPages.flatMap((page) => componentsIn(page.text)),
    ),
    selected = new Map<number, Array<[number, number]>>(),
    warnings: string[] = [];
  let reason = scope.reason;
  const addPage = (page: SourceDocumentPage) =>
    selected.set(page.page, [...(allowed.get(page.page) ?? [])]);
  const addWindow = (
    page: SourceDocumentPage,
    line: number,
    before = 1,
    after = 5,
  ) => {
    const lines = pageLines(page.text),
      start = Math.max(0, line - before),
      end = Math.min(lines.length, line + after + 1),
      startOffset = lines
        .slice(0, start)
        .reduce((n, value) => n + value.length + 1, 0),
      endOffset = Math.min(
        page.text.length,
        lines.slice(0, end).reduce((n, value) => n + value.length + 1, 0),
      );
    selected.set(page.page, [
      ...(selected.get(page.page) ?? []),
      ...(allowed.get(page.page) ?? [])
        .map(
          ([start, end]) =>
            [Math.max(start, startOffset), Math.min(end, endOffset)] as [
              number,
              number,
            ],
        )
        .filter(([start, end]) => end > start),
    ]);
  };
  const snippets = (page: SourceDocumentPage) => {
    const intervals = [...(selected.get(page.page) ?? [])].sort(
      (a, b) => a[0] - b[0],
    );
    const merged: Array<[number, number]> = [];
    for (const interval of intervals) {
      const last = merged[merged.length - 1];
      if (last && interval[0] <= last[1])
        last[1] = Math.max(last[1], interval[1]);
      else merged.push([...interval]);
    }
    return merged.map(([start, end]) => ({
      page: page.page,
      text: page.text.slice(start, end),
    }));
  };
  const small =
    total <=
    INDEXED_DOCUMENT_LIMITS.maxChunkCharacters *
      INDEXED_DOCUMENT_LIMITS.maxChunks;
  if (!matches.length && allComponents.size)
    reason ??= "Choose which paper this specification should follow.";
  if (small) {
    for (const page of scanPages) if (page.text.trim()) addPage(page);
  } else {
    if (!matches.length)
      reason ??=
        "We could not locate this assessment in the specification. Check the paper name or provide its assessment brief.";
    const topicNumbers = new Set<number>();
    for (const page of matches) {
      if (new Set(componentsIn(page.text)).size <= 1) {
        addPage(page);
        for (const topic of topicsIn(page.text)) topicNumbers.add(topic);
      } else {
        // A comparison/contents page can describe several papers. Retrieve
        // the matching row with context, without treating the other rows'
        // topic ranges as this paper's scope.
        pageLines(page.text).forEach((line, index) => {
          if (requested.test(normalize(line))) addWindow(page, index, 1, 5);
        });
      }
    }
    // Identity/edition information usually appears on the first readable cover.
    const first = scanPages.find((page) => page.text.trim());
    if (first) addPage(first);
    for (const page of scanPages) {
      const lines = pageLines(page.text),
        pageComponents = componentsIn(page.text);
      if (pageComponents.length && !requested.test(normalize(page.text)))
        continue;
      lines.forEach((line, index) => {
        if (rulePattern.test(line.trim())) addWindow(page, index);
        const topic = line.match(topicPattern);
        if (topic && topicNumbers.has(Number(topic[1])))
          addWindow(page, index, 0, 1);
      });
    }
    if (topicNumbers.size) {
      const foundTopics = new Set(
        scanPages.flatMap((page) =>
          pageLines(page.text).flatMap((line) => {
            const match = line.match(topicPattern);
            return match ? [Number(match[1])] : [];
          }),
        ),
      );
      if ([...topicNumbers].some((topic) => !foundTopics.has(topic)))
        reason ??=
          "The paper refers to topic sections that could not be located. Add the assessment content pages.";
    }
    warnings.push(
      "The index retrieves assessment rules and topic headings. Detailed syllabus outcomes remain in the owned source and are not treated as a complete verified curriculum.",
    );
  }

  // Printed page labels can differ from physical pages. Use an unambiguous
  // label mapping when one exists, otherwise an explicit physical page number.
  const printed = new Map<number, number[]>();
  for (const page of pages)
    if (page.printedPage !== undefined)
      printed.set(page.printedPage, [
        ...(printed.get(page.printedPage) ?? []),
        page.page,
      ]);
  const visited = new Set<number>();
  for (const number of selected.keys()) {
    if (visited.has(number)) continue;
    visited.add(number);
    const page = pages[number - 1];
    for (const match of snippets(page).flatMap((snippet) => [
      ...snippet.text.matchAll(
        /\b(?:see|refer to|shown on|given on)\s+(?:pages?|pp?\.?)\s*(\d{1,3})(?:\s*(?:to|[\u2013\u2014-])\s*(\d{1,3}))?/gi,
      ),
    ])) {
      const first = Number(match[1]),
        last = Number(match[2] ?? match[1]);
      if (first > last || last - first > 20) {
        reason ??= "A referenced page range could not be resolved.";
        continue;
      }
      for (let referenced = first; referenced <= last; referenced++) {
        const mapped = printed.get(referenced),
          target = printed.size ? mapped?.[0] : referenced;
        if (
          (mapped?.length === 1 ||
            (!printed.size &&
              target &&
              target >= 1 &&
              target <= pages.length)) &&
          allowed.get(target!)?.length
        )
          addPage(pages[target! - 1]);
        else
          reason ??=
            "A referenced assessment page could not be located. Add the referenced assessment brief.";
      }
    }
  }
  const selectedPages = [...selected.keys()].sort((a, b) => a - b),
    selectedText = selectedPages.flatMap((page) => snippets(pages[page - 1])),
    chunks = packPages(selectedText);
  if (chunks.length > INDEXED_DOCUMENT_LIMITS.maxChunks)
    reason ??=
      "The assessment evidence is larger than one bounded build can analyse. Add a component-specific assessment brief or use a reviewed source.";
  if (!chunks.length)
    reason ??= "No assessment evidence could be located in this source.";
  return {
    version: DOCUMENT_INDEX_VERSION,
    pages,
    chunks: reason ? [] : chunks,
    selectedPages,
    omittedPages: pages
      .filter((page) => !selected.has(page.page))
      .map((page) => page.page),
    coverage: reason ? { complete: false, reason } : { complete: true },
    warnings,
  };
}
