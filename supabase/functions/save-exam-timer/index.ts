import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { OCR_ALEVEL_BIOLOGY_ID } from "../_shared/assessment-tier.ts";
import { paperPlanForAttempt } from "../_shared/course-selection.ts";

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

    const { draftId, enabled, duration } = await req.json();

    if (!draftId || enabled === undefined) {
      return new Response(JSON.stringify({ error: 'Draft ID and enabled status required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Saving timer for exam:', draftId, { enabled, duration });

    // Verify exam ownership
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id, generation_context')
      .eq('id', draftId)
      .eq('user_id', user.id)
      .single();

    if (examError || !exam) {
      return new Response(JSON.stringify({ error: 'Exam not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guided Unified biology timing comes from the frozen server contract,
    // including retries after profile edits. Custom timing and other papers
    // retain their existing behaviour; the user's timer toggle is preserved.
    const context = exam.generation_context;
    const unifiedPlan = context?.course_id === OCR_ALEVEL_BIOLOGY_ID && context.paper_id === 'paper_3'
      ? paperPlanForAttempt(context) : null;
    const effectiveDuration = unifiedPlan?.durationMinutes ?? duration;

    // Upsert timer config
    const { error: timerError } = await supabase
      .from('exam_timer')
      .upsert({
        exam_id: draftId,
        enabled,
        duration_minutes: enabled ? effectiveDuration : null,
      }, {
        onConflict: 'exam_id',
      });

    if (timerError) {
      console.error('Timer save error:', timerError);
      return new Response(JSON.stringify({ error: 'Failed to save timer' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in save-exam-timer:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
