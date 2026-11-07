/**
 * A bounded, deterministic source index. This is retrieval, not an assertion
 * that a syllabus has been interpreted correctly. The evidence validator must
 * still check the selected facts against the original physical pages.
 *
 * Private page text belongs only in the owned preparation receipt. Only an
 * explicitly reviewed public source pack may enter a shared catalogue.
 */
export const DOCUMENT_INDEX_VERSION = 5;
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
  /** Server-derived codes for unselected options, never client-supplied aliases. */
  excludedComponentCodes?: string[];
  subject?: string;
  course?: string;
  qualification?: string;
  /** Physical source pages selected in a clarification; never a trust grant. */
  sourcePages?: number[];
}
export type SourceQualification = "AS" | "A-level";
export interface QualificationFragment {
  page: number;
  text: string;
  startOffset: number;
  endOffset: number;
  qualification?: SourceQualification;
  qualificationReference?: { page: number; text: string };
  course?: string;
  courseReference?: { page: number; text: string };
}
export interface AssessmentScopeResolution {
  field: "qualification" | "course" | "source";
  question: string;
  choices?: Array<{ value: string; label: string }>;
}
export interface QualificationScope {
  fragments: QualificationFragment[];
  qualifications: SourceQualification[];
  ambiguous: boolean;
  reason?: string;
  resolution?: AssessmentScopeResolution;
  excludedCourses?: string[];
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
  // Subject/board names are presentation, not an allow-list of sciences. A
  // short standalone heading may identify any AS/A-level subject, but prose,
  // comparison columns and component rows must not create section boundaries.
  if (/\b(?:paper|unit|component)\s*\d|[|;]|\b\d+\s*marks?\b/i.test(text))
    return undefined;
  const tail =
    "(?:\\s+[A-Za-z][A-Za-z &'-]{0,80})?(?:\\s*\\([A-Za-z0-9 ,/]+\\))?";
  if (
    text.startsWith("AS") &&
    new RegExp("^AS(?:[- ]level)?" + tail + "$", "i").test(text)
  )
    return "AS";
  if (new RegExp("^A[\\s\\u2010-\\u2015-]*level" + tail + "$", "i").test(text))
    return "A-level";
  return undefined;
}

/**
 * A flattened comparison can put both column headings before either column's
 * paper rows, or qualify each row inline. Neither shape establishes the
 * contiguous section boundaries used below. Keep those rows out of evidence
 * until the caller supplies a qualification-specific overview.
 */
function qualificationAssessmentRows(text: string): Set<SourceQualification> {
  const rows = new Set<SourceQualification>();
  for (const match of text.matchAll(
    /(?:^|[\n|;])\s*(AS(?:[- ]level)?|A[\s\u2010-\u2015-]*level)\s*[:\u2013\u2014|-]?\s+(?=(?:paper|unit|component)\s*\d)/gim,
  )) {
    const raw = match[1];
    if (/^AS(?:[- ]level)?$/.test(raw)) rows.add("AS");
    else if (/^A[\s\u2010-\u2015-]*level$/i.test(raw)) rows.add("A-level");
  }
  return rows;
}

function adjacentQualificationColumns(text: string): boolean {
  const lines = text.split("\n");
  let previous: SourceQualification | undefined;
  let assessmentBetween = false,
    gap = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const heading = qualificationHeading(line);
    if (heading) {
      if (previous && previous !== heading && !assessmentBetween) {
        const rest = lines.slice(index + 1).join("\n");
        if (/\b(?:paper|unit|component)\s*\d+\b/i.test(rest)) return true;
      }
      previous = heading;
      assessmentBetween = false;
      gap = 0;
    } else if (
      /\b(?:paper|unit|component)\s*\d+\b|\b\d+\s*marks?\b/i.test(line)
    )
      assessmentBetween = true;
    else if (++gap > 2 || line.length > 180) previous = undefined;
  }
  return false;
}

