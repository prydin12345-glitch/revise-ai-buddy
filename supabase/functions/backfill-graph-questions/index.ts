import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Cron-secret guard: this function rewrites correct_answer across all
  // graph questions and burns AI credits — only the scheduler may call it.
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing LOVABLE_API_KEY' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = { fixed: 0, failed: 0, skipped: 0, errors: [] as string[] };

  // Process practice_questions
  const { data: practiceQuestions } = await supabase
    .from('practice_questions')
    .select('id, question_text, correct_answer, marks')
    .in('question_type', ['graph_plotting', 'graph_sketch']);

  const allQuestions = [
    ...(practiceQuestions || []).map(q => ({ ...q, table: 'practice_questions' as const })),
  ];

  // Also get exam_questions  
  const { data: examQuestions } = await supabase
    .from('exam_questions')
    .select('id, question_text, correct_answer, marks')
    .in('question_type', ['graph_plotting', 'graph_sketch']);

  for (const eq of examQuestions || []) {
    allQuestions.push({ ...eq, table: 'exam_questions' as const });
  }

  console.log(`Found ${allQuestions.length} graph questions to check`);

  for (const q of allQuestions) {
    try {
      // Parse existing correct_answer
      let existing: any = {};
      try {
        existing = typeof q.correct_answer === 'string' 
          ? JSON.parse(q.correct_answer) 
          : (q.correct_answer || {});
      } catch { existing = {}; }

      // Check if markingFormula already exists and is valid
      const mf = existing?.plottingAnswer?.markingFormula;
      if (mf && typeof mf === 'string' && mf.trim().length > 0 && !mf.endsWith('$')) {
        // Validate it actually evaluates
        try {
          const fn = new Function('x', `return ${mf}`);
          const r = fn(1);
          if (typeof r === 'number' && isFinite(r)) {
            results.skipped++;
            continue; // Already has valid formula
          }
        } catch { /* invalid, proceed to fix */ }
      }

      // Ask AI to extract formula
      const prompt = `You are given an exam question about sketching or plotting a graph.
Extract the mathematical function and produce a plottingAnswer JSON object.

Question: "${q.question_text}"

Rules for markingFormula:
- Must be valid JavaScript with x as variable
- Use * for multiplication: x*(x-3)*(x+2) not x(x-3)(x+2)
- Use Math.pow(x,n) for powers
- NO trailing $ or special characters
- For transformations like f(x+1), substitute and simplify first

Return ONLY this JSON, no other text:
{
  "markingFormula": "javascript expression",
  "keyPoints": [{"x": 0, "y": 0, "type": "root", "label": "(0, 0)", "required": true, "marks": 1}],
  "curveShapeRules": [{"type": "positive_cubic", "crossingsCount": 3, "marks": 1}],
  "domainX": [-5, 5],
  "domainY": [-10, 10],
  "totalMarks": 4
}`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? '{}';
      
      // Strip markdown fences if present
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Validate markingFormula
      if (!parsed.markingFormula || parsed.markingFormula.endsWith('$')) {
        results.failed++;
        results.errors.push(`${q.table}/${q.id}: bad formula "${parsed.markingFormula}"`);
        continue;
      }

      // Validate it evaluates
      try {
        const fn = new Function('x', `return ${parsed.markingFormula}`);
        const r = fn(1);
        if (typeof r !== 'number' || !isFinite(r)) {
          results.failed++;
          results.errors.push(`${q.table}/${q.id}: formula eval failed at x=1`);
          continue;
        }
      } catch (e: any) {
        results.failed++;
        results.errors.push(`${q.table}/${q.id}: formula not valid JS: ${e.message}`);
        continue;
      }

      // Merge with existing correct_answer
      const updated = {
        ...existing,
        plottingAnswer: {
          ...(existing.plottingAnswer || {}),
          markingFormula: parsed.markingFormula,
          keyPoints: parsed.keyPoints || existing.plottingAnswer?.keyPoints || [],
          curveShapeRules: parsed.curveShapeRules || existing.plottingAnswer?.curveShapeRules || [],
          domainX: parsed.domainX || existing.plottingAnswer?.domainX || existing.graphConfig?.domainX || [-10, 10],
          domainY: parsed.domainY || existing.plottingAnswer?.domainY || existing.graphConfig?.domainY || [-10, 10],
          totalMarks: parsed.totalMarks || existing.plottingAnswer?.totalMarks || q.marks,
        },
      };

      const { error: updateError } = await supabase
        .from(q.table)
        .update({ correct_answer: JSON.stringify(updated) })
        .eq('id', q.id);

      if (updateError) {
        results.failed++;
        results.errors.push(`${q.table}/${q.id}: DB update failed: ${updateError.message}`);
      } else {
        results.fixed++;
        console.log(`Fixed ${q.table}/${q.id}: markingFormula="${parsed.markingFormula}"`);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));

    } catch (e: any) {
      results.failed++;
      results.errors.push(`${q.table}/${q.id}: ${e.message}`);
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
