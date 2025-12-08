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

    // Check if already submitted (status='graded' means already submitted and graded)
    const { data: existingSubmission } = await supabase
      .from('exam_submissions')
      .select('id, status')
      .eq('exam_id', examId)
      .eq('student_id', user.id)
      .maybeSingle();

    if (existingSubmission?.status === 'graded') {
      return new Response(JSON.stringify({ error: 'Exam already submitted' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch exam metadata to check subject and grade release settings
    const { data: examData } = await supabase
      .from('exams')
      .select('subject_id, title, assigned_by, grade_released')
      .eq('id', examId)
      .single();
    
    const isMathExam = examData?.subject_id?.toLowerCase().includes('math') || false;

    // Fetch assignment details for deadline and grade release settings
    const { data: assignment } = await supabase
      .from('exam_assignments')
      .select('deadline, is_grades_released, assigned_by')
      .eq('exam_id', examId)
      .maybeSingle();

    // Check if submission is late
    const now = new Date();
    const isLate = assignment?.deadline ? now > new Date(assignment.deadline) : false;
    console.log('Deadline check:', { deadline: assignment?.deadline, now: now.toISOString(), isLate });

    // Determine if scores should be hidden (tutor hasn't released grades)
    const scoresHidden = assignment && !assignment.is_grades_released && !examData?.grade_released;
    console.log('Score visibility:', { is_grades_released: assignment?.is_grades_released, grade_released: examData?.grade_released, scoresHidden });

    // Fetch all questions with correct answers
    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('id, question_text, question_type, correct_answer, marks, options, has_math, question_latex')
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
        
        // Parse math answer if it's JSON
        let workingOut = '';
        let finalAnswer = studentAnswer;
        let parsedAnswer: any = null;
        
        if (isMathExam) {
          try {
            parsedAnswer = JSON.parse(studentAnswer);
            workingOut = parsedAnswer.workingOut || '';
            finalAnswer = parsedAnswer.finalAnswer || studentAnswer;
          } catch {
            // Not JSON, treat as regular answer
          }
        }
        
        try {
          const isMathQuestion = question.has_math || question.question_latex || isMathExam;
          
          const systemPrompt = isMathQuestion 
            ? `You are a mathematics exam grader. Award partial credit for:
- Correct method even if final answer is wrong
- Correct setup/equation formulation
- Algebraic manipulation steps
- Unit conversions and substitutions
- Clear mathematical reasoning

Be generous with method marks but strict with accuracy.

IMPORTANT: Address the student directly using "You" (e.g., "You have provided the correct answer", "Your method is correct"). Never use "The student" or third-person language.`
            : 'You are an expert exam grader. Score student answers based on correctness, completeness, and accuracy. Address the student directly using "You" rather than "The student".';
          
          const userPrompt = isMathQuestion
            ? `You are grading a MATHEMATICS exam question. Award partial credit appropriately.

Question: ${question.question_text}
${question.question_latex ? `LaTeX: ${question.question_latex}` : ''}
Correct Answer: ${question.correct_answer}

${parsedAnswer ? `Student's Working Out: ${workingOut || 'Not provided'}
Student's Final Answer: ${finalAnswer}` : `Student Answer: ${studentAnswer}`}

Total Marks: ${question.marks}

Provide:
- Method marks (for working out) if applicable
- Accuracy marks (for final answer)
- Total score
- Brief feedback explaining mark breakdown`
            : `Question: ${question.question_text}\n\nCorrect Answer: ${question.correct_answer}\n\nStudent Answer: ${studentAnswer}\n\nTotal Marks: ${question.marks}\n\nScore this answer and provide brief feedback.`;

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
                  content: systemPrompt
                },
                {
                  role: 'user',
                  content: userPrompt
                }
              ],
              tools: [{
                type: "function",
                function: {
                  name: "grade_answer",
                  description: "Grade a student's answer with optional partial credit breakdown",
                  parameters: {
                    type: "object",
                    properties: {
                      score: { type: "number", description: "Total score out of total marks" },
                      feedback: { type: "string", description: "Brief feedback explaining the score" },
                      isCorrect: { type: "boolean", description: "Whether answer is fully correct" },
                      methodMarks: { type: "number", description: "Marks awarded for method/working (optional, for math questions)" },
                      accuracyMarks: { type: "number", description: "Marks awarded for final answer accuracy (optional, for math questions)" }
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
              
              // Build feedback with breakdown if available
              if (grading.methodMarks !== undefined && grading.accuracyMarks !== undefined) {
                feedback = `${grading.feedback}\n\n📊 Mark Breakdown:\n• Method: ${grading.methodMarks}/${question.marks - (grading.accuracyMarks || 0)}\n• Accuracy: ${grading.accuracyMarks}/${grading.accuracyMarks || 0}`;
              } else {
                feedback = grading.feedback;
              }
              
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

    // Update or create exam submission record with is_late flag
    let submissionError;
    if (existingSubmission) {
      // Update existing in_progress submission
      const { error } = await supabase
        .from('exam_submissions')
        .update({
          status: 'graded',
          submitted_at: now.toISOString(),
          time_taken_seconds: timeTakenSeconds,
          total_score: totalScore,
          total_marks: totalMarks,
          time_remaining_seconds: null,
          is_late: isLate,
        })
        .eq('id', existingSubmission.id);
      submissionError = error;
    } else {
      // Create new submission
      const { error } = await supabase
        .from('exam_submissions')
        .insert({
          exam_id: examId,
          student_id: user.id,
          time_taken_seconds: timeTakenSeconds,
          total_score: totalScore,
          total_marks: totalMarks,
          status: 'graded',
          is_late: isLate,
        });
      submissionError = error;
    }

    if (submissionError) {
      console.error('Submission error:', submissionError);
      return new Response(JSON.stringify({ error: 'Failed to submit exam' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Exam submitted successfully. Score:', totalScore, '/', totalMarks, 'Late:', isLate);

    // Create notification for tutor/teacher if this is an assigned exam
    const tutorId = assignment?.assigned_by || examData?.assigned_by;
    if (tutorId) {
      try {
        // Get student name
        const { data: studentProfile } = await supabase
          .from('user_profiles')
          .select('first_name, last_name, display_name')
          .eq('id', user.id)
          .single();
        
        const studentName = studentProfile?.display_name || 
          (studentProfile?.first_name && studentProfile?.last_name 
            ? `${studentProfile.first_name} ${studentProfile.last_name}` 
            : 'A student');

        await supabase.from('notifications').insert({
          user_id: tutorId,
          type: 'exam_submitted',
          title: 'Exam Submitted',
          body: `${studentName} has submitted "${examData?.title || 'an exam'}"${isLate ? ' (Late)' : ''}`,
          action_data: { 
            exam_id: examId, 
            student_id: user.id,
            is_late: isLate,
            score: scoresHidden ? null : totalScore,
            total_marks: scoresHidden ? null : totalMarks
          }
        });
        console.log('Tutor notification created for:', tutorId);
      } catch (notifError) {
        console.error('Failed to create tutor notification:', notifError);
        // Don't fail the submission for notification errors
      }
    }

    // Update user streak
    const { data: streakData } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    let newStreak = 1;
    let longestStreak = 1;

    if (streakData) {
      const lastSubmission = streakData.last_exam_submitted_at 
        ? new Date(streakData.last_exam_submitted_at) 
        : null;
      
      if (lastSubmission) {
        const hoursSinceLastSubmission = 
          (now.getTime() - lastSubmission.getTime()) / (1000 * 60 * 60);
        
        // Within 24 hours = continue streak
        if (hoursSinceLastSubmission <= 24) {
          newStreak = streakData.current_streak + 1;
          longestStreak = Math.max(newStreak, streakData.longest_streak);
        } else {
          // Reset streak if > 24 hours
          newStreak = 1;
          longestStreak = streakData.longest_streak;
        }
      }
      
      // Update existing streak
      await supabase
        .from('user_streaks')
        .update({
          current_streak: newStreak,
          longest_streak: longestStreak,
          last_exam_submitted_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('user_id', user.id);
    } else {
      // Create first streak
      await supabase
        .from('user_streaks')
        .insert({
          user_id: user.id,
          current_streak: 1,
          longest_streak: 1,
          last_exam_submitted_at: now.toISOString()
        });
    }

    console.log('Streak updated. New streak:', newStreak);

    return new Response(JSON.stringify({ 
      success: true,
      totalScore: scoresHidden ? null : totalScore,
      totalMarks: scoresHidden ? null : totalMarks,
      percentage: scoresHidden ? null : (totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0),
      scoresHidden,
      isLate
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