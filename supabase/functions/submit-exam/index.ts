import { requireExamAccess, ExamRequestError } from '../_shared/exam-access.ts';
import { enforceRateLimit } from '../_shared/rate-limiter.ts';
import { validatedGrade } from '../_shared/marking-result.ts';
import { logAIUsage } from '../_shared/usage-logger.ts';
import { detectDrawQuestion } from '../_shared/draw-question-detector.ts';
import "https://esm.sh/xhr-shim@0.1.3";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitiseFeedback, FEEDBACK_FORMATTING_RULE, MARKING_QUALITY_RULES } from "../_shared/sanitise-feedback.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let markingClient: any;
  let markingExamId: string | undefined;
  let markingUserId: string | undefined;
  let markingToken: string | undefined;
  let markingCommitted = false;
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization') ?? '';
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

    const access = await requireExamAccess(supabase, examId, user.id);
    const { data: claim, error: claimError } = await supabase.rpc('claim_exam_marking', {
      p_exam_id: examId, p_user_id: user.id,
      p_time_taken: Number.isFinite(timeTakenSeconds) ? Math.max(0, Math.round(timeTakenSeconds)) : 0,
    });
    if (claimError) throw new ExamRequestError(503, 'Marking could not start. Please retry.');
    if (claim?.state === 'graded') {
      return new Response(JSON.stringify({success:true,alreadyGraded:true}), {
        headers:{...corsHeaders,'Content-Type':'application/json'},
      });
    }
    if (claim?.state !== 'claimed') throw new ExamRequestError(409, 'This paper is already being marked. Please wait before retrying.');
    markingClient=supabase; markingExamId=examId; markingUserId=user.id; markingToken=claim.token;
    const requestQuota = await enforceRateLimit(supabase,user.id,'submit-exam',{dailyLimit:30,burstLimit:6});
    if (!requestQuota.allowed) throw new ExamRequestError(requestQuota.status ?? 429, requestQuota.message);
    const results: Array<{question_id:string;score:number;feedback:string;is_correct:boolean}> = [];
    // Each paid marking call has its own quota and timeout; refresh the claim before work.
    const markingFetch = async (url: string, init: RequestInit): Promise<Response> => {
      const {data: active,error: leaseError} = await supabase.from('exam_submissions')
        .update({marking_started_at:new Date().toISOString()}).eq('exam_id',examId)
        .eq('student_id',user.id).eq('marking_token',markingToken).eq('status','marking').select('id').maybeSingle();
      if(leaseError || !active) throw new Error('Marking claim expired');
      const quota=await enforceRateLimit(supabase,user.id,'submit-exam-marking',{dailyLimit:300,burstLimit:60});
      if(!quota.allowed)throw new ExamRequestError(quota.status ?? 429,quota.message);
      const response=await fetch(url,{...init,signal:AbortSignal.timeout(45_000)});
      if(!response.ok)throw new Error(`Marking service returned ${response.status}`);
      const usage=await response.clone().json();
      await logAIUsage(supabase,{userId:user.id,feature:'exam_marking',model:'google/gemini-2.5-flash',
        inputTokens:usage.usage?.prompt_tokens ?? 0,outputTokens:usage.usage?.completion_tokens ?? 0,cacheHit:false});
      return response;
    };

    // Fetch exam metadata to check subject and grade release settings
    const { data: examData } = await supabase
      .from('exams')
      .select('subject_id, title, assigned_by, grade_released, user_id')
      .eq('id', examId)
      .single();

    if (!examData) {
      throw new Error('Exam not found');
    }

    const isMathExam = examData.subject_id?.toLowerCase().includes('math') || false;

    const now = new Date();
    const isLate = access.deadline ? now > new Date(access.deadline) : false;
    const scoresHidden = !access.gradesReleased;

    // Fetch all questions with correct answers
    const { data: questions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('id, question_text, question_type, correct_answer, marks, options, has_math, question_latex')
      .eq('exam_id', examId);

    if (questionsError || !questions?.length) throw new Error('Questions could not be loaded');

    // Fetch student answers including table_answers and answer_latex for math input
    const { data: studentAnswers, error: answersError } = await supabase
      .from('student_answers')
      .select('question_id, answer_text, answer_latex, answer_format, table_answers')
      .eq('exam_id', examId)
      .eq('student_id', user.id);

    if (answersError) {
      throw new Error('Saved answers could not be loaded. Please retry.');
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
      const eligibleDrawing = question.question_type !== 'mcq' &&
        detectDrawQuestion(question.question_text, examData.subject_id, question.question_type).needsDrawingCanvas;
      if ((hasSelfMarkScore || isDrawingAnswer) && !eligibleDrawing) {
        throw new ExamRequestError(400, 'Self-marking is only available for drawing questions.');
      }
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

        results.push({question_id:question.id,score:safeScore,feedback:feedbackSelfMark,is_correct:isCorrectSelfMark});
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
              
              const aiResponse = await markingFetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash',
                  max_tokens: 2048,
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
                
                if (!toolCall) throw new Error('Missing marking response');
                if (toolCall) {
                  const grading = validatedGrade(JSON.parse(toolCall.function.arguments), question.marks);
                  score = Math.min(Math.max(0, grading.score), question.marks);
                  feedback = sanitiseFeedback(grading.feedback);
                  isCorrect = grading.isCorrect;
                  
                  // If AI provided correct answers, store them for future reference
                  if (grading.correctAnswers) {
                    console.log('AI provided correct answers:', JSON.stringify(grading.correctAnswers));
                  }
                }
              } else {
                console.error('AI grading failed:', await aiResponse.text());
                throw new Error('Marking could not finish. Your answers are saved. Please retry.');
              }
            } catch (aiError) {
              console.error('AI grading exception:', aiError);
              if (aiError instanceof ExamRequestError) throw aiError;
              throw new Error('Marking could not finish. Your answers are saved. Please retry.');
            }
          } else {
            throw new Error('Marking could not finish. Your answers are saved. Please retry.');
          }
        }
      } else if (question.question_type === 'mcq' && !hasTableAnswers) {
        // MCQ grading: student submits a letter (A/B/C/D), correct_answer may be letter OR full text
        const correctAnswer = (question.correct_answer || '').trim();
        if (!correctAnswer) throw new Error('This question has no marking key.');
        const studentAnswerTrimmed = studentAnswer.trim();
        const options: string[] = Array.isArray(question.options) ? question.options.map((option: any) => typeof option === 'string' ? option : String(option?.text ?? '')) : [];
        
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
          systemPrompt += FEEDBACK_FORMATTING_RULE + MARKING_QUALITY_RULES;
          
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

          const aiResponse = await markingFetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
                  max_tokens: 2048,
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
            throw new Error('Marking could not finish. Your answers are saved. Please retry.');
          } else if (aiResponse.status === 402) {
            console.error('AI credits depleted');
            throw new Error('Marking could not finish. Your answers are saved. Please retry.');
          } else if (!aiResponse.ok) {
            console.error('AI grading error:', await aiResponse.text());
            throw new Error('Marking could not finish. Your answers are saved. Please retry.');
          } else {
            const aiData = await aiResponse.json();
            const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
            
            if (toolCall) {
              const grading = validatedGrade(JSON.parse(toolCall.function.arguments), question.marks);
              score = Math.min(Math.max(0, grading.score), question.marks);
              grading.feedback = sanitiseFeedback(grading.feedback);

              // Build feedback with breakdown if available
              if (grading.methodMarks !== undefined && grading.accuracyMarks !== undefined) {
                feedback = `${grading.feedback}\n\n📊 Mark Breakdown:\n• Method: ${grading.methodMarks}/${question.marks - (grading.accuracyMarks || 0)}\n• Accuracy: ${grading.accuracyMarks}/${grading.accuracyMarks || 0}`;
              } else {
                feedback = grading.feedback;
              }

              isCorrect = grading.isCorrect;
            } else {
              console.error('No tool call in AI response');
              throw new Error('Marking could not finish. Your answers are saved. Please retry.');
            }
          }
        } catch (aiError) {
          console.error('AI grading exception:', aiError);
          if (aiError instanceof ExamRequestError) throw aiError;
          throw new Error('Marking could not finish. Your answers are saved. Please retry.');
        }
      }

      totalScore += score;
      console.log(`Question ${question.id}: score=${score}, isCorrect=${isCorrect}`);

      if (!Number.isFinite(score) || score < 0 || score > question.marks) throw new Error('Invalid grade');
      results.push({question_id:question.id,score,feedback,is_correct:isCorrect});
    }

    // One transaction commits every answer grade and the aggregate, or nothing.
    const {data: finished,error: finishError} = await supabase.rpc('finish_exam_marking', {
      p_exam_id:examId,p_user_id:user.id,p_token:markingToken,p_results:results,p_is_late:isLate,
    });
    if(finishError || !finished)throw new Error('Results could not be saved. Please retry.');
    markingCommitted=true;
    totalScore=finished.totalScore; totalMarks=finished.totalMarks;

    console.log('Exam submitted successfully. Score:', totalScore, '/', totalMarks, 'Late:', isLate);

    // Create notification for tutor/teacher if this is an assigned exam
    const tutorId = examData?.assigned_by || (examData.user_id !== user.id ? examData.user_id : null);
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
    if (markingToken && !markingCommitted) {
      const {error: resetError} = await markingClient.rpc('fail_exam_marking', {
        p_exam_id:markingExamId,p_user_id:markingUserId,p_token:markingToken,
      });
      if(resetError)console.error('Could not release marking claim',resetError.code);
    }
    // A post-commit notification/streak error must not ask the student to pay for marking again.
    if(markingCommitted)return new Response(JSON.stringify({success:true,alreadyGraded:true}),{
      headers:{...corsHeaders,'Content-Type':'application/json'},
    });
    const errorMessage = error instanceof ExamRequestError ? error.message : 'Marking could not finish. Your answers are saved. Please retry.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: error instanceof ExamRequestError ? error.status : 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
