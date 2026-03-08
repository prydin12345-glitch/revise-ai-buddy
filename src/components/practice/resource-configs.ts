export interface ResourceFieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface ResourceConfig {
  label: string;
  sourceTypeLabel: string;
  sourceTypes: ResourceFieldOption[];
  themeLabel: string;
  themePlaceholder: string;
  themeHelperText: string;
  showLength: boolean;
  lengthOptions?: ResourceFieldOption[];
  showLineNumbering?: boolean;
  extraFields?: {
    key: string;
    label: string;
    type: 'select' | 'toggle';
    options?: ResourceFieldOption[];
    defaultValue?: string;
  }[];
}

const englishLanguageConfig: ResourceConfig = {
  label: 'English Language Insert',
  sourceTypeLabel: 'Source Type',
  sourceTypes: [
    { value: '21st_century_fiction', label: '21st century prose fiction' },
    { value: '19th_century_fiction', label: '19th century prose fiction' },
    { value: 'literary_nonfiction', label: 'Literary non-fiction' },
    { value: 'travel_writing', label: 'Travel writing' },
    { value: 'newspaper_article', label: 'Newspaper / magazine article' },
    { value: 'autobiography', label: 'Autobiography or memoir' },
    { value: 'descriptive_writing', label: 'Descriptive writing' },
  ],
  themeLabel: 'Theme or Scenario',
  themePlaceholder: 'e.g. "isolation and memory" or "a teacher discovering something unexpected"',
  themeHelperText: 'Describe a mood, character, or situation — the AI will build an original story around it',
  showLength: true,
  lengthOptions: [
    { value: 'short', label: 'Short extract (~300 words, lines 1–30)' },
    { value: 'medium', label: 'Medium extract (~500 words, lines 1–50)' },
    { value: 'long', label: 'Full insert (~800 words, lines 1–80)' },
  ],
  showLineNumbering: true,
};

const englishLiteratureConfig: ResourceConfig = {
  label: 'English Literature Extract',
  sourceTypeLabel: 'Extract Type',
  sourceTypes: [
    { value: 'prose_extract', label: 'Prose fiction extract' },
    { value: 'poem', label: 'Poem or verse' },
    { value: 'drama_extract', label: 'Play / drama extract' },
    { value: 'speech', label: 'Speech or monologue' },
  ],
  themeLabel: 'Theme or Focus',
  themePlaceholder: 'e.g. "guilt and responsibility" or "social class division"',
  themeHelperText: 'The central theme the extract should explore for close reading',
  showLength: true,
  lengthOptions: [
    { value: 'short', label: 'Short extract (~200 words)' },
    { value: 'medium', label: 'Medium extract (~400 words)' },
    { value: 'long', label: 'Full extract (~600 words)' },
  ],
  showLineNumbering: true,
};

const geographyConfig: ResourceConfig = {
  label: 'Geography Resource Pack',
  sourceTypeLabel: 'Source Type',
  sourceTypes: [
    { value: 'news_article', label: 'News article' },
    { value: 'academic_extract', label: 'Academic extract' },
    { value: 'statistical_report', label: 'Statistical report' },
    { value: 'case_study', label: 'Case study' },
    { value: 'data_table', label: 'Data table' },
  ],
  themeLabel: 'Case Study Focus',
  themePlaceholder: 'e.g. "coastal erosion at Holderness" or "urbanisation in Lagos"',
  themeHelperText: 'The place, process, or phenomenon the resources should focus on',
  showLength: false,
  extraFields: [
    {
      key: 'dataTableStyle',
      label: 'Data Table Style',
      type: 'select',
      options: [
        { value: 'simple', label: 'Simple 2-column' },
        { value: 'complex', label: 'Complex multi-column' },
        { value: 'percentage_change', label: 'Percentage change table' },
      ],
      defaultValue: 'simple',
    },
    {
      key: 'resourceCount',
      label: 'Number of Resources',
      type: 'select',
      options: [
        { value: '1', label: '1 resource' },
        { value: '2', label: '2 resources' },
        { value: '3', label: '3 resources' },
      ],
      defaultValue: '2',
    },
  ],
};

