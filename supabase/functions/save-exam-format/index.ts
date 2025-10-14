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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { draftId, format } = await req.json();

    if (!draftId || !format) {
      return new Response(JSON.stringify({ error: 'Draft ID and format required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Saving format for exam:', draftId, format);

    // Verify exam ownership
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('id')
      .eq('id', draftId)
      .eq('user_id', user.id)
      .single();

    if (examError || !exam) {
      return new Response(JSON.stringify({ error: 'Exam not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert format
    const { error: formatError } = await supabase
      .from('exam_format')
      .upsert({
        exam_id: draftId,
        use_original_structure: format.useOriginal || false,
        mcq_count: format.mcq?.count || null,
        mcq_marks_each: format.mcq?.marksEach || null,
        short_answer_count: format.shortAnswer?.count || null,
        short_answer_marks_each: format.shortAnswer?.marksEach || null,
        long_form_count: format.longForm?.count || null,
        long_form_marks_each: format.longForm?.marksEach || null,
      }, {
        onConflict: 'exam_id',
      });

    if (formatError) {
      console.error('Format save error:', formatError);
      return new Response(JSON.stringify({ error: 'Failed to save format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in save-exam-format:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
