import { canonical, checksum } from "./profile-template.ts";
import {
  INDEXED_DOCUMENT_LIMITS,
  scopeDocumentQualification,
  type AssessmentScopeResolution,
} from "./profile-document-index.ts";

export const ASSESSMENT_DISCOVERY_VERSION = 2;
export type SourceAssessmentKind =
  "paper" | "unit" | "component" | "assessment";
export interface AssessmentDiscoveryDocument {
  id: string;
  checksum: string;
  /** Text from each physical PDF page, in its original order. */
  pages: string[];
}
export interface AssessmentSourceReference {
  documentId: string;
  checksum: string;
  page: number;
  /** A literal excerpt, never a model-generated title or citation. */
  quote: string;
}
export interface DiscoveredAssessment {
  id: string;
  label: string;
  componentCode?: string;
  kind: SourceAssessmentKind;
  qualification?: string;
  aliases: string[];
  references: AssessmentSourceReference[];
}
export interface AssessmentDiscoveryScope {
  qualification?: string;
  course?: string;
  organisation?: string;
  subject?: string;
  sourcePages?: number[];
}
export interface AssessmentDiscoveryResult {
  version: typeof ASSESSMENT_DISCOVERY_VERSION;
  candidates: DiscoveredAssessment[];
  warnings: string[];
  needsManualEntry: boolean;
  /** The source exposes conflicting labels/codes that must not be guessed. */
  ambiguous: boolean;
  resolution?: AssessmentScopeResolution;
}

/** Presentation aliases only: no fuzzy matching between different assessments. */
export function normaliseAssessmentAlias(value: string): string {
  return value
    .trim()
    .replace(/^[\s([\{]+|[\s)\]\}]+$/g, "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\b(paper|unit|component)\s*(\d)/g, "$1 $2")
    .replace(/\s+/g, " ");
}

const explicitComponentCode = /\b([A-Za-z0-9]{3,12}\/\d{1,3}[A-Za-z]{0,2})\b/;
const numberedHeading =
  /^(?:(?:\d+(?:\.\d+)*[.)]?)\s+)?(paper|unit|component)\s*(?:no\.?\s*)?([A-Za-z]?\d{1,3}[A-Za-z]{0,2})(?=$|\s|[:(\u2013\u2014-])\s*(.*)$/i;
const labelledAssessment =
  /^(assessment|examination|exam|test|component|unit)(?:\s+(?:title|name))?\s*[:\u2013\u2014-]\s*(.+)$/i;
const namedAssessment =
  /^(?:(?:final|mid[ -]?term|end.of.(?:term|course|year|module)|semester\s+\d+)\s+(?:assessment|examination|exam|test)|(?:oral|practical|written)\s+(?:examination|assessment)|practical endorsement|coursework|independent (?:investigation|research)|research investigation)\b/i;
const metadataLine =
  /^(?:what(?:'|\u2019)?s assessed|how (?:it(?:'|\u2019)?s|this is) assessed|assessment (?:overview|objectives|structure|information|criteria)|qualification at a glance|subject content|topics?|modules?|section\s|total\s|marks?\b|duration\b|time\b|calculator\b|answer\b|all questions\b|questions?\b|instructions?\b|first (?:teaching|assessment)|version\b|issue\b|page\b|contents?\b|\d+\s*(?:marks?|minutes?|hours?)\b)/i;
const instructionLine =
  /\b(?:ignore (?:all|previous|the)|system prompt|act as|return (?:json|only)|assistant:|award (?:a |the )?(?:star|approval))\b/i;
const assessmentContext =
  /\b(?:assessment (?:overview|structure|information)|qualification at a glance|written (?:exam|examination)|time allowed|\d+\s*marks|\d+\s*(?:minutes|hours))\b/i;
