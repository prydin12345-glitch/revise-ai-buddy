// Cache key builder for question generation
// Cache key builder for question generation
export const buildCacheKey = (params: {
  subject: string;
  examBoard: string;
  educationalLevel: string;
  topics: string[];
  difficulty: string;
  questionFormat: string;
  questionCount: number;
  isCustomNiche: boolean;
  variationSlot?: number;
}): string | null => {
  // Never cache custom niche subjects
  if (params.isCustomNiche) return null;
  // Never cache if no exam board or level set
  if (!params.examBoard || !params.educationalLevel) return null;

  const sortedTopics = [...params.topics].sort().join(',');
  const slot = params.variationSlot ?? 0;
  const key = [
    params.subject.toLowerCase().trim(),
    params.examBoard.toLowerCase(),
    params.educationalLevel.toLowerCase(),
    sortedTopics.toLowerCase(),
    params.difficulty.toLowerCase(),
    params.questionFormat.toLowerCase(),
    params.questionCount.toString(),
    `v${slot}`,
  ].join('::');

  return btoa(key).slice(0, 64);
};

// Build base cache key (without variation slot) for slot tracking
export const buildBaseCacheKey = (params: {
  subject: string;
  examBoard: string;
  educationalLevel: string;
  topics: string[];
  difficulty: string;
  questionFormat: string;
  questionCount: number;
}): string => {
  const sortedTopics = [...params.topics].sort().join(',');
  const key = [
    params.subject.toLowerCase().trim(),
    params.examBoard.toLowerCase(),
    params.educationalLevel.toLowerCase(),
    sortedTopics.toLowerCase(),
    params.difficulty.toLowerCase(),
    params.questionFormat.toLowerCase(),
    params.questionCount.toString(),
  ].join('::');

  return btoa(key).slice(0, 64);
};

export const shuffleArray = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
