import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { enforceRateLimit, rateLimitResponse, type RateLimitOptions } from './rate-limiter.ts';
/** Protect user-facing AI handlers that do not already reserve a request. */
export function withAIQuota(feature: string, handler: (req: Request) => Promise<Response>, options: RateLimitOptions = {}) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return handler(req);
    const cors = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json',
      'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
    if (req.method !== 'POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:cors});
    const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token=req.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return new Response(JSON.stringify({error:'Authentication required'}),{status:401,headers:cors});
    try {
      const {data:{user},error}=await client.auth.getUser(token);
      if (error || !user) return new Response(JSON.stringify({error:'Authentication required'}),{status:401,headers:cors});
      // Bound request payloads without consuming the handler's original body.
      const reader=req.clone().body?.getReader(); let size=0;
      if (reader) {
        while (true) { const {value,done}=await reader.read(); if(done)break;size+=value.byteLength;
          if(size>1_000_000){void reader.cancel();return new Response(JSON.stringify({error:'Request is too large'}),{status:413,headers:cors});}}
      }
      const check=await enforceRateLimit(client,user.id,feature,options);
      if(!check.allowed)return rateLimitResponse(check,cors);
      return await handler(req);
    } catch(error) {
      console.error('AI request failed',error instanceof Error ? error.name : 'unknown');
      return new Response(JSON.stringify({error:'AI request could not finish. Please retry.'}),{status:503,headers:cors});
    }
  };
}
