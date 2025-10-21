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

    // Fetch questions (without SQL ordering)
    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', examId);

    if (questionsError) {
      console.error('Fetch questions error:', questionsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch timer settings
    const { data: timerData } = await supabase
      .from('exam_timer')
      .select('enabled, duration_minutes')
      .eq('exam_id', examId)
      .maybeSingle();

    // Check if student has already submitted
    const { data: submission } = await supabase
      .from('exam_submissions')
      .select('submitted_at, total_score, total_marks, status, time_taken_seconds')
      .eq('exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle();

    // Fetch student's existing answers
    const { data: existingAnswers } = await supabase
      .from('student_answers')
      .select('question_id, answer_text, score, feedback, is_correct')
      .eq('exam_id', examId)
      .eq('student_id', user.id);

    // Sort questions numerically (not alphabetically)
    const sortQuestions = (questions: any[]) => {
      return questions.sort((a, b) => {
        const aParts = a.question_number.split('.').map(Number);
        const bParts = b.question_number.split('.').map(Number);
        
        // Compare primary number first (1, 2, 3...)
        if (aParts[0] !== bParts[0]) {
          return aParts[0] - bParts[0];
        }
        
        // Then compare sub-number (1.1, 1.2...)
        return (aParts[1] || 0) - (bParts[1] || 0);
      });
    };

    const sortedQuestions = sortQuestions(questions || []);

    // If student and not submitted, remove correct answers
    const responseQuestions = (isTeacher || submission)
      ? sortedQuestions 
      : sortedQuestions.map(q => ({
          id: q.id,
          question_number: q.question_number,
          question_type: q.question_type,
          question_text: q.question_text,
          marks: q.marks,
          options: q.options,
          figure_urls: q.figure_urls,
          has_figures: q.has_figures,
          has_tables: q.has_tables,
        }));

    return new Response(JSON.stringify({ 
      questions: responseQuestions,
      isTeacher,
      timer: timerData || null,
      submission: submission || null,
      existingAnswers: existingAnswers || []
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
