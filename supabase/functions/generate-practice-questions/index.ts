import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { validateNotes, formatNotesForPrompt, logNotesModeration } from "../_shared/notes-validator.ts";
import { validateGraphQuestion, generateFallbackGraphSpec, logGraphValidation } from "../_shared/graph-validator.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let setId: string | null = null;

  try {
    // Validate JWT token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required. Please log in and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create client with user's auth to validate the token
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate the JWT and get user claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('JWT validation failed:', claimsError?.message);
      return new Response(
        JSON.stringify({ error: 'Your session has expired. Please refresh and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Authenticated user:', userId);

    // Use service role key for server-side operations to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json();
    setId = body.setId;

    if (!setId) {
      throw new Error('Set ID is required');
    }

    console.log('Generating practice questions for set:', setId);

    // Get practice set details - use maybeSingle to avoid error if not found
    const { data: setData, error: setError } = await supabaseClient
      .from('practice_question_sets')
      .select('*')
      .eq('id', setId)
      .maybeSingle();

    if (setError) throw setError;
    if (!setData) {
      throw new Error(`Practice set not found: ${setId}`);
    }

    // Verify the user owns this practice set
    if (setData.user_id !== userId) {
      console.error('User does not own this practice set:', { userId, setUserId: setData.user_id });
      return new Response(
        JSON.stringify({ error: 'You do not have permission to generate this practice set.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('Set data:', setData);

    // Update status to extracting
    await supabaseClient
      .from('practice_question_sets')
      .update({ extraction_status: 'extracting' })
      .eq('id', setId);

    // Download spec file if available
    let specContent = '';
    if (setData.specification_file_url) {
      const { data: specFile } = await supabaseClient.storage
        .from('exam-files')
        .download(setData.specification_file_url);
      
      if (specFile) {
        specContent = await specFile.text();
      }
    }

    // Validate and sanitize notes
    const notesValidation = validateNotes(setData.notes);
    logNotesModeration('generate-practice-questions', notesValidation.auditLog);

    // Block if notes contain disallowed content
    if (!notesValidation.valid) {
      console.error('Notes validation failed:', notesValidation.auditLog.blockedPhrases);
      await supabaseClient
        .from('practice_question_sets')
        .update({
          extraction_status: 'failed',
          extraction_error: 'Notes contain disallowed content. Please revise your notes.',
        })
        .eq('id', setId);
      
      return new Response(
        JSON.stringify({ error: 'Notes validation failed', details: notesValidation.auditLog.blockedPhrases }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Format notes for safe inclusion in prompt
    const notesSection = formatNotesForPrompt(notesValidation.sanitized);

    // Build AI prompt (ASCII-only, JSON-safe)
    const difficultyInstructions =
      setData.difficulty_mode === 'increasing'
        ? 'Questions should progressively increase in difficulty from easy to hard.'
        : setData.difficulty_mode === 'mixed'
        ? 'Questions should have a balanced mix of easy, medium, and hard difficulty.'
        : `All questions should be ${setData.difficulty_level} difficulty.`;

    const prompt = `Generate ${setData.question_count} practice questions.

Context:
- Subject: ${setData.subject_id}
- Subtopics: ${setData.subtopics.join(', ')}
- Educational Level: ${setData.educational_tier}
${setData.exam_board ? `- Exam Board: ${setData.exam_board}` : ''}
- ${difficultyInstructions}

CRITICAL OUTPUT RULES:
1) Absolutely NO LaTeX anywhere.
2) Absolutely NO backslashes anywhere.
3) ASCII only in ALL text fields (no special symbols, no unicode).
4) Math must be plain ASCII, examples:
   - sqrt(16)
   - 3/4
   - (x+1)/(x-1)
   - pi
   - !=, <=, >=
   - y = mx + c
5) Do not output markdown. Do not output code fences.
6) Do not output JSON as raw text in chat content. You will return data via the provided function call only.

Question type mix:
- Use a mix of: short_answer, extended, mcq, table_grid, graph_interpretation, graph_plotting where appropriate.

MCQ rules (avoid duplication in UI):
- question_text MUST contain only the stem (no A/B/C/D in the text).
- options MUST be an array of 4 strings WITHOUT letter prefixes.
- correct_answer MUST be one of: "A", "B", "C", "D".

Graph questions (must include graphSpec inside correct_answer):
- For graph_interpretation and graph_plotting, correct_answer MUST be an object with:
  - graphType: "interpretation" or "plotting"
  - graphConfig: { chartType, xLabel, yLabel, xDomain, yDomain, series }
  - For interpretation: interpretationFields (at least 1)
  - For plotting: plottingAnswer.expectedPoints

Table_grid questions (interactive tables):
- question_type MUST be "table_grid".
- Provide table_data as an object with:
  - tableType: one of "tick_cross" | "text_entry" | "number_entry" | "mixed"
  - headers: array of short, meaningful headers (avoid placeholders like "Column 1")
  - rows: array of { id, label, locked }
  - columns: array describing input types (toggle/text/number/display)
  - selectionMode: "single" | "multi" | "text" | "number"
  - prefilled: optional array for given values, each item: { rowId, colIndex, value, locked }
- correct_answer for table_grid MUST be an object with correctAnswers keyed by row id.

General field expectations:
- question_number: string ("1", "2", ...)
- question_text: plain ASCII string
- question_latex: MUST be null
- worked_solution: plain ASCII string (optional)
- has_math: true/false
- equation_complexity: "simple" | "medium" | "complex" (optional)

${specContent ? 'Specification (excerpt):\n' + specContent.substring(0, 5000) : ''}
${notesSection}`;

    // IMPORTANT: The tool schema + server-side validation enforces structure and blocks LaTeX/backslashes.

    console.log('Calling Lovable AI (tool mode)...');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // ------------------------------
    // Tool schema + validation
    // ------------------------------

    const QuestionTypeSchema = z.enum([
      'short_answer',
      'extended',
      'mcq',
      'table_grid',
      'graph_interpretation',
      'graph_plotting',
    ]);

    const DifficultySchema = z.enum(['easy', 'medium', 'hard']);

    const PracticeQuestionSchema = z.object({
      question_number: z.string().min(1),
      question_text: z.string().min(1),
      question_latex: z.null().optional().nullable(),
      question_type: QuestionTypeSchema,
      marks: z.number().int().min(1).max(20),
      subtopic: z.string().min(1),
      difficulty_level: DifficultySchema,
      has_math: z.boolean().optional().default(false),
      equation_complexity: z.enum(['simple', 'medium', 'complex']).optional().nullable(),
      correct_answer: z.unknown(),
      options: z.array(z.string()).optional().nullable(),
      worked_solution: z.string().optional().nullable(),
      table_data: z.unknown().optional().nullable(),
    }).passthrough();

    const GeneratePracticeQuestionsSchema = z.object({
      questions: z.array(PracticeQuestionSchema).min(1),
    });

    const isAsciiOnly = (s: string) => {
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        // allow tab/newline/carriage return
        if (c === 9 || c === 10 || c === 13) continue;
        if (c < 32 || c > 126) return false;
      }
      return true;
    };

    const findStringViolations = (value: unknown) => {
      const issues: { path: string; issue: string }[] = [];

      const walk = (v: unknown, path: string) => {
        if (typeof v === 'string') {
          if (v.includes('\\')) issues.push({ path, issue: 'contains backslash' });
          if (v.includes('$')) issues.push({ path, issue: 'contains dollar sign (LaTeX)' });
          if (v.includes('```')) issues.push({ path, issue: 'contains markdown fence' });
          if (!isAsciiOnly(v)) issues.push({ path, issue: 'contains non-ASCII characters' });
          return;
        }
        if (Array.isArray(v)) {
          v.forEach((item, idx) => walk(item, `${path}[${idx}]`));
          return;
        }
        if (v && typeof v === 'object') {
          for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
            walk(child, path ? `${path}.${k}` : k);
          }
        }
      };

      walk(value, '');
      return issues;
    };

    // Fail-safe sanitizer (only applied if needed): escape backslashes inside ALL string fields.
    // NOTE: This is a last resort to guarantee JSON-safe serialization if the model disobeys.
    const escapeBackslashesDeep = <T,>(value: T): { value: T; didEscape: boolean; count: number } => {
      let didEscape = false;
      let count = 0;

      const walk = (v: any): any => {
        if (typeof v === 'string') {
          if (v.includes('\\')) {
            didEscape = true;
            const next = v.replace(/\\/g, '\\\\');
            count += (next.length - v.length) / 1;
            return next;
          }
          return v;
        }
        if (Array.isArray(v)) return v.map(walk);
        if (v && typeof v === 'object') {
          const out: Record<string, any> = {};
          for (const [k, child] of Object.entries(v)) out[k] = walk(child);
          return out;
        }
        return v;
      };

      return { value: walk(value), didEscape, count };
    };

    const tool = {
      type: 'function',
      function: {
        name: 'generate_practice_questions',
        description: 'Generate a set of practice questions as structured data.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['questions'],
          properties: {
            questions: {
              type: 'array',
              minItems: setData.question_count,
              maxItems: setData.question_count,
              items: {
                type: 'object',
                required: [
                  'question_number',
                  'question_text',
                  'question_type',
                  'marks',
                  'subtopic',
                  'difficulty_level',
                  'correct_answer',
                ],
                additionalProperties: true,
                properties: {
                  question_number: { type: 'string' },
                  question_text: { type: 'string' },
                  question_latex: { type: ['null', 'string'], description: 'Must be null.' },
                  question_type: {
                    type: 'string',
                    enum: [
                      'short_answer',
                      'extended',
                      'mcq',
                      'table_grid',
                      'graph_interpretation',
                      'graph_plotting',
                    ],
                  },
                  marks: { type: 'number' },
                  subtopic: { type: 'string' },
                  difficulty_level: { type: 'string', enum: ['easy', 'medium', 'hard'] },
                  has_math: { type: 'boolean' },
                  equation_complexity: { type: ['null', 'string'] },
                  correct_answer: {
                    anyOf: [
                      { type: 'string' },
                      { type: 'number' },
                      { type: 'boolean' },
                      { type: 'null' },
                      { type: 'array' },
                      { type: 'object' },
                    ],
                  },
                  options: { type: ['array', 'null'], items: { type: 'string' } },
                  worked_solution: { type: ['string', 'null'] },
                  table_data: { type: ['object', 'null'] },
                },
              },
            },
          },
        },
      },
    } as const;

    const baseSystemPrompt =
      'You are an expert practice question generator. ' +
      'You MUST call the function generate_practice_questions. ' +
      'Do not output any other text. ' +
      'No LaTeX, no backslashes, ASCII only. ' +
      'Math must be plain ASCII like sqrt(16), 3/4, (x+1)/(x-1), pi, !=, <=, >=.';

    const strictRetryPrompt = 'Return valid data. No LaTeX. No backslashes. ASCII only.';

    const callAi = async (attempt: 0 | 1) => {
      const sys = attempt === 0 ? baseSystemPrompt : `${baseSystemPrompt} ${strictRetryPrompt}`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          temperature: 0,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: prompt },
          ],
          tools: [tool],
          tool_choice: { type: 'function', function: { name: 'generate_practice_questions' } },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);

        if (response.status === 429) {
          throw new Error('AI rate limit exceeded. Please try again in a moment.');
        }
        if (response.status === 402) {
          throw new Error('AI usage limit reached. Please add credits and try again.');
        }

        throw new Error(`AI API error: ${response.status}`);
      }

      return await response.json();
    };

    const extractToolArgs = (ai: any) => {
      const msg = ai?.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls;
      const call = Array.isArray(toolCalls) ? toolCalls[0] : null;

      if (!call?.function?.arguments) {
        // Helpful debug for unexpected formats
        console.error('Unexpected AI response shape (missing tool_calls):', JSON.stringify(ai).slice(0, 2000));
        throw new Error('AI response missing tool output');
      }

      const argsText = String(call.function.arguments);
      try {
        return JSON.parse(argsText);
      } catch (e) {
        console.error('Failed to parse tool arguments:', argsText.slice(0, 2000));
        throw new Error(`Failed to parse AI tool arguments: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    const validateOrThrow = (payload: unknown) => {
      const parsed = GeneratePracticeQuestionsSchema.safeParse(payload);
      if (!parsed.success) {
        console.error('Schema validation failed:', parsed.error.flatten());
        throw new Error('AI returned invalid question data (schema validation failed)');
      }

      if (parsed.data.questions.length !== setData.question_count) {
        throw new Error(`AI returned ${parsed.data.questions.length} questions, expected ${setData.question_count}`);
      }

      // Enforce: question_latex must be null
      for (const q of parsed.data.questions) {
        if (q.question_latex !== null && q.question_latex !== undefined) {
          throw new Error('question_latex must be null');
        }
      }

      // Enforce: no LaTeX/backslashes/non-ASCII in ANY string fields
      const violations = findStringViolations(parsed.data);
      if (violations.length) {
        console.error('String violations found:', violations.slice(0, 50));
        throw new Error('AI returned forbidden characters (LaTeX/backslashes/non-ASCII)');
      }

      return parsed.data;
    };

    let generated: z.infer<typeof GeneratePracticeQuestionsSchema> | null = null;
    let lastErr: unknown = null;

    for (const attempt of [0, 1] as const) {
      try {
        const ai = await callAi(attempt);
        const toolPayload = extractToolArgs(ai);
        generated = validateOrThrow(toolPayload);
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`AI generation attempt ${attempt + 1} failed:`, e);
      }
    }

    if (!generated) {
      throw lastErr instanceof Error ? lastErr : new Error('AI generation failed');
    }

    // Apply fail-safe sanitizer only if needed (should be rare due to strict validation)
    const escaped = escapeBackslashesDeep(generated);
    if (escaped.didEscape) {
      console.warn(`Fail-safe sanitizer: escaped backslashes in model output (count approx: ${escaped.count})`);
    }

    const questions = escaped.value.questions;

    if (!questions || !Array.isArray(questions)) {
      throw new Error('AI response does not contain a valid questions array');
    }

    console.log(`Generated ${questions.length} questions`);

    // Validate and transform questions
    const questionsToInsert = questions.map((q: any, idx: number) => {
      // Validate table_grid questions have required fields
      if (q.question_type === 'table_grid') {
        if (!q.table_data) {
          console.warn(`Question ${q.question_number}: table_grid type but missing table_data, downgrading to short_answer`);
          q.question_type = 'short_answer';
        } else {
          // Validate headers aren't placeholders
          const headers: string[] = q.table_data.headers || [];
          const placeholderPatterns = /^(Element|Option|Column|Item|Row|Cell)\s*\d+$/i;
          const hasPlaceholderHeaders = headers.some((h: string) => placeholderPatterns.test(h));
          
          if (hasPlaceholderHeaders) {
            console.warn(`Question ${q.question_number}: table_grid has placeholder headers, flagging for review`);
            q.table_data.hasPlaceholderHeaders = true;
          }
          
          // DETECT TABLE INTERACTION TYPE (CRITICAL FOR MARKING)
          const headersLower = headers.map((h: string) => h.toLowerCase());
          const hasTrue = headersLower.includes('true');
          const hasFalse = headersLower.includes('false');
          const hasYes = headersLower.includes('yes');
          const hasNo = headersLower.includes('no');
          
          // Set table_interaction_type for deterministic validation/marking
          let tableInteractionType: string = 'multi_select'; // default
          
          if (hasTrue && hasFalse) {
            tableInteractionType = 'tf';
            q.table_data.tableType = 'tf_single';
            q.table_data.selectionMode = 'single';
          } else if ((hasYes && hasNo) || headers.length === 3) {
            // Binary choice table - might be single select
            tableInteractionType = 'single_select';
            q.table_data.tableType = 'grid_single';
            q.table_data.selectionMode = 'single';
          } else if (q.table_data.tableType === 'text_entry' || q.table_data.tableType === 'number_entry') {
            tableInteractionType = q.table_data.tableType;
          }
          
          q.table_data.table_interaction_type = tableInteractionType;
          
          // Validate column types match question intent
          const questionLower = (q.question_text || '').toLowerCase();
          const needsTextInput = /complete|fill in|enter|write|calculate|identify|name|state|give|suggest/.test(questionLower);
          const needsToggle = /tick|cross|select|indicate|mark with|choose|true|false/.test(questionLower);
          const isCalculationTable = /calculate|work out|find the|compute/.test(questionLower);
          
          const columns = q.table_data.columns || [];
          const hasOnlyToggles = columns.every((c: any) => c.type === 'toggle');
          
          if (needsTextInput && hasOnlyToggles && !needsToggle) {
            console.warn(`Question ${q.question_number}: Question needs text input but columns are all toggle type, converting`);
            q.table_data.columns = columns.map((c: any) => ({
              ...c,
              type: 'text'
            }));
            q.table_data.tableType = 'text_entry';
            q.table_data.table_interaction_type = 'text_entry';
          }
          
          // CRITICAL VALIDATION: Calculation tables MUST have prefilled data
          if (isCalculationTable && (q.table_data.tableType === 'number_entry' || tableInteractionType === 'number_entry')) {
            const prefilled = q.table_data.prefilled || [];
            const rows = q.table_data.rows || [];
            const hasDisplayColumn = columns.some((c: any) => c.type === 'display');
            
            // Check if we have given data
            const hasPrefilledData = prefilled.length > 0 && prefilled.some((p: any) => p.locked && p.value);
            
            if (!hasPrefilledData && !hasDisplayColumn && rows.length > 0) {
              console.warn(`Question ${q.question_number}: Calculation table missing prefilled given data - flagging as invalid`);
              q.table_data.validationError = 'MISSING_GIVEN_DATA';
              q.table_data.validationMessage = 'Calculation tables require prefilled given values for students to calculate from';
              
              // Try to detect which column should have given data based on header patterns
              const givenColumnPatterns = /time|distance|mass|volume|temperature|concentration|velocity|speed|force|current|voltage/i;
              const answerColumnPatterns = /rate|result|answer|calculate|final|output/i;
              
              for (let i = 0; i < columns.length; i++) {
                const header = headers[i + 1] || ''; // +1 because headers include label column
                if (givenColumnPatterns.test(header) && !answerColumnPatterns.test(header)) {
                  console.warn(`Question ${q.question_number}: Column "${header}" likely contains given data but has no prefilled values`);
                }
              }
            }
          }
          
          // Sanitize LaTeX in headers - convert to plain text
          q.table_data.headers = headers.map((h: string) => {
            return h
              .replace(/\$?\s*s\^?\{?-1\}?\s*\$?/g, 's⁻¹')
              .replace(/\$?\s*cm\^?\{?3\}?\s*\$?/g, 'cm³')
              .replace(/\$?\s*m\^?\{?2\}?\s*\$?/g, 'm²')
              .replace(/\$?\s*dm\^?\{?-3\}?\s*\$?/g, 'dm⁻³')
              .replace(/\$?\s*mol\s*[·.]\s*dm\^?\{?-3\}?\s*\$?/g, 'mol·dm⁻³')
              .replace(/\$([^$]+)\$/g, '$1');
          });
        }
        
        if (!q.correct_answer) {
          console.warn(`Question ${q.question_number}: table_grid type but missing correct_answer for grading`);
        }
      }
      
      // GRAPH QUESTION VALIDATION (CRITICAL - ensures graphSpec exists)
      if (q.question_type === 'graph_interpretation' || q.question_type === 'graph_plotting') {
        const graphValidation = validateGraphQuestion(q.question_type, q.correct_answer);
        logGraphValidation(q.question_number, graphValidation);
        
        if (!graphValidation.valid) {
          console.warn(`Question ${q.question_number}: Graph question failed validation, generating fallback`);
          
          // Generate fallback graphSpec
          const fallbackSpec = generateFallbackGraphSpec(q.question_type, q.question_text || '');
          
          if (fallbackSpec) {
            console.info(`Question ${q.question_number}: Using fallback graphSpec`);
            q.correct_answer = fallbackSpec;
          } else {
            // Cannot generate fallback - downgrade to short_answer
            console.error(`Question ${q.question_number}: Cannot generate fallback graphSpec, downgrading to short_answer`);
            q.question_type = 'short_answer';
            q.correct_answer = 'Answer will vary based on graph interpretation.';
          }
        }
      }
      
      // Serialize table_data into correct_answer if it's a table_grid
      let correctAnswer = q.correct_answer;
      if (q.question_type === 'table_grid' && q.table_data) {
        // Store table structure and answer key together
        correctAnswer = JSON.stringify({
          table_data: q.table_data,
          ...(typeof q.correct_answer === 'object' ? q.correct_answer : { expected: q.correct_answer })
        });
      } else if (typeof correctAnswer === 'object') {
        correctAnswer = JSON.stringify(correctAnswer);
      }
      
      return {
        set_id: setId,
        question_number: q.question_number,
        question_text: q.question_text,
        question_latex: q.question_latex || null,
        question_type: q.question_type,
        marks: q.marks,
        subtopic: q.subtopic,
        difficulty_level: q.difficulty_level,
        has_math: q.has_math || false,
        equation_complexity: q.equation_complexity || null,
        correct_answer: correctAnswer,
        options: q.options || null,
      };
    });
    
    console.log('Questions to insert:', questionsToInsert.map(q => ({ num: q.question_number, type: q.question_type })));

    const { error: insertError } = await supabaseClient
      .from('practice_questions')
      .insert(questionsToInsert);

    if (insertError) {
      console.error('Error inserting questions:', insertError);
      throw insertError;
    }

    // Update set status
    await supabaseClient
      .from('practice_question_sets')
      .update({
        extraction_status: 'completed',
        total_questions_generated: questions.length,
      })
      .eq('id', setId);

    console.log('Questions generated successfully');

    return new Response(
      JSON.stringify({ success: true, questionsGenerated: questions.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error generating practice questions:', error);
    
    // Update set status to failed if we have a setId
    if (setId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );
        
        await supabaseClient
          .from('practice_question_sets')
          .update({
            extraction_status: 'failed',
            extraction_error: error.message,
          })
          .eq('id', setId);
      } catch (updateError) {
        console.error('Failed to update error status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
