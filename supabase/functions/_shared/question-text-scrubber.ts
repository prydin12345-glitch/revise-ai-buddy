/**
 * Question text scrubber for broken diagram references.
 * Edge-function-compatible copy of src/utils/questionTextScrubber.ts
 *
 * NOTE: Verbs covered for chart/table references:
 *   shows, displays, presents, illustrates, depicts, gives
 */

const VERB_GROUP = '(shows?|displays?|presents?|illustrates?|depicts?|gives?)';
const VERB_GROUP_OPT = `\\s*${VERB_GROUP}?`;

const BROKEN_DIAGRAM_PHRASES: RegExp[] = [
  /in the circuit (shown |illustrated |displayed |given )?(below|above|here|opposite)/gi,
  /consider the circuit (shown |illustrated |)?(below|above|opposite)/gi,
  /refer(?:ring)? to the (circuit|network|diagram) (below|above|shown)/gi,
  /from the (circuit|network|diagram) (below|shown|above|given)/gi,
  /as shown in (the )?(circuit|figure|diagram)/gi,
  /using the (circuit|network) (shown|below|above|given|opposite)/gi,
  /the (circuit|network) below (shows|illustrates|has|contains)/gi,
  /shown in figure \d+/gi,
  /figure \d+ (shows|illustrates|below)/gi,
];

const BROKEN_TABLE_CHART_PHRASES: RegExp[] = [
  // Tables
  /the table (below|above|shown|opposite) shows?/i,
  /the following table/i,
  /refer(?:ring)? to the table/i,
  /using the (data in the |information in the )?table/i,
  /from the table (below|above|shown)/i,
  /as shown in the table/i,
  /the table (gives|provides|displays|presents|illustrates|depicts)/i,
  /in the table below/i,
  /data (shown |given |presented )?in the table/i,
  /study the table/i,

  // Bar chart — any verb
  new RegExp(`the (dual |grouped |stacked |compound |composite )?bar (chart|graph) (below|above|shown|opposite)?${VERB_GROUP_OPT}`, 'i'),
  /using the bar chart/i,
  /from the bar chart/i,
  /refer(?:ring)? to the bar chart/i,

  // Pie chart — any verb
  new RegExp(`the pie chart (below|above|shown|opposite)?${VERB_GROUP_OPT}`, 'i'),
  /using the pie chart/i,
  /from the pie chart/i,

  // Line / scatter / column / generic chart/graph — any verb
  new RegExp(`the (line |scatter |column )?(chart|graph) (below|above|shown|opposite)?${VERB_GROUP_OPT}`, 'i'),
  /using the (line )?graph/i,
  /using the (data in the |information in the )?chart/i,
  /from the chart (below|above|shown)/i,
  /refer(?:ring)? to the chart/i,
  /as shown in the chart/i,
  /study the chart/i,

  // Figures
  /figure (below|above|opposite)/i,
  /the figure (below|shown|above)/i,
  /see figure/i,

  // Maps (Geography)
  /the map (below|above|shown|opposite)/i,
  /using the map/i,
  /from the map (below|shown)/i,
  /refer(?:ring)? to the map/i,

  // Climate / climatograph / population pyramid
  /the climate (graph|chart) (below|above|shown)/i,
  /from the climate (graph|chart)/i,
  /using the climate (graph|chart)/i,
  /the climatograph (below|above|shown)/i,
  /the population pyramid (below|above|shown)/i,
  /the (graph|diagram) (below|above|shown|opposite) shows?/i,

  // Cumulative frequency
  /the cumulative frequency (curve|graph|diagram) (below|above|shown)/i,
  /from the cumulative frequency (curve|graph)/i,
  /using the cumulative frequency (curve|graph)/i,

  // Frequency polygon
  /the frequency polygon (below|above|shown)/i,
  /from the frequency polygon/i,
  /using the frequency polygon/i,
];

