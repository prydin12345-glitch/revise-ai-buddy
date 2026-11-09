/** Edition comparisons use explicit issue identifiers, not teaching or exam dates. */
export interface SpecificationIssue {
  family: "version" | "issue" | "edition";
  identifier: string;
}
export function specificationIssue(value: string): SpecificationIssue | null {
  const text = value.normalize("NFKC").trim().toLowerCase().replace(/_/g, " ");
  const labelled = text.match(
    /^(version|v|issue|edition)\s*[:=-]?\s*(\d+(?:\.\d+)*)(?=$|\b|[-–—])/,
  );
  if (labelled)
    return {
      family:
        labelled[1] === "v"
          ? "version"
          : (labelled[1] as SpecificationIssue["family"]),
      identifier: labelled[2],
    };
  const bare = text.match(/^(\d+\.\d+(?:\.\d+)*)(?=$|\b|[-–—])/);
  return bare ? { family: "version", identifier: bare[1] } : null;
}
const disagrees = (
  a: SpecificationIssue | null,
  b: SpecificationIssue | null,
) => !!a && !!b && a.family === b.family && a.identifier !== b.identifier;
export class SourceSpecificationVersionConflict extends Error {}

export interface SourceCoverSpecificationIssue {
  /** Exact source line, including any date, rather than a catalogue label. */
  value: string;
  page: number;
  issue: SpecificationIssue;
}

/** Metadata cannot claim one explicit specification issue under another identity. */
export function assertSourceSpecificationIssues(
  selected: string,
  documents: Array<{
    kind: string;
    authority: string;
    state: string;
    version: string;
  }>,
): void {
  const requested = specificationIssue(selected);
  if (!requested) return;
  for (const document of documents) {
    if (
      document.kind !== "specification" ||
      document.authority !== "owner_supplied" ||
      document.state !== "active"
    )
      continue;
    if (disagrees(requested, specificationIssue(document.version)))
      throw new SourceSpecificationVersionConflict(
        `The uploaded specification issue (${document.version}) differs from the selected profile issue (${selected}). Use the matching specification or rebuild the profile from its actual edition.`,
      );
  }
}

/**
 * The first explicit issue line on the first five physical pages is a cover
 * declaration. Later change-history rows do not replace it. No dates or model
 * metadata are treated as proof of a different issue.
 */
export function coverSpecificationIssue(
  pages: Array<{ page: number; text: string }>,
): SourceCoverSpecificationIssue | null {
  const cover = pages
    .filter((page) => page.page <= 5)
    .map((page) => page.text)
    .join("\n");
  // A question booklet can mention the course specification while carrying
  // its own print-version number. An explicit cover role keeps those two
  // editions distinct; later sample-paper pages cannot redefine a spec cover.
  const firstPage = [...pages].sort((a, b) => a.page - b.page)[0]?.text ?? "";
  if (
    /^\s*(?:question\s+(?:paper|booklet)|sample\s+question\s+paper)\s*$/im.test(
      firstPage,
    )
  )
    return null;
  if (!/\b(?:specification|syllabus)\b/i.test(cover)) return null;
  for (const page of [...pages]
    .sort((a, b) => a.page - b.page)
    .filter((p) => p.page <= 5)) {
    for (const line of page.text.split("\n")) {
      const literal = line.trim();
      if (
        literal.length > 120 ||
        !/^(?:(?:specification|spec)\s+)?(?:version|issue|edition)\s*[:=-]?\s*\d/i.test(
          literal,
        )
      )
        continue;
      const issue = specificationIssue(
        literal.replace(/^(?:specification|spec)\s+/i, ""),
      );
      if (!issue) continue;
      return {
        value: literal.replace(/^(?:specification|spec)\s+/i, ""),
        page: page.page,
        issue,
      };
    }
  }
  return null;
}

export function coverSpecificationIssueConflict(
  selected: string,
  pages: Array<{ page: number; text: string }>,
): string | null {
  const cover = coverSpecificationIssue(pages);
  return cover && disagrees(specificationIssue(selected), cover.issue)
    ? `The PDF states ${cover.value}, but this profile selects ${selected}. Add the matching specification or rebuild from the PDF's actual edition.`
    : null;
}
