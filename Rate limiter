/**
 * Rate limiter for AI generation endpoints.
 *
 * Uses the existing `ai_usage_tracking` table (written by logAIUsage after
 * every generation) so NO new database table or migration is required.
 *
 * Two limits are enforced:
 *  1. Daily cap   — max generations per user per UTC day
 *  2. Burst cap   — max generations per user in a rolling 10-minute window
 *
 * Usage (inside an edge function, with a SERVICE ROLE client):
 *
 *   import { checkGenerationRateLimit } from "../_shared/rate-limiter.ts";
 *
 *   const rateCheck = await checkGenerationRateLimit(supabaseClient, userId, 'generate-practice-questions');
 *   if (!rateCheck.allowed) {
 *     return new Response(
 *       JSON.stringify({ error: rateCheck.message, retryAfterSeconds: rateCheck.retryAfterSeconds }),
 *       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
 *     );
 *   }
 */

export interface RateLimitResult {
  allowed: boolean;
  usedToday: number;
  dailyLimit: number;
  usedInBurstWindow: number;
  burstLimit: number;
  message: string;
  retryAfterSeconds: number;
}

export interface RateLimitOptions {
  /** Max generations per UTC day. Default 30. */
  dailyLimit?: number;
  /** Max generations per burst window. Default 6. */
  burstLimit?: number;
  /** Burst window in minutes. Default 10. */
  burstWindowMinutes?: number;
}

export async function checkGenerationRateLimit(
  supabase: any,
  userId: string,
  feature: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const dailyLimit = options.dailyLimit ?? 30;
  const burstLimit = options.burstLimit ?? 6;
  const burstWindowMinutes = options.burstWindowMinutes ?? 10;

  const now = new Date();
  const startOfDayUtc = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
  )).toISOString();
  const burstWindowStart = new Date(now.getTime() - burstWindowMinutes * 60_000).toISOString();

  try {
    // Count today's generations for this user + feature.
    // cache hits are cheap, so they are excluded from the daily cap but
    // still count toward the burst cap (to stop request hammering).
    const [dailyRes, burstRes] = await Promise.all([
      supabase
        .from('ai_usage_tracking')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature_name', feature)
        .eq('cache_hit', false)
        .gte('created_at', startOfDayUtc),
      supabase
        .from('ai_usage_tracking')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature_name', feature)
        .gte('created_at', burstWindowStart),
    ]);

    // FAIL OPEN: if the rate check itself errors, never block a legitimate
    // user — log it and allow the request.
    if (dailyRes.error || burstRes.error) {
      console.error('Rate limit check failed (failing open):', dailyRes.error ?? burstRes.error);
      return allow(0, dailyLimit, 0, burstLimit);
    }

    const usedToday = dailyRes.count ?? 0;
    const usedInBurst = burstRes.count ?? 0;

    if (usedInBurst >= burstLimit) {
      console.warn(`Rate limit (burst) hit: user=${userId} feature=${feature} used=${usedInBurst}/${burstLimit}`);
      return {
        allowed: false,
        usedToday,
        dailyLimit,
        usedInBurstWindow: usedInBurst,
        burstLimit,
        message: `You're generating too quickly. Please wait a few minutes and try again.`,
        retryAfterSeconds: burstWindowMinutes * 60,
      };
    }

    if (usedToday >= dailyLimit) {
      console.warn(`Rate limit (daily) hit: user=${userId} feature=${feature} used=${usedToday}/${dailyLimit}`);
      const endOfDay = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
      ));
      return {
        allowed: false,
        usedToday,
        dailyLimit,
        usedInBurstWindow: usedInBurst,
        burstLimit,
        message: `You've reached today's generation limit of ${dailyLimit}. Your limit resets at midnight UTC.`,
        retryAfterSeconds: Math.ceil((endOfDay.getTime() - now.getTime()) / 1000),
      };
    }

    return allow(usedToday, dailyLimit, usedInBurst, burstLimit);
  } catch (err) {
    // FAIL OPEN on unexpected errors too.
    console.error('Rate limit check threw (failing open):', err);
    return allow(0, dailyLimit, 0, burstLimit);
  }
}

function allow(
  usedToday: number,
  dailyLimit: number,
  usedInBurstWindow: number,
  burstLimit: number
): RateLimitResult {
  return {
    allowed: true,
    usedToday,
    dailyLimit,
    usedInBurstWindow,
    burstLimit,
    message: 'OK',
    retryAfterSeconds: 0,
  };
}

