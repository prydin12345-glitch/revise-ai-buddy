import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserPreferences {
  id?: string;
  user_id?: string;
  display_name?: string;
  ai_feedback_detail: 'concise' | 'detailed';
  font_size: 'small' | 'medium' | 'large';
  high_contrast_mode: boolean;
  confirm_resolve_feedback: boolean;
  curriculum_region: string | null;
  preferred_exam_board: string | null;
  preferred_educational_level: string | null;
  // Legacy columns kept on DB but no longer surfaced in settings UI:
  language?: string;
  theme_mode?: 'light' | 'dark' | 'system';
  accent_color?: string;
  timezone?: string;
  email_notifications?: boolean;
  push_notifications?: boolean;
  in_app_notifications?: boolean;
  save_revision_history?: boolean;
  enable_ai_suggestions?: boolean;
  beta_features_enabled?: boolean;
}

const defaultPreferences: UserPreferences = {
  ai_feedback_detail: 'detailed',
  font_size: 'medium',
  high_contrast_mode: false,
  confirm_resolve_feedback: true,
  curriculum_region: null,
  preferred_exam_board: null,
  preferred_educational_level: null,
};

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce state — coalesce rapid updates into a single save + toast.
  const pendingUpdates = useRef<Partial<UserPreferences>>({});
  const saveTimer = useRef<number | null>(null);

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          const { data: newPrefs, error: insertError } = await supabase
            .from('user_preferences')
            .insert([{ user_id: user.id, ...defaultPreferences }])
            .select()
            .single();

          if (insertError) throw insertError;
          setPreferences({ ...defaultPreferences, ...newPrefs } as UserPreferences);
        } else {
          throw fetchError;
        }
      } else {
        setPreferences({ ...defaultPreferences, ...data } as UserPreferences);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const flushSave = useCallback(async () => {
    const updates = pendingUpdates.current;
    pendingUpdates.current = {};
    saveTimer.current = null;
    if (Object.keys(updates).length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: updateError } = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', user.id);
      if (updateError) throw updateError;
      toast.success('Settings saved');
    } catch (err) {
      console.error('Error updating preferences:', err);
      toast.error('Failed to save settings');
    }
  }, []);

  const updatePreference = useCallback((updates: Partial<UserPreferences>) => {
    // Optimistic local update
    setPreferences(prev => prev ? { ...prev, ...updates } : prev);
    // Queue & debounce save (600ms)
    pendingUpdates.current = { ...pendingUpdates.current, ...updates };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flushSave, 600);
  }, [flushSave]);

  useEffect(() => {
    loadPreferences();
    return () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        // Best-effort flush on unmount
        flushSave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    preferences,
    loading,
    error,
    updatePreference,
    reload: loadPreferences,
  };
};
