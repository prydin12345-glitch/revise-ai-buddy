import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/usage-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { questionId, questionText, correctAnswer, markScheme, subject } = await req.json();

    if (!questionId || !questionText) {
      return new Response(JSON.stringify({ error: 'questionId and questionText required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if rationale already exists in DB
    const { data: existing } = await supabase
      .from('practice_questions')
      .select('rationale')
      .eq('id', questionId)
      .single();

    if (existing?.rationale) {
      return new Response(JSON.stringify({ rationale: existing.rationale }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startTime = Date.now();

    const prompt = `Explain in 2-3 sentences why the following answer is correct.
Be clear and educational. Assume the student got it wrong.

Subject: ${subject || 'General'}
Question: ${questionText}
Correct answer: ${correctAnswer || 'Not provided'}
${markScheme ? `Mark scheme: ${markScheme}` : ''}

Return JSON only: {"rationale": "your explanation here"}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);
    const rationale = parsed.rationale || 'Could not generate an explanation.';

    // Cache in DB
    await supabase
      .from('practice_questions')
      .update({ rationale })
      .eq('id', questionId);

    // Log usage
    const usage = data.usage || {};
    await logAIUsage(supabase, {
      userId: user.id,
      feature: 'rationale',
      model: 'google/gemini-2.5-flash-lite',
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      cacheHit: false,
      subject: subject || undefined,
      durationMs: Date.now() - startTime,
    });

    return new Response(JSON.stringify({ rationale }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('generate-rationale error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
