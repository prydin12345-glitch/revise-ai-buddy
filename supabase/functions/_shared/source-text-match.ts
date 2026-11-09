/**
 * Punctuation-tolerant literal matching for source quotes.
 *
 * PDF text and model copies of it differ in typography, never in wording:
 * ligatures, curly vs straight quotes, dash variants, soft hyphens and words
 * hyphenated across a line break. These are folded on both sides. Letters,
 * digits and word order must still match exactly.
 */
export function foldSourceText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/[\u2018\u2019\u201a\u201b\u2032\u0060\u00b4]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212\ufe58\ufe63\uff0d]/g, "-")
    .toLowerCase()
    .replace(/\s+/g, " ")
    // "A- level", "A -level" and "A - level" are layout, not wording.
    .replace(/([a-z]) ?- ?([a-z])/g, "$1-$2")
    .trim();
}

/** Only a physical line break can establish that a hyphen is a PDF word wrap. */
function joinWrappedWords(text: string) {
  return text.replace(
    /(\p{L})[-\u2010-\u2015\u2212\ufe58\ufe63\uff0d][\t ]*\r?\n[\t ]*(\p{L})/gu,
    "$1$2",
  );
}

/** True when `needle` appears literally in `haystack`, up to typography only. */
export function sourceTextIncludes(haystack: string, needle: string): boolean {
  const passages = [haystack, joinWrappedWords(haystack)].map(foldSourceText);
  const quotes = [needle, joinWrappedWords(needle)].map(foldSourceText);
  // Keep both forms so a copied quote may retain a genuine line-wrap hyphen.
  // Never remove an ordinary lexical hyphen: "re-sign" and "resign" differ.
  return passages.some((passage) => quotes.some((quote) => passage.includes(quote)));
}
