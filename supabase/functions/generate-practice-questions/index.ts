import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateNotes, formatNotesForPrompt, logNotesModeration } from "../_shared/notes-validator.ts";

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

    // Build AI prompt
    const difficultyInstructions = 
      setData.difficulty_mode === 'increasing' 
        ? 'Questions should progressively increase in difficulty from easy to hard.'
        : setData.difficulty_mode === 'mixed'
        ? 'Questions should have a balanced mix of easy, medium, and hard difficulty.'
        : `All questions should be ${setData.difficulty_level} difficulty.`;

    const prompt = `Generate ${setData.question_count} practice questions for ${setData.subject_id} focused on the following subtopics:
${setData.subtopics.join(', ')}

Requirements:
- Educational Level: ${setData.educational_tier}
${setData.exam_board ? `- Exam Board: ${setData.exam_board}` : ''}
- ${difficultyInstructions}
- Question types: Mix of short answer, extended response, and MCQ where appropriate
- Include proper LaTeX notation for mathematical expressions using $ delimiters (e.g., $x^2$, $\\frac{1}{b^5}$)
- Set has_math: true for questions with equations
- Use lowercase variable names consistently (e.g., $x$ not $X$)

📐 MATHEMATICAL NOTATION (CRITICAL):
1. Use LaTeX wrapped in $ for inline math: "Find the value of $x$ where $x^2 = 4$"
2. For fractions use: $\\frac{1}{b^5}$ NOT 1/b^5
3. For exponents use: $b^{-5}$ NOT b^-5
4. For roots use: $\\sqrt{x}$ NOT sqrt(x)
5. Always use lowercase variables: $x$, $y$, $a$, $b$ (NOT $X$, $Y$)

📊 DATA TABLE FORMATTING (CRITICAL):
When generating questions that require tables:
1. ALWAYS use HTML table format with class="exam-table"
2. NEVER use markdown pipe/dash format (| col1 | col2 |)
3. Use this exact structure:
<table class="exam-table">
  <thead>
    <tr><th>Header 1</th><th>Header 2</th></tr>
  </thead>
  <tbody>
    <tr><td>Data 1</td><td>Data 2</td></tr>
    <tr><td>Data 3</td><td>Data 4</td></tr>
  </tbody>
</table>
4. Place table AFTER the question text, separated by a blank line
5. Include a caption prefix like "Table 1:" before the table if relevant
6. Tables with LaTeX: Use $ delimiters inside cells, e.g., <td>$x^2$</td>

📸 FIGURE NUMBERING RULES (MANDATORY):
When referencing images/figures/diagrams:
1. Figure numbers MUST match the question number: Q16 → Fig. 16.X
2. First figure in a question = Fig. <question>.1 (e.g., Q16's first figure = Fig. 16.1)
3. Second figure = Fig. <question>.2 (e.g., Q16's second figure = Fig. 16.2)
4. NEVER reuse figure numbers across different questions
5. NEVER invent unrelated figure numbers
6. For sub-questions (e.g., 17a), use the root question number: Fig. 17.1, not Fig. 17a.1

Example usage:
- Q16: "Fig. 16.1 shows the velocity-time graph..."
- Q17a: "Refer to Fig. 17.1..." (uses root question number 17)

🚀 UNIVERSAL TABLE RULES (MANDATORY FOR PDF RENDERING):
1. SHORT HEADERS ONLY (max 14-16 characters):
   - NEVER use long headers that will truncate in PDF
   - Always shorten or alias headers:
     * "Section of Quadrat" → "Quadrat"
     * "Beetles Count" → "Count"
     * "Desired concentration of diluted sample" → "Conc (mol/dm³)"
     * "Volume of stock solution required" → "Stock Vol (cm³)"
     * "Volume of distilled water required" → "Water Vol (cm³)"
     * "Temperature / °C" → "Temp (°C)"
     * "Time / s" → "Time (s)"

2. PLAIN TEXT VALUES INSIDE TABLE CELLS:
   - NEVER output raw LaTeX/math mode inside table cells
   - Always use plain text with Unicode superscripts:
     * "$0.4 \\, mol \\, dm^{-3}$" → "0.4 mol dm⁻³"
     * "$25 \\, cm^3$" → "25 cm³"
     * "$x^2$" → "x²"

3. TABLE SIZE LIMITS:
   - If table has more than 6 rows, consider:
     (A) Rotating table (swap rows/columns) for better fit
     (B) Splitting into two smaller tables
   - Tables MUST NOT break across pages

4. NARROW TABLES - USE HORIZONTAL LAYOUT:
   - If table has 2-3 columns and 5+ rows, use horizontal format:
     | Quadrat | A | B | C | D | E |
     | Count   |12 |15 |10 |12 |11 |

📝 MCQ FORMATTING (CRITICAL - PREVENTS DUPLICATION):
⚠️ NEVER include options (A, B, C, D) inside the "question_text" field!
The student exam interface renders interactive A/B/C/D buttons automatically.
If you include options in question_text, they will appear TWICE (duplicated).

RULES:
1. "question_text" = ONLY the question stem (no A/B/C/D options)
2. "options" array = Contains the option text WITHOUT letter prefixes
3. Options must NOT include letter prefixes - the frontend adds A), B), C), D)

✅ CORRECT FORMAT:
{
  "question_text": "Which expression represents the same value as $\\frac{1}{b^5}$?",
  "options": ["$b^{1/5}$", "$b^{-5}$", "$-b^5$", "$5b$"],
  "correct_answer": "B"
}

❌ WRONG FORMAT (causes duplication):
{
  "question_text": "Which expression represents...?\n\nA) $b^{1/5}$\nB) $b^{-5}$\nC) $-b^5$\nD) $5b$",
  "options": ["$b^{1/5}$", "$b^{-5}$", "$-b^5$", "$5b$"]
}

⚠️ FAILSAFE: Before outputting any MCQ, verify question_text does NOT contain "A)", "B)", "C)", "D)"

------------------------------------------------------------
⚠️ MCQ VALIDATION RULES (CRITICAL - PREVENTS INCORRECT ANSWERS)
------------------------------------------------------------

When generating ANY MCQ, you MUST perform these validation steps:

1. COMPUTE THE CORRECT ANSWER FIRST:
   - Before creating options, calculate/determine the correct answer yourself
   - For math/statistics questions: SHOW YOUR WORKING internally
   - For data-based questions: Use the EXACT numbers from the table/dataset

2. VALIDATE OPTIONS CONTAIN THE CORRECT ANSWER:
   - Compare your computed answer to ALL listed options
   - If NONE match, you MUST rewrite the options to include the correct answer
   - NEVER output an MCQ where no option is correct

3. DATA-BASED MCQ VALIDATION (Mean/Median/Mode):
   - For mean: sum of all values ÷ count of values
   - For median: middle value when data is sorted (or average of two middle values)
   - For mode: most frequently occurring value
   - VERIFY your calculated values match one of the options EXACTLY

4. PLAUSIBLE DISTRACTORS:
   - Incorrect options must be plausible but clearly wrong
   - Do NOT duplicate the correct answer in distractors
   - Distractors should reflect common calculation errors

⚠️ INTERNAL CHECK BEFORE FINAL OUTPUT:
Before outputting any MCQ, ask yourself:
"Does one of my options match the mathematically correct answer?"
If NO → FIX IT before outputting. NEVER rely on the user to notice errors.

❌ EXAMPLE OF WHAT NOT TO DO (Beetle Data):
Data: 10, 11, 12, 12, 15 (from quadrats A-E)
Correct calculation: Mean = 60/5 = 12, Median = 12, Mode = 12
Options provided:
A) Mean = 13, median = 14, mode = 15  ← WRONG
B) Mean = 14, median = 15, mode = 13  ← WRONG
C) Mean = 15, median = 14, mode = 13  ← WRONG
D) Mean = 15, median = 13, mode = 14  ← WRONG
→ This is UNACCEPTABLE. No correct answer exists!

✅ CORRECT APPROACH:
Data: 10, 11, 12, 12, 15
Step 1: Calculate - Mean = (10+11+12+12+15)/5 = 60/5 = 12
Step 2: Sort data: 10, 11, 12, 12, 15 → Median = 12 (middle value)
Step 3: Mode = 12 (appears twice, most frequent)
Step 4: Ensure one option has "Mean = 12, Median = 12, Mode = 12"
Step 5: Create plausible distractors with common errors (e.g., forgetting to sort for median)

------------------------------------------------------------
📊 TABLE GENERATION & STUDENT INTERACTIVITY RULES
------------------------------------------------------------

When generating questions that include tables for student completion:

1. EMPTY CELLS = STUDENT INPUT FIELDS:
   - Leave cells blank that students should fill in
   - Use consistent empty cell format: <td></td>
   - The frontend will convert empty cells to interactive inputs

2. CELL TYPE DETECTION (for frontend):
   - Numeric columns: Include units in headers (e.g., "Volume (cm³)", "Count", "Mass (g)")
   - Checkbox columns: Use ✓ symbols in example rows for classification tables
   - Text columns: Standard blank cells for short text answers

3. EXAMPLE ROW PATTERN:
   - For classification tables, include one filled row as an example
   - Mark with "Example:" or show first row completed

4. TABLE STRUCTURE FOR MARKING:
   - Each editable cell must have a corresponding correct_answer
   - For table-based questions, include expected values in worked_solution

5. PDF vs STUDENT VIEW:
   - In PDF: Empty cells remain blank for manual writing
   - In student view: Empty cells become interactive inputs (numeric, checkbox, or text)

6. TABLE ANSWER DATA STRUCTURE:
   Student responses are stored as structured JSON:
   {
     "row1_col1": "10.0",
     "row1_col2": "15.0",
     "row2_col1": true,
     "row2_col2": false
   }

7. MARKING TABLE-BASED QUESTIONS:
   When marking, evaluate:
   - Whether table values match the correct solution
   - Whether checkbox patterns are correct (for classification tables)
   - Whether the reasoning in free-text section adds partial credit

❌ INCORRECT FORMAT:
{
  "question_text": "Which expression represents...? A) $b^{1/5}$ B) $b^{-5}$",
  "options": ["A) $b^{1/5}$", "B) $b^{-5}$", ...]
}

${specContent ? 'Align questions with the provided specification document:\n' + specContent.substring(0, 5000) : ''}
${notesSection}
Return JSON with:
{
  "questions": [
    {
      "question_number": "1",
      "question_text": "The question text WITHOUT options (options go in options array for MCQ)",
      "question_latex": "Full LaTeX version if complex math",
      "question_type": "short_answer" | "extended" | "mcq",
      "marks": 2-10,
      "subtopic": "...",
      "difficulty_level": "easy" | "medium" | "hard",
      "has_math": true/false,
      "equation_complexity": "simple" | "medium" | "complex",
      "correct_answer": "The answer (for MCQ: just the letter A/B/C/D)",
      "options": ["Option text without letter prefix", "..."] (ONLY for MCQ, null otherwise),
      "worked_solution": "Step-by-step solution"
    }
  ]
}`;

    console.log('Calling Lovable AI...');

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert exam question generator. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log('AI response received');

    const content = aiResponse.choices[0].message.content;
    console.log('Raw AI content:', content.substring(0, 200)); // Log first 200 chars for debugging
    
    // Strip markdown code fences if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    console.log('Cleaned content:', cleanedContent.substring(0, 200));
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Failed to parse content:', cleanedContent);
      throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    const questions = parsedContent.questions;

    if (!questions || !Array.isArray(questions)) {
      throw new Error('AI response does not contain a valid questions array');
    }

    console.log(`Generated ${questions.length} questions`);

    // Insert questions into database
    const questionsToInsert = questions.map((q: any) => ({
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
      correct_answer: q.correct_answer || null,
      options: q.options || null,
    }));

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
