import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserPreferences {
  id?: string;
  user_id?: string;
  display_name?: string;
  language: string;
  theme_mode: 'light' | 'dark' | 'system';
  accent_color: string;
  timezone: string;
  email_notifications: boolean;
  push_notifications: boolean;
  in_app_notifications: boolean;
  save_revision_history: boolean;
  enable_ai_suggestions: boolean;
  ai_feedback_detail: 'concise' | 'detailed';
  beta_features_enabled: boolean;
  font_size: 'small' | 'medium' | 'large';
  high_contrast_mode: boolean;
  confirm_resolve_feedback: boolean;
}

const defaultPreferences: UserPreferences = {
  language: 'en',
  theme_mode: 'dark',
  accent_color: '#3B82F6',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  email_notifications: true,
  push_notifications: true,
  in_app_notifications: true,
  save_revision_history: true,
  enable_ai_suggestions: true,
  ai_feedback_detail: 'detailed',
  beta_features_enabled: false,
  font_size: 'medium',
  high_contrast_mode: false,
  confirm_resolve_feedback: true,
};

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          // No preferences found, create default ones
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
        // Merge with defaults to handle null values from DB
        setPreferences({ ...defaultPreferences, ...data } as UserPreferences);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (updates: Partial<UserPreferences>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: updateError } = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setPreferences(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Settings saved');
    } catch (err) {
      console.error('Error updating preferences:', err);
      toast.error('Failed to save settings');
      throw err;
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  return {
    preferences,
    loading,
    error,
    updatePreference,
    reload: loadPreferences,
  };
};
