import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAIUsage } from "../_shared/usage-logger.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionText, correctAnswer, studentAnswer, studentQuery, options } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const optionsText = options && Array.isArray(options)
      ? `\nThe answer options were:\n${options.map((o: any, i: number) => `${String.fromCharCode(65 + i)}) ${typeof o === 'string' ? o : o.text}`).join('\n')}`
      : '';

    const systemPrompt = `You are a concise, helpful tutor. A student is reviewing an exam question they got wrong. 
Explain clearly and briefly why the correct answer is right. Keep your response under 150 words. 
Use simple language appropriate for the student's level. Do not repeat the full question back to them.`;

    const userPrompt = `Question: ${questionText}
${optionsText}
Correct answer: ${correctAnswer}
Student's answer: ${studentAnswer || 'No answer provided'}
Student asks: "${studentQuery}"

Give a brief, clear explanation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate an explanation.";

    // Log usage
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (user) {
          const usage = data.usage || {};
          await logAIUsage(supabase, {
            userId: user.id,
            feature: 'explain_answer',
            model: 'google/gemini-3-flash-preview',
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0,
            cacheHit: false,
          });
        }
      }
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({ explanation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("explain-answer error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
