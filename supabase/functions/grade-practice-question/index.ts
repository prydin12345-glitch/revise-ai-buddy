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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { questionId, setId, answerText, workingOut } = await req.json();

    // Fetch question details
    const { data: question, error: questionError } = await supabase
      .from('practice_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError || !question) {
      throw new Error('Question not found');
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Prepare grading prompt
    const systemPrompt = `You are a supportive mathematics tutor grading student work. Your role is to:
- Award partial credit generously for correct methods, even if the final answer is wrong
- Provide constructive, encouraging feedback that addresses the student directly ("You")
- Format LaTeX expressions clearly and include decimal equivalents where helpful
- Explain what was done correctly and what needs adjustment
- Use a warm, educational tone - never harsh or discouraging

FEEDBACK TONE GUIDELINES:
- Full marks (100%): "Excellent! Your answer is completely correct."
- High partial marks (70-99%): "Great work! You're on the right track. [explain minor issue]"
- Medium partial marks (40-69%): "Good effort! You've got the main idea. [guide to completion]"
- Low partial marks (1-39%): "You've made a good start. [explain correct approach]"
- Zero marks: "Let's try a different approach. [guide toward solution without giving answer]"

NEVER use: "Incorrect", "Wrong", "You failed", "This is incorrect"
ALWAYS use: "Almost there", "Good effort", "Let's refine this", "You're close"

For mathematical expressions:
- Render LaTeX when appropriate but also provide decimal/simplified forms
- Example: "x = π/6 (or 0.524 radians)"
- Include brief explanations like "These values satisfy the equation within 0 ≤ x < 2π"`;

    const userPrompt = `Question: ${question.question_text}

Correct Answer: ${question.correct_answer || 'See worked solution'}

Student's Answer: ${answerText || '(No answer provided)'}

${workingOut ? `Student's Working:\n${workingOut}` : ''}

Total Marks Available: ${question.marks}

Grade this answer and provide detailed, constructive feedback. Award partial marks for:
- Method marks: Correct approach, setup, and working (even if answer is wrong)
- Accuracy marks: Correct final answer and precision

Return your grading using the grade_practice_answer function.`;

    // Call Lovable AI with function calling
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'grade_practice_answer',
            description: 'Grade a student practice answer with partial marking',
            parameters: {
              type: 'object',
              properties: {
                score: {
                  type: 'number',
                  description: 'Total score awarded (0 to question.marks)'
                },
                method_marks: {
                  type: 'number',
                  description: 'Marks for correct method/approach'
                },
                accuracy_marks: {
                  type: 'number',
                  description: 'Marks for correct final answer'
                },
                feedback: {
                  type: 'string',
                  description: 'Constructive, encouraging feedback for the student. Include what they did well and what to improve. Format LaTeX with decimal equivalents.'
                },
                is_correct: {
                  type: 'boolean',
                  description: 'True if answer is fully correct (score === marks)'
                }
              },
              required: ['score', 'feedback', 'is_correct'],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'grade_practice_answer' } }
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (aiResponse.status === 402) {
        throw new Error('AI service quota exceeded. Please contact support.');
      }
      throw new Error(`AI grading failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No grading result from AI');
    }

    const gradingResult = JSON.parse(toolCall.function.arguments);

    // Save answer to database
    const { error: saveError } = await supabase
      .from('practice_question_answers')
      .upsert({
        user_id: user.id,
        set_id: setId,
        question_id: questionId,
        answer_text: answerText,
        working_out: workingOut,
        score: gradingResult.score,
        method_marks: gradingResult.method_marks || null,
        accuracy_marks: gradingResult.accuracy_marks || null,
        is_correct: gradingResult.is_correct,
        feedback: gradingResult.feedback,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,question_id'
      });

    if (saveError) {
      console.error('Error saving answer:', saveError);
      throw saveError;
    }

    // Update progress
    const { data: progress } = await supabase
      .from('practice_set_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('set_id', setId)
      .single();

    const { data: allAnswers } = await supabase
      .from('practice_question_answers')
      .select('score, is_correct')
      .eq('user_id', user.id)
      .eq('set_id', setId);

    const questionsAttempted = allAnswers?.length || 0;
    const questionsCorrect = allAnswers?.filter(a => a.is_correct).length || 0;

    await supabase
      .from('practice_set_progress')
      .upsert({
        id: progress?.id || undefined,
        user_id: user.id,
        set_id: setId,
        questions_attempted: questionsAttempted,
        questions_correct: questionsCorrect,
        last_accessed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    return new Response(
      JSON.stringify({
        score: gradingResult.score,
        methodMarks: gradingResult.method_marks,
        accuracyMarks: gradingResult.accuracy_marks,
        feedback: gradingResult.feedback,
        isCorrect: gradingResult.is_correct
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in grade-practice-question:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});