import { foldSourceText, sourceTextIncludes } from "./source-text-match.ts";

type SourceResponseFormat = "mcq_single" | "short_answer" | "long_form";

// Keep line wraps within a sentence, but separate assessment bullets and
// clauses so teaching guidance or a prohibition cannot become a format fact.
const clauses = (text: string) =>
  text.match(/[^.!?;●•]+[.!?;]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
const teaching =
  /\b(?:teach(?:er|ers|ing)?|taught|learn(?:ing)?|lessons?|classroom|homework|revision|practi[cs]e|practising|practicing|sample answers?)\b/i;
const negative =
  /\b(?:no|not|never|without|neither|nor|cannot|can't|won't|isn't|aren't|doesn't|don't|shouldn't|zero|exclud(?:e|es|ed|ing)|prohibit(?:ed)?|forbidden|unassessed|unnecessary|removed|replaced|except)\b|\b(?:instead of|rather than)\b/i;
const unsupportedContext = (text: string) => {
  const s = foldSourceText(text);
  return teaching.test(s) || negative.test(s);
};

function contextualClauses(text: string) {
  let heading = "";
  return clauses(text).map((clause) => {
    // Carry literal headings over bullets, e.g. "Teaching activities:\n• Essay
    // questions" or "This paper does not include:\n• Short-answer questions".
    const headings = [...clause.matchAll(/(?:^|\n)[ \t]*([^\n.!?;●•]{1,120}:)[ \t]*(?=\r?\n|$)/g)];
    if (headings.length) heading = headings[headings.length - 1][1];
    return { text: clause, context: `${heading} ${clause}` };
  });
}

function classify(clause: string): SourceResponseFormat[] {
  const formats: SourceResponseFormat[] = [];
  const s = foldSourceText(clause);
  if (/\b(?:multiple[ -]+choice|mcqs?|single[ -]+select)\b/.test(s))
    formats.push("mcq_single");
  const short =
    /\bshort[ -]+(?:and[ -]+long[ -]+)?(?:structured[ -]+)?(?:answers?|responses?|open(?:[ -]+(?:answers?|responses?))?)\b|\bstructured[ -]+(?:questions?|answers?|responses?)\b|\bcalculations?\b/;
  const stimulusQuestion =
    /\b(?:data[ -]+response|source[ -]+based|case[ -]+study)[ -]+questions?\b|\bquestions?[ -]+(?:based[ -]+on|using)[ -]+(?:a[ -]+)?(?:sources?|case[ -]+stud(?:y|ies))\b/;
  const multipart =
    /\bmulti[ -]?part\b|\b(?:(?:broken[ -]+down|divided|split)[ -]+into|with|compris(?:e|es|ing)|contain(?:s|ing)?)[ -]+(?:(?:a[ -]+number[ -]+of|several|multiple|two|three|four|five|six|\d+)[ -]+)?(?:parts|sub[ -]?questions)\b/;
  if (short.test(s) || (stimulusQuestion.test(s) && multipart.test(s)))
    formats.push("short_answer");
  if (
    /\b(?:extended[ -]+(?:(?:open[ -]+)?responses?|answers?|writing|essays?|questions?)|essays?|long[ -]+(?:form|answers?|responses?)|open[ -]+responses?)\b/.test(s)
  )
    formats.push("long_form");
  return formats;
}

/**
 * The quote must itself name the format (and multipart structure for stimulus
 * questions). Check its enclosing source clause too: quoting "essay questions"
 * from "No essay questions" must never turn that prohibition into evidence.
 * A section heading can exclude teaching material, never establish a format.
 */
export function sourceResponseFormats(
  quote: string,
  locationText = quote,
  section = "",
): SourceResponseFormat[] {
  if (unsupportedContext(section)) return [];
  const sourceClauses = contextualClauses(locationText);
  const formats = new Set<SourceResponseFormat>();
  for (const clause of clauses(quote)) {
    if (unsupportedContext(clause)) continue;
    const contexts = sourceClauses.filter((s) => sourceTextIncludes(s.text, clause));
    if (
      !contexts.length ||
      contexts.some((s) => unsupportedContext(s.context))
    )
      continue;
    for (const format of classify(clause)) formats.add(format);
  }
  return [...formats];
}

/** Recover complete literal clauses; never cut off a qualifier at 200 chars. */
export function sourceResponseFormatQuotes(text: string, section = "") {
  return clauses(text).flatMap((clause) => {
    const quote = clause.replace(/\s+/g, " ").trim();
    if (quote.length > 200) return [];
    const formats = sourceResponseFormats(quote, text, section);
    return formats.length ? [{ quote, formats }] : [];
  });
}
