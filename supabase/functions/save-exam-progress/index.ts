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
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { examId, timeRemainingSeconds } = await req.json();
    
    // Only examId is required - timeRemainingSeconds is optional (for non-timed exams)
    if (!examId) {
      return new Response(JSON.stringify({ error: 'Exam ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Saving exam progress: examId=${examId}, timeRemaining=${timeRemainingSeconds ?? 'N/A (non-timed)'}`);

    // Check if session already exists
    const { data: existing } = await supabase
      .from('exam_submissions')
      .select('id, exam_started_at')
      .eq('exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle();

    // Build upsert data - only include defined fields
    const upsertData: Record<string, any> = {
      exam_id: examId,
      student_id: user.id,
      status: 'in_progress',
      last_accessed_at: new Date().toISOString(),
    };

    // Only set exam_started_at for NEW sessions
    if (!existing) {
      upsertData.exam_started_at = new Date().toISOString();
      console.log('Creating new exam session');
    } else {
      console.log('Updating existing exam session:', existing.id);
    }

    // Only include timer fields if provided (for timed exams)
    if (timeRemainingSeconds !== null && timeRemainingSeconds !== undefined) {
      upsertData.time_remaining_seconds = timeRemainingSeconds;
    }

    const { error } = await supabase
      .from('exam_submissions')
      .upsert(upsertData, {
        onConflict: 'exam_id,student_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error saving progress:', error);
      return new Response(JSON.stringify({ error: 'Failed to save progress' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Progress saved successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in save-exam-progress:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
