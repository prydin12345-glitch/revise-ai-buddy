/**
 * Shared subject colour palette and utilities.
 */

export const PRESET_COLOURS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#6366f1', // indigo
  '#f43f5e', // rose
];

export const getNextAvailableColour = (
  usedColours: string[],
  palette: string[] = PRESET_COLOURS
): string => {
  const normalised = usedColours.map(c => c.toLowerCase());
  const available = palette.filter(c => !normalised.includes(c.toLowerCase()));
  return available[0] ?? palette[Math.floor(Math.random() * palette.length)];
};

export const isSpecialisedSubject = (name: string): boolean => {
  const knownAcademic = [
    'mathematics', 'biology', 'chemistry', 'physics',
    'english', 'history', 'geography', 'computer science',
    'economics', 'psychology', 'business', 'sociology',
    'politics', 'philosophy', 'law', 'art', 'music',
    'french', 'spanish', 'german',
  ];
  return !knownAcademic.some(s => name.toLowerCase().includes(s));
};