const historyConfig: ResourceConfig = {
  label: 'History Source Pack',
  sourceTypeLabel: 'Source Type',
  sourceTypes: [
    { value: 'primary_source', label: 'Primary source extract' },
    { value: 'historian_interpretation', label: "Historian's interpretation" },
    { value: 'government_document', label: 'Government document' },
    { value: 'letter_diary', label: 'Letter or diary entry' },
    { value: 'speech', label: 'Speech or address' },
  ],
  themeLabel: 'Historical Focus',
  themePlaceholder: 'e.g. "causes of WWI" or "the impact of the Reformation"',
  themeHelperText: 'The event, period, or debate the sources should relate to',
  showLength: false,
  extraFields: [
    {
      key: 'timePeriod',
      label: 'Time Period',
      type: 'select',
      options: [
        { value: 'medieval', label: 'Medieval' },
        { value: 'early_modern', label: 'Early Modern' },
        { value: 'industrial', label: 'Industrial' },
        { value: '20th_century', label: '20th Century' },
        { value: 'cold_war', label: 'Cold War' },
      ],
      defaultValue: '20th_century',
    },
    {
      key: 'resourceCount',
      label: 'Number of Sources',
      type: 'select',
      options: [
        { value: '1', label: '1 source' },
        { value: '2', label: '2 sources' },
        { value: '3', label: '3 sources' },
      ],
      defaultValue: '2',
    },
  ],
};

const businessConfig: ResourceConfig = {
  label: 'Business Resource Pack',
  sourceTypeLabel: 'Source Type',
  sourceTypes: [
    { value: 'case_study', label: 'Business case study' },
    { value: 'news_article', label: 'Business news article' },
    { value: 'financial_data', label: 'Financial data / accounts' },
    { value: 'market_research', label: 'Market research report' },
  ],
  themeLabel: 'Case Study Focus',
  themePlaceholder: 'e.g. "a start-up entering a saturated market" or "ethical sourcing"',
  themeHelperText: 'The business scenario or issue the resources should explore',
  showLength: false,
  extraFields: [
    {
      key: 'resourceCount',
      label: 'Number of Resources',
      type: 'select',
      options: [
        { value: '1', label: '1 resource' },
        { value: '2', label: '2 resources' },
        { value: '3', label: '3 resources' },
      ],
      defaultValue: '2',
    },
  ],
};

const scienceConfig: ResourceConfig = {
  label: 'Science Resource Pack',
  sourceTypeLabel: 'Resource Type',
  sourceTypes: [
    { value: 'experiment_data', label: 'Experiment results' },
    { value: 'results_table', label: 'Results table' },
    { value: 'graph_data', label: 'Graph / chart data' },
    { value: 'method_writeup', label: 'Written method' },
    { value: 'peer_review', label: 'Peer review extract' },
  ],
  themeLabel: 'Experiment / Topic Focus',
  themePlaceholder: 'e.g. "enzyme activity at different temperatures" or "rate of photosynthesis"',
  themeHelperText: 'The experiment, investigation, or topic area the resources should cover',
  showLength: false,
  extraFields: [
    {
      key: 'dataFormat',
      label: 'Data Format',
      type: 'select',
      options: [
        { value: 'results_table', label: 'Results table' },
        { value: 'graph_data', label: 'Graph data' },
        { value: 'written_method', label: 'Written method' },
      ],
      defaultValue: 'results_table',
    },
    {
      key: 'resourceCount',
      label: 'Number of Resources',
      type: 'select',
      options: [
        { value: '1', label: '1 resource' },
        { value: '2', label: '2 resources' },
        { value: '3', label: '3 resources' },
      ],
      defaultValue: '2',
    },
  ],
};

const defaultConfig: ResourceConfig = {
  label: 'AI Resources',
  sourceTypeLabel: 'Resource Type',
  sourceTypes: [
    { value: 'text_extract', label: 'Text extract' },
    { value: 'data_table', label: 'Data table' },
    { value: 'article', label: 'Article' },
    { value: 'case_study', label: 'Case study' },
  ],
  themeLabel: 'Topic',
  themePlaceholder: 'Enter a topic for the resource pack...',
  themeHelperText: 'What should the generated resources be about?',
  showLength: false,
  extraFields: [
    {
      key: 'resourceCount',
      label: 'Number of Resources',
      type: 'select',
      options: [
        { value: '1', label: '1 resource' },
        { value: '2', label: '2 resources' },
        { value: '3', label: '3 resources' },
        { value: '4', label: '4 resources' },
        { value: '5', label: '5 resources' },
      ],
      defaultValue: '3',
    },
  ],
};

export const getResourceConfig = (subject: string): ResourceConfig => {
  const s = subject.toLowerCase();

  if (s.includes('english language') || s === 'english_language') return englishLanguageConfig;
  if (s.includes('english literature') || s === 'english_literature') return englishLiteratureConfig;
  if (s.includes('english')) return englishLanguageConfig;
  if (s.includes('geography')) return geographyConfig;
  if (s.includes('history')) return historyConfig;
  if (s.includes('business') || s.includes('economics')) return businessConfig;
  if (s.includes('biology') || s.includes('chemistry') || s.includes('physics') || s.includes('science')) return scienceConfig;
  return defaultConfig;
};
