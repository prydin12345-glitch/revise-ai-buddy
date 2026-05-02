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

    // Valid question types for exam_questions table
    // (Enforced by DB check constraint: exam_questions_question_type_check)
    const validQuestionTypes = ['mcq', 'short_answer', 'long_form', 'graph_plotting', 'graph_interpretation', 'bearings', 'table_grid'];
    
    // Map invalid types to valid ones
    const mapQuestionType = (type: string, marks?: number): string => {
      if (!type) return (marks && marks >= 6) ? 'long_form' : 'short_answer';
      const normalized = String(type).trim().toLowerCase();

      // Normalise AI variants of the plotting type so they remain interactive
      // graph questions instead of being demoted to text-only short_answer.
      if (
        normalized === 'graph_sketch' ||
        normalized === 'graph-sketch' ||
        normalized === 'sketch_graph' ||
        normalized === 'graph_drawing' ||
        normalized === 'curve_sketch'
      ) {
        return 'graph_plotting';
      }

      if (validQuestionTypes.includes(normalized)) return normalized;

      // Map common alternative types to DB-accepted values
      if (
        normalized === 'essay' ||
        normalized === 'extended_response' ||
        normalized === 'extended-response' ||
        normalized === 'long_answer' ||
        normalized === 'long-answer' ||
        normalized === 'long' ||
        normalized === 'free_response' ||
        normalized === 'free-response'
      ) {
        return 'long_form';
      }

      if (normalized === 'multiple_choice' || normalized === 'multiple-choice') return 'mcq';
      if (normalized === 'short' || normalized === 'brief') return 'short_answer';

      // Heuristic fallback: higher-mark questions are usually long-form
      const fallback = (marks && marks >= 6) ? 'long_form' : 'short_answer';
      console.warn(`Unknown question type "${type}" - mapping to ${fallback}`);
      return fallback;
    };

    // Validate MCQ questions have correct_answer set
    const mcqsWithoutAnswer = drafts.filter((d: any) => 
      d.question_type === 'mcq' && (!d.correct_answer || d.correct_answer.trim() === '')
    );
    
    if (mcqsWithoutAnswer.length > 0) {
      console.warn(`Found ${mcqsWithoutAnswer.length} MCQs without correct_answer - setting defaults`);
    }

    // Insert questions from drafts into exam_questions table
    const questionInserts = drafts.map((draft: any) => {
      const mappedType = mapQuestionType(draft.question_type, draft.marks);
      const correctAnswer = mappedType === 'mcq' && (!draft.correct_answer || draft.correct_answer.trim() === '')
        ? 'A' // Default to A if missing for MCQs
        : draft.correct_answer;
      
      // For graph questions, correct_answer contains graphConfig — also copy to options for frontend
      let options = draft.options;
      if ((mappedType === 'graph_plotting' || mappedType === 'graph_interpretation') && correctAnswer) {
        try {
          const graphData = typeof correctAnswer === 'string' ? JSON.parse(correctAnswer) : correctAnswer;
          if (graphData?.graphConfig) {
            options = graphData;
            console.log(`Question ${draft.question_number}: Copied graph data to options field`);
          }
        } catch { /* not JSON, keep original options */ }
      }

      return {
        exam_id: draft.exam_id,
        question_number: draft.question_number,
        question_type: mappedType,
        question_text: draft.question_text,
        marks: draft.marks,
        options,
        correct_answer: typeof correctAnswer === 'object' ? JSON.stringify(correctAnswer) : correctAnswer,
        original_page_number: draft.original_page_number,
        has_figures: draft.has_figures,
        has_tables: draft.has_tables,
        figure_urls: draft.figure_urls,
        topic_tag: draft.topic_tag,
        difficulty_level: draft.difficulty_level,
        extraction_confidence: draft.extraction_confidence,
        diagram_config: draft.diagram_config,
        data_type: draft.data_type,
        graph_description: draft.graph_description,
        table_data: draft.table_data,
        circuit_type: draft.circuit_type,
        circuit_description: draft.circuit_description,
        needs_diagram: draft.needs_diagram,
        diagram_type: draft.diagram_type,
        scenario_context: draft.scenario_context,
        command_verb: draft.command_verb,
        numerical_answer: draft.numerical_answer,
        generated_diagram_url: draft.generated_diagram_url,
        question_latex: draft.question_latex,
        has_math: draft.has_math,
        equation_complexity: draft.equation_complexity,
        parent_question_number: draft.parent_question_number,
        root_question_number: draft.root_question_number,
        is_verified: true,
      };
    });

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
