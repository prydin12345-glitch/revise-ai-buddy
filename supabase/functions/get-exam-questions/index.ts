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

    const { examId, isPreview } = await req.json();

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
      .select('submitted_at, total_score, total_marks, status, time_taken_seconds, time_remaining_seconds, exam_started_at')
      .eq('exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle();

    // Calculate remaining time for timer
    let timeRemaining = timerData?.duration_minutes ? timerData.duration_minutes * 60 : 0;

    if (submission?.status === 'in_progress' && timerData?.enabled) {
      if (submission.time_remaining_seconds !== null && submission.time_remaining_seconds !== undefined) {
        // Resume from saved time
        timeRemaining = submission.time_remaining_seconds;
        console.log('Resuming timer from saved state:', timeRemaining);
      } else if (submission.exam_started_at) {
        // Fallback: Calculate based on start time
        const elapsedSeconds = Math.floor(
          (Date.now() - new Date(submission.exam_started_at).getTime()) / 1000
        );
        timeRemaining = Math.max(0, (timerData.duration_minutes * 60) - elapsedSeconds);
        console.log('Calculating timer from start time:', timeRemaining);
      }
    }

    // Fetch student's existing answers (including table_answers and answer_latex for math input)
    const { data: existingAnswers } = await supabase
      .from('student_answers')
      .select('question_id, answer_text, answer_latex, answer_format, score, feedback, is_correct, table_answers')
      .eq('exam_id', examId)
      .eq('student_id', user.id);

    // Robust question number parser
    const parseQuestionNumber = (numStr: string) => {
      // Extract main number (e.g., 17 from "17 (a) (ii)")
      const mainMatch = numStr.match(/^(\d+)/);
      const main = mainMatch ? parseInt(mainMatch[1], 10) : 0;
      
      // Extract sub-dot number (e.g., 2 from "1.2" or "17.3")
      const dotMatch = numStr.match(/^(\d+)\.(\d+)/);
      const subDot = dotMatch ? parseInt(dotMatch[2], 10) : 0;
      
      // Extract letter in parentheses or after number (e.g., 'a' from "17 (a)" or "17a")
      const letterMatch = numStr.match(/\(([a-z])\)/i) || numStr.match(/^[0-9]+\s*([a-z])/i);
      const letter = letterMatch ? letterMatch[1].toLowerCase().charCodeAt(0) - 96 : 0;
      
      // Extract Roman numerals (i, ii, iii, iv, v, vi, vii, viii, ix, x)
      const romanMatch = numStr.match(/\((i|ii|iii|iv|v|vi|vii|viii|ix|x)\)/i);
      const romanMap: Record<string, number> = {
        'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5,
        'vi': 6, 'vii': 7, 'viii': 8, 'ix': 9, 'x': 10
      };
      const roman = romanMatch ? romanMap[romanMatch[1].toLowerCase()] : 0;
      
      return [main, subDot, letter, roman];
    };

    // Sort questions using robust parser
    const sortQuestions = (questions: any[]) => {
      return questions.sort((a, b) => {
        const aParts = parseQuestionNumber(a.question_number);
        const bParts = parseQuestionNumber(b.question_number);
        
        // Compare each part in order: main -> subDot -> letter -> roman
        for (let i = 0; i < aParts.length; i++) {
          if (aParts[i] !== bParts[i]) {
            return aParts[i] - bParts[i];
          }
        }
        return 0;
      });
    };

    const sortedQuestions = sortQuestions(questions || []);

    // If preview mode, return all questions without submission checks
    if (isPreview) {
      return new Response(
        JSON.stringify({
          questions: sortedQuestions,
          isTeacher: false,
          timer: timerData?.enabled ? {
            enabled: true,
            duration_minutes: timerData.duration_minutes,
            time_remaining_seconds: timerData.duration_minutes * 60
          } : null,
          submission: null,
          existingAnswers: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
          diagram_config: q.diagram_config,
          figure_urls: q.figure_urls,
          has_figures: q.has_figures,
          has_tables: q.has_tables,
          data_type: q.data_type,
          graph_description: q.graph_description,
          table_data: q.table_data,
          generated_diagram_url: q.generated_diagram_url,
          diagram_type: q.diagram_type,
          circuit_type: q.circuit_type,
          circuit_description: q.circuit_description,
          needs_diagram: q.needs_diagram,
          question_latex: q.question_latex,
          has_math: q.has_math,
        }));

    return new Response(JSON.stringify({ 
      questions: responseQuestions,
      isTeacher,
      timer: timerData?.enabled ? {
        enabled: true,
        duration_minutes: timerData.duration_minutes,
        time_remaining_seconds: timeRemaining
      } : null,
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
