import { useEffect } from "react";
import { useUserPreferences } from "@/hooks/useUserPreferences";

/**
 * Applies user accessibility preferences (font size + high contrast) to
 * the document root. Mount once near the app root.
 */
export const PreferencesApplier = () => {
  const { preferences } = useUserPreferences();

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove('text-scale-small', 'text-scale-medium', 'text-scale-large');
    if (preferences?.font_size === 'small') root.classList.add('text-scale-small');
    else if (preferences?.font_size === 'large') root.classList.add('text-scale-large');
    else root.classList.add('text-scale-medium');

    if (preferences?.high_contrast_mode) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
  }, [preferences?.font_size, preferences?.high_contrast_mode]);

  return null;
};
