import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateQuestionsInBackground } from "../_shared/practice-generation.ts";
import { responseFormatsEnabled } from "../_shared/response-format-policy.ts";
import { checkGenerationRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Main request handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please log in and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create client with user's auth to validate the token
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate the JWT and get user claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('JWT validation failed:', claimsError?.message);
      return new Response(
        JSON.stringify({ error: 'Your session has expired. Please refresh and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log('Authenticated user:', userId);

    // Parse request body
    const body = await req.json();
    const setId = body.setId;
    const forceRefresh = body.forceRefresh === true;
    const countMin = Number.isFinite(Number(body.questionCountMin)) ? Number(body.questionCountMin) : undefined;
    const countMax = Number.isFinite(Number(body.questionCountMax)) ? Number(body.questionCountMax) : undefined;

    if (!setId) {
      return new Response(
        JSON.stringify({ error: 'Set ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Generating practice questions for set:', setId);

    // Use service role key for server-side operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ── RATE LIMITING ──────────────────────────────────────────────────
    // Protects against AI cost abuse: 30 generations/day, max 6 per 10 min.
    const rateCheck = await checkGenerationRateLimit(
      supabaseClient,
      userId,
      'generate-practice-questions'
    );
    if (!rateCheck.allowed) {
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
    // ───────────────────────────────────────────────────────────────────

    // Get practice set details
    const { data: setData, error: setError } = await supabaseClient
      .from('practice_question_sets')
      .select('*')
      .eq('id', setId)
      .maybeSingle();

    if (setError) {
      throw setError;
    }
    if (!setData) {
      return new Response(
        JSON.stringify({ error: `Practice set not found: ${setId}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verify the user owns this practice set
    if (setData.user_id !== userId) {
      console.error('User does not own this practice set:', { userId, setUserId: setData.user_id });
      return new Response(
        JSON.stringify({ error: 'You do not have permission to generate this practice set.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    if(responseFormatsEnabled(setData.generation_context)) {
      if(setData.extraction_status==='completed')return new Response(JSON.stringify({success:true,status:'completed',setId}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
      const {data:existing,error}=await supabaseClient.from('practice_questions').select('id').eq('set_id',setId).limit(1);
      if(error || existing?.length)return new Response(JSON.stringify({error:'Create a fresh quiz instead of replacing an existing interactive attempt.'}),{status:409,headers:{...corsHeaders,'Content-Type':'application/json'}});
    }
    // Update status to extracting immediately
    await supabaseClient
      .from('practice_question_sets')
      .update({ extraction_status: 'extracting' })
      .eq('id', setId);

    // Inject forceRefresh flag into setData for background function
    const setDataWithFlags = {
      ...setData,
      __force_refresh: forceRefresh,
      __count_min: countMin,
      __count_max: countMax,
    };

    // Start background generation using EdgeRuntime.waitUntil
    // This ensures the work completes even after the response is sent
    (globalThis as any).EdgeRuntime?.waitUntil(
      generateQuestionsInBackground(setId, userId, setDataWithFlags)
    );

    // Return immediate response - client will poll for status
    console.log('Background generation started for set:', setId);
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'started',
        message: 'Generation started. Poll for status updates.',
        setId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error starting practice question generation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
