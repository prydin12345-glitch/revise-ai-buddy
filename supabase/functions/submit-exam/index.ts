import "https://esm.sh/xhr-shim@0.1.3";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitiseFeedback, FEEDBACK_FORMATTING_RULE } from "../_shared/sanitise-feedback.ts";

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

    const { examId, timeTakenSeconds, selfMarkScores: rawSelfMarkScores } = await req.json();
    const selfMarkScores: Record<string, number> =
      rawSelfMarkScores && typeof rawSelfMarkScores === 'object' ? rawSelfMarkScores : {};
    console.log('Submitting exam:', examId, 'for user:', user.id, 'self-mark questions:', Object.keys(selfMarkScores).length);

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

    // Fetch student answers including table_answers and answer_latex for math input
    const { data: studentAnswers, error: answersError } = await supabase
      .from('student_answers')
      .select('question_id, answer_text, answer_latex, answer_format, table_answers')
      .eq('exam_id', examId)
      .eq('student_id', user.id);

    if (answersError) {
      console.error('Error fetching answers:', answersError);
    }

    // Create maps for text answers, latex answers, and table answers
    const answerMap = new Map(studentAnswers?.map(a => [a.question_id, a.answer_text]) || []);
    const latexAnswerMap = new Map(studentAnswers?.map(a => [a.question_id, a.answer_latex]) || []);
    const answerFormatMap = new Map(studentAnswers?.map(a => [a.question_id, a.answer_format]) || []);
    const tableAnswerMap = new Map(studentAnswers?.map(a => [a.question_id, a.table_answers]) || []);
    
    // Helper function to format table answers for AI grading
    const formatTableAnswersForGrading = (tableAnswers: any): string => {
      if (!tableAnswers || typeof tableAnswers !== 'object') return '';
      
      const entries: string[] = [];
      for (const [cellKey, value] of Object.entries(tableAnswers)) {
        if (value !== undefined && value !== null && value !== '') {
          // Format: "Row X, Column Y: value" or "Cell key: value"
          const displayValue = value === true ? '✓ (checked)' : value === false ? '(unchecked)' : String(value);
          entries.push(`${cellKey}: ${displayValue}`);
        }
      }
      
      if (entries.length === 0) return '';
      return entries.join('\n');
    };
    
    let totalScore = 0;
    let totalMarks = 0;

    // Score each question
    for (const question of questions || []) {
      totalMarks += question.marks;
      const studentAnswer = answerMap.get(question.id) || '';

      // Drawing self-mark short-circuit: trust the student's self-mark score and skip AI grading.
      // Triggered either by a self-mark score in the request, or by a stored answer prefixed "drawing:".
      const hasSelfMarkScore = Object.prototype.hasOwnProperty.call(selfMarkScores, question.id);
      const isDrawingAnswer = typeof studentAnswer === 'string' && studentAnswer.startsWith('drawing:');
      if (hasSelfMarkScore || isDrawingAnswer) {
        const rawScore = hasSelfMarkScore ? Number(selfMarkScores[question.id]) : 0;
        const safeScore = Number.isFinite(rawScore)
          ? Math.min(Math.max(0, rawScore), question.marks)
          : 0;
        const isCorrectSelfMark = safeScore >= question.marks && question.marks > 0;
        const feedbackSelfMark = hasSelfMarkScore
          ? `Self-marked: ${safeScore}/${question.marks}`
          : 'Diagram submitted (not self-marked)';

        totalScore += safeScore;
        console.log(`Question ${question.id}: self-mark score=${safeScore}/${question.marks}`);

        const { error: updateErr } = await supabase
          .from('student_answers')
          .update({
            score: safeScore,
            feedback: feedbackSelfMark,
            is_correct: isCorrectSelfMark,
          })
          .eq('question_id', question.id)
          .eq('student_id', user.id);
        if (updateErr) console.error('Error updating self-marked answer:', updateErr);
        continue;
      }

      const studentLatex = latexAnswerMap.get(question.id) || '';
      const answerFormat = answerFormatMap.get(question.id) || 'text';
      const tableAnswers = tableAnswerMap.get(question.id);
      const formattedTableAnswers = formatTableAnswersForGrading(tableAnswers);
      
      // Check if this is a table_grid answer (tick/X table) - support both formats
      let tableGridAnswers: Record<string, number[]> | null = null;
      try {
        const parsed = JSON.parse(studentAnswer);
        if (parsed._type === 'table_grid') {
          // New format (version 2)
          if (parsed.version === 2 && parsed.cells) {
            tableGridAnswers = {};
            for (const [rowId, colMap] of Object.entries(parsed.cells as Record<string, Record<number, boolean>>)) {
              tableGridAnswers[rowId] = Object.entries(colMap)
                .filter(([_, selected]) => selected)
                .map(([colIdx]) => parseInt(colIdx, 10));
            }
          }
          // Legacy format
          else if (parsed.answers) {
            tableGridAnswers = parsed.answers;
          }
        }
      } catch {
        // Not JSON or not table_grid format
      }
      
      // Determine if this question has table answers
      const hasTableAnswers = formattedTableAnswers.length > 0;
      const hasLatexAnswer = studentLatex && studentLatex.trim() !== '';
      const hasTextAnswer = studentAnswer && studentAnswer.trim() !== '' && !tableGridAnswers;
      const hasTableGridAnswer = tableGridAnswers !== null && Object.keys(tableGridAnswers).length > 0;
      const hasAnyAnswer = hasTableAnswers || hasLatexAnswer || hasTextAnswer || hasTableGridAnswer;

      let score = 0;
      let feedback = '';
      let isCorrect = false;

      if (!hasAnyAnswer) {
        // No answer provided (neither text nor table nor latex)
        feedback = 'No answer provided';
        isCorrect = false;
      } else if (hasTableGridAnswer && tableGridAnswers) {
        // DETERMINISTIC GRADING for table_grid questions (tick/X tables)
        
        // Detect table type from question text for validation
        const questionText = question.question_text || '';
        const questionLower = questionText.toLowerCase();
        const headerMatch = questionText.match(/^\s*\|([^|]+\|)+/m);
        const headers: string[] = headerMatch 
          ? headerMatch[0].split('|').filter((h: string) => h.trim()).map((h: string) => h.trim())
          : [];
        
        // Determine table type for validation
        let tableType: 'tf_single' | 'grid_single' | 'grid_multi' = 'grid_multi';
        const headersLower = headers.map((h: string) => h.toLowerCase());
        
        if (headersLower.includes('true') && headersLower.includes('false')) {
          tableType = 'tf_single';
        } else if (headers.length === 3) {
          const col1 = headersLower[1] || '';
          const col2 = headersLower[2] || '';
          if ((col1 === 'yes' && col2 === 'no') || (col1 === 'a' && col2 === 'b')) {
            tableType = 'grid_single';
          }
        }
        
        // HARD VALIDATION: Sanitize answers based on table type
        const sanitizedAnswers: Record<string, number[]> = {};
        const validationErrors: string[] = [];
        
        for (const [rowId, selections] of Object.entries(tableGridAnswers)) {
          if (tableType === 'tf_single' || tableType === 'grid_single') {
            // Only one selection allowed per row
            if (selections.length > 1) {
              validationErrors.push(`Row "${rowId}": Multiple selections detected, keeping only first`);
              sanitizedAnswers[rowId] = [selections[0]];
            } else {
              sanitizedAnswers[rowId] = selections;
            }
          } else {
            sanitizedAnswers[rowId] = selections;
          }
        }
        
        if (validationErrors.length > 0) {
          console.warn('Table grid validation errors:', validationErrors);
        }
        
        // Parse correct answers from question
        let correctAnswers: Record<string, number[]> | null = null;
        
        if (question.correct_answer) {
          try {
            const parsed = JSON.parse(question.correct_answer);
            if (parsed.correctAnswers) {
              correctAnswers = parsed.correctAnswers;
            } else if (typeof parsed === 'object' && !parsed._type && !parsed.version) {
              correctAnswers = parsed;
            }
          } catch {
            // Not valid JSON format
          }
        }
        
        if (correctAnswers && Object.keys(correctAnswers).length > 0) {
          // GRADING based on table type
          const nonExampleRows = Object.keys(correctAnswers);
          const marksPerRow = question.marks / nonExampleRows.length;
          let totalScore = 0;
          const rowResults: string[] = [];
          
          for (const rowId of nonExampleRows) {
            const expected = correctAnswers[rowId] || [];
            const actual = sanitizedAnswers[rowId] || [];
            
            if (tableType === 'tf_single' || tableType === 'grid_single') {
              // Radio behavior: exactly one correct answer per row
              if (actual.length === 0) {
                rowResults.push(`${rowId}: ⚠ Unanswered`);
              } else if (expected.length === 1 && actual.length === 1 && expected[0] === actual[0]) {
                totalScore += marksPerRow;
                rowResults.push(`${rowId}: ✓ Correct`);
              } else {
                rowResults.push(`${rowId}: ✗ Incorrect`);
              }
            } else {
              // Multi-select with anti-"select all" scoring
              const expectedSet = new Set(expected);
              let correctCount = 0;
              let incorrectCount = 0;
              
              for (const col of actual) {
                if (expectedSet.has(col)) {
                  correctCount++;
                } else {
                  incorrectCount++;
                }
              }
              
              // F1-like scoring
              const rawScore = Math.max(0, correctCount - incorrectCount);
              const rowScore = expected.length > 0 
                ? Math.min((rawScore / expected.length) * marksPerRow, marksPerRow)
                : 0;
              
              totalScore += rowScore;
              
              const isFullyCorrect = correctCount === expected.length && incorrectCount === 0;
              if (isFullyCorrect) {
                rowResults.push(`${rowId}: ✓ Correct`);
              } else if (correctCount > 0) {
                rowResults.push(`${rowId}: Partial (${correctCount} correct, ${incorrectCount} extra)`);
              } else if (actual.length === 0) {
                rowResults.push(`${rowId}: ⚠ Unanswered`);
              } else {
                rowResults.push(`${rowId}: ✗ Incorrect`);
              }
            }
          }
          
          score = Math.round(totalScore * 100) / 100;
          isCorrect = score >= question.marks;
          const correctRows = rowResults.filter(r => r.includes('✓')).length;
          feedback = `${correctRows}/${nonExampleRows.length} rows correct.\n\n${rowResults.join('\n')}\n\nScore: ${score}/${question.marks}`;
        } else {
          // No correct answers available - use AI grading as fallback
          console.log(`Table grid question ${question.id} has no answer key - attempting AI grading`);
          
          // Try to grade using AI
          const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
          if (LOVABLE_API_KEY) {
            try {
              const tableGridDescription = Object.entries(tableGridAnswers)
                .map(([rowId, cols]) => `${rowId}: columns ${cols.join(', ')}`)
                .join('\n');
              
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
                      content: `You are grading a tick/X table question. The student selected cells in a table grid. Evaluate correctness based on the question context and your knowledge. Award partial marks for partially correct answers.`
                    },
                    {
                      role: 'user',
                      content: `Question: ${question.question_text}\n\nStudent selections:\n${tableGridDescription}\n\nTotal marks: ${question.marks}\n\nGrade this table response and provide specific feedback on which selections are correct/incorrect.`
                    }
                  ],
                  tools: [{
                    type: "function",
                    function: {
                      name: "grade_answer",
                      description: "Grade a student's table answer with partial credit",
                      parameters: {
                        type: "object",
                        properties: {
                          score: { type: "number", description: "Total score out of total marks (supports decimals for partial credit)" },
                          feedback: { type: "string", description: "Brief feedback explaining which cells were correct/incorrect" },
                          isCorrect: { type: "boolean", description: "Whether answer is fully correct" },
                          correctAnswers: { 
                            type: "object", 
                            description: "The correct answer key as { rowId: [columnIndices] }" 
                          }
                        },
                        required: ["score", "feedback", "isCorrect"],
                        additionalProperties: false
                      }
                    }
                  }],
                  tool_choice: { type: "function", function: { name: "grade_answer" } }
                }),
              });
              
              if (aiResponse.ok) {
                const aiData = await aiResponse.json();
                const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
                
                if (toolCall) {
                  const grading = JSON.parse(toolCall.function.arguments);
                  score = Math.min(Math.max(0, grading.score), question.marks);
                  feedback = grading.feedback;
                  isCorrect = grading.isCorrect;
                  
                  // If AI provided correct answers, store them for future reference
                  if (grading.correctAnswers) {
                    console.log('AI provided correct answers:', JSON.stringify(grading.correctAnswers));
                  }
                }
              } else {
                console.error('AI grading failed:', await aiResponse.text());
                score = 0;
                feedback = 'Table grid answer recorded but could not be auto-graded. Awaiting tutor review.';
                isCorrect = false;
              }
            } catch (aiError) {
              console.error('AI grading exception:', aiError);
              score = 0;
              feedback = 'Table grid answer recorded but could not be auto-graded. Awaiting tutor review.';
              isCorrect = false;
            }
          } else {
            score = 0;
            feedback = 'Table grid answer recorded but could not be auto-graded (no answer key available). Awaiting tutor review.';
            isCorrect = false;
          }
        }
      } else if (question.question_type === 'mcq' && !hasTableAnswers) {
        // MCQ grading: student submits a letter (A/B/C/D), correct_answer may be letter OR full text
        const correctAnswer = (question.correct_answer || '').trim();
        const studentAnswerTrimmed = studentAnswer.trim();
        const options: string[] = Array.isArray(question.options) ? question.options : [];
        
        // Resolve student's letter to option text (A=0, B=1, C=2, D=3)
        const studentLetterIndex = studentAnswerTrimmed.length === 1 
          ? studentAnswerTrimmed.toUpperCase().charCodeAt(0) - 65 
          : -1;
        const studentOptionText = (studentLetterIndex >= 0 && studentLetterIndex < options.length) 
          ? options[studentLetterIndex] 
          : studentAnswerTrimmed;
        
        // Resolve correct answer: could be a letter OR full option text
        const correctLetterIndex = correctAnswer.length === 1 
          ? correctAnswer.toUpperCase().charCodeAt(0) - 65 
          : -1;
        const correctOptionText = (correctLetterIndex >= 0 && correctLetterIndex < options.length)
          ? options[correctLetterIndex]
          : correctAnswer;
        
        // Match by: letter-to-letter, text-to-text, or letter-resolved-to-text
        const letterMatch = studentAnswerTrimmed.toLowerCase() === correctAnswer.toLowerCase();
        const textMatch = studentOptionText.toLowerCase() === correctOptionText.toLowerCase();
        // Also check if student's selected option text matches correct_answer directly
        const crossMatch = studentOptionText.toLowerCase() === correctAnswer.toLowerCase();
        
        isCorrect = letterMatch || textMatch || crossMatch;
        score = isCorrect ? question.marks : 0;
        
        // Show the correct option letter + text in feedback
        let correctDisplay = correctAnswer;
        if (correctLetterIndex < 0 && options.length > 0) {
          // correct_answer is text — find which letter it corresponds to
          const matchIdx = options.findIndex(o => o.toLowerCase().trim() === correctAnswer.toLowerCase());
          if (matchIdx >= 0) correctDisplay = `${String.fromCharCode(65 + matchIdx)}) ${correctAnswer}`;
        }
        feedback = isCorrect ? 'Correct!' : `Incorrect. Correct answer: ${correctDisplay}`;
      } else {
        // Use Lovable AI to score written answers
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        
        // Use LaTeX answer if available (preferred), otherwise use text answer
        let workingOut = '';
        let finalAnswer = hasLatexAnswer ? studentLatex : studentAnswer;
        let parsedAnswer: any = null;
        
        // For display purposes, include both if available
        const normalizedPlain = studentAnswer; // Plain text version for fallback
        const canonicalLatex = studentLatex; // LaTeX for AI grading (preferred)
        
        if (isMathExam && !hasLatexAnswer) {
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
          
          // Build table-aware system prompt
          let systemPrompt = '';
          if (hasTableAnswers) {
            systemPrompt = `You are an expert exam grader specializing in TABLE-BASED questions. 

CRITICAL TABLE GRADING RULES:
1. Extract and evaluate EACH cell value from the student's table responses
2. For CHECKBOX tables: A tick (✓ or true) in a cell means the student selected that option
3. For INPUT tables: Evaluate numeric/text values cell-by-cell against the answer key
4. Award marks PER CELL or PER ROW as appropriate
5. In feedback, explicitly reference which cells/rows are correct or incorrect (e.g., "Row 1: Correct ✓ for Column A")

Address the student directly using "You" (e.g., "You correctly identified...", "Your entry for Row 2 is incorrect").`;
          } else if (isMathQuestion) {
            systemPrompt = `You are a mathematics exam grader. Award partial credit for:
- Correct method even if final answer is wrong
- Correct setup/equation formulation
- Algebraic manipulation steps
- Unit conversions and substitutions
- Clear mathematical reasoning

Be generous with method marks but strict with accuracy.

IMPORTANT: Address the student directly using "You" (e.g., "You have provided the correct answer", "Your method is correct"). Never use "The student" or third-person language.`;
          } else {
            systemPrompt = 'You are an expert exam grader. Score student answers based on correctness, completeness, and accuracy. Address the student directly using "You" rather than "The student".';
          }
          
          // Build the user prompt based on answer type
          let userPrompt = '';
          
          if (hasTableAnswers) {
            userPrompt = `You are grading a TABLE-BASED exam question. Evaluate EACH cell individually.

Question: ${question.question_text}
${question.question_latex ? `LaTeX: ${question.question_latex}` : ''}
Correct Answer/Key: ${question.correct_answer || 'See marking scheme'}

STUDENT'S TABLE RESPONSES:
${formattedTableAnswers}

${hasTextAnswer ? `Additional Text Answer: ${studentAnswer}` : ''}

Total Marks: ${question.marks}

GRADING INSTRUCTIONS:
1. Compare each student cell value to the correct answer for that cell
2. For checkbox questions: checked=true means ✓, unchecked means empty
3. Award marks based on correct cells (partial credit allowed)
4. Provide cell-by-cell feedback (e.g., "Row 1, Column 2: Correct", "Row 2, Column 3: Incorrect, should be X")
5. Calculate total score based on correct entries`;
          } else if (isMathQuestion) {
            // Prefer LaTeX for math grading (canonical representation)
            const answerToGrade = canonicalLatex || finalAnswer;
            const isLatexFormat = !!canonicalLatex;
            
            userPrompt = `You are grading a MATHEMATICS exam question. Award partial credit appropriately.

Question: ${question.question_text}
${question.question_latex ? `Question LaTeX: ${question.question_latex}` : ''}
Correct Answer: ${question.correct_answer}

${isLatexFormat ? `Student's Answer (LaTeX): ${canonicalLatex}
Student's Answer (Plain text): ${normalizedPlain || 'Not provided'}` : 
parsedAnswer ? `Student's Working Out: ${workingOut || 'Not provided'}
Student's Final Answer: ${finalAnswer}` : `Student Answer: ${studentAnswer}`}

Total Marks: ${question.marks}

Provide:
- Method marks (for working out) if applicable
- Accuracy marks (for final answer)
- Total score
- Brief feedback explaining mark breakdown`;
          } else {
            userPrompt = `Question: ${question.question_text}\n\nCorrect Answer: ${question.correct_answer}\n\nStudent Answer: ${studentAnswer}\n\nTotal Marks: ${question.marks}\n\nScore this answer and provide brief feedback.`;
          }

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