// Patterns that indicate the question references an EXTERNAL paper insert,
// resource booklet, separate sheet, or figure the student cannot access on
// the platform. Questions matching any of these should be removed entirely
// rather than scrubbed — there is no recovery without the missing resource.
const INSERT_REFERENCE_PATTERNS: RegExp[] = [
  /\bon the insert\b/i,
  /\bthe insert\b/i,
  /\binsert sheet\b/i,
  /\bresource booklet\b/i,
  /\bresource sheet\b/i,
  /\bfig\.?\s*\d+\.\d+\s*on\b/i,
  /\bfigure\s*\d+\.\d+\s*on\b/i,
  /\bsee\s+(the\s+|the\s+attached\s+|attached\s+)?insert\b/i,
  /\brefer\s+to\s+(the\s+)?insert\b/i,
  /\bas shown in the insert\b/i,
  /\bon the separate sheet\b/i,
  /\bon page \d+ of the insert\b/i,
  /\bthe photograph\s+(shown|provided|given)\b/i,
  /\bthe (source|stimulus)\s+(material|sheet)\b/i,
  /\bin\s+(source|extract)\s+\d+\b/i,
];

export const referencesExternalInsert = (questionText: string): boolean => {
  const text = questionText || '';
  return INSERT_REFERENCE_PATTERNS.some(p => p.test(text));
};

const testPattern = (pattern: RegExp, value: string): boolean => {
  const isolatedPattern = new RegExp(pattern.source, pattern.flags);
  return isolatedPattern.test(value);
};

export const hasBrokenDiagramReference = (
  questionText: string,
  diagramConfig: unknown,
  options?: unknown,
): boolean => {
  if (diagramConfig !== null && diagramConfig !== undefined) {
    return false;
  }
  if (
    options !== null &&
    options !== undefined &&
    typeof options === 'object' &&
    !Array.isArray(options) &&
    typeof (options as any).type === 'string'
  ) {
    return false;
  }
  const allPatterns = [...BROKEN_DIAGRAM_PHRASES, ...BROKEN_TABLE_CHART_PHRASES];
  return allPatterns.some(pattern => testPattern(pattern, questionText || ''));
};

