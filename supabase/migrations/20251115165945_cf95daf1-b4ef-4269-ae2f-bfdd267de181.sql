-- Create user_preferences table
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Account
  display_name TEXT,
  
  -- Personalization
  language TEXT DEFAULT 'en',
  theme_mode TEXT DEFAULT 'dark' CHECK (theme_mode IN ('light', 'dark', 'system')),
  accent_color TEXT DEFAULT '#3B82F6',
  timezone TEXT DEFAULT 'UTC',
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  
  -- Privacy
  save_revision_history BOOLEAN DEFAULT true,
  
  -- AI Usage
  enable_ai_suggestions BOOLEAN DEFAULT true,
  ai_feedback_detail TEXT DEFAULT 'detailed' CHECK (ai_feedback_detail IN ('concise', 'detailed')),
  
  -- Advanced
  beta_features_enabled BOOLEAN DEFAULT false,
  font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  high_contrast_mode BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create user_sessions table
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_name TEXT,
  device_type TEXT,
  ip_address INET,
  user_agent TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON user_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Create ai_usage_tracking table
CREATE TABLE ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_name TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost_credits DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai usage"
  ON ai_usage_tracking FOR SELECT
  USING (auth.uid() = user_id);