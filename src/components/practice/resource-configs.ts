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

const mathematicsConfig: ResourceConfig = {
  label: 'Mathematics Resource',
  sourceTypeLabel: 'Resource Type',
  sourceTypes: [
    { value: 'data_set', label: 'Data set for statistics questions' },
    { value: 'geometric_figure', label: 'Geometric figure description' },
    { value: 'financial_scenario', label: 'Financial scenario' },
    { value: 'real_world_model', label: 'Real-world modelling context' },
  ],
  themeLabel: 'Mathematical Context',
  themePlaceholder: 'e.g. "a company\'s sales data over 12 months"',
  themeHelperText: 'Provide a real-world context for the data or scenario',
  showLength: false,
  extraFields: [
    {
      key: 'dataFormat',
      label: 'Data Format',
      type: 'select',
      options: [
        { value: 'small', label: 'Small data set (10–15 values)' },
        { value: 'medium', label: 'Medium data set (20–30 values)' },
      ],
      defaultValue: 'small',
    },
    {
      key: 'resourceCount',
      label: 'Number of Resources',
      type: 'select',
      options: [
        { value: '1', label: '1 resource' },
        { value: '2', label: '2 resources' },
      ],
      defaultValue: '1',
    },
  ],
};

const geographyConfig: ResourceConfig = {
  label: 'Geography Resource Pack',
  sourceTypeLabel: 'Source Type',
  sourceTypes: [
    { value: 'case_study_urban', label: 'Case study — urban' },
    { value: 'case_study_coastal', label: 'Case study — coastal' },
    { value: 'case_study_development', label: 'Case study — development' },
    { value: 'statistical_report', label: 'Statistical report' },
    { value: 'news_article', label: 'News article' },
    { value: 'field_data_table', label: 'Field data table' },
  ],
  themeLabel: 'Case Study Focus',
  themePlaceholder: 'e.g. "coastal erosion in a UK location" or "urbanisation in a developing country"',
  themeHelperText: 'The AI will generate an original case study with realistic data',
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
    { value: 'newspaper_period', label: 'Newspaper from the period' },
    { value: 'personal_account', label: 'Personal account / diary' },
  ],
  themeLabel: 'Historical Period and Event',
  themePlaceholder: 'e.g. "Germany 1933–1939" or "suffragette movement 1900–1918"',
  themeHelperText: 'The AI will generate an original source with provenance information',
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

const biologyConfig: ResourceConfig = {
  label: 'Biology Resource Pack',
  sourceTypeLabel: 'Resource Type',
  sourceTypes: [
    { value: 'scientific_article', label: 'Scientific article extract' },
    { value: 'experiment_data', label: 'Experiment results and data' },
    { value: 'field_study', label: 'Field study findings' },
    { value: 'medical_case', label: 'Medical case study' },
  ],
  themeLabel: 'Topic Focus',
  themePlaceholder: 'e.g. "enzyme activity at different temperatures"',
  themeHelperText: 'The AI will generate realistic scientific data and context',
  showLength: false,
  extraFields: [
    {
      key: 'dataFormat',
      label: 'Data Format',
      type: 'select',
      options: [
        { value: 'results_table', label: 'Data table only' },
        { value: 'article_data', label: 'Short article + data (~300 words)' },
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

const chemistryConfig: ResourceConfig = {
  label: 'Chemistry Resource Pack',
  sourceTypeLabel: 'Resource Type',
  sourceTypes: [
    { value: 'experiment_data', label: 'Experiment results' },
    { value: 'results_table', label: 'Results table' },
    { value: 'graph_data', label: 'Graph / chart data' },
    { value: 'method_writeup', label: 'Written method' },
    { value: 'peer_review', label: 'Peer review extract' },
  ],
  themeLabel: 'Experiment / Topic Focus',
  themePlaceholder: 'e.g. "rates of reaction with hydrochloric acid" or "electrolysis of copper sulfate"',
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

const physicsConfig: ResourceConfig = {
  ...chemistryConfig,
  label: 'Physics Resource Pack',
  sourceTypes: [
    { value: 'experiment_data', label: 'Experiment results' },
    { value: 'results_table', label: 'Results table' },
    { value: 'graph_data', label: 'Graph / chart data' },
    { value: 'method_writeup', label: 'Written method' },
    { value: 'real_world_context', label: 'Real-world application' },
  ],
  themePlaceholder: 'e.g. "measuring the speed of sound" or "projectile motion"',
};

const psychologyConfig: ResourceConfig = {
  label: 'Psychology Resource Pack',
  sourceTypeLabel: 'Source Type',
  sourceTypes: [
    { value: 'study_summary', label: 'Study summary' },
    { value: 'case_study', label: 'Case study' },
    { value: 'research_data', label: 'Research data' },
    { value: 'article_extract', label: 'Journal article extract' },
  ],
  themeLabel: 'Topic Focus',
  themePlaceholder: 'e.g. "Milgram\'s obedience study" or "memory models"',
  themeHelperText: 'The psychological topic or study the resources should focus on',
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

const defaultConfig: ResourceConfig = {
  label: 'AI Resources',
  sourceTypeLabel: 'Resource Type',
  sourceTypes: [
    { value: 'text_extract', label: 'Text extract' },
    { value: 'data_table', label: 'Data table' },
    { value: 'article', label: 'Article' },
    { value: 'case_study', label: 'Case study' },
    { value: 'news_article', label: 'News article' },
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

const configByCategory: Record<string, ResourceConfig> = {
  english_language: englishLanguageConfig,
  english_literature: englishLiteratureConfig,
  mathematics: mathematicsConfig,
  biology: biologyConfig,
  chemistry: chemistryConfig,
  physics: physicsConfig,
  geography: geographyConfig,
  history: historyConfig,
  business: businessConfig,
  computer_science: defaultConfig,
  psychology: psychologyConfig,
  sociology: defaultConfig,
  art_design: defaultConfig,
  music: defaultConfig,
  physical_education: defaultConfig,
  other: defaultConfig,
};

/**
 * Get resource config by subject category (from AI classification).
 * Falls back to string matching for backwards compatibility.
 */
export const getResourceConfig = (subjectOrCategory: string): ResourceConfig => {
  // First try direct category lookup
  if (configByCategory[subjectOrCategory]) {
    return configByCategory[subjectOrCategory];
  }

  // Fallback: legacy string matching for backwards compatibility
  const s = subjectOrCategory.toLowerCase();
  if (s.includes('english language') || s === 'english_language') return englishLanguageConfig;
  if (s.includes('english literature') || s === 'english_literature') return englishLiteratureConfig;
  if (s.includes('english')) return englishLanguageConfig;
  if (s.includes('geography')) return geographyConfig;
  if (s.includes('history')) return historyConfig;
  if (s.includes('business') || s.includes('economics')) return businessConfig;
  if (s.includes('biology')) return biologyConfig;
  if (s.includes('chemistry')) return chemistryConfig;
  if (s.includes('physics')) return physicsConfig;
  if (s.includes('psychology')) return psychologyConfig;
  if (s.includes('math')) return mathematicsConfig;
  if (s.includes('science')) return chemistryConfig;
  return defaultConfig;
};
