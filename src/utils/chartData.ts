// Shared helper for resolving chart data for a question.
//
// Background: chart payloads were originally written into the `options` column,
// which collides with MCQ answer choices. New writes go into `diagram_config`
// instead, while existing rows keep chart payloads on `options`. This helper
// returns whichever source contains a recognised chart payload (diagram_config
// takes priority), without altering the underlying records.

const CHART_TYPES = new Set([
  'bar_chart',
  'pie_chart',
  'data_table',
  'climate_chart',
  'cumulative_frequency',
  'frequency_polygon',
  'histogram',
  'boxplot',
  'boxplot_comparison',
]);

export const isChartDataPayload = (data: any): boolean => {
  return !!data && typeof data === 'object' && !Array.isArray(data) && CHART_TYPES.has(data?.type);
};

export const getChartData = (question: any): any => {
  if (!question) return null;

  // Priority 1 — diagram_config (new location for chart data).
  const dc = question.diagram_config;
  if (isChartDataPayload(dc)) return dc;

  // Priority 2 — options (legacy location, still common for existing data).
  const opts = question.options;
  if (isChartDataPayload(opts)) return opts;

  return null;
};

// Pull the optional correct_chart_data payload (used by draw/construct questions
// to display the model chart in the review page after marking).
export const getCorrectChartData = (question: any): any => {
  const dc = question?.diagram_config;
  if (dc && typeof dc === 'object') {
    const cc = (dc as any).correct_chart_data;
    if (isChartDataPayload(cc)) return cc;
  }
  return null;
};