const genericNamedHeading =
  /^[\p{L}][\p{L}\p{N}\s,&'\u2019/()\u2013\u2014-]{2,140}$/u;

interface FoundAssessment {
  kind: SourceAssessmentKind;
  label: string;
  componentCode?: string;
  base?: string;
  qualification?: string;
  references: AssessmentSourceReference[];
}
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const titleCaseKind = (kind: string) =>
  kind[0].toUpperCase() + kind.slice(1).toLowerCase();
const literalReference = (
  document: AssessmentDiscoveryDocument,
  page: number,
  text: string,
): AssessmentSourceReference => ({
  documentId: document.id,
  checksum: document.checksum,
  page,
  quote: text.trim(),
});

function codeNear(
  lines: string[],
  index: number,
): { code?: string; line?: string } {
  const current = lines[index].match(explicitComponentCode);
  if (current) return { code: current[1], line: lines[index] };
  for (let offset = 1; offset <= 2; offset++) {
    const line = lines[index + offset]?.trim();
    if (!line || numberedHeading.test(line) || labelledAssessment.test(line))
      break;
    const code = line.match(
      /^(?:(?:paper|unit|component|assessment)\s+code\s*:\s*|\()?([A-Za-z0-9]{3,12}\/\d{1,3}[A-Za-z]{0,2})\)?$/i,
    );
    if (code) return { code: code[1], line: lines[index + offset] };
  }
  const previous = lines[index - 1]?.trim();
  const previousCode = previous?.match(
    /^(?:(?:paper|unit|component|assessment)\s+code\s*:\s*|\()?([A-Za-z0-9]{3,12}\/\d{1,3}[A-Za-z]{0,2})\)?$/i,
  );
  if (previousCode) return { code: previousCode[1], line: lines[index - 1] };
  return {};
}

function cleanHeadingTail(tail: string): string {
  const withoutCode = tail
    .replace(explicitComponentCode, "")
    .replace(/\(\s*\)/g, "");
  const label = clean(
    withoutCode.replace(/^[\s:(\u2013\u2014-]+|[\s)\u2013\u2014-]+$/g, ""),
  );
  if (!label || metadataLine.test(label)) return "";
  // Flattened weighting tables contain "Paper 1  Paper 2" column headers
  // and "Paper 1  85  x1  85" rows. These are not alternative paper titles.
  if (numberedHeading.test(label) || /^\d+(?:[.,]\d+)?(?:\s|$)/.test(label))
    return "";
  // Sentences referring to a paper are not dropdown options.
  if (
    /^(?:and|or|is|are|will|may|must|can|should|includes?|covers?|assesses?|requires?|contains?|consists?|has|uses?|contributes?|accounts?|examines?|tests?)\b/i.test(
      label,
    )
  )
    return "";
  if (
    /[.!?]/.test(label) ||
    instructionLine.test(label) ||
    /^(?:please|complete|write|describe|explain|read|use|submit|ensure)\b/i.test(
      label,
    )
  )
    return "";
  return label.length <= 140 ? label : "";
}

function followingTitle(lines: string[], index: number): string {
  const next = lines[index + 1]?.trim() ?? "";
  if (
    !next ||
    numberedHeading.test(next) ||
    labelledAssessment.test(next) ||
    metadataLine.test(next) ||
    namedAssessment.test(next)
  )
    return "";
  if (
    explicitComponentCode.test(next) ||
    !genericNamedHeading.test(next) ||
    instructionLine.test(next)
  )
    return "";
  // A neighbouring paragraph cannot silently become an assessment name.
  if (
    next.split(/\s+/).length > 12 ||
    /\b(?:students?|learners?|candidates?|you|they|this|these|must|should|will|may|can)\b/i.test(
      next,
    )
  )
    return "";
  return clean(next);
}

function collectPage(
  document: AssessmentDiscoveryDocument,
  page: number,
  text: string,
): FoundAssessment[] {
  const lines = text.split(/\n/),
    found: FoundAssessment[] = [];
  for (let index = 0; index < lines.length; index++) {
    const original = lines[index].trim(),
      line = clean(original);
    if (!line || line.length > 240 || instructionLine.test(line)) continue;
    const numbered = line.match(numberedHeading);
    const near = codeNear(lines, index);
    if (numbered) {
      const kind = numbered[1].toLowerCase() as SourceAssessmentKind;
      const base = `${titleCaseKind(kind)} ${numbered[2]}`;
      const rawTail = numbered[3];
      const tail = cleanHeadingTail(rawTail);
      // Bare headings are useful; running references such as "Paper 1 is..."
      // and optional instructions such as "Paper 1 or Paper 2" are not.
      if (
        rawTail &&
        !tail &&
        !explicitComponentCode.test(rawTail) &&
        !/^[\s:(\u2013\u2014-]*(?:what(?:'|\u2019)?s assessed|how it(?:'|\u2019)?s assessed)/i.test(
          rawTail,
        )
      )
        continue;
      const extraTitle = tail || (!rawTail ? followingTitle(lines, index) : "");
      const references = [literalReference(document, page, original)];
      if (extraTitle && !tail)
        references.push(literalReference(document, page, lines[index + 1]));
      if (near.line && near.line.trim() !== original)
        references.push(literalReference(document, page, near.line));
      found.push({
        kind,
        base,
        label: extraTitle ? `${base} — ${extraTitle}` : base,
        ...(near.code ? { componentCode: near.code } : {}),
        references,
      });
      continue;
    }
    const labelled = line.match(labelledAssessment);
    if (labelled) {
      const name = cleanHeadingTail(labelled[2]);
      if (!name || name.length > 180) continue;
      const references = [literalReference(document, page, original)];
      if (near.line && near.line.trim() !== original)
        references.push(literalReference(document, page, near.line));
      const kind = /^(?:component|unit)$/i.test(labelled[1])
        ? (labelled[1].toLowerCase() as SourceAssessmentKind)
        : "assessment";
      found.push({
        kind,
        label: name,
        ...(near.code ? { componentCode: near.code } : {}),
        references,
      });
      continue;
    }
    const named = line.match(namedAssessment);
    const context = lines.slice(Math.max(0, index - 3), index + 5).join("\n");
    if (named) {
      const rawTail = line.slice(named[0].length);
      const tail = cleanHeadingTail(rawTail);
      if (
        rawTail.trim() &&
        !tail &&
        !explicitComponentCode.test(rawTail) &&
        !metadataLine.test(rawTail.replace(/^[\s:(\u2013\u2014-]+/, ""))
      )
        continue;
      const name = tail ? `${clean(named[0])} — ${tail}` : clean(named[0]);
      const references = [literalReference(document, page, original)];
      if (near.line && near.line.trim() !== original)
        references.push(literalReference(document, page, near.line));
      found.push({
        kind: "assessment",
        label: name,
        ...(near.code ? { componentCode: near.code } : {}),
        references,
      });
      continue;
    }
    // Named components without "Paper" must have a literal component code or
    // explicit assessment context, rather than merely being a topic heading.
    const name = cleanHeadingTail(line);
    const nameWithoutCode = clean(
      line.replace(explicitComponentCode, "").replace(/\(\s*\)/g, ""),
    );
    const knownNamedAssessment =
      /^(?:breadth (?:in|of)|depth (?:in|of)|unified)\s+[\p{L}\s]+$/iu.test(
        nameWithoutCode,
      );
    if (
      (!near.code &&
        !(knownNamedAssessment && assessmentContext.test(context))) ||
      !name ||
      !genericNamedHeading.test(name) ||
      metadataLine.test(name)
    )
      continue;
    const references = [literalReference(document, page, original)];
    if (near.line && near.line.trim() !== original)
      references.push(literalReference(document, page, near.line));
    found.push({
      kind: "component",
      label: name,
      ...(near.code ? { componentCode: near.code } : {}),
      references,
    });
  }
  return found;
}

function mergeReferences(
  target: AssessmentSourceReference[],
  additions: AssessmentSourceReference[],
) {
  for (const reference of additions)
    if (
      !target.some((existing) => canonical(existing) === canonical(reference))
    )
      target.push(reference);
  target.sort(
    (a, b) =>
      a.checksum.localeCompare(b.checksum) ||
      a.page - b.page ||
      a.quote.localeCompare(b.quote),
  );
  // Repeated running headers can appear hundreds of times. These are citations
  // for dropdown identity only; no assessment rules are truncated here.
  target.splice(8);
}

/**
 * Extracts choices from source text only. It neither verifies course identity
 * nor awards approval; callers bind the result to an owned request receipt and
 * still validate the chosen assessment before any draft or saved profile.
 */
export async function discoverSourceAssessments(
  documents: AssessmentDiscoveryDocument[],
  scope: AssessmentDiscoveryScope = {},
): Promise<AssessmentDiscoveryResult> {
  if (!documents.length || documents.length > 3)
    throw Error("Choose between one and three readable assessment sources.");
  const seen = new Set<string>();
  for (const document of documents) {
    if (
      !document.id ||
      document.id.length > 120 ||
      seen.has(document.id) ||
      !/^[a-f0-9]{64}$/.test(document.checksum)
    )
      throw Error("Invalid or duplicate source document.");
    seen.add(document.id);
    if (
      !document.pages.length ||
      document.pages.length > INDEXED_DOCUMENT_LIMITS.maxPages ||
      document.pages.some((page) => typeof page !== "string") ||
      document.pages.reduce((sum, page) => sum + page.length, 0) >
        INDEXED_DOCUMENT_LIMITS.maxCharacters
    )
      throw Error("The source exceeds the supported reading limits.");
  }
  const warnings: string[] = [];
  let qualificationAmbiguity = false;
  let resolution: AssessmentScopeResolution | undefined;
  const found = documents
    .flatMap((document) => {
      const scoped = scopeDocumentQualification(
        document.pages,
        scope.qualification,
        scope.course,
        scope.sourcePages,
      );
      if (scoped.excludedCourses?.length)
        warnings.push(
          "Some source components belong to a different course code and were not offered for this selection.",
        );
      if (scoped.ambiguous) {
        qualificationAmbiguity = true;
        resolution ??= scoped.resolution;
        if (scoped.reason) warnings.push(scoped.reason);
        // A known qualification must not receive choices from an unpartitioned
        // AS/A-level comparison table. The student can supply its assessment brief.
        if (scope.qualification?.trim()) return [];
      }
      return scoped.fragments.flatMap((fragment) =>
        collectPage(document, fragment.page, fragment.text).map(
          (assessment) => {
            if (fragment.qualification)
              assessment.qualification = fragment.qualification;
            if (fragment.qualificationReference)
              mergeReferences(assessment.references, [
                literalReference(
                  document,
                  fragment.qualificationReference.page,
                  fragment.qualificationReference.text,
                ),
              ]);
            if (fragment.courseReference)
              mergeReferences(assessment.references, [
                literalReference(
                  document,
                  fragment.courseReference.page,
                  fragment.courseReference.text,
                ),
              ]);
            return assessment;
          },
        ),
      );
    })
    .filter((assessment) => {
      const course = scope.course?.trim();
      // Compare only an explicit supplied code, not a guessed qualification name.
      if (
        !course ||
        !/^[A-Za-z0-9]{3,12}$/.test(course) ||
        !/\d/.test(course) ||
        !assessment.componentCode
      )
        return true;
      const matches =
        assessment.componentCode.split("/")[0].toLowerCase() ===
        course.toLowerCase();
      if (!matches)
        warnings.push(
          "Some source components belong to a different course code and were not offered for this selection.",
        );
      return matches;
    });
  const groups = new Map<string, FoundAssessment>();
  for (const assessment of found) {
    const key = canonical({
      label: normaliseAssessmentAlias(assessment.label),
      code: assessment.componentCode?.toLowerCase() ?? "",
      kind: assessment.kind,
      qualification: assessment.qualification ?? "",
    });
    const existing = groups.get(key);
    if (existing) mergeReferences(existing.references, assessment.references);
    else {
      const item = { ...assessment, references: [] };
      mergeReferences(item.references, assessment.references);
      groups.set(key, item);
    }
  }
  const values = [...groups.values()];
  for (const item of values) {
    if (!item.base || item.label !== item.base || !item.componentCode) continue;
    const named = values.filter(
      (other) =>
        !other.base &&
        other.kind === "component" &&
        other.qualification === item.qualification &&
        other.componentCode?.toLowerCase() ===
          item.componentCode?.toLowerCase(),
    );
    if (named.length === 1) {
      item.label = `${item.base} — ${named[0].label}`;
      mergeReferences(item.references, named[0].references);
    }
  }
  // A short contents entry and its detailed heading refer to one option when
  // there is exactly one supported detailed/code-bearing identity for that base.
  const collapsed = values.filter((item) => {
    if (!item.base && item.componentCode) {
      const numbered = values.find(
        (other) =>
          other.base &&
          other.qualification === item.qualification &&
          other.componentCode?.toLowerCase() ===
            item.componentCode?.toLowerCase() &&
          normaliseAssessmentAlias(other.label).endsWith(
            `- ${normaliseAssessmentAlias(item.label)}`,
          ),
      );
      if (numbered) {
        mergeReferences(numbered.references, item.references);
        return false;
      }
    }
    if (!item.base || item.label !== item.base || item.componentCode)
      return true;
    const detailed = values.filter(
      (other) =>
        other !== item &&
        other.base === item.base &&
        (!item.qualification || other.qualification === item.qualification) &&
        (other.label !== other.base || other.componentCode),
    );
    if (detailed.length === 1) {
      mergeReferences(detailed[0].references, item.references);
      return false;
    }
    return true;
  });
  const ambiguity = new Map<string, Set<string>>();
  for (const assessment of collapsed) {
    const alias = normaliseAssessmentAlias(assessment.base ?? assessment.label);
    const keys = ambiguity.get(alias) ?? new Set<string>();
    keys.add(
      `${assessment.qualification ?? ""}:${assessment.componentCode?.toLowerCase() ?? ""}:${normaliseAssessmentAlias(assessment.label)}`,
    );
    ambiguity.set(alias, keys);
  }
  const ambiguous =
    qualificationAmbiguity ||
    [...ambiguity.values()].some((keys) => keys.size > 1);
  if (ambiguous)
    warnings.push(
      "The sources list more than one version or component for the same assessment name. Check the matching course and source before choosing.",
    );
  if (ambiguous && !resolution)
    resolution = {
      field: "source",
      question:
        "Which PDF page shows the assessment overview for your selected course?",
    };
  if (collapsed.length > 50)
    return {
      version: ASSESSMENT_DISCOVERY_VERSION,
      candidates: [],
      warnings: [
        "The sources contain too many assessment choices to identify safely. Use the assessment overview or enter its exact name for checking.",
      ],
      needsManualEntry: true,
      ambiguous: true,
    };
  const candidates = await Promise.all(
    collapsed.map(async (assessment) => {
      const identity = {
        kind: assessment.kind,
        label: normaliseAssessmentAlias(assessment.label),
        code: assessment.componentCode?.toLowerCase() ?? "",
        qualification: assessment.qualification ?? "",
        sources: [
          ...new Set(
            assessment.references.map((reference) => reference.checksum),
          ),
        ].sort(),
      };
      return {
        id: `source-assessment-${(await checksum(canonical(identity))).slice(0, 24)}`,
        label: assessment.label,
        ...(assessment.componentCode
          ? { componentCode: assessment.componentCode }
          : {}),
        kind: assessment.kind,
        ...(assessment.qualification
          ? { qualification: assessment.qualification }
          : {}),
        aliases: [
          ...new Set([
            assessment.label,
            ...(assessment.base ? [assessment.base] : []),
            ...(assessment.componentCode ? [assessment.componentCode] : []),
          ]),
        ],
        references: assessment.references,
      };
    }),
  );
  if (!candidates.length)
    warnings.push(
      "We could not find a clear assessment heading in these sources. Enter the exact assessment name from your brief so it can be checked.",
    );
  return {
    version: ASSESSMENT_DISCOVERY_VERSION,
    candidates,
    warnings: [...new Set(warnings)],
    needsManualEntry: !candidates.length,
    ambiguous,
    ...(resolution ? { resolution } : {}),
  };
}
