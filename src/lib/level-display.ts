import { LEVEL_DISPLAY_NAMES } from "./board-level-mapping";
import { ALL_LEVELS } from "./educational-levels";

/**
 * Convert a raw educational-tier code (e.g. "level3_a_level", "LEVEL3",
 * "COLLEGE_16_18") into a clean, human-readable label.
 */
export function formatEducationalTier(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = String(raw).trim();
  if (!key) return null;

  // 1. Board-linked codes (level3_a_level → "A-Level")
  if (LEVEL_DISPLAY_NAMES[key]) return LEVEL_DISPLAY_NAMES[key];
  const lower = key.toLowerCase();
  if (LEVEL_DISPLAY_NAMES[lower]) return LEVEL_DISPLAY_NAMES[lower];

  // 2. Universal levels (level3 → "Level 3 (Age 16–18)")
  const uni = ALL_LEVELS.find((l) => l.id.toLowerCase() === lower);
  if (uni) return uni.label;

  // 3. Common shorthand
  const shorthand: Record<string, string> = {
    level1: "Foundation",
    level2: "GCSE",
    level3: "A Level",
    college_16_18: "A Level",
    high_school: "High School",
    middle_school: "Middle School",
    undergrad: "Undergraduate",
    postgrad: "Postgraduate",
    doctoral: "Doctoral",
  };
  if (shorthand[lower]) return shorthand[lower];

  // 4. Fallback: humanise the raw token
  return lower
    .replace(/^level\d_?/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || key;
}
