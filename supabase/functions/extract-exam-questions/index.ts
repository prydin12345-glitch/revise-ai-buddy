import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.2.1";

// Declare EdgeRuntime global for background task support
declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

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

    console.log('Extracting questions for exam:', draftId);

    // Get exam details quickly
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*, exam_format(*), exam_specifications(*)')
      .eq('id', draftId)
      .eq('user_id', user.id)
      .single();

    if (examError || !exam) {
      return new Response(JSON.stringify({ error: 'Exam not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update status to extracting
    await supabase
      .from('exams')
      .update({ extraction_status: 'extracting' })
      .eq('id', draftId);

    // Start processing in background using EdgeRuntime.waitUntil to keep it alive
    EdgeRuntime.waitUntil(
      processExamExtraction(draftId, user.id, supabase, lovableApiKey)
        .catch(async (error) => {
          console.error('Background processing error:', error);
          await supabase
            .from('exams')
            .update({ 
              extraction_status: 'failed',
              extraction_error: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', draftId);
        })
    );

    // Return immediately
    return new Response(JSON.stringify({ 
      status: 'processing',
      message: 'Question extraction started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in extract-exam-questions:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Main processing function
async function processExamExtraction(draftId: string, userId: string, supabase: any, lovableApiKey: string) {
  console.log('Starting background extraction for:', draftId);

  // Get exam details with format and specifications
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*, exam_format(*), exam_specifications(*)')
    .eq('id', draftId)
    .eq('user_id', userId)
    .single();

  if (examError || !exam) {
    throw new Error('Exam not found');
  }

  const examBoard = exam.exam_board || 'generic';
  const qualificationLevel = exam.qualification_level || 'not specified';
  const specTopics = exam.exam_specifications || [];
  
  const useOriginalStructure = exam.exam_format?.[0]?.use_original_structure ?? true;
  console.log('Use original structure:', useOriginalStructure);
  console.log('Exam board:', examBoard, 'Level:', qualificationLevel);

  // Update status to extracting (already done above)
  // await supabase.from('exams').update({ extraction_status: 'extracting' }).eq('id', draftId);

  // Download PDF from storage
  const { data: pdfData, error: downloadError } = await supabase.storage
    .from('exam-files')
    .download(exam.file_url);

  if (downloadError || !pdfData) {
    console.error('Download error:', downloadError);
    await supabase
      .from('exams')
      .update({ 
        extraction_status: 'failed',
        extraction_error: 'Failed to download PDF'
      })
      .eq('id', draftId);
    throw new Error('Failed to download PDF');
  }

    // Extract text and images from PDF using pdfjs-serverless
    const arrayBuffer = await pdfData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let pdfText = '';
    const pageImages: Record<number, string> = {};
    
    try {
      console.log('Attempting PDF parsing with pdfjs-serverless...');
      const pdf = await getDocument({ data: uint8Array, useSystemFonts: true }).promise;
      const pages: string[] = [];
      
      console.log(`PDF has ${pdf.numPages} pages`);
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
          .join(' ');
        pages.push(pageText);
        
        // Extract page as image for diagram support
        try {
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = {
            width: viewport.width,
            height: viewport.height,
            context: null as any
          };
          
          // Note: Full image extraction requires canvas API which isn't available in Deno
          // This is a placeholder for future enhancement when canvas support is added
          console.log(`Page ${pageNum} dimensions: ${viewport.width}x${viewport.height}`);
        } catch (imgError) {
          console.log(`Could not extract image from page ${pageNum}:`, imgError);
        }
      }
      
      pdfText = pages.join('\n\n');
      pdf.cleanup();
      
      console.log(`Extracted ${pdfText.length} characters using pdfjs-serverless`);
    } catch (pdfError) {
      console.error('pdfjs-serverless parsing failed, trying fallback method:', pdfError);
      
      // Fallback: Basic text extraction
      try {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const rawText = decoder.decode(uint8Array);
        
        const textMatches = rawText.match(/\(([^)]+)\)/g);
        if (textMatches && textMatches.length > 10) {
          pdfText = textMatches
            .map(match => match.slice(1, -1))
            .join(' ')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\n')
            .replace(/\\t/g, ' ')
            .replace(/\\(.)/g, '$1');
        }
        
        if (!pdfText || pdfText.length < 100) {
          const cleanedText = rawText
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\xFF]/g, ' ')
            .replace(/\s+/g, ' ')
            .split(/[\/\[\]<>{}]/g)
            .filter(part => {
              const letters = part.match(/[a-zA-Z]/g);
              return letters && letters.length > 3;
            })
            .join(' ');
          
          if (cleanedText.length > pdfText.length) {
            pdfText = cleanedText;
          }
        }
        
        console.log(`Fallback extraction yielded ${pdfText.length} characters`);
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError);
      }
    }
    
    // Final cleanup
    pdfText = pdfText
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();
    
    // Validate extracted text with lenient threshold
    const readableChars = pdfText.match(/[a-zA-Z0-9]/g);
    const readableRatio = readableChars ? readableChars.length / pdfText.length : 0;
    
    console.log(`Final text: ${pdfText.length} chars, readability: ${(readableRatio * 100).toFixed(1)}%`);
    
    // Determine if we need fallback mode
    const useFallbackMode = readableRatio < 0.25 || pdfText.length < 100;
    
    if (useFallbackMode) {
      console.warn('⚠️ FALLBACK MODE ACTIVATED: Text unreadable, generating from metadata');
      pdfText = ''; // Clear unusable text
    } else {
      console.log('✅ TEXT-BASED MODE: Using extracted PDF text');
    }

    console.log('Calling Lovable AI for question extraction...');

    // Build exam board-specific guidance
    const examBoardGuidance: Record<string, string> = {
      aqa: `
- Use AQA-style command words (describe, explain, evaluate)
- Follow AQA mark scheme format (1 mark per valid point)
- Use clear, direct language
- Include practical application questions`,
      edexcel: `
- Use Edexcel command words (state, discuss, assess)
- Follow Edexcel levels-based marking
- Include real-world contexts
- Use structured question formats`,
      ocr: `
- Use OCR command words (outline, analyse, justify)
- Follow OCR point-based marking
- Include synoptic elements
- Use varied question formats`,
      cie: `
- Use Cambridge command words (identify, compare, suggest)
- Follow Cambridge detailed mark schemes
- Include international contexts
- Use precise scientific terminology`,
      ib: `
- Use IB command words (define, calculate, deduce)
- Follow IB markband descriptors
- Include TOK and interdisciplinary links
- Use inquiry-based approach`,
      wjec: `
- Use WJEC command words and marking style
- Include Welsh/UK contexts where appropriate
- Follow WJEC mark scheme conventions`,
    };

    const boardInstructions = examBoardGuidance[examBoard] || '- Match standard exam board practices';

    // Build specification filtering if available
    const specTopicList = specTopics.map((t: any) => t.topic_name).join(', ');
    const specInstructions = specTopics.length > 0 
      ? `\n\n📋 SPECIFICATION CONSTRAINT:
Only generate questions covering these approved topics:
${specTopicList}

COMMAND VERB DISTRIBUTION (maintain variety):
- 40% calculation/numerical (calculate, determine, show that, find)
- 30% explanation (explain, describe, discuss, outline)
- 20% analysis (deduce, evaluate, assess, compare)
- 10% recall (state, identify, define, name)

ASSESSMENT OBJECTIVES (aim for balance):
- AO1 (knowledge & recall): 30-35%
- AO2 (application & analysis): 40-45%
- AO3 (evaluation & synthesis): 20-25%

If the exam covers topics NOT in this list, skip them or adapt to spec-approved topics.`
      : '';

    // Build format-aware instructions
    const structureInstructions = useFallbackMode
      ? `🔥 FALLBACK MODE - NO TEXT AVAILABLE:

⚠️ The PDF text could not be extracted (scanned or corrupted document).

📋 GENERATE QUESTIONS FROM METADATA ONLY:

**Exam Details:**
- Subject: ${exam.subject || exam.title || 'Unknown'}
- Exam Board: ${examBoard.toUpperCase()}
- Level: ${qualificationLevel}
- Format: ${exam.exam_format?.[0]?.format_type || 'Standard exam'}

**Your Task:**
Generate a TYPICAL exam paper for this board and level. Use your knowledge of typical ${examBoard.toUpperCase()} ${qualificationLevel} ${exam.subject || exam.title} exams.

**Question Structure:**
${getSubjectSpecificInstructions(exam.subject_id || exam.title, examBoard, qualificationLevel)}

**CRITICAL REQUIREMENTS:**
1. ALL questions MUST include "question_latex" with proper LaTeX notation for ANY mathematical expressions
2. Set "has_math": true for any question with equations, formulas, or math symbols
3. Set "equation_complexity": "simple", "medium", or "complex" based on mathematical content
4. Use hierarchical numbering: "question_number", "parent_question_number", "root_question_number"
   - Main question: "17" → parent: null, root: "17"
   - Sub-part: "17a" → parent: "17", root: "17"
   - Sub-sub-part: "17a(i)" → parent: "17a", root: "17"
5. Allocate marks appropriately (simple: 2-3, medium: 4-6, complex: 7-14)
6. Tag each question with a specific topic
7. NO diagrams assumed (has_figures: false) since we cannot extract them
8. Generate REALISTIC, exam-standard questions`
      : useOriginalStructure
      ? `✨ STRUCTURE PRESERVATION MODE - FULL AI GENERATION:
...
4. **Quality Standards**:
   - Questions must test identical learning objectives
   - Difficulty level must match original
   - Mark allocation must be preserved
   - All questions must be self-contained (no external references)`
      : `🎯 FLEXIBLE GENERATION MODE:
1. Analyze topics and difficulty levels from the document
2. Generate a balanced set of NEW questions based on:
   - Topics identified (prioritize most prominent topics)
   - Mix of question types (MCQ, short answer, long form)
   - Progressive difficulty (easy → medium → hard)
3. Total questions and marks can vary from original
4. Focus on comprehensive topic coverage
5. All questions must be freshly generated (no verbatim copying)`;

    const extractionPrompt = useFallbackMode
      ? `🔥 FALLBACK MODE - NO TEXT AVAILABLE

You are generating a ${examBoard.toUpperCase()} ${qualificationLevel} ${exam.subject || exam.title} exam paper from METADATA ONLY (PDF text extraction failed).

${structureInstructions}

🎯 EXAM BOARD REQUIREMENTS:
${boardInstructions}
${specInstructions}

📐 MATHEMATICAL NOTATION (CRITICAL):
1. ALWAYS provide LaTeX in "question_latex" for ANY math content
2. IMPORTANT: In JSON strings, backslashes MUST be escaped as double backslashes (\\)
3. Examples:
   - Fractions: "\\\\frac{3x+2}{x-1}"
   - Powers: "e^{-2x}", "x^{2n+1}"
   - Integrals: "\\\\int_{0}^{\\\\pi} \\\\sin(x) dx"
   - Square roots: "\\\\sqrt{x^2 + y^2}"
   - Greek letters: "\\\\theta", "\\\\alpha", "\\\\pi"
4. Set "has_math": true for all math questions
5. Set "equation_complexity" appropriately
6. In "question_text", you can use inline math notation with $ signs (e.g., "Find $x$ where...")
7. CRITICAL: Make sure all JSON is properly escaped - backslashes must be doubled in JSON strings

📊 GRAPH & DATA TABLE GENERATION:
When generating questions involving data:
1. Create realistic numerical datasets with:
   - Clear independent/dependent variables
   - Logical relationships (linear, inverse, quadratic)
   - Appropriate significant figures (2-3 for physics/chemistry)
   - Randomized values preserving trends

2. For graphs, populate "graph_description" with:
   - Clear axes labels and units (e.g., "x-axis: time / s, y-axis: velocity / m s⁻¹")
   - Trend description (e.g., "linear decrease from 20 m/s at t=0 to 0 m/s at t=5s")
   - Key features (intercepts, gradients, areas under curve)
   - Example: "Figure 1 shows velocity decreasing linearly over 5 seconds"

3. ⚠️ TABLE FORMAT REQUIREMENT (MANDATORY):
   - Tables MUST be HTML format: <table class="exam-table">...</table>
   - Tables MUST NOT be markdown format (no |---|---| pipe/dash syntax)
   - Any markdown tables in source documents must be converted to HTML
   - Failure to use HTML tables will cause rendering errors
   
   Example HTML table structure:
   <table class="exam-table">
     <thead>
       <tr><th>Time / s</th><th>Velocity / m s⁻¹</th></tr>
     </thead>
     <tbody>
       <tr><td>0.0</td><td>20.0</td></tr>
       <tr><td>1.0</td><td>16.0</td></tr>
       <tr><td>2.0</td><td>12.0</td></tr>
     </tbody>
   </table>
   - Use <thead> for headers with <th> tags
   - Use <tbody> for data rows with <td> tags
   - Always include class="exam-table" for styling
   - Use proper superscripts in headers (e.g., <th>Titre / cm³</th>)
   - For LaTeX in cells, use $ delimiters: <td>$x^2$</td>

4. Set "data_type": "graph", "table", "both", or "none"
5. Set "needs_diagram": true if visual representation is essential

🔍 SUBJECT DETECTION (CRITICAL):
In addition to extracting questions, you MUST analyze the content to detect the PRIMARY SUBJECT of this exam.

Analyze:
- Mathematical notation patterns (algebra, calculus, trigonometry = Mathematics)
- Scientific terminology (forces, energy, circuits = Physics; compounds, reactions = Chemistry)
- Topic keywords (cells, DNA, ecology = Biology; tenses, literature = English)
- Equation types (kinematic equations vs organic chemistry vs pure math)
- Contextual clues (experimental setups, theorem proofs, language analysis)

Return your detection WITHIN THE SAME JSON as questions/topics:
{
  "detected_subject": "Physics" | "Mathematics" | "Chemistry" | "Biology" | "English" | "History" | "Geography" | "Computer Science" | "Other",
  "subject_confidence": 0.95,
  "subject_reasoning": "Brief explanation (e.g., 'Document contains kinematic equations, circuit diagrams, and force calculations')"
}

**Subject Classification Guidelines:**
- **Physics**: Forces, energy, circuits, waves, mechanics, thermodynamics, electricity
- **Mathematics**: Pure algebra, calculus, geometry, trigonometry, statistics, proofs
- **Chemistry**: Elements, compounds, reactions, bonding, organic chemistry, stoichiometry
- **Biology**: Cells, DNA, evolution, ecology, human body systems, genetics
- **English**: Literature analysis, grammar, comprehension, creative writing
- **Computer Science**: Programming, algorithms, data structures, networks
- **History**: Historical events, dates, civilizations, wars, political movements
- **Geography**: Maps, climate, physical features, human geography, environmental science

**Confidence Score:**
- 0.9-1.0: Very clear indicators (e.g., heavy use of F=ma, circuit diagrams → Physics)
- 0.7-0.89: Strong indicators but some ambiguity
- 0.5-0.69: Moderate confidence, mixed signals
- < 0.5: Uncertain, document may be multi-subject or unclear

🔌 CIRCUIT DIAGRAM SUPPORT:
For electrical/electronics questions:
1. Describe circuit topology clearly in "circuit_description":
   - "A thermistor and 0.25 kΩ resistor R are connected in series with a 9.0 V supply"
   - "The output pd is measured across resistor R"
   - Specify all component values and connections

2. Set "circuit_type": "series", "parallel", "voltage_divider", "complex", or "none"

3. For voltage dividers, include:
   - Supply voltage and internal resistance if relevant
   - Fixed resistor values with units
   - Variable component type (thermistor, LDR, potentiometer)
   - Output measurement point

4. Set "needs_diagram": true and "diagram_type": "circuit"

🧪 EXPERIMENTAL SCENARIOS:
Create rich real-world contexts in "scenario_context":
- Physics: escape lanes with friction, rotating platforms, string instruments, projectile motion
- Chemistry: reaction rate experiments, titrations, calorimetry
- Biology: enzyme activity, photosynthesis rates, population studies

For multi-part questions:
- Build progressively (part a calculates, part b explains, part c evaluates)
- Reference the same setup throughout all sub-parts
- Use varied "command_verb" for each part

🔢 QUESTION NUMBERING:
- Main: "1", "17" → parent: null, root: "1" or "17"
- Sub: "17a", "17b" → parent: "17", root: "17"
- Sub-sub: "17a(i)", "17a(ii)" → parent: "17a", root: "17"

Return ONLY valid JSON in this structure:
{
  "detected_subject": "string (REQUIRED - Physics, Mathematics, Chemistry, Biology, English, History, Geography, Computer Science, or Other)",
  "subject_confidence": number (REQUIRED - 0.0 to 1.0),
  "subject_reasoning": "string (REQUIRED - brief explanation of detected subject)",
  "questions": [
    {
      "question_number": "string",
      "question_type": "mcq | short_answer | long_form",
      "question_text": "string",
      "question_latex": "string (REQUIRED for math)",
      "has_math": boolean,
      "equation_complexity": "simple | medium | complex | null",
      "parent_question_number": "string or null",
      "root_question_number": "string",
      "marks": number,
      "options": ["option without letter prefix", "..."] or null (for MCQ only - DO NOT include A), B) prefixes),
      "correct_answer": "string (REQUIRED for MCQ)",
      "original_page_number": 1,
      "has_figures": false,
      "has_tables": false,
      "topic_tag": "string (REQUIRED)",
      "difficulty_level": "easy | medium | hard",
      "extraction_confidence": 0.8,
      "data_type": "graph | table | both | none",
      "graph_description": "string or null (detailed axes, trend, features)",
      "table_data": "string or null (HTML table with class='exam-table')",
      "circuit_type": "series | parallel | voltage_divider | complex | none",
      "circuit_description": "string or null (topology and component values)",
      "needs_diagram": boolean,
      "diagram_type": "circuit | graph | apparatus | geometric | other | null",
      "scenario_context": "string or null (real-world setup)",
      "command_verb": "string (calculate, explain, describe, show, deduce, etc.)",
      "numerical_answer": "string or null (expected answer if calculable)"
    }
  ],
  "topics": [
    {"topic_name": "string", "confidence_score": 0.9}
  ]
}`
      : `You are an expert exam question GENERATOR specializing in ${examBoard.toUpperCase()} ${qualificationLevel} exams.

🎯 EXAM BOARD REQUIREMENTS:
${boardInstructions}
${specInstructions}

🎯 YOUR MISSION: Generate BRAND NEW questions inspired by this exam's content.

${structureInstructions}

📐 SCIENTIFIC & MATHEMATICAL NOTATION RULES (ALL SUBJECTS - CRITICAL):
Apply these rules to Chemistry, Physics, Biology, Math, and ALL STEM subjects.

1. NEVER use HTML tags like <sup>, <sub>, <i>, <b> in question text
2. ALWAYS use LaTeX notation wrapped in $ delimiters for:
   
   ✅ Scientific Notation:
   - Write: "The energy is $2.15 \\times 10^{-12}$ J"
   - NOT: "The energy is 2.15 x 10<sup>-12</sup> J"
   
   ✅ Units with Exponents:
   - Write: "velocity of $45 \\, m \\, s^{-1}$"
   - Write: "concentration in $mol \\, dm^{-3}$"
   - NOT: "45 m s<sup>-1</sup>" or "mol dm<sup>-3</sup>"
   
   ✅ Chemical Formulas:
   - Write: "$H_2O$" for water
   - Write: "$Na^+$" and "$Cl^-$" for ions
   - Write: "$CaCO_3$" for calcium carbonate
   - NOT: "H<sub>2</sub>O" or "Na<sup>+</sup>"
   
   ✅ Mathematical Expressions:
   - Write: "$v^2$", "$\\frac{1}{2}mv^2$", "$E = mc^2$"
   - Write: "$\\sqrt{x}$", "$x^{2n+1}$"
   - NOT: "v<sup>2</sup>" or raw text
   
   ✅ Physics Equations:
   - Write: "$F = ma$", "$KE = \\frac{1}{2}mv^2$"
   - Write: "$\\Delta H = -572 \\, kJ \\, mol^{-1}$"
   
   ✅ Complex Expressions:
   - Fractions: "$\\frac{numerator}{denominator}$"
   - Integrals: "$\\int_{0}^{\\pi} \\sin(x) \\, dx$"
   - Summations: "$\\sum_{i=1}^{n} x_i$"

3. LaTeX Escaping in JSON:
   - In JSON strings, escape backslashes as double backslashes (\\)
   - Example: "\\\\frac{3x+2}{x-1}" in JSON becomes "\\frac{3x+2}{x-1}" in LaTeX
   
4. Set "has_math": true whenever using LaTeX notation

5. Examples by Subject:
   
   CHEMISTRY:
   ✓ "The $K_a$ value for ethanoic acid is $1.7 \\times 10^{-5}$"
   ✓ "Calculate the enthalpy change in $kJ \\, mol^{-1}$"
   ✓ "The compound $CH_3COOH$ reacts with $NaOH$"
   
   PHYSICS:
   ✓ "The velocity is $3.5 \\times 10^8 \\, m \\, s^{-1}$"
   ✓ "Calculate $KE = \\frac{1}{2}mv^2$ where $m = 0.5$ kg"
   ✓ "The acceleration is $9.81 \\, m \\, s^{-2}$"
   
   BIOLOGY:
   ✓ "The ATP molecule ($C_{10}H_{16}N_5O_{13}P_3$)"
   ✓ "DNA concentration is $2.5 \\times 10^{-6} \\, mol \\, dm^{-3}$"
   
   MATH:
   ✓ "Solve $3x^2 + 5x - 2 = 0$"
   ✓ "Find $\\int x^3 \\, dx$"

📊 TABLE GENERATION (CRITICAL):
When tables are present in questions:
1. Embed them directly in "question_text" as HTML tables with the exact format below
2. Use this exact HTML structure:
   <table class="exam-table">
     <thead>
       <tr>
         <th>Column Header 1</th>
         <th>Column Header 2</th>
       </tr>
     </thead>
     <tbody>
       <tr>
         <td>Cell data</td>
         <td>X</td>
       </tr>
     </tbody>
   </table>
3. Use "X" or "✓" for checkmarks/marks in cells
4. Ensure all text before/after tables is preserved in "question_text"
5. Set "has_tables": true when tables are present
6. Tables should be visually formatted with proper spacing and alignment

📊 GRAPH GENERATION:
When generating questions involving graphs or charts:
1. Create realistic numerical datasets with logical relationships
2. Describe axes, units, trends clearly in "graph_description"
3. Set "data_type": "graph", "table", "both", or "none"

🔌 CIRCUIT DIAGRAM SUPPORT:
For electrical questions:
1. Describe circuit topology in "circuit_description"
2. Specify all component values and connections
3. Set "circuit_type": "series", "parallel", "voltage_divider", "complex", or "none"
4. Set "needs_diagram": true and "diagram_type": "circuit" if visual needed

🧪 EXPERIMENTAL SCENARIOS:
- Create rich contexts in "scenario_context" (e.g., escape lanes, violin strings, rotating platforms)
- For multi-part questions: build progressively with varied "command_verb" for each part

🔢 QUESTION NUMBERING FOR HIERARCHICAL QUESTIONS:
- For main questions: Q1, Q2, Q17 → set "question_number": "1", "parent_question_number": null, "root_question_number": "1"
- For sub-parts: Q17(a), Q17(b) → set "question_number": "17a", "parent_question_number": "17", "root_question_number": "17"
- For sub-sub-parts: Q17(a)(i), Q17(a)(ii) → set "question_number": "17a(i)", "parent_question_number": "17a", "root_question_number": "17"

IMPORTANT INSTRUCTIONS:
1. For Multiple Choice Questions (MCQ):
   - The "question_text" must contain ONLY the question stem - NO options inline
   - Put options in the "options" array WITHOUT letter prefixes (frontend adds A), B), C), D))
   - Example: "options": ["$b^{-5}$", "$\\frac{1}{b^5}$", ...] NOT ["A) $b^{-5}$", "B) ..."]
2. Identify if questions reference figures, diagrams, tables, or images
3. Tag each question with a relevant topic (e.g., "Biology - Cell Structure", "Physics - Mechanics", "Maths - Calculus")
4. Assess difficulty: easy, medium, or hard
5. Note the page number where each question appears
6. Extract the marks allocated to each question
7. Use lowercase variables consistently (e.g., $x$ not $X$, $a$ not $A$)

The exam text is below:

---
${pdfText}
---

Return a JSON object with this structure:
{
  "detected_subject": "string (REQUIRED - Physics, Mathematics, Chemistry, Biology, English, History, Geography, Computer Science, or Other)",
  "subject_confidence": number (REQUIRED - 0.0 to 1.0),
  "subject_reasoning": "string (REQUIRED - brief explanation of why this subject was detected)",
  "questions": [
    {
      "question_number": "string (e.g., '1', '17a', '17a(i)')",
      "question_type": "mcq | short_answer | long_form",
      "question_text": "string (the full question text)",
      "question_latex": "string or null (LaTeX notation if question contains math)",
      "has_math": boolean,
      "equation_complexity": "simple | medium | complex | null",
      "parent_question_number": "string or null",
      "root_question_number": "string",
      "marks": number,
      "options": ["option text without letter prefix", "..."] (only for MCQ, null otherwise - DO NOT include A), B), C), D) prefixes),
      "correct_answer": "string (REQUIRED for MCQ - must be 'A', 'B', 'C', or 'D'; for other types can be null if answer not provided)",
      "original_page_number": number,
      "has_figures": boolean,
      "has_tables": boolean,
      "topic_tag": "string",
      "difficulty_level": "easy | medium | hard",
      "extraction_confidence": number (0.0 to 1.0),
      "data_type": "graph | table | both | none",
      "graph_description": "string or null (detailed axes, trend, features)",
      "table_data": "string or null (HTML table with class='exam-table')",
      "circuit_type": "series | parallel | voltage_divider | complex | none",
      "circuit_description": "string or null (topology and component values)",
      "needs_diagram": boolean,
      "diagram_type": "circuit | graph | apparatus | geometric | other | null",
      "scenario_context": "string or null (real-world setup description)",
      "command_verb": "string (calculate, explain, describe, show, deduce, discuss, evaluate, etc.)",
      "numerical_answer": "string or null (expected numerical answer if calculable)"
    }
  ],
  "topics": [
    {
      "topic_name": "string",
      "confidence_score": number (0.0 to 1.0)
    }
  ]
}`;

    // Helper function to repair incomplete JSON
    function repairJSON(jsonStr: string): string {
      let repaired = jsonStr.trim();
      
      // Fix common LaTeX escaping issues BEFORE bracket counting
      // Replace problematic LaTeX patterns that break JSON
      repaired = repaired
        // Fix unescaped backslashes in LaTeX (but not already escaped ones or valid escape sequences)
        .replace(/\\([a-zA-Z]+)\{/g, '\\\\$1{')  // \frac{ -> \\frac{
        .replace(/\\([a-zA-Z]+)\s/g, '\\\\$1 ')  // \theta  -> \\theta 
        .replace(/\\_/g, '\\\\_')  // \_ -> \\_
        .replace(/\\,/g, '\\\\,')  // \, -> \\,
        .replace(/\\;/g, '\\\\;')  // \; -> \\;
        // Fix escaped quotes that might be double-escaped
        .replace(/\\\\"/g, '\\"')
        // Remove any control characters that break JSON
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
      
      // Count brackets and braces
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/\]/g) || []).length;
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      
      // Add missing closing brackets/braces
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        repaired += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        repaired += '}';
      }
      
      // Remove trailing commas before closing brackets/braces
      repaired = repaired.replace(/,(\s*[\]}])/g, '$1');
      
      return repaired;
    }

    // Make AI request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minute timeout
    
    let aiResponse;
    try {
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are an expert exam question generator. Your role is to create NEW, original questions inspired by exam content, never copying verbatim. Always generate fresh wording, examples, and data while preserving educational objectives. Return valid JSON only. CRITICAL: Ensure all backslashes in LaTeX are properly escaped as double backslashes (\\\\) in JSON strings.' },
            { role: 'user', content: extractionPrompt }
          ],
          max_tokens: 32000,
          temperature: 0.3,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('AI request timed out after 3 minutes');
        await supabase
          .from('exams')
          .update({ 
            extraction_status: 'failed',
            extraction_error: 'AI processing timed out - document may be too large'
          })
          .eq('id', draftId);
        return new Response(JSON.stringify({ error: 'AI processing timed out' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw fetchError;
    }
    clearTimeout(timeoutId);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      await supabase
        .from('exams')
        .update({ 
          extraction_status: 'failed',
          extraction_error: `AI extraction failed: ${aiResponse.status}`
        })
        .eq('id', draftId);
      return new Response(JSON.stringify({ error: 'AI extraction failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse response with better error handling
    let aiData;
    let extractedContent;
    try {
      const responseText = await aiResponse.text();
      console.log(`AI response length: ${responseText.length} characters`);
      console.log('AI response preview:', responseText.substring(0, 500));
      
      aiData = JSON.parse(responseText);
      extractedContent = aiData.choices?.[0]?.message?.content || '{"questions":[],"topics":[]}';
    } catch (responseError) {
      console.error('Failed to parse AI response envelope:', responseError);
      await supabase
        .from('exams')
        .update({ 
          extraction_status: 'failed',
          extraction_error: 'AI returned malformed response envelope'
        })
        .eq('id', draftId);
      return new Response(JSON.stringify({ error: 'AI returned invalid response format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean up markdown code blocks
    extractedContent = extractedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    console.log('Extracted content length:', extractedContent.length);
    console.log('Content preview:', extractedContent.substring(0, 300));
    console.log('Content ending:', extractedContent.substring(Math.max(0, extractedContent.length - 300)));

    let parsedData: any = { questions: [], topics: [] };
    
    // Attempt 1: Direct parsing
    try {
      parsedData = JSON.parse(extractedContent);
      if (Array.isArray(parsedData)) {
        parsedData = { questions: parsedData, topics: [] };
      }
      console.log('✅ Successfully parsed AI response on first attempt');
    } catch (parseError) {
      console.error('❌ Attempt 1 failed:', parseError);
      console.error('Parse error message:', (parseError as Error).message);
      
      // Attempt 2: Repair JSON (fix incomplete brackets/braces)
      try {
        console.log('Attempting to repair incomplete JSON...');
        const repairedContent = repairJSON(extractedContent);
        console.log('Repaired content ending:', repairedContent.substring(Math.max(0, repairedContent.length - 200)));
        
        parsedData = JSON.parse(repairedContent);
        if (Array.isArray(parsedData)) {
          parsedData = { questions: parsedData, topics: [] };
        }
        console.log('✅ Successfully parsed after JSON repair');
      } catch (repairError) {
        console.error('❌ Attempt 2 (repair) failed:', repairError);
        
        // Attempt 3: Fix LaTeX escaping issues
        try {
          console.log('Attempting to fix LaTeX escaping...');
          let fixedContent = extractedContent;
          
          // Replace unescaped backslashes (but not already escaped ones)
          fixedContent = fixedContent.replace(/(?<!\\)\\(?!["\\/bfnrtu])/g, '\\\\');
          
          // Repair after fixing escapes
          fixedContent = repairJSON(fixedContent);
          
          parsedData = JSON.parse(fixedContent);
          if (Array.isArray(parsedData)) {
            parsedData = { questions: parsedData, topics: [] };
          }
          console.log('✅ Successfully parsed after LaTeX escape fix');
        } catch (latexError) {
          console.error('❌ Attempt 3 (LaTeX fix) failed:', latexError);
          
          // Final attempt: Extract what we can from partial JSON
          try {
            console.log('Final attempt: extracting partial data...');
            
            // Try to find the questions array even if JSON is incomplete
            const questionsMatch = extractedContent.match(/"questions"\s*:\s*\[([\s\S]*?)(?:\],|\]$)/);
            const topicsMatch = extractedContent.match(/"topics"\s*:\s*\[([\s\S]*?)(?:\],|\]$)/);
            
            let questionsArray = [];
            let topicsArray = [];
            
            if (questionsMatch) {
              try {
                const questionsJson = '[' + questionsMatch[1] + ']';
                const repairedQuestions = repairJSON(questionsJson);
                questionsArray = JSON.parse(repairedQuestions);
                console.log(`Extracted ${questionsArray.length} questions from partial JSON`);
              } catch (e) {
                console.error('Could not extract questions array:', e);
              }
            }
            
            if (topicsMatch) {
              try {
                const topicsJson = '[' + topicsMatch[1] + ']';
                const repairedTopics = repairJSON(topicsJson);
                topicsArray = JSON.parse(repairedTopics);
                console.log(`Extracted ${topicsArray.length} topics from partial JSON`);
              } catch (e) {
                console.error('Could not extract topics array:', e);
              }
            }
            
            if (questionsArray.length > 0) {
              parsedData = { questions: questionsArray, topics: topicsArray };
              console.log('✅ Partial extraction successful');
            } else {
              throw new Error('No questions could be extracted from incomplete JSON');
            }
          } catch (finalError) {
            console.error('❌ All parsing attempts failed:', finalError);
            console.error('Content sample (start):', extractedContent.substring(0, 500));
            console.error('Content sample (middle):', extractedContent.substring(Math.floor(extractedContent.length / 2), Math.floor(extractedContent.length / 2) + 500));
            console.error('Content sample (end):', extractedContent.substring(Math.max(0, extractedContent.length - 500)));
            
            await supabase
              .from('exams')
              .update({ 
                extraction_status: 'failed',
                extraction_error: 'Failed to parse AI response - incomplete or invalid JSON. The document may be too large. Try using a shorter document or enabling "Use Original Structure" mode.'
              })
              .eq('id', draftId);
            return new Response(JSON.stringify({ 
              error: 'Failed to parse extracted questions',
              details: 'The AI response was incomplete or malformed. This often happens with very large documents. Try a shorter document or contact support.'
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }
    }

    const extractedQuestions = parsedData.questions || [];
    const extractedTopics = parsedData.topics || [];

    // Extract subject detection from AI response
    const detectedSubject = parsedData.detected_subject || null;
    const subjectConfidence = parsedData.subject_confidence || null;
    const subjectReasoning = parsedData.subject_reasoning || null;

    // Map detected subject to our subject system (case-insensitive)
    const subjectMapping: Record<string, string> = {
      'physics': 'physics',
      'mathematics': 'mathematics',
      'math': 'mathematics',
      'maths': 'mathematics',
      'chemistry': 'chemistry',
      'biology': 'biology',
      'english': 'english',
      'history': 'history',
      'geography': 'geography',
      'computer science': 'computer_science',
      'computing': 'computer_science',
    };

    const normalizedDetected = detectedSubject ? (subjectMapping[detectedSubject.toLowerCase()] || detectedSubject.toLowerCase()) : null;
    const userSelectedSubject = exam.subject_id?.toLowerCase() || exam.title?.toLowerCase();

    // Check for mismatch (only flag if reasonably confident)
    const CONFIDENCE_THRESHOLD = 0.6;
    const isMismatch = normalizedDetected && 
                       userSelectedSubject && 
                       normalizedDetected !== userSelectedSubject &&
                       subjectConfidence && subjectConfidence > CONFIDENCE_THRESHOLD;

    console.log('Subject Detection:', {
      detected: detectedSubject,
      normalized: normalizedDetected,
      confidence: subjectConfidence,
      selected: exam.subject_id,
      mismatch: isMismatch,
      reasoning: subjectReasoning
    });

    if (!Array.isArray(extractedQuestions) || extractedQuestions.length === 0) {
      console.error('No questions extracted');
      await supabase
        .from('exams')
        .update({ 
          extraction_status: 'failed',
          extraction_error: 'No questions found in document'
        })
        .eq('id', draftId);
      return new Response(JSON.stringify({ error: 'No questions found in document' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Extracted ${extractedQuestions.length} questions and ${extractedTopics.length} topics`);

    // Sort questions by normalized question_number for proper hierarchical ordering
    extractedQuestions.sort((a: any, b: any) => {
      const aKey = normalizeQuestionNumber(String(a.question_number || ''));
      const bKey = normalizeQuestionNumber(String(b.question_number || ''));
      return aKey.localeCompare(bKey);
    });
    console.log('Questions sorted by hierarchical numbering');

    // Delete existing drafts
    await supabase
      .from('exam_question_drafts')
      .delete()
      .eq('exam_id', draftId);

    // Insert questions with generation status and math support
    const draftsToInsert = extractedQuestions.map((q: any, index: number) => {
      const questionType = q.question_type || 'short_answer';
      const correctAnswer = q.correct_answer || null;
      
      // Validate MCQ correct_answer
      if (questionType === 'mcq' && (!correctAnswer || correctAnswer.trim() === '')) {
        console.warn(`MCQ question ${q.question_number} missing correct_answer - setting to 'A' as default`);
      }
      
      // Extract parent and root question numbers from question_number
      const questionNum = String(q.question_number || (index + 1));
      let parentQuestionNumber = q.parent_question_number || null;
      let rootQuestionNumber = q.root_question_number || questionNum.match(/^\d+/)?.[0] || questionNum;
      
      // Auto-detect parent if not provided (e.g., "17a(i)" -> parent is "17a", root is "17")
      if (!parentQuestionNumber && questionNum.includes('(')) {
        const matches = questionNum.match(/^(\d+[a-z]*)\(/i);
        if (matches) {
          parentQuestionNumber = matches[1];
          rootQuestionNumber = matches[1].match(/^\d+/)?.[0] || matches[1];
        }
      }
      
      return {
        exam_id: draftId,
        question_number: questionNum,
        question_type: questionType,
        question_text: q.question_text || '',
        question_latex: q.question_latex || null,
        has_math: q.has_math || false,
        equation_complexity: q.equation_complexity || null,
        parent_question_number: parentQuestionNumber,
        root_question_number: rootQuestionNumber,
        marks: q.marks || 1,
        options: q.options || null,
        correct_answer: questionType === 'mcq' ? (correctAnswer || 'A') : correctAnswer,
        original_page_number: q.original_page_number || 1,
        has_figures: q.has_figures || false,
        has_tables: q.has_tables || false,
        figure_urls: q.figure_urls || [],
        topic_tag: q.topic_tag || null,
        difficulty_level: q.difficulty_level || null,
        extraction_confidence: q.extraction_confidence || 0.9,
        generation_status: useFallbackMode ? 'ai_generated' : (useOriginalStructure ? 'structure_inspired' : 'extracted'),
        image_handling_strategy: null,
        original_question_text: null,
      };
    });

    const { data: insertedQuestions, error: draftError } = await supabase
      .from('exam_question_drafts')
      .insert(draftsToInsert)
      .select();

    if (draftError) {
      console.error('Draft insertion error:', draftError);
      await supabase
        .from('exams')
        .update({ 
          extraction_status: 'failed',
          extraction_error: `Failed to save questions: ${draftError.message}`
        })
        .eq('id', draftId);
      return new Response(JSON.stringify({ error: 'Failed to save extracted questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ✅ INCREMENTAL UPDATE: Update question count immediately after insertion
    console.log(`✅ Inserted ${insertedQuestions?.length || 0} questions - updating count immediately`);
    await supabase
      .from('exams')
      .update({ 
        total_questions_extracted: insertedQuestions?.length || 0
      })
      .eq('id', draftId);
    console.log('Question count updated in database');

    // Process ALL questions when use_original_structure is true (Full AI Generation)
    if (useOriginalStructure) {
      console.log('Full AI generation mode: Regenerating ALL questions...');
      const nonImageQuestions = insertedQuestions?.filter((q: any) => !q.has_figures) || [];
      
      for (const question of nonImageQuestions) {
        try {
          const regenerationPrompt = `Original question structure: "${question.question_text}"
Topic: ${question.topic_tag}
Type: ${question.question_type}
Marks: ${question.marks}
Difficulty: ${question.difficulty_level}

Generate a COMPLETELY NEW question that:
1. Tests the SAME learning objective/concept
2. Uses DIFFERENT wording, phrasing, and structure
3. Provides DIFFERENT examples, scenarios, or contexts
4. If numerical data is involved, use NEW synthetic values
5. For MCQs: Create ENTIRELY NEW options (if applicable)
6. Maintains the same difficulty and mark value
7. Never copies any original text

CRITICAL: Be creative! Change names, locations, scenarios, values - make it fresh while testing the same skill.

Return ONLY the new question text (and options if MCQ), no explanation.`;

          const regenResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'You are an expert at creating original exam questions. Never copy verbatim - always generate fresh content while preserving educational value.' },
                { role: 'user', content: regenerationPrompt }
              ],
            }),
          });

          if (regenResponse.ok) {
            const regenData = await regenResponse.json();
            const newQuestionText = regenData.choices?.[0]?.message?.content || question.question_text;
            
            await supabase
              .from('exam_question_drafts')
              .update({
                original_question_text: question.question_text,
                question_text: newQuestionText,
                generation_status: 'ai_generated',
              })
              .eq('id', question.id);
            
            console.log(`Regenerated question ${question.question_number} with AI`);
          }
        } catch (regenError) {
          console.error(`Failed to regenerate question ${question.question_number}:`, regenError);
        }
      }
    }

    // Process image-based questions using Hybrid Approach
    console.log('Processing image-based questions...');
    const imageQuestions = insertedQuestions?.filter((q: any) => q.has_figures) || [];
    
    for (const question of imageQuestions) {
      try {
        const strategy = determineImageStrategy(question);
        console.log(`Question ${question.question_number}: Using ${strategy} strategy`);
        
        if (strategy === 'concept_replacement') {
          const replacementPrompt = `Original question references an image: "${question.question_text}"
Topic: ${question.topic_tag}
Marks: ${question.marks}
Difficulty: ${question.difficulty_level}

Generate a COMPLETELY NEW question that:
1. Tests the SAME concept/skill without requiring any visual aid
2. Provides all necessary context in text form
3. Uses DIFFERENT wording, scenarios, and examples
4. If the original involves data/measurements, generate NEW synthetic values
   Example: Change "800,000 births" to "230,000 births"
   Example: Change "Figure 5 shows..." to "Consider a population where..."
5. Maintains the same difficulty level and awards the same marks
6. Includes realistic data that makes analytical sense
7. Is self-contained with no external references

IMPORTANT: 
- Generate synthetic data/values where needed
- Use different contexts (change locations, names, scenarios)
- Never reference the original document
- Make the question analytically equivalent but conceptually fresh

Return ONLY the new question text, no additional explanation.`;

          const replaceResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'You are an expert at creating exam questions that test concepts without requiring visual aids.' },
                { role: 'user', content: replacementPrompt }
              ],
            }),
          });

          if (replaceResponse.ok) {
            const replaceData = await replaceResponse.json();
            const newQuestionText = replaceData.choices?.[0]?.message?.content || question.question_text;
            
            await supabase
              .from('exam_question_drafts')
              .update({
                original_question_text: question.question_text,
                question_text: newQuestionText,
                generation_status: 'ai_generated',
                image_handling_strategy: 'concept_replacement',
                has_figures: false,
              })
              .eq('id', question.id);
            
            console.log(`Replaced image question ${question.question_number} with concept-based version`);
          }
        } else {
          // Keep original with reference warning
          const wrappedText = `[📷 IMAGE REFERENCE] ${question.question_text}\n\n⚠️ Note: This question references a diagram from the original document (page ${question.original_page_number}). Students should refer to the uploaded PDF.`;
          
          await supabase
            .from('exam_question_drafts')
            .update({
              original_question_text: question.question_text,
              question_text: wrappedText,
              generation_status: 'image_referenced',
              image_handling_strategy: 'original_reference',
            })
            .eq('id', question.id);
          
          console.log(`Kept image reference for question ${question.question_number}`);
        }
      } catch (imgError) {
        console.error(`Failed to process image question ${question.question_number}:`, imgError);
      }
    }

    // Save topics
    if (extractedTopics.length > 0) {
      await supabase
        .from('exam_topics')
        .delete()
        .eq('exam_id', draftId);

      const topicsToInsert = extractedTopics.map((topic: any) => ({
        exam_id: draftId,
        topic_name: topic.topic_name,
        confidence_score: topic.confidence_score || 0.8
      }));

      await supabase
        .from('exam_topics')
        .insert(topicsToInsert);

      console.log(`Inserted ${extractedTopics.length} topics`);
    }

    // ✅ ROBUST FINAL UPDATE: Update exam status to completed with retry logic
    console.log('Attempting final status update to "completed"...');
    let updateSuccess = false;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Final update attempt ${attempt}/3`);
        const { error: updateError } = await supabase
          .from('exams')
          .update({
            extraction_status: 'completed',
            total_questions_extracted: extractedQuestions.length,
            extraction_error: null,
            detected_subject: detectedSubject,
            subject_confidence: subjectConfidence,
            subject_mismatch: isMismatch
          })
          .eq('id', draftId);

        if (updateError) {
          throw updateError;
        }
        
        console.log(`✅ Final status update successful on attempt ${attempt}`);
        updateSuccess = true;
        break;
      } catch (error) {
        lastError = error;
        console.error(`❌ Final update attempt ${attempt} failed:`, error);
        if (attempt < 3) {
          console.log(`Retrying in ${attempt} second(s)...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    if (!updateSuccess) {
      console.error('❌ CRITICAL: Failed to update exam status after 3 attempts:', lastError);
      // Try one last time to at least mark it as completed (even if other fields fail)
      try {
        await supabase
          .from('exams')
          .update({ extraction_status: 'completed' })
          .eq('id', draftId);
        console.log('Emergency fallback update succeeded (status only)');
      } catch (emergencyError) {
        console.error('❌ Emergency fallback also failed:', emergencyError);
      }
    }

  console.log('✅ Extraction completed successfully:', {
    questions: extractedQuestions.length,
    topics: extractedTopics.length,
    subject: detectedSubject,
    finalUpdateSuccess: updateSuccess
  });
}

// Helper function to determine image handling strategy (Hybrid Approach)
function determineImageStrategy(question: any): 'concept_replacement' | 'original_reference' {
  const imageKeywords = ['graph', 'diagram', 'chart', 'figure', 'table', 'image', 'illustration', 'plot'];
  const questionLower = question.question_text.toLowerCase();
  
  const hasComplexVisual = imageKeywords.some(kw => questionLower.includes(kw));
  
  // Use original reference for complex analytical questions with high marks
  if (hasComplexVisual && question.marks >= 4) {
    return 'original_reference';
  }
  
  // Use concept replacement for simpler questions
  return 'concept_replacement';
}

// Helper function to normalize question numbers for sorting
function normalizeQuestionNumber(qNum: string): string {
  // Convert "17", "17a", "17a(i)", "17a(ii)" to sortable format
  // Returns format like "017_a_001" for proper sorting
  const match = qNum.match(/^(\d+)([a-z]?)(?:\(([ivxlcdm]+)\))?$/i);
  if (!match) return qNum.padStart(10, '0');
  
  const [, num, letter, roman] = match;
  const paddedNum = num.padStart(3, '0');
  const letterPart = letter ? `_${letter}` : '';
  
  // Convert roman numerals to numbers for sorting
  const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 };
  const romanPart = roman ? `_${String(romanMap[roman.toLowerCase()] || 0).padStart(3, '0')}` : '';
  
  return `${paddedNum}${letterPart}${romanPart}`;
}

// Helper function to get subject-specific generation instructions
function getSubjectSpecificInstructions(subject: string, examBoard: string, level: string): string {
  const subjectLower = (subject || '').toLowerCase();
  
  if (subjectLower.includes('biology')) {
    return `
- For ${examBoard.toUpperCase()} ${level} Biology:
  * QUESTION STYLE: Write CONCISE questions like real OCR/AQA exam papers - avoid verbose descriptions
  * For MCQs: Keep options SHORT (1-2 sentences max, often just a few words)
  * Include a mix of structured questions and extended response
  * Question types: data analysis, experimental design, explanations, calculations
  * Topics: Cell biology, Genetics & DNA, Ecology, Physiology, Evolution, Biochemistry
  * Typical marks: 1-2 (recall), 3-4 (application), 6+ (extended response)
  * Use command words: State, Describe, Explain, Compare, Evaluate, Suggest, Calculate
  * Include practical and experimental scenarios (enzyme experiments, photosynthesis, etc.)
  * Use realistic biological data (gene frequencies, population sizes, enzyme rates)
  * For calculations: Hardy-Weinberg, magnification, Simpson's diversity index
  * Structure multi-part questions with clear (a), (b), (c) sub-parts
  * Tables and data should be presented cleanly, not described in prose
  * Use proper scientific terminology without excessive explanation`;
  }
  
  if (subjectLower.includes('chemistry')) {
    return `
- For ${examBoard.toUpperCase()} ${level} Chemistry:
  * Include calculations with moles, concentrations, and equations
  * Topics: Atomic structure, Bonding, Organic chemistry, Reactions, Equilibria, Thermodynamics
  * Question types: Calculations, mechanism drawing, explanations, data analysis
  * Use correct chemical notation and formulae
  * Include enthalpy calculations, rate equations, equilibrium constants
  * Use realistic experimental data (titrations, colorimetry, etc.)`;
  }
  
  if (subjectLower.includes('physics')) {
    return `
- For ${examBoard.toUpperCase()} ${level} Physics:
  * Heavy use of calculations and mathematical formulae
  * Topics: Mechanics, Waves, Electricity, Fields, Particles, Astrophysics
  * Include free-body diagrams descriptions, graph analysis
  * Use SI units consistently
  * Multi-step problems with "show that" questions
  * Include experimental scenarios and error analysis`;
  }
  
  if (subjectLower.includes('math')) {
    return `
- For ${examBoard.toUpperCase()} ${level} Mathematics:
  * NO multiple choice questions (all structured/long-form)
  * Main questions with sub-parts (a), (b), (c) and sub-sub-parts (i), (ii)
  * Topics: Calculus, Algebra, Trigonometry, Series, Proof, Coordinate Geometry, Vectors
  * Marks range: 2-14 marks per question
  * Total paper typically ~100 marks
  * Heavy use of mathematical notation - ALL questions need question_latex
  * Include "show that" and "hence" questions`;
  }
  
  // Default for other subjects
  return `
- Generate a balanced mix appropriate for ${examBoard.toUpperCase()} ${level}
- Include various question types based on the subject
- Use appropriate command words for this exam board
- Follow typical mark allocations
- Mix of short answer (1-4 marks) and extended response (6+ marks)`;
}
