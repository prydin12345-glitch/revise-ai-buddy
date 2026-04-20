/**
 * Centralised subject colour system shared between tutors and students.
 * Ensures the same subject always renders with the same colour across the app.
 */

export const SUBJECT_COLOR_MAP: Record<string, string> = {
  // Maths
  'mathematics': '#3B82F6',
  'maths': '#3B82F6',
  'further mathematics': '#2563EB',
  'further maths': '#2563EB',
  'statistics': '#6366F1',

  // Sciences
  'physics': '#8B5CF6',
  'chemistry': '#10B981',
  'biology': '#22C55E',
  'combined science': '#14B8A6',
  'environmental science': '#84CC16',
  'science': '#14B8A6',

  // Humanities
  'history': '#F59E0B',
  'geography': '#EF4444',
  'economics': '#F97316',
  'psychology': '#EC4899',
  'sociology': '#D946EF',
  'philosophy': '#A855F7',
  'religious studies': '#E879F9',
  'politics': '#9333EA',
  'law': '#7C3AED',

  // English
  'english language': '#06B6D4',
  'english literature': '#0EA5E9',
  'english': '#0284C7',

  // Languages
  'french': '#3B82F6',
  'spanish': '#EF4444',
  'german': '#F59E0B',
  'italian': '#10B981',
  'chinese': '#DC2626',
  'arabic': '#059669',

  // Computing
  'computer science': '#6366F1',
  'ict': '#8B5CF6',

  // Business
  'business studies': '#F97316',
  'business': '#EA580C',
  'accounting': '#D97706',

  // Creative
  'art': '#EC4899',
  'music': '#A855F7',
  'drama': '#E879F9',
  'media studies': '#F43F5E',
  'design technology': '#14B8A6',
  'food technology': '#84CC16',
  'pe': '#22C55E',
  'physical education': '#16A34A',
};

/** Ten preset colours offered in the colour picker. */
export const PRESET_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
  '#22C55E', // emerald
];

/**
 * Resolve a subject (by name or slug) to its display colour.
 * Custom colour from settings always wins. Falls back to a deterministic
 * hash so the same input always produces the same colour.
 */
export const getSubjectColor = (
  subjectNameOrSlug: string | null | undefined,
  customColor?: string | null,
): string => {
  if (customColor) return customColor;
  if (!subjectNameOrSlug) return PRESET_COLORS[0];

  const lower = subjectNameOrSlug.toLowerCase().trim();

  // Exact match first
  if (SUBJECT_COLOR_MAP[lower]) return SUBJECT_COLOR_MAP[lower];

  // Partial match (longest key wins to avoid 'english' matching 'english literature' accidentally)
  const sortedKeys = Object.keys(SUBJECT_COLOR_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) return SUBJECT_COLOR_MAP[key];
  }

  // Deterministic hash fallback
  let hash = 0;
  for (let i = 0; i < subjectNameOrSlug.length; i++) {
    hash = subjectNameOrSlug.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PRESET_COLORS[Math.abs(hash) % PRESET_COLORS.length];
};
