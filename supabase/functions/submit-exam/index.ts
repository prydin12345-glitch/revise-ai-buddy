import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const { examId, timeTakenSeconds } = await req.json();
    console.log('Submitting exam:', examId, 'for user:', user.id);

    // Check if already submitted
    const { data: existingSubmission } = await supabase
      .from('exam_submissions')
      .select('id')
      .eq('exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle();

    if (existingSubmission) {
      return new Response(JSON.stringify({ error: 'Exam already submitted' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all questions with correct answers
    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('id, question_text, question_type, correct_answer, marks, options')
      .eq('exam_id', examId);

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch student answers
    const { data: studentAnswers, error: answersError } = await supabase
      .from('student_answers')
      .select('question_id, answer_text')
      .eq('exam_id', examId)
      .eq('student_id', user.id);

    if (answersError) {
      console.error('Error fetching answers:', answersError);
    }

    const answerMap = new Map(studentAnswers?.map(a => [a.question_id, a.answer_text]) || []);
    
    let totalScore = 0;
    let totalMarks = 0;

    // Score each question
    for (const question of questions || []) {
      totalMarks += question.marks;
      const studentAnswer = answerMap.get(question.id) || '';

      let score = 0;
      let feedback = '';
      let isCorrect = false;

      if (!studentAnswer || studentAnswer.trim() === '') {
        // No answer provided
        feedback = 'No answer provided';
        isCorrect = false;
      } else if (question.question_type === 'mcq') {
        // Simple exact match for MCQ
        const correctAnswer = question.correct_answer?.toLowerCase().trim() || '';
        const studentAnswerLower = studentAnswer.toLowerCase().trim();
        isCorrect = studentAnswerLower === correctAnswer;
        score = isCorrect ? question.marks : 0;
        feedback = isCorrect ? 'Correct!' : `Incorrect. Correct answer: ${question.correct_answer}`;
      } else {
        // Use Lovable AI to score written answers
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        
        try {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert exam grader. Score student answers based on correctness, completeness, and accuracy.'
                },
                {
                  role: 'user',
                  content: `Question: ${question.question_text}\n\nCorrect Answer: ${question.correct_answer}\n\nStudent Answer: ${studentAnswer}\n\nTotal Marks: ${question.marks}\n\nScore this answer and provide brief feedback.`
                }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "grade_answer",
                  description: "Grade a student's answer",
                  parameters: {
                    type: "object",
                    properties: {
                      score: { type: "number", description: "Score out of total marks" },
                      feedback: { type: "string", description: "Brief feedback explaining the score" },
                      isCorrect: { type: "boolean", description: "Whether answer is fully correct" }
                    },
                    required: ["score", "feedback", "isCorrect"],
                    additionalProperties: false
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "grade_answer" } }
            }),
          });

          if (aiResponse.status === 429) {
            console.error('AI rate limit exceeded');
            score = 0;
            feedback = 'Unable to grade - rate limit exceeded';
            isCorrect = false;
          } else if (aiResponse.status === 402) {
            console.error('AI credits depleted');
            score = 0;
            feedback = 'Unable to grade - credits depleted';
            isCorrect = false;
          } else if (!aiResponse.ok) {
            console.error('AI grading error:', await aiResponse.text());
            score = 0;
            feedback = 'Unable to grade automatically';
            isCorrect = false;
          } else {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            
            if (toolCall) {
              const grading = JSON.parse(toolCall.function.arguments);
              score = Math.min(Math.max(0, grading.score), question.marks);
              feedback = grading.feedback;
              isCorrect = grading.isCorrect;
            } else {
              console.error('No tool call in AI response');
              score = 0;
              feedback = 'Unable to grade automatically';
              isCorrect = false;
            }
          }
        } catch (aiError) {
          console.error('AI grading exception:', aiError);
          score = 0;
          feedback = 'Unable to grade automatically';
          isCorrect = false;
        }
      }

      totalScore += score;
      console.log(`Question ${question.id}: score=${score}, isCorrect=${isCorrect}`);

      // Update student_answers with score and feedback
      const { error: updateError } = await supabase
        .from('student_answers')
        .update({
          score,
          feedback,
          is_correct: isCorrect
        })
        .eq('question_id', question.id)
        .eq('student_id', user.id);

      if (updateError) {
        console.error('Error updating answer:', updateError);
      }
    }

    // Create exam submission record
    const { error: submissionError } = await supabase
      .from('exam_submissions')
      .insert({
        exam_id: examId,
        student_id: user.id,
        time_taken_seconds: timeTakenSeconds,
        total_score: totalScore,
        total_marks: totalMarks,
        status: 'graded'
      });

    if (submissionError) {
      console.error('Submission error:', submissionError);
      return new Response(JSON.stringify({ error: 'Failed to submit exam' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Exam submitted successfully. Score:', totalScore, '/', totalMarks);

    return new Response(JSON.stringify({ 
      success: true,
      totalScore,
      totalMarks,
      percentage: totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in submit-exam:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
