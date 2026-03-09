import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const { subjectName, educationalTier } = await req.json();
    if (!subjectName) {
      return new Response(JSON.stringify({ error: 'subjectName required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a curriculum specialist. Return ONLY a JSON array of topic name strings. No explanation, no markdown, no code fences.',
          },
          {
            role: 'user',
            content: `Generate 8-12 specific, realistic topics for someone studying this subject at the given level. Be specific to the subject — not generic.

Subject: "${subjectName}"
Level: "${educationalTier || 'General'}"

For example, "Quarterly Testing for Large Porous Load Sterilizers (NHS / HTM 01-01)" would have topics like: "Bowie-Dick Test", "Air Removal Tests", "Weekly Thermometric Testing", "Load Configuration", "HTM 01-01 Compliance", "Cycle Parametric Release".

Return ONLY a JSON array: ["Topic One", "Topic Two", ...]`,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'return_topics',
              description: 'Return the suggested topics',
              parameters: {
                type: 'object',
                properties: {
                  topics: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['topics'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'return_topics' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      throw new Error('AI gateway error');
    }

    const result = await response.json();

    // Extract from tool call
    let topics: string[] = [];
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        topics = parsed.topics || [];
      } catch {
        topics = [];
      }
    }

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('suggest-subject-topics error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
