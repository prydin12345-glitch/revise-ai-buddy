-- Fix 1: The cache table is only accessed by edge functions using service role key.
-- No user-facing RLS policies needed — keep RLS on but no policies = deny all via RLS (edge functions use service role which bypasses RLS).

-- Fix 2: Recreate view with SECURITY INVOKER (default in newer PG, but explicitly set)
DROP VIEW IF EXISTS ai_usage_summary;
CREATE VIEW ai_usage_summary WITH (security_invoker = true) AS
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