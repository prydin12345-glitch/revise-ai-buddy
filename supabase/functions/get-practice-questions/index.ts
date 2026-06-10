import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// get-practice-questions
// =============================================================================
// Secure question fetcher for the practice quiz. Replaces direct client-side
// `select('*')` on practice_questions, which shipped correct_answer,
// worked_solution and rationale to the student's browser before they answered.
//
// Rules:
//  - Caller must be authenticated and own the practice set.
//  - Questions the user has NOT yet answered are stripped of:
//      worked_solution, rationale, and correct_answer
//    EXCEPT graph-type questions, which keep correct_answer because the
//    plotting canvas needs it for axes/domain setup (known limitation until
//    plot-setup data is separated from answer data).
//  - Questions the user HAS answered are returned in full, so review mode
//    and worked-solution reveal work normally.
//
// Body: { setId: string, questionId?: string }
//  - With questionId: returns just that question (used after grading and
//    after regenerating a question).
// Returns: { questions: [...] }
// =============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_TYPES = ['graph_plotting', 'graph_interpretation', 'graph_transformation'];

function stripAnswerFields(question: any, answeredIds: Set<string>): any {
  if (answeredIds.has(question.id)) {
    return question; // already answered — full data for review
  }
  const stripped = { ...question };
  delete stripped.worked_solution;
  delete stripped.rationale;
  if (!GRAPH_TYPES.includes(question.question_type)) {
    delete stripped.correct_answer;
  }
  return stripped;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── AUTH ───────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorised' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorised' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { setId, questionId } = await req.json();
    if (!setId) {
      return new Response(JSON.stringify({ error: 'setId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── OWNERSHIP ──────────────────────────────────────────────────────
    const { data: setRow, error: setError } = await supabase
      .from('practice_question_sets')
      .select('id, user_id')
      .eq('id', setId)
      .maybeSingle();

    if (setError) throw setError;
    if (!setRow || setRow.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── FETCH QUESTIONS ────────────────────────────────────────────────
    let query = supabase
      .from('practice_questions')
      .select('*')
      .eq('set_id', setId)
      .order('question_number_int')
      .order('question_number');

    if (questionId) {
      query = query.eq('id', questionId);
    }

    const { data: questions, error: questionsError } = await query;
    if (questionsError) throw questionsError;

    // ── FETCH USER'S ANSWERS (to decide what to reveal) ────────────────
    const { data: answers, error: answersError } = await supabase
      .from('practice_question_answers')
      .select('question_id')
      .eq('user_id', user.id)
      .eq('set_id', setId);
    if (answersError) throw answersError;

    const answeredIds = new Set((answers ?? []).map((a: any) => a.question_id));
    const safeQuestions = (questions ?? []).map((q: any) => stripAnswerFields(q, answeredIds));

    return new Response(JSON.stringify({ questions: safeQuestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('get-practice-questions error:', error);
    return new Response(JSON.stringify({ error: error.message ?? 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
