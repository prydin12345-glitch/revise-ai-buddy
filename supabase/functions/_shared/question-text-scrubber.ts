/**
 * Question text scrubber for broken diagram references.
 * Edge-function-compatible copy of src/utils/questionTextScrubber.ts
 */

const BROKEN_DIAGRAM_PHRASES = [
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

const BROKEN_TABLE_CHART_PHRASES = [
  /the table (below|above|shown|opposite) shows?/i,
  /the following table/i,
  /refer(?:ring)? to the table/i,
  /using the (data in the |information in the )?table/i,
  /from the table (below|above|shown)/i,
  /as shown in the table/i,
  /the table (gives|provides|displays|presents)/i,
  /in the table below/i,
  /data (shown |given |presented )?in the table/i,
  /study the table/i,
  /the bar chart (below|above|shown|opposite)/i,
  /the bar chart shows?/i,
  /using the bar chart/i,
  /from the bar chart/i,
  /refer(?:ring)? to the bar chart/i,
  /the pie chart (below|above|shown|opposite)/i,
  /the pie chart shows?/i,
  /using the pie chart/i,
  /from the pie chart/i,
  /the (line )?graph (below|above|shown|opposite) shows?/i,
  /using the (line )?graph/i,
  /the chart (below|above|shown|opposite)/i,
  /the chart shows?/i,
  /using the (data in the |information in the )?chart/i,
  /from the chart (below|above|shown)/i,
  /refer(?:ring)? to the chart/i,
  /as shown in the chart/i,
  /study the chart/i,
  /figure (below|above|opposite)/i,
  /the figure (below|shown|above)/i,
  /see figure/i,
  /the map (below|above|shown|opposite)/i,
  /using the map/i,
  /from the map (below|shown)/i,
  /refer(?:ring)? to the map/i,
  /the climate (graph|chart) (below|above|shown)/i,
  /from the climate (graph|chart)/i,
  /using the climate (graph|chart)/i,
  /the climatograph (below|above|shown)/i,
  /the population pyramid (below|above|shown)/i,
  /the (graph|diagram) (below|above|shown|opposite) shows?/i,
  /the cumulative frequency (curve|graph|diagram) (below|above|shown)/i,
  /from the cumulative frequency (curve|graph)/i,
  /using the cumulative frequency (curve|graph)/i,
  /the frequency polygon (below|above|shown)/i,
  /from the frequency polygon/i,
  /using the frequency polygon/i,
];

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
    .replace(/in the circuit (shown |illustrated |displayed |given )?(below|above|here|opposite)/gi, 'in the described circuit')
    .replace(/consider the circuit (shown |illustrated |)?(below|above|opposite)\.?/gi, '')
    .replace(/refer(?:ring)? to the (circuit|network|diagram) (below|above|shown)\.?/gi, '')
    .replace(/from the (circuit|network|diagram) (below|shown|above|given)/gi, 'from the described circuit')
    .replace(/as shown in (the )?(circuit|figure|diagram)/gi, 'as described')
    .replace(/using the (circuit|network) (shown|below|above|given|opposite)/gi, 'using the described circuit')
    .replace(/the (circuit|network) below (shows|illustrates|has|contains)/gi, 'the described $1 $2')
    .replace(/shown in figure \d+/gi, 'as described')
    .replace(/figure \d+ (shows|illustrates|below)/gi, '')
    .replace(/the table (below|above|shown|opposite) shows?\s*/gi, 'The following data shows ')
    .replace(/the following table\s*(shows|gives|provides|displays)?:?\s*/gi, 'The following data ')
    .replace(/refer(?:ring)? to the table\.?\s*/gi, 'Using the data provided, ')
    .replace(/using the (data in the |information in the )?table\.?\s*/gi, 'Using the data provided, ')
    .replace(/from the table (below|above|shown)\.?\s*/gi, 'From the data provided, ')
    .replace(/as shown in the table\.?\s*/gi, 'As shown in the data below, ')
    .replace(/the table (gives|provides|displays|presents)\s*/gi, 'The data shows ')
    .replace(/in the table below\.?\s*/gi, 'in the data provided ')
    .replace(/study the table (below|above|shown)?\.?\s*/gi, 'Study the following data. ')
    .replace(/data (shown |given |presented )?in the table\.?\s*/gi, 'data provided ')
    .replace(/the bar chart (below|above|shown|opposite) shows?\s*/gi, 'The data shows ')
    .replace(/using the bar chart\.?\s*/gi, 'Using the data provided, ')
    .replace(/from the bar chart\.?\s*/gi, 'From the data provided, ')
    .replace(/refer(?:ring)? to the bar chart\.?\s*/gi, 'Using the data provided, ')
    .replace(/the pie chart (below|above|shown|opposite) shows?\s*/gi, 'The data shows ')
    .replace(/using the pie chart\.?\s*/gi, 'Using the data provided, ')
    .replace(/from the pie chart\.?\s*/gi, 'From the data provided, ')
    .replace(/the chart (below|above|shown|opposite) shows?\s*/gi, 'The data shows ')
    .replace(/using the (data in the |information in the )?chart\.?\s*/gi, 'Using the data provided, ')
    .replace(/from the chart (below|above|shown)\.?\s*/gi, 'From the data provided, ')
    .replace(/refer(?:ring)? to the chart\.?\s*/gi, 'Using the data provided, ')
    .replace(/as shown in the chart\.?\s*/gi, 'As shown in the data, ')
    .replace(/study the chart (below|above|shown)?\.?\s*/gi, 'Study the following data. ')
    .replace(/figure (below|above|opposite)\.?\s*/gi, 'the data ')
    .replace(/the figure (below|shown|above)\.?\s*/gi, 'the data ')
    .replace(/see figure\.?\s*/gi, '')
    .replace(/the map (below|above|shown|opposite) shows?\s*/gi, 'The geographic data shows ')
    .replace(/using the map\.?\s*/gi, 'Using the geographic information provided, ')
    .replace(/from the map (below|shown)\.?\s*/gi, 'From the geographic data, ')
    .replace(/refer(?:ring)? to the map\.?\s*/gi, 'Using the geographic data provided, ')
    .replace(/the climate (graph|chart|diagram) (below|above|shown) shows?\s*/gi, 'The climate data shows ')
    .replace(/from the climate (graph|chart)\.?\s*/gi, 'From the climate data, ')
    .replace(/using the climate (graph|chart)\.?\s*/gi, 'Using the climate data, ')
    .replace(/the climatograph (below|above|shown) shows?\s*/gi, 'The climate data shows ')
    .replace(/the population pyramid (below|above|shown) shows?\s*/gi, 'The population data shows ')
    .replace(/the (graph|diagram) (below|above|shown|opposite) shows?\s*/gi, 'The data shows ')
    .replace(/the cumulative frequency (curve|graph|diagram) (below|above|shown) shows?\s*/gi, 'The cumulative frequency data shows ')
    .replace(/from the cumulative frequency (curve|graph)\.?\s*/gi, 'From the cumulative frequency data, ')
    .replace(/using the cumulative frequency (curve|graph)\.?\s*/gi, 'Using the cumulative frequency data, ')
    .replace(/the frequency polygon (below|above|shown) shows?\s*/gi, 'The frequency data shows ')
    .replace(/from the frequency polygon\.?\s*/gi, 'From the frequency data, ')
    .replace(/using the frequency polygon\.?\s*/gi, 'Using the frequency data, ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
};
