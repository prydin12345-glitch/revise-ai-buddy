import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { questionId, originalText, topicTag, questionType, marks, difficultyLevel } = await req.json();

    if (!questionId || !originalText) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Regenerating question ${questionId}`);

    const regenerationPrompt = `Original question: "${originalText}"
Topic: ${topicTag}
Type: ${questionType}
Marks: ${marks}
Difficulty: ${difficultyLevel}

Generate a COMPLETELY NEW question that:
1. Tests the SAME learning objective/concept
2. Uses DIFFERENT wording, phrasing, and structure
3. Provides DIFFERENT examples, scenarios, or contexts
4. If numerical data is involved, use NEW synthetic values
5. For MCQs: Create ENTIRELY NEW options (if applicable)
6. Maintains the same difficulty and mark value
7. Never copies any original text

TABLE FORMATTING (if applicable):
- If the question contains a table, format it as HTML using this exact structure:
  <table class="exam-table">
    <thead><tr><th>Header 1</th><th>Header 2</th></tr></thead>
    <tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody>
  </table>
- Use "X" or "✓" for checkmarks in cells
- Preserve the table structure and data relationships

SCIENTIFIC & MATHEMATICAL NOTATION (ALL SUBJECTS - CRITICAL):
Use LaTeX notation, NEVER HTML tags.

1. Scientific notation: "$2.15 \\times 10^{-12}$" NOT "2.15 x 10<sup>-12</sup>"
2. Units with exponents: "$m \\, s^{-1}$" NOT "m s<sup>-1</sup>"
3. Chemical formulas: "$H_2O$", "$Na^+$" NOT "H<sub>2</sub>O" or "Na<sup>+</sup>"
4. Math expressions: "$v^2$", "$\\frac{1}{2}mv^2$" NOT "v<sup>2</sup>"
5. Wrap all scientific/math content in $ delimiters
6. Examples:
   - Chemistry: "$K_a = 1.7 \\times 10^{-5}$", "$CH_3COOH$"
   - Physics: "$3.5 \\times 10^8 \\, m \\, s^{-1}$", "$E = mc^2$"
   - Biology: "$C_{10}H_{16}N_5O_{13}P_3$"

NEVER use <sup>, <sub>, <i>, or <b> tags.

CRITICAL: Be creative! Change names, locations, scenarios, values - make it fresh while testing the same skill.

Return ONLY the new question text (and options if MCQ), no explanation.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert at creating original exam questions. Never copy verbatim - always generate fresh content while preserving educational value.' },
          { role: 'user', content: regenerationPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'AI regeneration failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const newQuestionText = aiData.choices?.[0]?.message?.content || originalText;

    // Update the question in database
    const { error: updateError } = await supabase
      .from('exam_question_drafts')
      .update({
        question_text: newQuestionText,
        generation_status: 'ai_generated',
      })
      .eq('id', questionId);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update question' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Successfully regenerated question ${questionId}`);

    return new Response(JSON.stringify({ 
      success: true,
      newText: newQuestionText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in regenerate-question:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
