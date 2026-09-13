/** Atomic, server-owned request quotas. Usage logs are analytics, never authority. */
export interface RateLimitResult {
  allowed: boolean; usedToday: number; dailyLimit: number;
  usedInBurstWindow: number; burstLimit: number; message: string;
  retryAfterSeconds: number; status?: number;
}
export interface RateLimitOptions { dailyLimit?: number; burstLimit?: number; burstWindowMinutes?: number; }
export function quotaFeature(feature: string): string {
  return ['generate-practice-questions','get-practice-questions','practice_generation'].includes(feature)
    ? 'practice_generation' : feature;
}
export async function enforceRateLimit(
  supabase: any, userId: string, feature: string, options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const dailyLimit=options.dailyLimit ?? 100, burstLimit=options.burstLimit ?? 15;
  const unavailable: RateLimitResult = {
    allowed:false,usedToday:0,dailyLimit,usedInBurstWindow:0,burstLimit,
    message:'AI requests are temporarily unavailable. Please retry shortly.',retryAfterSeconds:60,status:503,
  };
  try {
    const { data, error } = await supabase.rpc('reserve_ai_request', {
      p_user_id:userId,p_feature:quotaFeature(feature),p_daily_limit:dailyLimit,
      p_burst_limit:burstLimit,p_burst_minutes:options.burstWindowMinutes ?? 10,
    });
    if (error || typeof data?.allowed !== 'boolean') {
      console.error('Quota reservation failed', error?.code ?? 'invalid_response');
      return unavailable;
    }
    const message = data.allowed ? 'OK' : data.reason==='daily'
      ? 'You have reached today’s limit for this feature. It resets at midnight UTC.'
      : data.reason==='burst' ? 'You are making requests too quickly. Please wait before retrying.'
      : 'AI requests are temporarily paused. Your saved work is still available.';
    return {...data,message,status:data.reason==='disabled' ? 503 : 429};
  } catch {
    return unavailable;
  }
}
export function checkGenerationRateLimit(supabase: any,userId: string,feature: string,options: RateLimitOptions = {}) {
  return enforceRateLimit(supabase,userId,feature,{dailyLimit:30,burstLimit:6,burstWindowMinutes:10,...options});
}
export function rateLimitResponse(check: RateLimitResult,cors: Record<string,string>): Response {
  return new Response(JSON.stringify({error:check.message,retryAfterSeconds:check.retryAfterSeconds}),{
    status:check.status ?? 429,
    headers:{...cors,'Content-Type':'application/json','Retry-After':String(check.retryAfterSeconds)},
  });
}