function qualificationColumnAnchors(texts: string[]) {
  const unsafe = new Set<string>();
  let previous: { qualification: SourceQualification; key: string } | undefined,
    assessmentBetween = false,
    gap = 0;
  texts.forEach((text, page) =>
    text.split("\n").forEach((line) => {
      const qualification = qualificationHeading(line);
      if (qualification) {
        const key = `${page + 1}:${line.trim()}`;
        if (
          previous &&
          previous.qualification !== qualification &&
          !assessmentBetween
        ) {
          unsafe.add(previous.key);
          unsafe.add(key);
        }
        previous = { qualification, key };
        assessmentBetween = false;
        gap = 0;
      } else if (
        /\b(?:paper|unit|component)\s*\d+\b|\b\d+\s*marks?\b/i.test(line)
      )
        assessmentBetween = true;
      else if (++gap > 2 || line.length > 180) previous = undefined;
    }),
  );
  return unsafe;
}

/**
 * Scopes only explicit qualification headings. Fragments remain contiguous
 * literal spans at their original physical pages, including shared-page
 * AS/A-level sections. Neutral cover/general material stays unqualified.
 */
function scopeQualificationHeadings(
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
  const combinedTitle = texts.some(
    (text) =>
      /\b(?:AS\s*(?:and|&|\/|\|)\s*A[\s\u2010-\u2015-]*level|A[\s\u2010-\u2015-]*level\s*(?:and|&|\/|\|)\s*AS)\b/i.test(
        text,
      ) ||
      /^\s*(?:AS[ \t]+A[ \t\u2010-\u2015-]*level|A[ \t\u2010-\u2015-]*level[ \t]+AS)\s*$/m.test(
        text,
      ),
  );
  let reason: string | undefined;
  if ((qualifications.size > 1 || combinedTitle) && !requested)
    reason = "Choose AS or A-level before using this combined specification.";
  if (requested && qualifications.size && !qualifications.has(requested))
    reason =
      "The source qualification does not match your selected AS or A-level course.";
  if (requested && combinedTitle && !qualifications.has(requested))
    reason =
      "We could not separate the AS and A-level assessment sections. Add the assessment overview for your qualification.";
  if (
    requested &&
    (adjacentQualificationColumns(texts.join("\n")) ||
      fragments.some((fragment) => {
        const rows = qualificationAssessmentRows(fragment.text);
        const expected = fragment.qualification ?? requested;
        return [...rows].some((row) => row !== expected);
      }))
  )
    reason =
      "The source has AS/A-level assessment rows that could not be safely separated. Add the assessment overview for your selected qualification.";
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

const literalComponentCode = /\b([A-Za-z0-9]{3,12})\/\d{1,3}[A-Za-z]{0,2}\b/g;
const assessmentRow =
  /^(?:(?:AS(?:[- ]level)?|A[\s\u2010-\u2015-]*level)\s+)?(?:paper|unit|component)\s*(?:no\.?\s*)?[A-Za-z]?\d|^(?:assessment|examination|exam|test|component|unit)(?:\s+(?:title|name))?\s*[:\u2013\u2014-]/i;
const exactCourseCode = (value?: string) => {
  const text = value?.normalize("NFKC").trim();
  return text && /^[A-Za-z0-9]{3,12}$/.test(text) && /\d/.test(text)
    ? text.toLowerCase()
    : undefined;
};
const inlineQualification = (line: string) => {
  if (/^AS(?:[- ]level)?\s+(?:paper|unit|component)\b/.test(line.trim()))
    return "AS" as const;
  if (
    /^A[\s\u2010-\u2015-]*level\s+(?:paper|unit|component)\b/i.test(line.trim())
  )
    return "A-level" as const;
  return undefined;
};

/** Literal course headings and explicitly coded assessment rows form spans.
 * A selected course code never supplies the meaning of an unlabelled table
 * column: every retained assessment block still needs its own source anchor.
 */
function courseBlocks(texts: string[], requested: string) {
  const fragments: QualificationFragment[] = [],
    courses = new Set<string>();
  let sectionQualification: SourceQualification | undefined,
    sectionReference: { page: number; text: string } | undefined,
    sectionCourse: string | undefined,
    sectionCourseReference: { page: number; text: string } | undefined,
    currentQualification: SourceQualification | undefined,
    currentQualificationReference: { page: number; text: string } | undefined,
    currentCourse: string | undefined,
    currentCourseReference: { page: number; text: string } | undefined,
    ambiguous = false;
  const columnPages = new Set<number>(),
    columnAnchors = qualificationColumnAnchors(texts);
  texts.forEach((text, pageIndex) => {
    const page = pageIndex + 1,
      lines = text.split("\n");
    if (adjacentQualificationColumns(text)) columnPages.add(page);
    let start = 0,
      offset = 0;
    const add = (end: number) => {
      if (end <= start || !text.slice(start, end).trim()) return;
      fragments.push({
        page,
        text: text.slice(start, end),
        startOffset: start,
        endOffset: end,
        ...(currentQualification
          ? {
              qualification: currentQualification,
              qualificationReference: currentQualificationReference,
            }
          : {}),
        ...(currentCourse
          ? { course: currentCourse, courseReference: currentCourseReference }
          : {}),
      });
    };
    lines.forEach((line, index) => {
      const value = line.trim(),
        heading = qualificationHeading(line);
      const headingCode =
        value.match(
          /^(?:course|qualification|specification)\s+code\s*:\s*([A-Za-z0-9]{3,12})\s*$/i,
        )?.[1] ??
        (/^(?:AS(?:[- ]level)?|A[\s\u2010-\u2015-]*level|GCSE|GCE)\b/i.test(
          value,
        )
          ? value.match(/\(([A-Za-z0-9]{3,12})\)\s*$/)?.[1]
          : undefined);
      const courseHeading = exactCourseCode(headingCode);
      const isRow = assessmentRow.test(value),
        codes = new Set<string>();
      if (isRow || /^[A-Za-z0-9]{3,12}\/\d{1,3}[A-Za-z]{0,2}$/.test(value)) {
        for (const match of value.matchAll(literalComponentCode))
          codes.add(match[1].toLowerCase());
        if (!codes.size && isRow)
          for (
            let next = index + 1;
            next <= Math.min(index + 2, lines.length - 1);
            next++
          ) {
            const following = lines[next].trim();
            if (
              !following ||
              assessmentRow.test(following) ||
              qualificationHeading(following)
            )
              break;
            const code = following.match(
              /^(?:(?:paper|unit|component|assessment)\s+code\s*:\s*|\()?([A-Za-z0-9]{3,12})\/\d{1,3}[A-Za-z]{0,2}\)?$/i,
            );
            if (code) {
              codes.add(code[1].toLowerCase());
              break;
            }
          }
      }
      const continuesCodedRow =
        !isRow &&
        !heading &&
        !courseHeading &&
        codes.size === 1 &&
        currentCourse === [...codes][0];
      if (
        heading ||
        courseHeading ||
        isRow ||
        (codes.size && !continuesCodedRow)
      ) {
        add(offset);
        start = offset;
        if (heading || courseHeading) {
          if (heading) {
            sectionQualification = heading;
            sectionReference = { page, text: value };
          } else if (/^(?:GCSE|GCE)\b/i.test(value)) {
            sectionQualification = undefined;
            sectionReference = undefined;
          }
          sectionCourse = courseHeading;
          sectionCourseReference = courseHeading
            ? { page, text: value }
            : undefined;
          if (courseHeading) courses.add(courseHeading);
        }
        if (codes.size > 1) ambiguous = true;
        const inline = inlineQualification(value);
        currentCourse = codes.size === 1 ? [...codes][0] : sectionCourse;
        currentCourseReference =
          codes.size === 1 ? { page, text: value } : sectionCourseReference;
        currentQualification = inline ?? sectionQualification;
        currentQualificationReference = inline
          ? { page, text: value }
          : sectionReference;
        // In a flattened heading row, position is not a qualification anchor.
        // A row's literal course/component code can still settle its identity.
        if (codes.size === 1 && columnPages.has(page) && !inline) {
          currentQualification = undefined;
          currentQualificationReference = undefined;
        }
        for (const code of codes) courses.add(code);
      }
      offset += line.length + 1;
    });
    add(text.length);
  });
  const assessmentFragments = fragments.filter((fragment) =>
    fragment.text
      .split("\n")
      .some(
        (line) =>
          assessmentRow.test(line.trim()) ||
          /^[A-Za-z0-9]{3,12}\/\d{1,3}[A-Za-z]{0,2}\s*$/.test(line.trim()),
      ),
  );
  const unresolved = assessmentFragments.some(
    (fragment) =>
      (!fragment.course &&
        (!fragment.qualification || columnPages.has(fragment.page))) ||
      (columnPages.has(fragment.page) &&
        !fragment.courseReference?.text.match(literalComponentCode)) ||
      (!!fragment.qualificationReference &&
        columnAnchors.has(
          `${fragment.qualificationReference.page}:${fragment.qualificationReference.text}`,
        ) &&
        !fragment.courseReference?.text.match(literalComponentCode)),
  );
  return {
    fragments,
    courses,
    ambiguous: ambiguous || unresolved,
    matched: courses.has(requested),
  };
}

export function scopeDocumentQualification(
  texts: string[],
  qualification?: string,
  course?: string,
  sourcePages?: number[],
): QualificationScope {
  const base = scopeQualificationHeadings(texts, qualification),
    requested = qualificationKey(qualification),
    requestedCourse = exactCourseCode(course);
  let result = base;
  const mixedScience = texts.some((text) =>
    text
      .split("\n")
      .some(
        (line) =>
          line.length <= 180 &&
          /^\s*(?:\d+(?:\.\d+)*[.)]?\s+)?GCSE\b/i.test(line) &&
          /\bcombined\b/i.test(line) &&
          /\b(?:separate|single|triple)\b/i.test(line),
      ),
  );
  if (mixedScience)
    result = {
      ...base,
      ambiguous: true,
      reason:
        "The source combines separate and combined GCSE science assessments without clear course-code headings. Add the matching assessment overview.",
    };
  if (requestedCourse) {
    const scoped = courseBlocks(texts, requestedCourse);
    if (scoped.courses.size) {
      const contradiction = scoped.fragments.some(
        (fragment) =>
          fragment.course === requestedCourse &&
          requested &&
          fragment.qualification &&
          fragment.qualification !== requested,
      );
      const explicitMismatch = !scoped.matched;
      const reason = contradiction
        ? "The selected course code and qualification have conflicting source headings. Add the matching assessment overview."
        : explicitMismatch
          ? "The source course code does not match your selected course. Add its assessment overview or change the course."
          : scoped.ambiguous
            ? (base.reason ??
              "The source contains assessment rows without a clear course or qualification anchor. Add the relevant assessment overview.")
            : undefined;
      result = {
        fragments: scoped.fragments.filter(
          (fragment) =>
            (!fragment.course || fragment.course === requestedCourse) &&
            (!requested ||
              !fragment.qualification ||
              fragment.qualification === requested),
        ),
        qualifications: base.qualifications,
        ambiguous: !!reason,
        ...(reason ? { reason } : {}),
        ...(scoped.matched && scoped.courses.size > 1
          ? {
              excludedCourses: [...scoped.courses].filter(
                (value) => value !== requestedCourse,
              ),
            }
          : {}),
      };
    }
  }
  if (sourcePages) {
    if (
      !sourcePages.length ||
      sourcePages.length > 24 ||
      new Set(sourcePages).size !== sourcePages.length ||
      sourcePages.some(
        (page) => !Number.isInteger(page) || page < 1 || page > texts.length,
      )
    )
      throw Error("Choose between one and 24 valid physical PDF pages.");
    // Selection narrows already-scoped literal spans. It must not remove the
    // other column first and thereby make an unlabelled row appear qualified.
    const columnAnchors = qualificationColumnAnchors(texts),
      selected = new Set(sourcePages),
      fragments = result.fragments.filter((fragment) =>
        selected.has(fragment.page),
      );
    const rows = fragments.filter((fragment) =>
      fragment.text.split("\n").some((line) => assessmentRow.test(line.trim())),
    );
    const safelyAnchored =
      rows.length > 0 &&
      rows.every((fragment) => {
        const anchored =
          (requestedCourse && fragment.course === requestedCourse) ||
          (requested && fragment.qualification === requested);
        if (!anchored) return false;
        if (
          fragment.qualificationReference &&
          columnAnchors.has(
            `${fragment.qualificationReference.page}:${fragment.qualificationReference.text}`,
          ) &&
          !fragment.courseReference?.text.match(literalComponentCode)
        )
          return false;
        const inline = qualificationAssessmentRows(fragment.text);
        if (requested && [...inline].some((value) => value !== requested))
          return false;
        if (
          adjacentQualificationColumns(texts[fragment.page - 1]) &&
          !fragment.courseReference?.text.match(literalComponentCode)
        )
          return false;
        return fragment.text.split("\n").every((line) => {
          if (!assessmentRow.test(line.trim())) return true;
          const codes = [...line.matchAll(literalComponentCode)].map((match) =>
            match[1].toLowerCase(),
          );
          return (
            new Set(codes).size <= 1 &&
            (!requestedCourse ||
              codes.every((code) => code === requestedCourse))
          );
        });
      });
    const reason = safelyAnchored
      ? undefined
      : (result.reason ??
        "The selected pages do not clearly identify your course's assessment overview. Add a focused assessment brief.");
    result = { ...result, fragments, ambiguous: !!reason };
    if (reason) result.reason = reason;
    else delete result.reason;
  }
  if (!result.ambiguous) return result;
  const choices = base.qualifications.map((value) => ({ value, label: value }));
  return {
    ...result,
    resolution:
      !requested && choices.length > 1
        ? {
            field: "qualification",
            question: "Which qualification are you studying?",
            choices,
          }
        : {
            field: "source",
            question:
              "Which PDF page shows the assessment overview for your selected course?",
          },
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
  resolution?: AssessmentScopeResolution;
}

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015_]/g, " ")
    .replace(/\b(paper|unit|component)\s*(\d{1,3}[a-z]?)\b/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Keep CR characters in offsets so every retrieved span remains a literal
// substring of the original page, including text-file CRLF line endings.
const pageLines = (text: string) => text.split("\n");
const componentPattern = /\b(?:paper|unit|component)\s+(\d{1,2}(?:[a-z])?)\b/gi;
const componentCodePattern = /\b[A-Za-z0-9]{3,12}\/\d{1,3}[A-Za-z]{0,2}\b/g;
const topicPattern = /^\s*(?:Topic|Module)\s+(\d{1,2})\b/i;
const rulePattern =
  /^(?:assessment(?:\s+(?:overview|information|objectives|requirements|guidance))?\s*$|(?:appendix\s+\d+\s*[:.\u2013-]\s*)?(?:qualification at a glance|(?:mathematical|maths|practical|experimental)\s+(?:skills|requirements)|command words|mark(?:ing)?\s+scheme(?:\s+conventions)?|(?:total\s+)?marks|duration|time allowed|calculator(?:s|\s+policy)?|answer all questions|all questions are compulsory|tier(?:s|ing)?|(?:this (?:paper|assessment) is )?untiered)\b)/i;
const headingPattern =
  /^\s*(?:[A-Z][A-Z\s\d,/:&()\u2013-]{3,}|(?:\d+(?:\.\d+)*\s+)?(?:Paper|Unit|Component|Topic|Module|Appendix|Assessment|Qualification|Content|Specification|Mathematical|Practical|Command words)\b)/;

const rulePassageBoundary = (line: string) => {
  const text = line.trim();
  return (
    !!qualificationHeading(text) ||
    rulePattern.test(text) ||
    /^(?:\d+(?:\.\d+)*[.)]?\s+)?(?:(?:Paper|Unit|Component|Topic|Module|Appendix)\s*[A-Z]?\d|Section\s+[A-Z0-9]\b)/i.test(
      text,
    ) ||
    /^[A-Za-z0-9]{3,12}\/\d{1,3}[A-Za-z]{0,2}\b/.test(text)
  );
};
const endsRuleSentence = (line: string) =>
  /[.!?;][\s"')\]]*$/.test(line.trim());

/** Keep wrapped rule sentences literal, without an unbounded paragraph read. */
function rulePassageEnd(lines: string[], line: number, after: number) {
  const limit = Math.min(lines.length, line + after + 1 + 12);
  let end = line + 1,
    characters = lines[line].length,
    content = false;
  if (endsRuleSentence(lines[line])) return { end, bounded: false };
  while (end < limit) {
    const next = lines[end].trim();
    if (!next) {
      // A short layout gap after a heading is not the end of its paragraph.
      if (content || end - line > 2) break;
    } else if (rulePassageBoundary(next)) break;
    if (characters + lines[end].length + 1 > 2_000)
      return { end, bounded: true };
    characters += lines[end].length + 1;
    end++;
    if (next) content = true;
    if (endsRuleSentence(next)) return { end, bounded: false };
  }
  return {
    end,
    bounded:
      end === limit &&
      end < lines.length &&
      !!lines[end].trim() &&
      !rulePassageBoundary(lines[end]),
  };
}

function componentsIn(text: string) {
  return [...text.matchAll(componentPattern)].map((match) =>
    normalize(match[0]),
  );
}
function requestedPattern(selection: DocumentSelection) {
  const values = [selection.component, ...(selection.componentAliases ?? [])]
    // Legacy clients wrapped visible paper names in parentheses. Unwrap only
    // a complete numbered identity; arbitrary names/codes are never guessed.
    .map((value) =>
      value
        .normalize("NFKC")
        .replace(
          /^\s*\(\s*((?:paper|unit|component)\s*\d{1,3}[a-z]?)\s*\)\s*$/i,
          "$1",
        ),
    )
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
    for (let offset = 0; offset < page.text.length;) {
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
    scope = scopeDocumentQualification(
      texts,
      selection.qualification,
      selection.course,
      selection.sourcePages,
    ),
    allowed = new Map<number, Array<[number, number]>>();
  for (const fragment of scope.fragments)
    allowed.set(fragment.page, [
      ...(allowed.get(fragment.page) ?? []),
      [fragment.startOffset, fragment.endOffset],
    ]);
  const exactCode = (value: string) => {
    const code = value.normalize("NFKC").trim().toLowerCase();
    return /^[a-z0-9]{3,12}\/\d{1,3}[a-z]{0,2}$/.test(code) ? code : null;
  };
  const positiveCodes = new Set(
    [selection.component, ...(selection.componentAliases ?? [])]
      .map(exactCode)
      .filter((code): code is string => code !== null),
  );
  const excludedCodes = new Set(
    (selection.excludedComponentCodes ?? [])
      .map(exactCode)
      .filter((code): code is string => code !== null),
  );
  const excludedOptionPages = new Set<number>();
  let optionAmbiguity: string | undefined;
  if (excludedCodes.size)
    for (const page of pages) {
      const text = (allowed.get(page.page) ?? [])
        .map(([start, end]) => page.text.slice(start, end))
        .join("\n");
      const codes = new Set(
        [...text.matchAll(componentCodePattern)].map((match) =>
          match[0].toLowerCase(),
        ),
      );
      if (![...codes].some((code) => excludedCodes.has(code))) continue;
      if ([...codes].some((code) => positiveCodes.has(code)))
        optionAmbiguity ??=
          "The source lists selected and unselected optional sections on the same page. Add an overview for your selected option so their assessment rules can be separated.";
      else {
        excludedOptionPages.add(page.page);
        allowed.delete(page.page);
      }
    }
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
  let reason = scope.reason ?? optionAmbiguity;
  const addPage = (page: SourceDocumentPage) =>
    selected.set(page.page, [...(allowed.get(page.page) ?? [])]);
  const addWindow = (
    page: SourceDocumentPage,
    line: number,
    before = 1,
    after = 5,
    continueRule = false,
  ) => {
    const lines = pageLines(page.text),
      start = Math.max(0, line - before),
      passage = continueRule ? rulePassageEnd(lines, line, after) : null,
      end = passage?.end ?? Math.min(lines.length, line + after + 1),
      startOffset = lines
        .slice(0, start)
        .reduce((n, value) => n + value.length + 1, 0),
      endOffset = Math.min(
        page.text.length,
        lines.slice(0, end).reduce((n, value) => n + value.length + 1, 0),
      );
    if (passage?.bounded) {
      const warning =
        "An assessment-rule passage exceeds the bounded context window. Use only fully supported facts or add a focused assessment brief.";
      if (!warnings.includes(warning)) warnings.push(warning);
    }
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
  if (!matches.length && excludedOptionPages.size)
    reason ??=
      "The source shows a different optional topic. Add the assessment overview or brief for the option you selected.";
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
        pageComponents = componentsIn(page.text),
        codedComponents = [...page.text.matchAll(componentCodePattern)];
      if (
        (pageComponents.length || codedComponents.length) &&
        !requested.test(normalize(page.text))
      )
        continue;
      lines.forEach((line, index) => {
        if (rulePattern.test(line.trim())) addWindow(page, index, 1, 5, true);
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
    ...(scope.resolution ? { resolution: scope.resolution } : {}),
  };
}