export const scrubBrokenDiagramReferences = (questionText: string): string => {
  const cleaned = (questionText || '')
    // Circuit / network / figure
    .replace(/in the circuit (shown |illustrated |displayed |given )?(below|above|here|opposite)/gi, 'in the described circuit')
    .replace(/consider the circuit (shown |illustrated |)?(below|above|opposite)\.?/gi, '')
    .replace(/refer(?:ring)? to the (circuit|network|diagram) (below|above|shown)\.?/gi, '')
    .replace(/from the (circuit|network|diagram) (below|shown|above|given)/gi, 'from the described circuit')
    .replace(/as shown in (the )?(circuit|figure|diagram)/gi, 'as described')
    .replace(/using the (circuit|network) (shown|below|above|given|opposite)/gi, 'using the described circuit')
    .replace(/the (circuit|network) below (shows|illustrates|has|contains)/gi, 'the described $1 $2')
    .replace(/shown in figure \d+/gi, 'as described')
    .replace(/figure \d+ (shows|illustrates|below)/gi, '')

    // Tables — any verb
    .replace(/the table (below|above|shown|opposite) (shows?|displays?|presents?|illustrates?|depicts?|gives?)\s*/gi, 'The following data shows ')
    .replace(/the following table\s*(shows|gives|provides|displays|illustrates|presents)?:?\s*/gi, 'The following data ')
    .replace(/refer(?:ring)? to the table\.?\s*/gi, 'Using the data provided, ')
    .replace(/using the (data in the |information in the )?table\.?\s*/gi, 'Using the data provided, ')
    .replace(/from the table (below|above|shown)\.?\s*/gi, 'From the data provided, ')
    .replace(/as shown in the table\.?\s*/gi, 'As shown in the data below, ')
    .replace(/the table (gives|provides|displays|presents|illustrates|depicts)\s*/gi, 'The data shows ')
    .replace(/in the table below\.?\s*/gi, 'in the data provided ')
    .replace(/study the table (below|above|shown)?\.?\s*/gi, 'Study the following data. ')
    .replace(/data (shown |given |presented )?in the table\.?\s*/gi, 'data provided ')

    // Bar charts — any verb (covers dual/grouped/stacked/compound/composite)
    .replace(/the (dual |grouped |stacked |compound |composite )?bar (chart|graph) (below|above|shown|opposite)?\s*(shows?|displays?|presents?|illustrates?|depicts?|gives?)\s*/gi, 'The data shows ')
    .replace(/using the bar chart\.?\s*/gi, 'Using the data provided, ')
    .replace(/from the bar chart\.?\s*/gi, 'From the data provided, ')
    .replace(/refer(?:ring)? to the bar chart\.?\s*/gi, 'Using the data provided, ')

    // Pie charts — any verb
    .replace(/the pie chart (below|above|shown|opposite)?\s*(shows?|displays?|presents?|illustrates?|depicts?|gives?)\s*/gi, 'The data shows ')
    .replace(/using the pie chart\.?\s*/gi, 'Using the data provided, ')
    .replace(/from the pie chart\.?\s*/gi, 'From the data provided, ')

    // Generic chart/graph — any verb
    .replace(/the (line |scatter |column )?(chart|graph) (below|above|shown|opposite)\s*(shows?|displays?|presents?|illustrates?|depicts?|gives?)\s*/gi, 'The data shows ')
    .replace(/using the (data in the |information in the )?chart\.?\s*/gi, 'Using the data provided, ')
    .replace(/from the chart (below|above|shown)\.?\s*/gi, 'From the data provided, ')
    .replace(/refer(?:ring)? to the chart\.?\s*/gi, 'Using the data provided, ')
    .replace(/as shown in the chart\.?\s*/gi, 'As shown in the data, ')
    .replace(/study the chart (below|above|shown)?\.?\s*/gi, 'Study the following data. ')

    // Figures
    .replace(/figure (below|above|opposite)\.?\s*/gi, 'the data ')
    .replace(/the figure (below|shown|above)\.?\s*/gi, 'the data ')
    .replace(/see figure\.?\s*/gi, '')

    // Maps
    .replace(/the map (below|above|shown|opposite) (shows?|displays?|presents?|illustrates?)\s*/gi, 'The geographic data shows ')
    .replace(/using the map\.?\s*/gi, 'Using the geographic information provided, ')
    .replace(/from the map (below|shown)\.?\s*/gi, 'From the geographic data, ')
    .replace(/refer(?:ring)? to the map\.?\s*/gi, 'Using the geographic data provided, ')

    // Climate / climatograph / population pyramid / generic
    .replace(/the climate (graph|chart|diagram) (below|above|shown) (shows?|displays?|presents?|illustrates?)\s*/gi, 'The climate data shows ')
    .replace(/from the climate (graph|chart)\.?\s*/gi, 'From the climate data, ')
    .replace(/using the climate (graph|chart)\.?\s*/gi, 'Using the climate data, ')
    .replace(/the climatograph (below|above|shown) (shows?|displays?|presents?|illustrates?)\s*/gi, 'The climate data shows ')
    .replace(/the population pyramid (below|above|shown) (shows?|displays?|presents?|illustrates?)\s*/gi, 'The population data shows ')
    .replace(/the (graph|diagram) (below|above|shown|opposite) (shows?|displays?|presents?|illustrates?)\s*/gi, 'The data shows ')

    // Cumulative frequency
    .replace(/the cumulative frequency (curve|graph|diagram) (below|above|shown) (shows?|displays?|presents?|illustrates?)\s*/gi, 'The cumulative frequency data shows ')
    .replace(/from the cumulative frequency (curve|graph)\.?\s*/gi, 'From the cumulative frequency data, ')
    .replace(/using the cumulative frequency (curve|graph)\.?\s*/gi, 'Using the cumulative frequency data, ')

    // Frequency polygon
    .replace(/the frequency polygon (below|above|shown) (shows?|displays?|presents?|illustrates?)\s*/gi, 'The frequency data shows ')
    .replace(/from the frequency polygon\.?\s*/gi, 'From the frequency data, ')
    .replace(/using the frequency polygon\.?\s*/gi, 'Using the frequency data, ')

    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
};
