/**
 * Luminance-based contrast utilities for subject cards.
 * Ensures text is always readable regardless of background colour.
 */

export const getLuminance = (hex: string): number => {
  if (!hex || !hex.startsWith("#")) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** Returns dark or light text color based on background luminance */
export const getTextColor = (backgroundHex: string): string =>
  getLuminance(backgroundHex) > 0.5 ? "#0f172a" : "#ffffff";

/** Returns a semi-transparent overlay for badges/chips on coloured backgrounds */
export const getBadgeColor = (backgroundHex: string): string =>
  getLuminance(backgroundHex) > 0.5
    ? "rgba(0,0,0,0.15)"
    : "rgba(255,255,255,0.15)";
