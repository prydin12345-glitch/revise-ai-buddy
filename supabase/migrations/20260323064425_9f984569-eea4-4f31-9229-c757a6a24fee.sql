-- Optimisation 1: Question generation cache
CREATE TABLE IF NOT EXISTS question_generation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  subject text NOT NULL,
  exam_board text,
  educational_level text,
  topics text[],
  difficulty text,
  question_format text,
  question_count integer,
  questions jsonb NOT NULL,
  hit_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 days'
);

CREATE INDEX IF NOT EXISTS idx_cache_key ON question_generation_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON question_generation_cache (expires_at);

ALTER TABLE question_generation_cache ENABLE ROW LEVEL SECURITY;

-- Optimisation 5: Extend AI usage tracking table
ALTER TABLE ai_usage_tracking ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE ai_usage_tracking ADD COLUMN IF NOT EXISTS input_tokens integer DEFAULT 0;
ALTER TABLE ai_usage_tracking ADD COLUMN IF NOT EXISTS output_tokens integer DEFAULT 0;
ALTER TABLE ai_usage_tracking ADD COLUMN IF NOT EXISTS cache_hit boolean DEFAULT false;
ALTER TABLE ai_usage_tracking ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE ai_usage_tracking ADD COLUMN IF NOT EXISTS duration_ms integer;

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage_tracking (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_tracking (created_at);

-- Usage summary view
CREATE OR REPLACE VIEW ai_usage_summary AS
SELECT
  user_id,
  feature_name,
  count(*) AS call_count,
  sum(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS total_tokens,
  sum(CASE WHEN cache_hit THEN 1 ELSE 0 END) AS cache_hits,
  round(
    sum(CASE WHEN cache_hit THEN 1 ELSE 0 END)::numeric /
    nullif(count(*), 0) * 100, 1
  ) AS cache_hit_rate_pct,
  date_trunc('month', created_at) AS month
FROM ai_usage_tracking
GROUP BY user_id, feature_name, date_trunc('month', created_at);