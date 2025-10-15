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

    const { draftId } = await req.json();

    if (!draftId) {
      return new Response(JSON.stringify({ error: 'Draft ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Publishing exam:', draftId);

    // Verify exam ownership and fetch data
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', draftId)
      .eq('user_id', user.id)
      .single();

    if (examError || !exam) {
      return new Response(JSON.stringify({ error: 'Exam not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch verified question drafts
    const { data: drafts, error: draftError } = await supabase
      .from('exam_question_drafts')
      .select('*')
      .eq('exam_id', draftId)
      .order('question_number');

    if (draftError) {
      console.error('Fetch drafts error:', draftError);
      return new Response(JSON.stringify({ error: 'Failed to fetch question drafts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!drafts || drafts.length === 0) {
      return new Response(JSON.stringify({ error: 'No questions found. Please extract questions first.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Publishing ${drafts.length} extracted questions`);

    // Insert questions from drafts into exam_questions table
    const questionInserts = drafts.map((draft: any) => ({
      exam_id: draft.exam_id,
      question_number: draft.question_number,
      question_type: draft.question_type,
      question_text: draft.question_text,
      marks: draft.marks,
      options: draft.options,
      correct_answer: draft.correct_answer,
      original_page_number: draft.original_page_number,
      has_figures: draft.has_figures,
      has_tables: draft.has_tables,
      figure_urls: draft.figure_urls,
      topic_tag: draft.topic_tag,
      difficulty_level: draft.difficulty_level,
      extraction_confidence: draft.extraction_confidence,
      is_verified: true,
    }));

    const { error: insertError } = await supabase
      .from('exam_questions')
      .insert(questionInserts);

    if (insertError) {
      console.error('Insert questions error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to publish questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Published ${drafts.length} questions`);

    // Update status to published
    const { error: updateError } = await supabase
      .from('exams')
      .update({ status: 'published' })
      .eq('id', draftId);

    if (updateError) {
      console.error('Publish error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to publish exam' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      examId: draftId,
      questionsPublished: drafts.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in publish-exam:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
