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

    // Download example questions file if available - use this to guide graph style and question format
    let exampleQuestionsContent = '';
    if (setData.example_questions_file_url) {
      try {
        const { data: exampleFile } = await supabaseClient.storage
          .from('exam-files')
          .download(setData.example_questions_file_url);
        
        if (exampleFile) {
          exampleQuestionsContent = await exampleFile.text();
          console.log('Loaded example questions file, length:', exampleQuestionsContent.length);
        }
      } catch (err) {
        console.warn('Failed to load example questions file:', err);
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

    // Visual question type instructions based on user preferences
    const includeGraphs = setData.include_graphs === true;
    const includeTables = setData.include_tables === true;
    
    let visualQuestionInstructions = '';
    if (includeGraphs && includeTables) {
      visualQuestionInstructions = `
REQUIRED VISUAL QUESTIONS (MANDATORY):
- At least 30% of questions MUST be graph_interpretation or graph_plotting.
- At least 20% of questions MUST be table_grid.
- EVERY graph question MUST include complete graphConfig with series.data array containing at least 3 {x,y} points.
- A graph question WITHOUT visible data points is INVALID and will be rejected.`;
    } else if (includeGraphs) {
      visualQuestionInstructions = `
REQUIRED GRAPH QUESTIONS (MANDATORY):
- At least 40% of questions MUST be graph_interpretation or graph_plotting.
- EVERY graph question MUST include complete graphConfig with:
  - chartType: "line" or "scatter"
  - xLabel, yLabel: meaningful axis labels
  - domainX, domainY: [min, max] arrays
  - series: array with at least one object containing data: [{x, y}, ...] with at least 3 points
- A graph question WITHOUT visible data points is INVALID and will be rejected.
- Example topics: read values, find gradient/intercept, identify trends, plot coordinates.`;
    } else if (includeTables) {
      visualQuestionInstructions = `
REQUIRED TABLE QUESTIONS (MANDATORY):
- At least 30% of questions MUST be table_grid.
- Tables must have headers, rows, and columns arrays.
- Use appropriate tableType: tick_cross, text_entry, number_entry, or mixed.`;
    } else {
      visualQuestionInstructions = `
Question type mix:
- Use a mix of: short_answer, extended, mcq where appropriate.
- Only include graph or table questions if specifically relevant to the subtopics.`;
    }

    // Determine educational tier for complexity scaling
    const tier = (setData.educational_tier || '').toLowerCase();
    const isFoundation = tier.includes('foundation') || tier.includes('basic');
    const isGCSE = tier.includes('gcse') || tier.includes('ks4') || tier.includes('o-level') || tier.includes('secondary');
    const isALevel = tier.includes('a-level') || tier.includes('a level') || tier.includes('ib') || tier.includes('pre-u') || tier.includes('advanced');
    const isUniversity = tier.includes('university') || tier.includes('undergraduate') || tier.includes('degree') || tier.includes('postgraduate') || tier.includes('masters');
    
    // PHASE 1: Stronger subtopic detection for transformations
    const subtopicsLower = (setData.subtopics || []).map((s: string) => s.toLowerCase());
    const hasTransformationTopic = subtopicsLower.some((s: string) => 
      s.includes('transform') || 
      s.includes('f(x)') || 
      s.includes('function') ||
      s.includes('sketch') ||
      s.includes('curve') ||
      s.includes('graph')
    );
    
    // Force graph_transformation type when A-Level/IB + transformation/graph topic
    const forceTransformationType = (isALevel || isUniversity) && hasTransformationTopic && includeGraphs;
    
    console.log('Transformation detection:', { 
      tier, 
      isALevel, 
      hasTransformationTopic, 
      forceTransformationType,
      subtopics: setData.subtopics 
    });
    
    // PHASE 4: Better specification extraction - parse for exam patterns
    let examPatterns = '';
    if (specContent && specContent.length > 0) {
      // Look for question structures in the spec
      const questionMatches = specContent.match(/\([a-z]\)\s+[A-Z][^.]{10,100}\./g) || [];
      const markPatterns = specContent.match(/\[\d+\s*marks?\]/gi) || [];
      const commandWords = specContent.match(/\b(hence|deduce|prove|show that|sketch|state|find|calculate|determine|explain|justify)\b/gi) || [];
      
      const uniqueMarks = [...new Set(markPatterns)];
      const uniqueCommands = [...new Set(commandWords.map((w: string) => w.toLowerCase()))];
      
      if (questionMatches.length > 0 || uniqueCommands.length > 0) {
        examPatterns = `
EXAM STYLE PATTERNS (from uploaded specification):
${questionMatches.length > 0 ? `- Sample question structures:\n${questionMatches.slice(0, 3).join('\n')}` : ''}
${uniqueMarks.length > 0 ? `- Mark allocations observed: ${uniqueMarks.join(', ')}` : ''}
${uniqueCommands.length > 0 ? `- Command words used: ${uniqueCommands.slice(0, 10).join(', ')}` : ''}
- IMPORTANT: Match the complexity and style of these patterns in your generated questions.
`;
        console.log('Extracted exam patterns from specification');
      }
    }
    
    // Build complexity scaling instructions based on educational tier
    let complexityInstructions = '';
    
    if (isFoundation) {
      complexityInstructions = `
COMPLEXITY LEVEL: Foundation/Basic
- Use simple, scaffolded questions with clear step-by-step guidance
- Avoid abstract notation; use concrete numbers and straightforward language
- Include worked examples within multi-part questions
- Keep calculations to single-step or two-step maximum
- Use friendly, encouraging language
- Provide visual aids (diagrams, number lines) where helpful`;
    } else if (isGCSE) {
      complexityInstructions = `
COMPLEXITY LEVEL: GCSE/Secondary (Higher)
- Questions should require multi-step reasoning
- Use standard mathematical notation but explain any unfamiliar symbols
- Include some abstract elements but ground in practical contexts
- Mix procedural fluency with problem-solving
- 2-4 mark questions with clear mark allocation
- Include "show that" and "explain" command words`;
    } else if (isALevel || isUniversity) {
      // PHASE 3: Enhanced A-Level enforcement
      const minMarks = isUniversity ? 6 : 4;
      complexityInstructions = `
COMPLEXITY LEVEL: ${isUniversity ? 'University/Undergraduate+' : 'A-Level/IB/Advanced'}
CRITICAL REQUIREMENTS:
- Use formal mathematical language and notation throughout
- Require abstract reasoning and proof-style arguments
- Use f(x) notation for ALL function questions; students must work with transformations
- Questions should connect multiple concepts (e.g., calculus with trigonometry)
- Include "hence or otherwise", "deduce", "prove", "show that" command words
- NO scaffolding or hints; professional exam-style layout only
- Multi-part questions (a, b, c) where parts BUILD ON EACH OTHER
- Include asymptote analysis, set notation for domains/ranges
- MINIMUM ${minMarks} marks per question - no simple 1-2 mark procedural tasks

BANNED FOR THIS LEVEL:
- Simple "plot this single point" questions
- Questions asking only for a single coordinate read-off
- Basic arithmetic without conceptual reasoning
- Any question that could appear on a GCSE paper

REQUIRED STYLE:
- Every question should require REASONING, not just procedure
- Use abstract function notation: f(x), g(x), fg(x), f^(-1)(x)
- Include phrases like "Hence find...", "Deduce that...", "Prove that...", "Show that..."
${isUniversity ? '- Expect rigorous justification for all steps\n- Include epsilon-delta arguments, formal set theory where appropriate' : ''}
${examPatterns}`;
    } else {
      // Default: moderate complexity
      complexityInstructions = `
COMPLEXITY LEVEL: Standard
- Balance procedural and conceptual questions
- Use clear mathematical notation
- Include a range of difficulty within the set`;
    }

    // PHASE 2: A-Level specific transformation instructions with MANDATORY templates
    // IMPORTANT: We use graph_plotting for interactive graphs (not graph_transformation which doesn't render)
    let transformationInstructions = '';
    
    if (forceTransformationType) {
      transformationInstructions = `
MANDATORY A-LEVEL GRAPH TRANSFORMATION REQUIREMENTS:
***** CRITICAL: AT LEAST 50% OF QUESTIONS MUST USE question_type = "graph_plotting" *****

For this A-Level transformation topic set, you MUST generate professional exam-style graph questions.
These questions should show a reference function and ask students to plot transformed points or curves.

HERE IS A COMPLETE WORKING EXAMPLE - COPY THIS STRUCTURE EXACTLY:

question_type: "graph_plotting"
question_text: "The curve y = f(x) where f(x) = x(x + 2)(1 - x) has a maximum at A(-0.55, 1.63) and crosses the x-axis at O(0,0), B(-2,0) and C(1,0). On the grid, plot the coordinates of the maximum point on the curve y = f(x + 3)."
marks: 3

correct_answer (THIS IS A COMPLETE WORKING JSON OBJECT - USE THIS FORMAT):
{
  "graphType": "plotting",
  "graphConfig": {
    "chartType": "line",
    "xLabel": "x",
    "yLabel": "y",
    "xDomain": [-6, 4],
    "yDomain": [-4, 6],
    "domainX": [-6, 4],
    "domainY": [-4, 6],
    "grid": {"show": true, "stepX": 1, "stepY": 1},
    "series": [
      {
        "id": "original",
        "label": "y = f(x)",
        "data": [
          {"x": -3, "y": -12}, {"x": -2.5, "y": -4.375}, {"x": -2, "y": 0}, 
          {"x": -1.5, "y": 2.19}, {"x": -1, "y": 2}, {"x": -0.55, "y": 1.63},
          {"x": 0, "y": 0}, {"x": 0.5, "y": -0.94}, {"x": 1, "y": 0}
        ],
        "showLine": true,
        "lineStyle": "solid"
      }
    ]
  },
  "plottingAnswer": {
    "expectedPoints": [{"x": -3.55, "y": 1.63}],
    "toleranceUnits": 0.3,
    "marksPerPoint": 3
  }
}

ANOTHER EXAMPLE - SKETCHING TRANSFORMED CURVE:

question_type: "graph_plotting"  
question_text: "The curve y = f(x) = (x-1)² has vertex at V(1, 0). On the grid, sketch the curve y = 2f(x) + 3 by plotting the vertex and at least two other points."
marks: 4

correct_answer:
{
  "graphType": "plotting",
  "graphConfig": {
    "chartType": "line",
    "xLabel": "x",
    "yLabel": "y",
    "xDomain": [-4, 6],
    "yDomain": [-2, 14],
    "domainX": [-4, 6],
    "domainY": [-2, 14],
    "grid": {"show": true, "stepX": 1, "stepY": 2},
    "series": [
      {
        "id": "original",
        "label": "y = f(x) = (x-1)² (reference)",
        "data": [{"x": -1, "y": 4}, {"x": 0, "y": 1}, {"x": 1, "y": 0}, {"x": 2, "y": 1}, {"x": 3, "y": 4}],
        "showLine": true,
        "lineStyle": "dashed"
      }
    ]
  },
  "plottingAnswer": {
    "expectedPoints": [{"x": 1, "y": 3}, {"x": 0, "y": 5}, {"x": 2, "y": 5}, {"x": 3, "y": 11}],
    "toleranceUnits": 0.3,
    "marksPerPoint": 1
  }
}

EXAMPLE - GRAPH INTERPRETATION (for text/numeric answers with visible graph):

question_type: "graph_interpretation"
question_text: "The curve y = f(x) = 1/(x+3) has a vertical asymptote at x = -3. State the equation of the vertical asymptote of y = f(x - 1)."
marks: 2

correct_answer:
{
  "graphType": "interpretation",
  "graphConfig": {
    "chartType": "line",
    "xLabel": "x",
    "yLabel": "y",
    "xDomain": [-8, 6],
    "yDomain": [-4, 4],
    "domainX": [-8, 6],
    "domainY": [-4, 4],
    "grid": {"show": true, "stepX": 1, "stepY": 1},
    "series": [
      {
        "id": "left",
        "label": "y = f(x)",
        "data": [{"x": -7, "y": -0.25}, {"x": -6, "y": -0.33}, {"x": -5, "y": -0.5}, {"x": -4, "y": -1}],
        "showLine": true
      },
      {
        "id": "right",
        "label": "y = f(x)",
        "data": [{"x": -2, "y": 1}, {"x": -1, "y": 0.5}, {"x": 0, "y": 0.33}, {"x": 2, "y": 0.2}],
        "showLine": true
      }
    ]
  },
  "interpretationFields": [
    {"id": "asymptote", "type": "text", "question": "State the equation of the vertical asymptote of y = f(x - 1)", "correctAnswer": "x = -2", "marks": 2, "alternatives": ["x=-2", "-2"]}
  ]
}

TRANSFORMATIONS TO INCLUDE (vary these across questions):
- Horizontal translations: y = f(x + a), y = f(x - a)
- Vertical translations: y = f(x) + a
- Stretches: y = af(x), y = f(ax)
- Reflections: y = -f(x), y = f(-x)
- Composite functions fg(x), gf(x)
- Inverse functions

***** CRITICAL: COMMAND VERB DETECTION RULES *****
Use COMMAND VERBS to determine question type:

ALGEBRAIC ANSWER VERBS (use question_type = "short_answer"):
- "Write down" → short_answer (coordinate or numeric input)
- "State" → short_answer (text input, e.g., asymptote equation)
- "Find" → short_answer (algebraic/numeric answer)
- "Calculate" → short_answer (numeric answer)
- "Determine" → short_answer (any answer type)
- "Give" → short_answer (coordinate or value)
- "Work out" → short_answer (numeric/algebraic)
- "Show that" → extended (working required)
- "Prove" → extended (formal proof required)
- "Explain" → extended (reasoning required)
- "Describe" → extended (description required)

GRAPHICAL ACTION VERBS (use question_type = "graph_plotting"):
- "Sketch" → graph_plotting (student draws on grid)
- "Plot" → graph_plotting (student places points)
- "Draw" → graph_plotting (student creates curve)
- "Mark" → graph_plotting (student marks on diagram)
- "On the grid, show" → graph_plotting

READING FROM GRAPH VERBS (use question_type = "graph_interpretation"):
- "Read from the graph" → graph_interpretation with visible data
- "Use your graph to find" → graph_interpretation
- "Estimate from the curve" → graph_interpretation

EXAMPLES OF CORRECT MAPPING:
- "Write down the coordinates of the maximum point on y = f(x+3)" → short_answer with coordinateAnswer
- "State the equation of the asymptote of y = f(2x)" → short_answer with textAnswer
- "Find f⁻¹(4)" → short_answer with numericAnswer
- "Sketch y = 2f(x) on the grid" → graph_plotting with expectedPoints
- "Plot the transformed curve" → graph_plotting

DO NOT show an interactive graph if the question only asks for algebraic/numeric answers.
Graphs should ONLY appear when students need to visually interact with them.

CRITICAL RULES:
1. Match command verbs to question types as specified above
2. For graph_plotting: ALWAYS include graphType, graphConfig.series with data, and plottingAnswer.expectedPoints
3. For short_answer coordinates: use {"coordinateAnswer": {"x": val, "y": val}, "textAnswer": "(x, y)"}
4. For short_answer equations: use {"textAnswer": "x = value", "alternatives": [...]}
5. NEVER include a graph just because the topic involves functions - only when visual interaction is required
`;
    } else if (isALevel) {
      transformationInstructions = `
A-LEVEL GRAPH QUESTIONS (when relevant to subtopics):
- Use question_type = "graph_plotting" for questions where students plot points or sketch curves
- Use question_type = "graph_interpretation" for questions with text/numeric answers about graphs
- Include f(x) notation for transformations
- correct_answer MUST include graphType ("plotting" or "interpretation"), graphConfig with series data
- See the graph format requirements above
`;
    }

    const prompt = `Generate ${setData.question_count} practice questions.

Context:
- Subject: ${setData.subject_id}
- Subtopics: ${setData.subtopics.join(', ')}
- Educational Level: ${setData.educational_tier || 'not specified'}
${setData.exam_board ? `- Exam Board: ${setData.exam_board}` : ''}
- ${difficultyInstructions}
${complexityInstructions}
${transformationInstructions}

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
${visualQuestionInstructions}

MCQ rules (avoid duplication in UI):
- question_text MUST contain only the stem (no A/B/C/D in the text).
- options MUST be an array of 4 strings WITHOUT letter prefixes.
- correct_answer MUST be one of: "A", "B", "C", "D".

Graph questions (CRITICAL - must ALWAYS render a visible graph):
- For graph_interpretation and graph_plotting, you MUST generate a complete chart with MATHEMATICAL DATA.
- correct_answer MUST be an object with ALL of the following:
  {
    "graphType": "interpretation" or "plotting",
    "graphConfig": {
      "chartType": "line",
      "xLabel": "x",
      "yLabel": "y",
      "xDomain": [min, max],
      "yDomain": [min, max],
      "domainX": [min, max],
      "domainY": [min, max],
      "series": [
        {
          "id": "reference",
          "label": "y = f(x)",
          "data": [MATHEMATICALLY COMPUTED POINTS - at least 15-20 points for a smooth curve],
          "showLine": true,
          "lineStyle": "solid"
        }
      ],
      "grid": {"show": true, "stepX": 1, "stepY": 1}
    },
    "plottingAnswer": {
      "expectedPoints": [{"x": val, "y": val}, ...],
      "toleranceUnits": 0.3,
      "marksPerPoint": 1,
      "expectedCurve": {
        "id": "expected",
        "label": "Expected",
        "data": [same curve data as series],
        "showLine": true,
        "lineStyle": "dashed",
        "color": "#22c55e"
      }
    }
  }

***** CRITICAL DATA GENERATION RULES *****
1. The "series.data" array MUST contain 15-20 mathematically computed points
2. If question mentions f(x) = x(x+2)(1-x), COMPUTE y values: y = x * (x+2) * (1-x)
3. If question mentions (x-a)^2, COMPUTE y values: y = (x-a)^2
4. If question mentions 1/(x+a), COMPUTE y values: y = 1/(x+a)
5. Set xDomain/yDomain to encompass all key points mentioned in the question
6. NEVER use placeholder data like [{"x":0,"y":1},{"x":2,"y":5}] - compute real values
7. Copy the same curve data into plottingAnswer.expectedCurve for review mode

Example computation for y = x(x+2)(1-x):
x=-3: y = -3*(-1)*4 = 12
x=-2: y = -2*0*3 = 0 (root)
x=-1: y = -1*1*2 = -2
x=0: y = 0 (root)
x=0.5: y = 0.5*2.5*0.5 = 0.625
x=1: y = 1*3*0 = 0 (root)

CRITICAL RULE FOR graph_interpretation interpretationFields:
- The interpretationFields array MUST match the intent of question_text.
- If the question asks "What is the temperature at 2 minutes?" => field should ask "Temperature at t=2 (read from graph)" with type "numeric".
- If the question asks about a trend => field should be type "text" asking to describe the trend.
- ONLY include gradient/y-intercept fields if the question_text EXPLICITLY asks for gradient, slope, m-value, y-intercept, or c-value.
- DO NOT add gradient/y-intercept fields by default. Match the fields to the question intent.
- Example read-value question fields: [{"id":"f1","type":"numeric","question":"What is the temperature when time = 2 minutes?","correctAnswer":15,"marks":1}]
- Example trend question fields: [{"id":"f1","type":"text","question":"Describe the trend between x=2 and x=4","correctAnswer":"increasing","synonyms":["rising","goes up","increases"],"marks":1}]
- Example gradient question (ONLY if question asks for it): [{"id":"f1","type":"numeric","question":"What is the gradient of the line?","correctAnswer":2,"marks":1}]

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

QUESTION NUMBERING (EXAM-STYLE MULTI-PART FORMAT):
- You SHOULD use sub-part notation like "1a", "1b", "1c", "2a", "2b" etc.
- Multi-part questions (a, b, c, d...) that share context SHOULD be grouped under the same number
- Example: A transformation question about f(x) = x(x+2)(1-x) might have:
  - Question "1a": "Sketch the curve y = f(x)..." → question_number: "1a"
  - Question "1b": "Sketch the curve y = f(x + 3)..." → question_number: "1b"
  - Question "1c": "State the coordinates of the maximum of y = -f(x)" → question_number: "1c"
- A standalone question with no sub-parts can just use "2", "3", etc.
- The sub-parts (1a, 1b, 1c) together count as ONE root question
- You can have questions with varying numbers of sub-parts: some may have just "a", others "a, b, c, d"
- Total ROOT questions (unique numbers like 1, 2, 3) should roughly match user request
- The INDIVIDUAL entries you return should equal the user's requested count (${setData.question_count})
- Example: 20 questions could be: 1a, 1b, 2a, 2b, 2c, 3, 4a, 4b, 5a, 5b, 5c, 5d, 6, 7a, 7b, 8, 9a, 9b, 9c, 10

MCQ QUESTIONS:
- If the question asks "Which of the following represents..." it MUST be question_type: "mcq"
- MCQ correct_answer MUST be a single letter: "A", "B", "C", or "D"
- Do NOT use graph_plotting for "Which of the following..." questions

General field expectations:
- question_number: string ("1", "2", ...) - simple integers only
- question_text: plain ASCII string
- question_latex: MUST be null
- worked_solution: plain ASCII string (optional)
- has_math: true/false
- equation_complexity: "simple" | "medium" | "complex" (optional)

${specContent ? 'Specification (excerpt):\n' + specContent.substring(0, 5000) : ''}
${exampleQuestionsContent ? `
EXAMPLE QUESTIONS TO REPLICATE (IMPORTANT):
The user has provided example questions. Study these carefully and:
1. Match the STYLE of graph questions (curve shapes, axis labels, grid setup)
2. Match the STRUCTURE of multi-part questions (a, b, c sub-parts)
3. Match the COMMAND VERBS used (Sketch, State, Find, etc.)
4. For graph questions, ensure your graphConfig.series data produces similar curve shapes
5. Use similar marks allocation patterns

Example content (excerpt):
${exampleQuestionsContent.substring(0, 8000)}
` : ''}
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
      'graph_transformation',
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

    // Simplified tool schema to avoid "too many states" error from Google AI
    // Removed minItems/maxItems constraints and simplified correct_answer type
    const tool = {
      type: 'function',
      function: {
        name: 'generate_practice_questions',
        description: `Generate exactly ${setData.question_count} practice questions as structured data.`,
        parameters: {
          type: 'object',
          required: ['questions'],
          properties: {
            questions: {
              type: 'array',
              description: `Array of exactly ${setData.question_count} questions`,
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
                properties: {
                  question_number: { type: 'string' },
                  question_text: { type: 'string' },
                  question_latex: { type: 'string', nullable: true },
                  question_type: { type: 'string' },
                  marks: { type: 'number' },
                  subtopic: { type: 'string' },
                  difficulty_level: { type: 'string' },
                  has_math: { type: 'boolean' },
                  equation_complexity: { type: 'string', nullable: true },
                  correct_answer: {},
                  options: { type: 'array', nullable: true },
                  worked_solution: { type: 'string', nullable: true },
                  table_data: { type: 'object', nullable: true },
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

    // Pre-parse sanitizer: fix invalid backslash escapes in JSON strings BEFORE parsing.
    // This handles LaTeX-like sequences the model may emit despite instructions.
    const sanitizeJsonString = (raw: string): string => {
      // Replace invalid escape sequences inside strings.
      // Valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
      // Anything else (e.g. \s, \l, \q from LaTeX) is invalid.
      let result = '';
      let inString = false;
      let i = 0;
      while (i < raw.length) {
        const c = raw[i];
        if (c === '"' && (i === 0 || raw[i - 1] !== '\\')) {
          inString = !inString;
          result += c;
          i++;
          continue;
        }
        if (inString && c === '\\') {
          const next = raw[i + 1];
          if (next === undefined) {
            // Trailing backslash - escape it
            result += '\\\\';
            i++;
            continue;
          }
          // Check for valid JSON escapes
          if ('"\\\/bfnrt'.includes(next)) {
            result += c + next;
            i += 2;
            continue;
          }
          if (next === 'u') {
            // Check for valid unicode escape \uXXXX
            const hex = raw.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              result += raw.slice(i, i + 6);
              i += 6;
              continue;
            }
          }
          // Invalid escape - double the backslash to make it literal
          result += '\\\\' + next;
          i += 2;
          continue;
        }
        result += c;
        i++;
      }
      return result;
    };

    const extractToolArgs = (ai: any) => {
      const msg = ai?.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls;
      const call = Array.isArray(toolCalls) ? toolCalls[0] : null;

      if (!call?.function?.arguments) {
        console.error('Unexpected AI response shape (missing tool_calls):', JSON.stringify(ai).slice(0, 2000));
        throw new Error('AI response missing tool output');
      }

      let argsText = String(call.function.arguments);
      
      // Attempt parse; if fails, sanitize and retry once
      try {
        return JSON.parse(argsText);
      } catch (firstErr) {
        console.warn('First JSON.parse failed, sanitizing:', (firstErr as Error).message);
        const sanitized = sanitizeJsonString(argsText);
        try {
          return JSON.parse(sanitized);
        } catch (secondErr) {
          // Log context around failure position
          const match = (secondErr as Error).message.match(/position (\d+)/);
          const pos = match ? parseInt(match[1], 10) : 0;
          const snippet = sanitized.slice(Math.max(0, pos - 50), pos + 50);
          console.error('Sanitized JSON still invalid. Context:', snippet);
          throw new Error(`Failed to parse AI tool arguments: ${(secondErr as Error).message}`);
        }
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
    
    // PHASE 5: Post-generation validation for A-Level complexity
    if (isALevel || isUniversity) {
      const minExpectedMarks = isUniversity ? 6 : 4;
      
      // Count low-quality questions
      const lowQualityQuestions = questions.filter((q: any) => {
        const isLowMarks = q.marks < minExpectedMarks;
        const isShortText = (q.question_text || '').length < 50;
        const isTooSimple = /^plot (the|a|this) point/i.test(q.question_text || '') ||
                           /^read (the|a) value/i.test(q.question_text || '') ||
                           /^what is the (x|y)(-| )coordinate/i.test(q.question_text || '');
        const hasNoReasoning = !/hence|therefore|deduce|prove|show that|explain|justify/i.test(q.question_text || '');
        
        return isLowMarks || isShortText || isTooSimple;
      });
      
      const lowQualityRatio = lowQualityQuestions.length / questions.length;
      
      console.log(`A-Level quality check: ${lowQualityQuestions.length}/${questions.length} questions below expected complexity (${(lowQualityRatio * 100).toFixed(1)}%)`);
      
      if (lowQualityRatio > 0.3) {
        console.warn('WARNING: Too many low-complexity questions for A-Level/University tier');
        console.warn('Low quality questions:', lowQualityQuestions.map((q: any) => ({
          num: q.question_number,
          marks: q.marks,
          textPreview: (q.question_text || '').substring(0, 60)
        })));
      }
      
      // Check graph_transformation ratio when forced
      if (forceTransformationType) {
        const transformationQuestions = questions.filter((q: any) => q.question_type === 'graph_transformation');
        const transformationRatio = transformationQuestions.length / questions.length;
        
        console.log(`Transformation question ratio: ${transformationQuestions.length}/${questions.length} (${(transformationRatio * 100).toFixed(1)}%)`);
        
        if (transformationRatio < 0.3) {
          console.warn('WARNING: Expected at least 50% graph_transformation questions but got less than 30%');
          console.warn('Question types generated:', questions.map((q: any) => q.question_type));
        }
      }
    }

    // Validate and transform questions
    const questionsToInsert = questions.map((q: any, idx: number) => {
      
      // *** CRITICAL: COMMAND VERB DETECTION - Convert graph questions to short_answer when appropriate ***
      const questionText = (q.question_text || '').toLowerCase();
      const isGraphType = q.question_type === 'graph_plotting' || q.question_type === 'graph_interpretation' || q.question_type === 'graph_transformation';
      
      // *** NEW: Detect MCQ questions wrongly marked as graph_plotting ***
      // Pattern: "Which of the following represents..." with single-letter answer
      const isMcqPattern = /\b(which of the following|which option|which graph|which represents|which shows)\b/i.test(questionText);
      const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
      const hasSingleLetterAnswer = typeof q.correct_answer === 'string' && /^[A-D]$/i.test(q.correct_answer);
      
      if (isGraphType && isMcqPattern && (hasOptions || hasSingleLetterAnswer)) {
        console.info(`Question ${q.question_number}: Converting ${q.question_type} to MCQ - detected "Which of the following" pattern`);
        q.question_type = 'mcq';
        
        // Ensure we have options
        if (!hasOptions) {
          q.options = ['A', 'B', 'C', 'D'];
        }
        
        // Ensure correct_answer is just the letter
        if (typeof q.correct_answer !== 'string' || !/^[A-D]$/i.test(q.correct_answer)) {
          q.correct_answer = 'A'; // Default if not specified
        }
      }
      else if (isGraphType) {
        // Verbs that indicate algebraic/numeric answers (NOT graph interaction)
        const algebraicVerbs = /\b(write down|state|find|calculate|determine|give|work out)\b/i;
        // Verbs that indicate graph interaction IS required
        const graphicalVerbs = /\b(sketch|plot|draw|mark|on the grid|on the axes|on the diagram)\b/i;
        
        const hasAlgebraicVerb = algebraicVerbs.test(questionText);
        const hasGraphicalVerb = graphicalVerbs.test(questionText);
        
        // If question uses algebraic verbs but NOT graphical verbs, convert to short_answer
        if (hasAlgebraicVerb && !hasGraphicalVerb) {
          console.info(`Question ${q.question_number}: Converting ${q.question_type} to short_answer - uses algebraic verb "${questionText.match(algebraicVerbs)?.[0]}" without graphical action`);
          
          // Try to extract numeric answer from the graph data
          let convertedAnswer: any = { textAnswer: '' };
          
          try {
            const graphData = typeof q.correct_answer === 'string' 
              ? JSON.parse(q.correct_answer) 
              : q.correct_answer;
            
            // Check for coordinate answers
            if (graphData?.plottingAnswer?.expectedPoints?.[0]) {
              const pt = graphData.plottingAnswer.expectedPoints[0];
              convertedAnswer = {
                coordinateAnswer: { x: pt.x, y: pt.y },
                textAnswer: `(${pt.x}, ${pt.y})`,
                alternatives: [`(${pt.x},${pt.y})`, `${pt.x}, ${pt.y}`]
              };
            }
            // Check for interpretation text answers
            else if (graphData?.interpretationFields?.[0]) {
              const field = graphData.interpretationFields[0];
              convertedAnswer = {
                textAnswer: String(field.correctAnswer),
                alternatives: field.alternatives || field.synonyms || []
              };
              if (typeof field.correctAnswer === 'number') {
                convertedAnswer.numericAnswer = field.correctAnswer;
              }
            }
          } catch (e) {
            console.warn(`Question ${q.question_number}: Failed to extract answer during conversion`);
          }
          
          q.question_type = 'short_answer';
          q.correct_answer = convertedAnswer;
        }
      }
      
      // Validate table_grid questions have required fields
      if (q.question_type === 'table_grid') {
        if (!q.table_data) {
          console.warn(`Question ${q.question_number}: table_grid type but missing table_data, downgrading to short_answer`);
          q.question_type = 'short_answer';
        } else {
          // CRITICAL: Ensure rows array exists and is valid
          if (!Array.isArray(q.table_data.rows) || q.table_data.rows.length === 0) {
            console.warn(`Question ${q.question_number}: table_grid missing rows array, generating fallback`);
            
            // Try to infer rows from question context
            const questionLower = (q.question_text || '').toLowerCase();
            let fallbackRows: Array<{ id: string; label: string }> = [];
            
            // Common table patterns
            if (/statement|claim|fact/i.test(questionLower)) {
              fallbackRows = [
                { id: 'row1', label: 'Statement 1' },
                { id: 'row2', label: 'Statement 2' },
                { id: 'row3', label: 'Statement 3' },
              ];
            } else if (/x\s*[=:]/i.test(questionLower) || /coordinate|point/i.test(questionLower)) {
              fallbackRows = [
                { id: 'row1', label: 'x = 0' },
                { id: 'row2', label: 'x = 1' },
                { id: 'row3', label: 'x = 2' },
              ];
            } else if (/segment|interval|range/i.test(questionLower)) {
              fallbackRows = [
                { id: 'row1', label: 'Segment A-B' },
                { id: 'row2', label: 'Segment B-C' },
                { id: 'row3', label: 'Segment C-D' },
              ];
            } else {
              // Generic fallback
              fallbackRows = [
                { id: 'row1', label: 'Item 1' },
                { id: 'row2', label: 'Item 2' },
                { id: 'row3', label: 'Item 3' },
              ];
            }
            
            q.table_data.rows = fallbackRows;
          }
          
          // Ensure headers array exists
          if (!Array.isArray(q.table_data.headers) || q.table_data.headers.length === 0) {
            console.warn(`Question ${q.question_number}: table_grid missing headers, generating fallback`);
            
            const tableType = q.table_data.tableType || q.table_data.table_interaction_type || 'text_entry';
            
            if (tableType === 'tf_single' || /true.*false/i.test(q.question_text || '')) {
              q.table_data.headers = ['', 'True', 'False'];
            } else if (tableType === 'tick_cross' || /tick.*cross/i.test(q.question_text || '')) {
              q.table_data.headers = ['', 'Tick', 'Cross'];
            } else if (/increase|decrease/i.test(q.question_text || '')) {
              q.table_data.headers = ['', 'Increasing', 'Decreasing'];
            } else {
              q.table_data.headers = ['', 'Answer'];
            }
          }
          
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
      
      // GRAPH QUESTION VALIDATION (CRITICAL - ensures graphSpec exists with actual data)
      if (q.question_type === 'graph_interpretation' || q.question_type === 'graph_plotting') {
        const graphValidation = validateGraphQuestion(q.question_type, q.correct_answer);
        logGraphValidation(q.question_number, graphValidation);
        
        // Parse to check if series has actual data points
        let hasValidData = false;
        let graphData: any = null;
        try {
          graphData = typeof q.correct_answer === 'string' 
            ? JSON.parse(q.correct_answer) 
            : q.correct_answer;
          const series = graphData?.graphConfig?.series;
          if (Array.isArray(series) && series.length > 0) {
            const firstSeries = series[0];
            if (Array.isArray(firstSeries?.data) && firstSeries.data.length >= 3) {
              hasValidData = true;
            }
          }
        } catch (e) {
          console.warn(`Question ${q.question_number}: Failed to parse graphConfig for data check`);
        }
        
        // *** CRITICAL: ALWAYS try to generate question-specific curve data ***
        // This fixes the issue where AI returns empty graphConfig or generic fallback data
        if (!hasValidData) {
          console.info(`Question ${q.question_number}: No valid series data - generating from question context`);
          
          const qText = q.question_text || '';
          
          // Extract key points from question text
          const coordPatterns = [
            /(?:crosses|intercept|root|zero)[^.]*?\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/gi,
            /(?:turning point|vertex|maximum|minimum|max|min)[^.]*?\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/gi,
            /(?:passes through|through)[^.]*?\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/gi,
            /at\s+[A-Z]?\s*\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/gi,
          ];
          
          const extractedPoints: Array<{x: number, y: number, type?: string}> = [];
          
          for (const pattern of coordPatterns) {
            let match;
            const text = qText;
            pattern.lastIndex = 0;
            while ((match = pattern.exec(text)) !== null) {
              const x = parseFloat(match[1]);
              const y = parseFloat(match[2]);
              if (!isNaN(x) && !isNaN(y)) {
                extractedPoints.push({ x, y });
              }
            }
          }
          
          console.info(`Question ${q.question_number}: Extracted ${extractedPoints.length} key points from text:`, extractedPoints);
          
          // CRITICAL: Detect transformation type from question text
          // e.g., "Sketch y = f(x) + 2" means vertical translation +2
          // e.g., "Sketch y = f(x - 3)" means horizontal translation +3
          // e.g., "Sketch y = 2f(x)" means vertical stretch by 2
          // e.g., "Sketch y = f(2x)" means horizontal compression by 1/2
          // e.g., "Sketch y = -f(x)" means reflection in x-axis
          // e.g., "Sketch y = f(-x)" means reflection in y-axis
          
          interface TransformConfig {
            verticalShift: number;
            horizontalShift: number;
            verticalStretch: number;
            horizontalStretch: number;
            reflectX: boolean;
            reflectY: boolean;
          }
          
          const transform: TransformConfig = {
            verticalShift: 0,
            horizontalShift: 0,
            verticalStretch: 1,
            horizontalStretch: 1,
            reflectX: false,
            reflectY: false,
          };
          
          // Parse transformation from question text
          // Pattern: f(x) + a or f(x) - a (vertical shift)
          const vertShiftMatch = qText.match(/f\(x\)\s*([+-])\s*(\d+(?:\.\d+)?)/i);
          if (vertShiftMatch) {
            const sign = vertShiftMatch[1] === '+' ? 1 : -1;
            transform.verticalShift = sign * parseFloat(vertShiftMatch[2]);
            console.info(`Question ${q.question_number}: Detected vertical shift: ${transform.verticalShift}`);
          }
          
          // Pattern: f(x + a) or f(x - a) (horizontal shift, OPPOSITE direction)
          const horizShiftMatch = qText.match(/f\(x\s*([+-])\s*(\d+(?:\.\d+)?)\)/i);
          if (horizShiftMatch) {
            // f(x - 3) shifts RIGHT by 3, f(x + 2) shifts LEFT by 2
            const sign = horizShiftMatch[1] === '-' ? 1 : -1;
            transform.horizontalShift = sign * parseFloat(horizShiftMatch[2]);
            console.info(`Question ${q.question_number}: Detected horizontal shift: ${transform.horizontalShift}`);
          }
          
          // Pattern: af(x) where a is a number (vertical stretch)
          const vertStretchMatch = qText.match(/(\d+(?:\.\d+)?)\s*f\(x\)/i);
          if (vertStretchMatch) {
            transform.verticalStretch = parseFloat(vertStretchMatch[1]);
            console.info(`Question ${q.question_number}: Detected vertical stretch: ${transform.verticalStretch}`);
          }
          
          // Pattern: f(ax) where a is a number (horizontal compression)
          const horizStretchMatch = qText.match(/f\((\d+(?:\.\d+)?)x\)/i);
          if (horizStretchMatch) {
            transform.horizontalStretch = parseFloat(horizStretchMatch[1]);
            console.info(`Question ${q.question_number}: Detected horizontal stretch factor: ${transform.horizontalStretch}`);
          }
          
          // Pattern: -f(x) (reflection in x-axis)
          if (/-\s*f\(x\)/i.test(qText) && !/f\(x\)\s*-/i.test(qText)) {
            transform.reflectX = true;
            console.info(`Question ${q.question_number}: Detected reflection in x-axis`);
          }
          
          // Pattern: f(-x) (reflection in y-axis)
          if (/f\(-x\)/i.test(qText)) {
            transform.reflectY = true;
            console.info(`Question ${q.question_number}: Detected reflection in y-axis`);
          }
          
          // Generate base curve (reference curve y = f(x))
          let baseCurveData: Array<{x: number, y: number}> = [];
          let domainX: [number, number] = [-5, 5];
          let domainY: [number, number] = [-5, 10];
          
          // Check for specific function mentions
          const isQuadratic = /\b(x-?\d*)?\^2\b|parabola|quadratic/i.test(qText);
          const isCubic = /x\([^)]+\)\([^)]+\)|cubic|x\^3/i.test(qText);
          const isReciprocal = /1\/\(x|1\/x|reciprocal/i.test(qText);
          
          if (extractedPoints.length >= 3) {
            // Generate curve that passes through extracted key points
            const allX = extractedPoints.map(p => p.x);
            const allY = extractedPoints.map(p => p.y);
            const minX = Math.min(...allX);
            const maxX = Math.max(...allX);
            const minY = Math.min(...allY);
            const maxY = Math.max(...allY);
            
            const xPad = Math.max(2, (maxX - minX) * 0.3);
            const yPad = Math.max(2, (maxY - minY) * 0.3);
            domainX = [Math.floor(minX - xPad), Math.ceil(maxX + xPad)];
            domainY = [Math.floor(minY - yPad), Math.ceil(maxY + yPad)];
            
            // Lagrange interpolation
            const step = (domainX[1] - domainX[0]) / 50;
            for (let x = domainX[0]; x <= domainX[1]; x += step) {
              let y = 0;
              for (let i = 0; i < extractedPoints.length; i++) {
                let term = extractedPoints[i].y;
                for (let j = 0; j < extractedPoints.length; j++) {
                  if (i !== j) {
                    term *= (x - extractedPoints[j].x) / (extractedPoints[i].x - extractedPoints[j].x);
                  }
                }
                y += term;
              }
              if (Number.isFinite(y) && Math.abs(y) < 100) {
                baseCurveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
              }
            }
          } else if (isReciprocal) {
            domainX = [-5, 5];
            domainY = [-5, 5];
            for (let x = domainX[0]; x <= domainX[1]; x += 0.15) {
              if (Math.abs(x) > 0.2) {
                const y = 1 / x;
                if (Math.abs(y) < 10) {
                  baseCurveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
                }
              }
            }
          } else if (isCubic) {
            domainX = [-4, 3];
            domainY = [-6, 4];
            for (let x = domainX[0]; x <= domainX[1]; x += 0.15) {
              const y = x * (x + 2) * (1 - x);
              baseCurveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
            }
          } else {
            // Default: simple parabola y = x^2
            domainX = [-4, 4];
            domainY = [-2, 10];
            for (let x = domainX[0]; x <= domainX[1]; x += 0.2) {
              const y = x * x;
              baseCurveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
            }
          }
          
          // CRITICAL: Apply transformation to generate expectedCurve
          // The transformation is applied to the CURVE, not to individual x values.
          // For y = f(x + a): we evaluate y at (x + a), which means we SHIFT the curve LEFT by a
          // So if baseCurveData has point (2, 4) from f(x), for f(x + 3), the new point is at x = 2 - 3 = -1
          // The convention: if we want the transformed curve, we take each base point and shift the x-coordinate
          const transformedCurveData: Array<{x: number, y: number}> = [];
          
          for (const point of baseCurveData) {
            let newX = point.x;
            let newY = point.y;
            
            // Apply transformations in correct mathematical order:
            
            // 1. Horizontal transformations (affect x-coordinate of the output curve)
            // For y = f(x + a): shift the curve LEFT by a (so newX = point.x - a)
            // For y = f(x - a): shift the curve RIGHT by a (so newX = point.x + a)
            // horizontalShift is stored as: f(x - a) → shift = +a, f(x + a) → shift = -a
            newX = point.x + transform.horizontalShift;
            
            // For y = f(ax): compress horizontally by factor a (so newX = point.x / a)
            if (transform.horizontalStretch !== 1) {
              newX = point.x / transform.horizontalStretch;
            }
            
            // For y = f(-x): reflect in y-axis (newX = -point.x)
            if (transform.reflectY) {
              newX = -point.x;
            }
            
            // 2. Vertical transformations (affect y-coordinate of the output curve)
            // For y = af(x): stretch vertically by factor a
            newY = point.y * transform.verticalStretch;
            
            // For y = -f(x): reflect in x-axis
            if (transform.reflectX) {
              newY = -newY;
            }
            
            // For y = f(x) + a: shift up by a
            newY = newY + transform.verticalShift;
            
            if (Number.isFinite(newX) && Number.isFinite(newY)) {
              transformedCurveData.push({ 
                x: Math.round(newX * 100) / 100, 
                y: Math.round(newY * 100) / 100 
              });
            }
          }
          
          // Sort transformed curve by x-coordinate for proper line rendering
          transformedCurveData.sort((a, b) => a.x - b.x);
          
          // Adjust domain to fit transformed curve
          if (transformedCurveData.length > 0) {
            const allX = transformedCurveData.map(p => p.x);
            const allY = transformedCurveData.map(p => p.y);
            const minX = Math.min(...allX, ...baseCurveData.map(p => p.x));
            const maxX = Math.max(...allX, ...baseCurveData.map(p => p.x));
            const minY = Math.min(...allY, ...baseCurveData.map(p => p.y));
            const maxY = Math.max(...allY, ...baseCurveData.map(p => p.y));
            
            domainX = [Math.floor(minX - 1), Math.ceil(maxX + 1)];
            domainY = [Math.floor(minY - 1), Math.ceil(maxY + 1)];
          }
          
          console.info(`Question ${q.question_number}: Generated base curve (${baseCurveData.length} pts) and transformed curve (${transformedCurveData.length} pts)`);
          
          if (baseCurveData.length >= 10) {
            // Build complete graphConfig
            graphData = {
              graphType: 'plotting',
              graphConfig: {
                chartType: 'line',
                xLabel: 'x',
                yLabel: 'y',
                xDomain: domainX,
                yDomain: domainY,
                domainX: domainX,
                domainY: domainY,
                grid: { show: true, stepX: 1, stepY: 1 },
                series: [{
                  id: 'reference',
                  label: 'y = f(x)',
                  data: baseCurveData,
                  showLine: true,
                  lineStyle: 'solid',
                  color: 'hsl(var(--primary))'
                }]
              },
              plottingAnswer: {
                expectedPoints: transformedCurveData.slice(0, 5).map(p => ({ x: p.x, y: p.y })),
                toleranceUnits: 0.5,
                marksPerPoint: Math.max(1, Math.floor(q.marks / 3)),
                // CRITICAL: expectedCurve is the TRANSFORMED curve, not the original
                expectedCurve: {
                  id: 'expected',
                  label: 'Expected',
                  data: transformedCurveData.length > 0 ? transformedCurveData : baseCurveData,
                  showLine: true,
                  lineStyle: 'dashed',
                  color: '#22c55e'
                }
              }
            };
            
            q.correct_answer = graphData;
            hasValidData = true;
          }
        }
        
        // If still no valid data after generation attempt, downgrade question type
        if (!hasValidData) {
          console.warn(`Question ${q.question_number}: Could not generate curve data, downgrading to extended`);
          q.question_type = 'extended';
          q.correct_answer = 'This question requires graphical analysis. Show your working.';
        }
      }
      
      // GRAPH TRANSFORMATION VALIDATION - Convert to graph_plotting since that's what renders
      if (q.question_type === 'graph_transformation') {
        console.info(`Question ${q.question_number}: Converting graph_transformation to graph_plotting for proper rendering`);
        
        try {
          const transData = typeof q.correct_answer === 'string' 
            ? JSON.parse(q.correct_answer) 
            : q.correct_answer;
          
          // Convert to graph_plotting format
          const hasGraphConfig = transData?.graphConfig && 
                                 Array.isArray(transData.graphConfig.series) &&
                                 transData.graphConfig.series.length > 0;
          
          if (hasGraphConfig) {
            // Transform to graph_plotting format
            // CRITICAL: Include expectedCurve from series for review mode
            const seriesData = transData.graphConfig.series[0]?.data || [];
            const plottingData = {
              graphType: 'plotting',
              graphConfig: {
                ...transData.graphConfig,
                grid: { show: true, stepX: 1, stepY: 1 },
                xDomain: transData.graphConfig.domainX || transData.graphConfig.xDomain || [-10, 10],
                yDomain: transData.graphConfig.domainY || transData.graphConfig.yDomain || [-10, 10],
                domainX: transData.graphConfig.domainX || transData.graphConfig.xDomain || [-10, 10],
                domainY: transData.graphConfig.domainY || transData.graphConfig.yDomain || [-10, 10],
              },
              plottingAnswer: {
                expectedPoints: transData.parts?.[0]?.correctAnswer?.coordinateAnswer 
                  ? [transData.parts[0].correctAnswer.coordinateAnswer]
                  : transData.parts?.[0]?.correctAnswer?.transformedPoints || [],
                toleranceUnits: 0.3,
                marksPerPoint: q.marks / Math.max(1, transData.parts?.length || 1),
                // Include expectedCurve for review mode rendering
                expectedCurve: seriesData.length >= 3 ? {
                  id: 'expected',
                  label: 'Expected answer',
                  data: seriesData,
                  showLine: true,
                  lineStyle: 'dashed',
                  color: '#22c55e'
                } : undefined
              }
            };
            
            q.question_type = 'graph_plotting';
            q.correct_answer = plottingData;
            console.info(`Question ${q.question_number}: Successfully converted to graph_plotting with expectedCurve`);
          } else {
            // Fallback to graph_interpretation if no series data
            console.warn(`Question ${q.question_number}: No graphConfig series, converting to graph_interpretation`);
            q.question_type = 'graph_interpretation';
            const interpretationData = {
              graphType: 'interpretation',
              graphConfig: {
                chartType: 'line',
                xLabel: 'x',
                yLabel: 'y',
                xDomain: [-10, 10],
                yDomain: [-10, 10],
                domainX: [-10, 10],
                domainY: [-10, 10],
                grid: { show: true, stepX: 1, stepY: 1 },
                series: []
              },
              interpretationFields: [
                { id: 'answer', type: 'text', question: 'Enter your answer', correctAnswer: transData.parts?.[0]?.correctAnswer?.textAnswer || '', marks: q.marks }
              ]
            };
            q.correct_answer = interpretationData;
          }
        } catch (e) {
          console.warn(`Question ${q.question_number}: Failed to convert graph_transformation, downgrading to extended`);
          q.question_type = 'extended';
          q.correct_answer = 'This question requires analysis of function transformations.';
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
