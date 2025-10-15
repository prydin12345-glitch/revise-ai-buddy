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

    const { examId } = await req.json();

    if (!examId) {
      return new Response(JSON.stringify({ error: 'Exam ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is exam creator
    const { data: exam } = await supabase
      .from('exams')
      .select('user_id')
      .eq('id', examId)
      .single();

    const isTeacher = exam?.user_id === user.id;

    // Fetch questions
    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', examId)
      .order('question_number');

    if (questionsError) {
      console.error('Fetch questions error:', questionsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If student, remove correct answers
    const responseQuestions = isTeacher 
      ? questions 
      : questions?.map(q => ({
          id: q.id,
          question_number: q.question_number,
          question_type: q.question_type,
          question_text: q.question_text,
          marks: q.marks,
          options: q.options,
        }));

    return new Response(JSON.stringify({ 
      questions: responseQuestions,
      isTeacher 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-exam-questions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