// ---------------------------------------------------------------------------
// V2 — request-time enforcement
// ---------------------------------------------------------------------------
// Unlike checkGenerationRateLimit (which counts completed generations logged
// by logAIUsage), enforceRateLimit records each request the moment it
// arrives, BEFORE any AI call. This protects functions that don't log usage
// and closes the gap where many concurrent requests pass the check before
// any of them complete.
//
// Marker rows are written to ai_usage_tracking with feature_name ending in
// "-req" and zero tokens/cost, so they're trivial to exclude from analytics.
//
// MUST be called with a SERVICE ROLE client (bypasses RLS).
//
// Usage:
//   const rateCheck = await enforceRateLimit(serviceClient, user.id, 'grade-practice-question', {
//     dailyLimit: 300, burstLimit: 60, burstWindowMinutes: 10,
//   });
//   if (!rateCheck.allowed) { return 429 response }

export async function enforceRateLimit(
  supabase: any,
  userId: string,
  feature: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const dailyLimit = options.dailyLimit ?? 100;
  const burstLimit = options.burstLimit ?? 15;
  const burstWindowMinutes = options.burstWindowMinutes ?? 10;
  const markerFeature = `${feature}-req`;

  const now = new Date();
  const startOfDayUtc = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
  )).toISOString();
  const burstWindowStart = new Date(now.getTime() - burstWindowMinutes * 60_000).toISOString();

  try {
    const [dailyRes, burstRes] = await Promise.all([
      supabase
        .from('ai_usage_tracking')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature_name', markerFeature)
        .gte('created_at', startOfDayUtc),
      supabase
        .from('ai_usage_tracking')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature_name', markerFeature)
        .gte('created_at', burstWindowStart),
    ]);

    // FAIL OPEN: never block a legitimate user because the check errored.
    if (dailyRes.error || burstRes.error) {
      console.error('enforceRateLimit check failed (failing open):', dailyRes.error ?? burstRes.error);
      return allow(0, dailyLimit, 0, burstLimit);
    }

    const usedToday = dailyRes.count ?? 0;
    const usedInBurst = burstRes.count ?? 0;

    if (usedInBurst >= burstLimit) {
      console.warn(`Rate limit (burst) hit: user=${userId} feature=${feature} used=${usedInBurst}/${burstLimit}`);
      return {
        allowed: false,
        usedToday,
        dailyLimit,
        usedInBurstWindow: usedInBurst,
        burstLimit,
        message: `You're doing that too quickly. Please wait a few minutes and try again.`,
        retryAfterSeconds: burstWindowMinutes * 60,
      };
    }

    if (usedToday >= dailyLimit) {
      console.warn(`Rate limit (daily) hit: user=${userId} feature=${feature} used=${usedToday}/${dailyLimit}`);
      const endOfDay = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1
      ));
      return {
        allowed: false,
        usedToday,
        dailyLimit,
        usedInBurstWindow: usedInBurst,
        burstLimit,
        message: `You've reached today's limit for this feature. Your limit resets at midnight UTC.`,
        retryAfterSeconds: Math.ceil((endOfDay.getTime() - now.getTime()) / 1000),
      };
    }

    // Record this request immediately (zero-cost marker row).
    const { error: insertError } = await supabase.from('ai_usage_tracking').insert({
      user_id: userId,
      feature_name: markerFeature,
      model: 'rate-limit-marker',
      input_tokens: 0,
      output_tokens: 0,
      tokens_used: 0,
      cache_hit: true,
      cost_credits: 0,
    });
    if (insertError) {
      // Still fail open — the request proceeds, it just isn't counted.
      console.error('enforceRateLimit marker insert failed:', insertError);
    }

    return allow(usedToday + 1, dailyLimit, usedInBurst + 1, burstLimit);
  } catch (err) {
    console.error('enforceRateLimit threw (failing open):', err);
    return allow(0, dailyLimit, 0, burstLimit);
  }
}

/** Standard 429 response body builder for consistency across functions. */
export function rateLimitResponse(rateCheck: RateLimitResult, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: rateCheck.message,
      retryAfterSeconds: rateCheck.retryAfterSeconds,
    }),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(rateCheck.retryAfterSeconds),
      },
      status: 429,
    }
  );
}
