import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.25.76";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.2.1";
import { validateNotes, formatNotesForPrompt, logNotesModeration } from "../_shared/notes-validator.ts";
import { validateGraphQuestion, generateFallbackGraphSpec, logGraphValidation, parseLinearEquations } from "../_shared/graph-validator.ts";
import { getRegionalPersona, getRegionAwareSubjectInstructions } from "../_shared/regional-personas.ts";
import {
  parseFunctionFromText,
  parseTransformFromText,
  generateCurveData,
  applyTransform,
  isSketchable,
  extractKeyFeatures,
  transformKeyFeatures,
  calculateStudentFriendlyDomain,
  extractMarkingFormula,
  normalizeFormulaExpression,
  generateCurveFromMarkingFormula,
  applyFormulaTransform,
  IDENTITY_TRANSFORM,
  logMathEngineOperation,
  // Audit v5 additions - Secret Formula & Asymptote Validation
  generateSecretMarkingFormula,
  validateAsymptoteQuestion,
  type FunctionType,
  type TransformSpec,
  type GraphSeries,
  type KeyFeatures,
} from "../_shared/math-engine.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function extractPdfTextFromBlob(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  let pdfText = '';

  try {
    const pdf = await getDocument({ data: uint8Array, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ');
      pages.push(pageText);
    }
    pdfText = pages.join('\n\n');
    pdf.cleanup();
  } catch (err) {
    // Fallback: try to salvage readable strings from raw bytes
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = decoder.decode(uint8Array);
      const textMatches = rawText.match(/\(([^)]+)\)/g);
      if (textMatches && textMatches.length > 10) {
        pdfText = textMatches.map((m) => m.slice(1, -1)).join(' ');
      } else {
        pdfText = rawText;
      }
    } catch {
      pdfText = '';
    }
  }

  return pdfText.replace(/\s+/g, ' ').trim();
}

// Background generation function - runs after response is sent
async function generateQuestionsInBackground(
  setId: string,
  userId: string,
  setData: any
): Promise<void> {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    console.log('Starting background generation for set:', setId);

    // Make retries idempotent: clear any previously inserted questions + reset status/error.
    // (If a previous attempt partially inserted rows, this prevents duplicates.)
    await supabaseClient
      .from('practice_questions')
      .delete()
      .eq('set_id', setId);

    await supabaseClient
      .from('practice_question_sets')
      .update({
        extraction_status: 'extracting',
        extraction_error: null,
        total_questions_generated: 0,
      })
      .eq('id', setId);

    // Download spec file if available
    let specContent = '';
    if (setData.specification_file_url) {
      const { data: specFile } = await supabaseClient.storage
        .from('exam-files')
        .download(setData.specification_file_url);
      
      if (specFile) {
        // Cap read size to avoid huge files causing slowdowns/timeouts.
        specContent = await specFile.slice(0, 200_000).text();
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
          // Cap read size to avoid huge files causing slowdowns/timeouts.
          exampleQuestionsContent = await exampleFile.slice(0, 200_000).text();
          console.log('Loaded example questions file, length:', exampleQuestionsContent.length);
        }
      } catch (err) {
        console.warn('Failed to load example questions file:', err);
      }
    }

    // RESOURCE PACK SUPPORT - Extract and fetch linked resources if any
    let resourcePackContext = '';
    let hasResourcePack = false;
    
    if (setData.resource_pack_id && setData.resource_mode !== 'none') {
      try {
        console.log('Fetching resource pack:', setData.resource_pack_id);
        
        // Fetch the resource pack
        const { data: packData, error: packError } = await supabaseClient
          .from('resource_packs')
          .select('*')
          .eq('id', setData.resource_pack_id)
          .single();
        
        if (packError) {
          console.warn('Failed to fetch resource pack:', packError);
        } else if (packData) {
          // Check if pack needs extraction (status is 'pending')
          if (packData.status === 'pending' && packData.source_file_url) {
            console.log('Resource pack is pending extraction, extracting now with context...');
            
            // Update status to processing
            await supabaseClient
              .from('resource_packs')
              .update({ status: 'processing' })
              .eq('id', setData.resource_pack_id);
            
            // Download the PDF file
            const { data: fileData, error: downloadError } = await supabaseClient.storage
              .from('exam-files')
              .download(packData.source_file_url);
            
            if (downloadError) {
              console.error('Failed to download resource pack file:', downloadError);
              throw new Error('Failed to download resource pack file');
            }
            
            const pdfText = await extractPdfTextFromBlob(fileData);
            console.log('PDF text length:', pdfText.length);
            
            // Extract resources with full context (subject, board, tier)
            const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
            if (!LOVABLE_API_KEY) {
              throw new Error('LOVABLE_API_KEY is not configured');
            }
            
            const extractionPrompt = `You are an expert at analyzing exam insert/resource booklets and extracting structured resources.

CONTEXT:
- Subject: ${setData.subject_id}
- Educational Tier: ${setData.educational_tier || 'Secondary'}
- Question Style: ${setData.exam_board || 'UK exam board'}

Given the following PDF text content from an exam insert or resource booklet, identify and extract all discrete resources (sources, texts, data tables, images described, etc.).

PDF CONTENT:
${pdfText.substring(0, 30000)}

EXTRACTION RULES:
1. Identify each distinct resource (Source A, Source B, Extract 1, Figure 1, Table 1, etc.)
2. Preserve the original source labels used in the document
3. Classify each resource type based on the subject context:
   - For ${setData.subject_id}: use appropriate types like text_extract, case_study, data_table, map, image, graph, transcript, article, experiment_data, poem_excerpt, primary_source, historian_interpretation
4. Extract the full text content for text-based resources
5. For tables, structure as JSON with headers and rows
6. Include any attribution or source citations
7. Estimate word count for text resources
8. Assess difficulty contribution: simple, moderate, or complex

Return a JSON array of resources in this exact format:
{
  "resources": [
    {
      "source_label": "Source A",
      "resource_type": "text_extract",
      "content_text": "Full text content here...",
      "content_json": null,
      "word_count": 350,
      "attribution": "Adapted from The Guardian, 2023",
      "difficulty_contribution": "moderate",
      "display_order": 0
    },
    {
      "source_label": "Table 1",
      "resource_type": "data_table",
      "content_text": null,
      "content_json": {
        "headers": ["Year", "Population", "Growth Rate"],
        "rows": [["2010", "3.5bn", "+2.1%"], ["2020", "4.2bn", "+2.8%"]]
      },
      "word_count": null,
      "attribution": null,
      "difficulty_contribution": "simple",
      "display_order": 1
    }
  ]
}

Extract all resources found. If the document appears to be a question paper rather than an insert, still extract any embedded sources, scenarios, or data that appear within questions.`;

            const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [
                  { role: 'system', content: 'You are an expert at analyzing exam documents. Return only valid JSON.' },
                  { role: 'user', content: extractionPrompt },
                ],
                temperature: 0.3,
              }),
            });

            if (!aiResponse.ok) {
              const errorText = await aiResponse.text();
              console.error('AI extraction failed:', errorText);
              await supabaseClient
                .from('resource_packs')
                .update({ status: 'failed', processing_error: 'AI extraction failed' })
                .eq('id', setData.resource_pack_id);
              throw new Error('Failed to extract resources from document');
            }

            const aiResult = await aiResponse.json();
            let extractedContent = aiResult.choices?.[0]?.message?.content || '';
            
            // Parse JSON from response
            const jsonMatch = extractedContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              await supabaseClient
                .from('resource_packs')
                .update({ status: 'failed', processing_error: 'Failed to parse extraction results' })
                .eq('id', setData.resource_pack_id);
              throw new Error('Failed to parse extraction results');
            }

            const parsedResult = JSON.parse(jsonMatch[0]);
            let extractedResources = parsedResult.resources || [];

            // Guarantee minimum of 1 resource so packs are always usable.
            if (!Array.isArray(extractedResources) || extractedResources.length === 0) {
              extractedResources = [
                {
                  source_label: 'Source A',
                  resource_type: 'text_extract',
                  content_text: pdfText ? pdfText.substring(0, 8000) : 'Insert provided but no readable text could be extracted.',
                  content_json: null,
                  word_count: null,
                  attribution: null,
                  difficulty_contribution: 'moderate',
                  display_order: 0,
                },
              ];
            }

            console.log(`Extracted ${extractedResources.length} resources with context`);

            // Insert resource items
            for (let i = 0; i < extractedResources.length; i++) {
              const resource = extractedResources[i];
              
              const { error: itemError } = await supabaseClient
                .from('resource_items')
                .insert({
                  pack_id: setData.resource_pack_id,
                  source_label: resource.source_label || `Resource ${i + 1}`,
                  resource_type: resource.resource_type || 'text_extract',
                  content_text: resource.content_text || null,
                  content_json: resource.content_json || null,
                  word_count: resource.word_count || null,
                  attribution: resource.attribution || null,
                  difficulty_contribution: resource.difficulty_contribution || 'moderate',
                  display_order: resource.display_order ?? i,
                });

              if (itemError) {
                console.error('Error inserting resource item:', itemError);
              }
            }

            // Update pack status to ready
            await supabaseClient
              .from('resource_packs')
              .update({ status: 'ready' })
              .eq('id', setData.resource_pack_id);
            
            console.log('Resource pack extraction completed successfully');
          }
          
          // Now fetch the resource items (whether just extracted or already ready)
          if (packData.status === 'ready' || packData.status === 'pending') {
            const { data: resourceItems, error: itemsError } = await supabaseClient
              .from('resource_items')
              .select('*')
              .eq('pack_id', setData.resource_pack_id)
              .order('display_order');
            
            if (itemsError) {
              console.warn('Failed to fetch resource items:', itemsError);
            } else if (resourceItems && resourceItems.length > 0) {
              hasResourcePack = true;
              
              // Extract key entities (character names, places, etc.) from resources for validation
              const allResourceText = resourceItems.map((r: any) => r.content_text || '').join(' ');
              const properNouns = allResourceText.match(/\b[A-Z][a-z]+\b/g) || [];
              const uniqueNames = [...new Set(properNouns)].slice(0, 20).join(', ');
              
              // Build resource context for AI prompt with STRICT enforcement
              resourcePackContext = `

╔══════════════════════════════════════════════════════════════════════════════╗
║                    ⚠️  RESOURCE-BASED EXAM - STRICT MODE  ⚠️                   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  This exam MUST be based EXCLUSIVELY on the following source material.       ║
║  DO NOT invent characters, scenarios, or content not present in the sources. ║
╚══════════════════════════════════════════════════════════════════════════════╝

🔒 ABSOLUTE REQUIREMENTS:
1. ALL questions MUST reference the sources below (e.g., "Read Source A...", "Using Source A...")
2. Character names, settings, events MUST come from the source text ONLY
3. DO NOT invent: new characters, alternative scenarios, unrelated content
4. If Source A mentions "Rosabel", questions must ask about "Rosabel" - NOT "Elara", "Sarah", etc.
5. Line references and quotations MUST match the actual source content

📚 KEY ENTITIES FROM SOURCES (use these, not invented ones):
${uniqueNames}

`;
              for (const item of resourceItems) {
                resourcePackContext += `\n━━━━━━━━━━ ${item.source_label} ━━━━━━━━━━\n`;
                resourcePackContext += `📂 Type: ${item.resource_type}\n`;
                if (item.attribution) {
                  resourcePackContext += `📖 Attribution: ${item.attribution}\n`;
                }
                if (item.content_text) {
                  resourcePackContext += `\n📝 FULL CONTENT (use this text for all questions):\n"""\n${item.content_text}\n"""\n`;
                }
                if (item.content_json) {
                  resourcePackContext += `📊 Data:\n${JSON.stringify(item.content_json, null, 2)}\n`;
                }
              }
              
              resourcePackContext += `
━━━━━━━━━━ END OF SOURCES ━━━━━━━━━━

⛔ VALIDATION CHECKLIST (apply to EVERY question before output):
□ Does the question explicitly reference a Source (A, B, etc.)?
□ Are all character names from the actual source text?
□ Are all settings/locations from the actual source text?
□ Are line number references accurate to the source?
□ Would a student be able to answer using ONLY the provided sources?

If ANY checkbox fails, REWRITE the question to comply.

EXAMPLE QUESTION FORMATS:
- "Read Source A from lines 1-5. What four things do we learn about [CHARACTER FROM SOURCE]?"
- "Using Source A, explain how the writer uses language to..."
- "Compare the evidence in Sources A and B..."
- "To what extent does Source A support the view that..."
- "Using data from Table 1, determine..."
`;
              console.log(`Loaded ${resourceItems.length} resource items for context (strict mode)`);
            }
          }
        }
      } catch (err) {
        console.warn('Error loading resource pack:', err);
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
      
      // In background function, throw error instead of returning Response
      throw new Error('Notes validation failed: Notes contain disallowed content');
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

    // PHASE 0: AUTO-DETECT GRAPH/TABLE NEEDS based on subtopics and subject context
    // The AI should always include visuals when the topic warrants it - no manual toggle needed
    const subtopicsLower = (setData.subtopics || []).map((s: string) => s.toLowerCase());
    const notesLower = (setData.notes || '').toLowerCase();
    
    // Detect if subtopics/notes suggest graphs are needed
    const graphKeywords = [
      'graph', 'curve', 'plot', 'sketch', 'coordinate', 'transform', 'function', 
      'f(x)', 'y=', 'linear', 'quadratic', 'cubic', 'parabola', 'asymptote',
      'gradient', 'intercept', 'tangent', 'differentiation', 'integration',
      'polynomial', 'exponential', 'logarithm', 'trigonometric', 'sine', 'cosine',
      // Subject-aware graph keywords (Physics, Economics, etc.)
      'velocity', 'acceleration', 'force', 'displacement', 'momentum', 'energy',
      'supply', 'demand', 'cost', 'revenue', 'profit', 'equilibrium',
      'subsidy', 'tax', 'tariff', 'price floor', 'price ceiling', 'quota', 'welfare',
      'concentration', 'rate', 'temperature', 'pressure', 'volume'
    ];
    
    const tableKeywords = [
      'table', 'data', 'frequency', 'cumulative', 'statistics', 'probability',
      'tally', 'survey', 'grouped', 'class interval', 'histogram', 'chemistry',
      'periodic', 'element', 'compound', 'reaction', 'biology', 'physics'
    ];
    
    // Check if any subtopic or notes contain these keywords
    const needsGraphs = graphKeywords.some(kw => 
      subtopicsLower.some((s: string) => s.includes(kw)) || notesLower.includes(kw)
    );
    
    const needsTables = tableKeywords.some(kw => 
      subtopicsLower.some((s: string) => s.includes(kw)) || notesLower.includes(kw)
    );
    
    console.log('Auto-detected visual needs:', { needsGraphs, needsTables, subtopics: setData.subtopics });
    
    // Build visual question instructions based on AUTO-DETECTION (not manual toggles)
    let visualQuestionInstructions = '';
    if (needsGraphs && needsTables) {
      visualQuestionInstructions = `
INTELLIGENT VISUAL QUESTIONS (AUTO-DETECTED REQUIREMENT):
Based on the subtopics selected, this set REQUIRES visual questions.
- When the question involves functions, coordinates, curves, or transformations: USE graph_plotting or graph_interpretation
- When the question involves data, frequencies, or tabular information: USE table_grid
- EVERY graph question MUST include complete graphConfig with series.data array containing at least 10 {x,y} points for smooth curves
- A graph question WITHOUT visible data points is INVALID and will be rejected
- If a question says "sketch", "plot", "draw", or "the graph shows" it MUST be a graph question type, NOT extended or short_answer`;
    } else if (needsGraphs) {
      visualQuestionInstructions = `
INTELLIGENT GRAPH QUESTIONS (AUTO-DETECTED REQUIREMENT):
Based on the subtopics selected (${setData.subtopics?.join(', ')}), this set REQUIRES graph questions.
- AT LEAST 40% of questions MUST use graph_plotting or graph_interpretation types
- If a question mentions "sketch", "plot", "draw", "the graph shows", or any visual verb: USE graph_plotting, NOT extended
- EVERY graph question MUST include complete graphConfig with:
  - chartType: "line" or "scatter"
  - xLabel, yLabel: meaningful axis labels
  - domainX, domainY: [min, max] arrays
  - series: array with at least one object containing data: [{x, y}, ...] with at least 10 points for smooth curves
- A graph question WITHOUT visible data points is INVALID and will be rejected
- NEVER use question_type "extended" for questions that say "sketch" or "plot" - those MUST be graph_plotting`;
    } else if (needsTables) {
      visualQuestionInstructions = `
INTELLIGENT TABLE QUESTIONS (AUTO-DETECTED REQUIREMENT):
- At least 30% of questions MUST be table_grid
- Tables must have headers, rows, and columns arrays
- Use appropriate tableType: tick_cross, text_entry, number_entry, or mixed`;
    } else {
      visualQuestionInstructions = `
VISUAL QUESTION GUIDELINES:
- Use graph_plotting or graph_interpretation when the question naturally involves coordinates, curves, or visual analysis
- Use table_grid when the question involves data entry or tabular information
- IMPORTANT: If a question says "sketch", "plot", "draw", or "the graph shows", it MUST use graph_plotting type
- Never use "extended" type for questions that require visual/graphical answers`;
    }

    // SUBJECT-AWARE GRAPHING: Add annotations and subject profile instructions for non-Math subjects
    const subjectId = (setData.subject_id || '').toLowerCase();
    const isMathSubject = subjectId.includes('math') || subjectId.includes('maths');
    
    let subjectGraphInstructions = '';
    if (!isMathSubject && needsGraphs) {
      subjectGraphInstructions = `
SUBJECT-AWARE GRAPHING (${setData.subject_id}):
Since this is NOT a Mathematics subject, graph questions MUST include:
1. A "subjectProfile" object in graphConfig with appropriate axis labels and units:
   - Physics: axisLabels like {"x": "Time (s)", "y": "Velocity (m/s)"}, quadrantMode: "q1"
   - Economics: axisLabels like {"x": "Quantity", "y": "Price ($)"}, quadrantMode: "q1"
   - Biology: axisLabels like {"x": "Time (min)", "y": "Rate of reaction"}, quadrantMode: "q1"
   - Chemistry: axisLabels like {"x": "Volume (cm^3)", "y": "Temperature (C)"}, quadrantMode: "q1"
2. An "annotations" array to label key features on the graph:
    - Use type "point" with showCoordinates: true for key values (e.g., terminal velocity, equilibrium)
    - Use type "intercept" for axis crossings with meaningful labels
    - Use type "projection" with coords and projectTo: "both" for equilibrium/key points — renders thin dashed lines from the point to both axes (textbook projection lines)
    - Use type "region" with fillBetween for areas under curves (e.g., work done, consumer surplus)
3. Axis labels MUST include units in parentheses
4. Most science/economics graphs only use positive values, so use quadrantMode: "q1"
5. SERIES LIMIT: Maximum 4 data series per graph. If more curves are needed, generate multiple separate graph questions instead of crowding one canvas.
6. RENDERING RULES: All economic curves MUST be solid lines (lineStyle: "solid" or omit lineStyle). Only use "dashed" for shifted/new curves (e.g., S₁, D₁). NEVER add visible dots to series — lines must render as smooth, continuous paths.

DISCRETE PATH RENDERING (CRITICAL FOR NON-MATH GRAPH PLOTTING):
For non-mathematics graph_plotting questions (Physics distance-time, Economics supply/demand, etc.):
- Use "expectedPath" instead of "markingFormula" in plottingAnswer
- expectedPath is an ORDERED array of vertices that define the correct journey/path
- The rendering engine connects these vertices with STRAIGHT lines (no curve fitting)
- Each vertex represents a KEY EVENT (start, stop, direction change, equilibrium shift)
- Include "pathAnnotations" to label important vertices with meaningful text
- Do NOT provide markingFormula for piecewise journeys or event-based paths
- ALWAYS provide subjectProfile with appropriate axis labels and units

EXAMPLE - Distance-Time Journey:
{
  "graphType": "plotting",
  "graphConfig": {
    "chartType": "line",
    "xLabel": "Time (s)",
    "yLabel": "Distance (m)",
    "domainX": [0, 350],
    "domainY": [0, 700],
    "series": [],
    "subjectProfile": {
      "subject": "Physics",
      "axisLabels": {"x": "Time (s)", "y": "Distance (m)"},
      "quadrantMode": "q1"
    }
  },
  "plottingAnswer": {
    "expectedPoints": [{"x": 0, "y": 0}, {"x": 100, "y": 300}, {"x": 200, "y": 300}, {"x": 300, "y": 600}],
    "toleranceUnits": 15,
    "expectedPath": [
      {"x": 0, "y": 0},
      {"x": 100, "y": 300},
      {"x": 200, "y": 300},
      {"x": 300, "y": 600}
    ],
    "pathAnnotations": [
      {"pointIndex": 0, "label": "Start"},
      {"pointIndex": 2, "label": "Bus Stop (stationary)"},
      {"pointIndex": 3, "label": "Arrives"}
    ]
  }
}

RULES FOR expectedPath:
1. Every stage described in the question text MUST map to specific vertices in expectedPath
2. If the question says "stays stationary for 100 seconds at 300m", expectedPath MUST have two consecutive points with the same y-value
3. Sharp direction changes (acceleration, deceleration, price shifts) = new vertex
4. pathAnnotations bind labels to vertices by index (0-based)
5. expectedPoints should contain the same key vertices for point-matching marking
6. toleranceUnits should be appropriate for the scale (e.g., 15 for a 0-600 range, not 0.3)
`;
    } else if (isMathSubject && needsGraphs) {
      subjectGraphInstructions = `
MATH GRAPH ANNOTATIONS:
For graph questions that mention specific features, include an "annotations" array in graphConfig:
- If question mentions turning points/maxima/minima: add annotation with type "point", showCoordinates: true
- If question mentions roots/intercepts: add annotation with type "intercept" and the axis
- Example: {"id": "max1", "type": "point", "coords": {"x": -0.55, "y": 1.63}, "label": "Maximum", "showCoordinates": true}
These annotations are visual-only and do NOT affect marking.
`;
    }

    // Determine educational tier for complexity scaling
    const tier = (setData.educational_tier || '').toLowerCase();
    // New universal tier IDs (primary), plus legacy IDs for backward compat
    const isFoundation = tier.includes('foundation') || tier.includes('basic');
    const isGCSE = tier === 'secondary_14_16' || tier.includes('gcse') || tier.includes('ks4') || tier.includes('o-level') || tier.includes('secondary');
    const isALevel = tier === 'college_16_18' || tier.includes('a-level') || tier.includes('a level') || tier.includes('ib') || tier.includes('pre-u') || tier.includes('advanced') || tier.includes('college');
    const isUniversity = tier === 'university_18plus' || tier.includes('university') || tier.includes('undergraduate') || tier.includes('degree') || tier.includes('postgraduate') || tier.includes('masters');
    
    // Map universal tier to internal rigor label for prompt context
    const rigorLabel = isUniversity ? 'Expert' : isALevel ? 'Advanced' : isGCSE ? 'Foundation' : 'Standard';
    
    // Detect transformation topics for special handling
    const hasTransformationTopic = subtopicsLower.some((s: string) => 
      s.includes('transform') || 
      s.includes('f(x)') || 
      s.includes('function') ||
      s.includes('sketch') ||
      s.includes('curve') ||
      s.includes('graph')
    );
    
    // Force graph questions when A-Level/IB + transformation/graph topic (always, regardless of toggle)
    const forceTransformationType = (isALevel || isUniversity) && hasTransformationTopic;
    
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
COMPLEXITY LEVEL: Foundation / Basic Rigor
- Use simple, scaffolded questions with clear step-by-step guidance
- Avoid abstract notation; use concrete numbers and straightforward language
- Include worked examples within multi-part questions
- Keep calculations to single-step or two-step maximum
- Use friendly, encouraging language
- Provide visual aids (diagrams, number lines) where helpful`;
    } else if (isGCSE) {
      complexityInstructions = `
COMPLEXITY LEVEL: Foundation Rigor — High School / Secondary (Ages 14–16)
- Questions should require multi-step reasoning
- Use standard mathematical notation but explain any unfamiliar symbols
- Include some abstract elements but ground in practical contexts
- Mix procedural fluency with problem-solving
- 2-4 mark questions with clear mark allocation
- Include "show that" and "explain" command words`;
    } else if (isALevel || isUniversity) {
      // PHASE 3: Enhanced enforcement for Advanced/Expert tiers
      const minMarks = isUniversity ? 6 : 4;
      complexityInstructions = `
COMPLEXITY LEVEL: ${isUniversity ? `Expert Rigor — University / Undergraduate (Ages 18+)` : `Advanced Rigor — College / Sixth Form (Ages 16–18)`}
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

MANDATORY THREE-TIER QUESTION STRUCTURE:
Every parent question MUST follow this cognitive progression:
  Part (a) Calculation — Straightforward formula application. e.g., "Calculate $P(X = 4)$.", "Find $\\frac{dy}{dx}$."
  Part (b) Constraint/Assumption — Condition, assumption, or model justification. e.g., "State one assumption you have made about the occurrence of defects.", "Explain why a Poisson distribution is appropriate here."
  Part (c) 'Show That' / Reverse — Higher-difficulty: logarithms, algebraic rearrangement, inverse reasoning. e.g., "Given that $P(X = 0) = 0.05$, show that $\\lambda \\approx 3.0$.", "Hence deduce that $n > 45$."

MANDATORY FORMAL NOTATION:
- Use formal probability/mathematical notation in EVERY question: $P(X = 4)$, $P(X < 2)$, $P(X \\leq 1)$.
- State distributions explicitly: $X \\sim \\text{Po}(3.5)$, $Y \\sim B(20, 0.3)$, $W \\sim N(50, 4^2)$.
- Use "probability" NEVER "likelihood" or "chance". Do NOT name distributions in question text — let the student identify from context.

CLINICAL LINGUISTIC STYLING:
- Use exam board command verbs ONLY: 'Calculate', 'Determine', 'Evaluate', 'Verify', 'State', 'Show that', 'Hence', 'Deduce', 'Justify'.
- Include "Give your answer to 3 significant figures" or "Give your answer to 2 decimal places" where appropriate.
- NEVER use conversational language. At least ONE sub-part per question must require a text-based explanation in context.

MARK SCHEME (M1/A1/B1) ALIGNMENT:
- Every sub-part's worked_solution MUST include M1/A1/B1 marking breakdown.
- M1 = Method mark (correct approach/formula), A1 = Accuracy mark (correct numerical answer), B1 = Independent mark (standalone fact/definition).
- Format in worked_solution: "M1 for identifying $\\lambda = 3.5$\\nM1 for $P(X \\leq 1) = P(X=0) + P(X=1)$\\nA1 for 0.1359"
- Total marks per sub-part must equal the sum of M/A/B marks.

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

    // Translate exam board to generic style description (no trademarked names in prompt)
    const boardTranslation: Record<string, string> = {
      aqa: "UK exam board using command verbs like 'evaluate', 'explain', 'compare'; structured mark schemes with AO1/AO2/AO3 weighting",
      edexcel: "UK exam board (Pearson style) with data-response and multi-part questions; emphasis on application and analysis",
      ocr: "UK exam board with structured response format and synoptic assessment; clear command terms",
      cie: "International exam board (Cambridge style) with structured data response and essay-type questions",
      wjec: "Welsh exam board with structured mark schemes; emphasis on Welsh context where appropriate",
      ib: "International Baccalaureate programme with internal assessment style and extended response questions",
      college_board: "US standardized testing style with multiple-choice and free-response sections",
    };
    const translatedBoard = setData.exam_board
      ? (boardTranslation[setData.exam_board.toLowerCase()] || `Exam board style: ${setData.exam_board}`)
      : '';

    const prompt = `Generate ${setData.question_count} practice questions.

Context:
- Subject: ${setData.subject_id}
- Subtopics: ${setData.subtopics.join(', ')}
- Educational Level: ${setData.educational_tier || 'not specified'}
${translatedBoard ? `- Question Style: ${translatedBoard}` : ''}
- ${difficultyInstructions}
${complexityInstructions}

IMPORTANT: All scenarios, case studies, and data sets MUST be entirely original. Do not reproduce or closely paraphrase real exam questions, published mark schemes, or copyrighted source texts. Create novel contexts that test the same skills.

SOURCE TEXT / INSERT TRANSFORMATION RULE:
If the example or resource material contains a case study, source text, passage, or experimental setup (e.g., a UK factory, a specific political speech, or a named experiment):
1. EXTRACT: Identify the numerical values, logical relationships, and skill being tested.
2. TRANSFORM: Rewrite the scenario entirely using a completely different real-world context (different industry, country, time period, or fictional setting) while preserving the identical mathematical/analytical relationship. Example: "London Bus distance-time graph" -> "Singapore Metro distance-time graph".
3. VISUAL SYNC: When a scenario is transformed, also generate updated axis labels and annotations for any GraphCanvas or table headers so the visual data matches the new narrative. Example: if changing from "London Bus" to "Singapore Metro", update the pathAnnotations labels and xLabel/yLabel in graphConfig to reflect the new context. The numerical coordinates must remain unchanged.
4. ENSURE: The rewritten scenario tests exactly the same Assessment Objective and skill level. The numbers may be similar but the narrative must be 100% original.
5. NEVER reproduce verbatim passages from the source document.
${transformationInstructions}
${subjectGraphInstructions}
${resourcePackContext}

CRITICAL OUTPUT RULES:
1) Wrap ALL mathematical expressions in LaTeX delimiters: $...$ for inline math, $$...$$ for standalone equations.
2) Use proper LaTeX commands: \\frac{a}{b}, \\sqrt{x}, x^{2}, \\pi, \\theta, \\leq, \\geq, \\neq, \\times, \\div, \\pm
3) Example: instead of "h_max = (m*u^2) / (2*(mg + R))", output "$$h_{max} = \\frac{mu^2}{2(mg + R)}$$"
4) Use $...$ for inline math within sentences, $$...$$ for standalone block equations.
5) Do not output markdown code fences.
6) Do not output JSON as raw text in chat content. You will return data via the provided function call only.
7) IMPORTANT: LaTeX is ONLY for display text fields (question_text, feedback, worked_solution, correct_answer for short-answer). NEVER put LaTeX in markingFormula, graphConfig numeric data, or coordinate arrays.
8) NEVER use \\[ ... \\] or [ ... ] as LaTeX delimiters. ONLY use $...$ (inline) and $$...$$ (block). The renderer does NOT support bracket delimiters.
${visualQuestionInstructions}

MCQ rules (avoid duplication in UI):
- question_text MUST contain only the stem (no A/B/C/D in the text).
- options MUST be an array of 4 strings WITHOUT letter prefixes.
- correct_answer MUST be one of: "A", "B", "C", "D".

${!isMathSubject ? `
MULTI-SERIES GRAPHS (Economics, Science, etc.):
For graph_interpretation questions with multiple curves (e.g., Supply & Demand, Force vs Extension with multiple materials):
- Use multiple entries in graphConfig.series[] with DIFFERENT colors and labels
- Color palette: "#3b82f6" (blue), "#ef4444" (red), "#22c55e" (green), "#f59e0b" (amber), "#8b5cf6" (purple)
- Each series MUST have a unique "id" and its own separate "data" array — NEVER combine multiple curves into a single data array
- CRITICAL: NEVER connect the last point of one series to the first point of another. Each series is an INDEPENDENT object in the series[] array.

***** ACADEMIC LABELLING RULES FOR ECONOMICS *****
- Use functional labels, NOT mathematical intercept labels:
  - Use "Demand Function (D)" NOT "Demand Intercept"
  - Use "Supply Function (S)" NOT "Supply Intercept"  
  - For shifted curves: "New Demand (D₁)" or "New Supply (S₁)"
- Series labels should read like an economics textbook, e.g.: "Demand (D)", "Supply (S)", "New Supply (S₁)"

***** ALGEBRAIC DERIVATION FIRST — MANDATORY FOR ALL NON-MATH SUBJECTS *****
For ALL subjects except Mathematics, when a question involves equations or functions:
1. The worked_solution MUST solve equations algebraically FIRST: set equations equal, solve step-by-step, state numeric answer.
2. The graph is a VISUAL AID only — never derive values "from the graph" in the worked solution.
3. Example methodology: "Setting $P_D = P_S$: $150 - 3Q = 30 + 2Q$ → $120 = 5Q$ → $Q = 24$. Substituting: $P = 150 - 3(24) = 78$. The graph confirms the intersection at $(24, 78)$."
4. For welfare analysis, use EXACT formulas:
   - Total Subsidy Cost = subsidy_per_unit × Q_new
   - ΔCS = 0.5 × (P_old - P_new) × (Q_old + Q_new)
   - ΔPS = 0.5 × (P_new_producer - P_old) × (Q_old + Q_new)
   - DWL = 0.5 × subsidy_per_unit × (Q_new - Q_old)
5. NEVER approximate or "read off" values — always compute from the algebraic solution.

***** LINEAR TERMINOLOGY ENFORCEMENT *****
- If a function is linear (degree 1, e.g., P = 10 + 0.5Q), the question text MUST say "line" or "function" — NEVER "curve."
- "Curve" is ONLY acceptable for genuinely non-linear relationships (quadratic, exponential, logarithmic).
- Correct: "Plot the supply line", "The demand function is shown", "Draw the supply line on the graph"
- WRONG: "Plot the supply curve" (when the function is linear)

***** CURRENCY SYMBOL FORMATTING *****
- NEVER use a bare $ symbol for currency in question_text, feedback, or worked_solution. The $ character is RESERVED for LaTeX delimiters.
- For currency, write the amount in words or use non-conflicting symbols: "30 dollars", "USD 30", "£30", "€30".
- If you must use a dollar sign, escape it: "\\$30" — but prefer spelling it out.

***** CRITICAL: MATH-VISUAL SYNC RULE — DATA MUST MATCH EQUATIONS *****
For economics linear equations like P = a - bQ or P_S = c + dQ:
- The data points MUST be calculated from the equation. If P = 150 - 3Q, then at Q=0 P=150, at Q=10 P=120, at Q=50 P=0.
- NEVER use parabolic or curved data for linear equations.
- NEVER copy curve shapes from other examples — CALCULATE coordinates from the equation.
- Axis domains MUST encompass the full range of the equation. If P-intercept is 150, domainY must extend to at least 160. If Q-intercept is 50, domainX must extend to at least 55. NEVER use default [-4,4] or [0,10] domains for economics graphs.

***** CRITICAL: SIMULTANEOUS EQUATION SOLVER RULE *****
When generating Supply & Demand graphs, you MUST solve the simultaneous equations BEFORE generating coordinates:
- Step 1: Set Demand = Supply and solve for Q_eq algebraically (e.g., 150 - 3Q = 30 + 2Q → 120 = 5Q → Q = 24)
- Step 2: Substitute Q_eq back to find P_eq (e.g., P = 150 - 3(24) = 78)
- Step 3: INCLUDE the equilibrium point (Q_eq, P_eq) as an explicit data point in BOTH the demand AND supply series
- Step 4: The interpretationFields correctAnswer values MUST match the solved equilibrium exactly
- NEVER "eyeball" or approximate the intersection — ALWAYS solve mathematically first

***** CRITICAL: GRAPH_PLOTTING vs GRAPH_INTERPRETATION FOR ECONOMICS *****
- graph_interpretation = student READS FROM a pre-drawn graph → series[] MUST contain the curve data (visible to student)
- graph_plotting = student DRAWS the graph → series[] MUST be EMPTY [], answer data goes ONLY in plottingAnswer
- If the question says "Plot", "Draw", or "Sketch" the curves → use graph_plotting with series: []
- If the question says "Calculate from the graph", "Read from the diagram", "Use the graph to find" → use graph_interpretation with data in series[]
- NEVER put the answer curves in series[] for graph_plotting — that reveals the answer before the student draws!

***** CRITICAL: TAX/SUBSIDY QUESTIONS MUST INCLUDE GRAPHS *****
- Tax, subsidy, price floor, price ceiling, tariff, and quota questions MUST use graph_interpretation
- These graphs MUST show: Original Supply (S), Shifted curve (S₁ or D₁), and the other curve (D or S)
- Include projection annotations (type: "projection") at equilibrium points and key intersections to draw dashed reference lines to both axes
- The student calculates values FROM the pre-drawn graph
- ALWAYS include "annotations" array with projection lines for equilibrium points using: {"type": "projection", "coords": {"x": Q_eq, "y": P_eq}, "label": "E", "projectTo": "both"}

ECONOMICS GRAPH GOLD STANDARD (INTERPRETATION) — copy this structure for Supply/Demand graphs where students READ from the graph:
Given P_D = 150 - 3Q (demand) and P_S = 30 + 2Q (supply):
Equilibrium: 150 - 3Q = 30 + 2Q → Q = 24, P = 78
{
  "graphType": "interpretation",
  "graphConfig": {
    "chartType": "line", "xLabel": "Quantity (Q)", "yLabel": "Price ($)",
    "domainX": [0, 55], "domainY": [0, 160], "xDomain": [0, 55], "yDomain": [0, 160],
    "series": [
      {"id": "demand", "label": "Demand (D)", "data": [{"x":0,"y":150},{"x":10,"y":120},{"x":24,"y":78},{"x":30,"y":60},{"x":40,"y":30},{"x":50,"y":0}], "color": "#ef4444", "showLine": true},
      {"id": "supply", "label": "Supply (S)", "data": [{"x":0,"y":30},{"x":10,"y":50},{"x":24,"y":78},{"x":30,"y":90},{"x":40,"y":110},{"x":50,"y":130}], "color": "#3b82f6", "showLine": true}
    ],
    "grid": {"show": true, "stepX": 5, "stepY": 10},
    "subjectProfile": {"subject": "Economics", "axisLabels": {"x": "Quantity (Q)", "y": "Price ($)"}, "quadrantMode": "q1"},
    "annotations": [
      {"id": "eq_proj", "type": "projection", "coords": {"x": 24, "y": 78}, "label": "E", "projectTo": "both", "showCoordinates": true}
    ]
  },
  "interpretationFields": [
    {"id": "eq_price", "type": "numeric", "question": "What is the equilibrium price?", "correctAnswer": 78, "tolerance": 2, "marks": 2},
    {"id": "eq_qty", "type": "numeric", "question": "What is the equilibrium quantity?", "correctAnswer": 24, "tolerance": 1, "marks": 2}
  ]
}

ECONOMICS GRAPH GOLD STANDARD (SUBSIDY/TAX) — for questions where a graph is PRE-DRAWN and the student reads values:
Given: Original supply P_S = 50 + 3Q, demand P_D = 200 - 2Q, government subsidy of $15 per unit (shifts supply down by $15):
New supply: P_S' = 35 + 3Q
Original equilibrium: Q=30, P=140; New equilibrium: Q=33, P=134
{
  "graphType": "interpretation",
  "graphConfig": {
    "chartType": "line", "xLabel": "Quantity (units)", "yLabel": "Price ($)",
    "domainX": [0, 75], "domainY": [0, 220], "xDomain": [0, 75], "yDomain": [0, 220],
    "series": [
      {"id": "demand", "label": "Demand (D)", "data": [{"x":0,"y":200},{"x":30,"y":140},{"x":33,"y":134},{"x":50,"y":100},{"x":70,"y":60}], "color": "#ef4444", "showLine": true},
      {"id": "supply", "label": "Supply (S)", "data": [{"x":0,"y":50},{"x":20,"y":110},{"x":30,"y":140},{"x":40,"y":170},{"x":50,"y":200}], "color": "#3b82f6", "showLine": true},
      {"id": "supply_new", "label": "Supply + Subsidy (S₁)", "data": [{"x":0,"y":35},{"x":20,"y":95},{"x":33,"y":134},{"x":40,"y":155},{"x":50,"y":185}], "color": "#22c55e", "showLine": true, "lineStyle": "dashed"}
    ],
    "grid": {"show": true, "stepX": 5, "stepY": 20},
    "subjectProfile": {"subject": "Economics", "axisLabels": {"x": "Quantity (units)", "y": "Price ($)"}, "quadrantMode": "q1"},
    "annotations": [
      {"id": "old_eq", "type": "projection", "coords": {"x": 30, "y": 140}, "label": "E", "projectTo": "both"},
      {"id": "new_eq", "type": "projection", "coords": {"x": 33, "y": 134}, "label": "E₁", "projectTo": "both"}
    ]
  },
  "interpretationFields": [
    {"id": "new_eq_qty", "type": "numeric", "question": "What is the new equilibrium quantity after the subsidy?", "correctAnswer": 33, "tolerance": 1, "marks": 2},
    {"id": "subsidy_cost", "type": "numeric", "question": "Calculate the total cost of the subsidy to the government.", "correctAnswer": 495, "tolerance": 10, "marks": 3}
  ]
}

ECONOMICS GRAPH GOLD STANDARD (DUAL-SHIFT TAX) — for indirect tax questions with S and S₁:
Given: Demand P_D = 120 - 2Q, Supply P_S = 20 + Q, tax of $10 per unit (shifts supply UP by $10):
New supply: P_S₁ = 30 + Q
Original equilibrium: 120 - 2Q = 20 + Q → Q=33.33, P=53.33; New equilibrium: 120 - 2Q = 30 + Q → Q=30, P=60
Consumer tax burden = new price - old price = 60 - 53.33 = $6.67
{
  "graphType": "interpretation",
  "graphConfig": {
    "chartType": "line", "xLabel": "Quantity (Q)", "yLabel": "Price ($)",
    "domainX": [0, 65], "domainY": [0, 130], "xDomain": [0, 65], "yDomain": [0, 130],
    "series": [
      {"id": "demand", "label": "Demand (D)", "data": [{"x":0,"y":120},{"x":15,"y":90},{"x":30,"y":60},{"x":33.33,"y":53.33},{"x":45,"y":30},{"x":60,"y":0}], "color": "#ef4444", "showLine": true},
      {"id": "supply", "label": "Supply (S)", "data": [{"x":0,"y":20},{"x":15,"y":35},{"x":33.33,"y":53.33},{"x":45,"y":65},{"x":60,"y":80}], "color": "#3b82f6", "showLine": true},
      {"id": "supply_tax", "label": "Supply + Tax (S₁)", "data": [{"x":0,"y":30},{"x":15,"y":45},{"x":30,"y":60},{"x":45,"y":75},{"x":60,"y":90}], "color": "#f59e0b", "showLine": true}
    ],
    "grid": {"show": true, "stepX": 5, "stepY": 10},
    "subjectProfile": {"subject": "Economics", "axisLabels": {"x": "Quantity (Q)", "y": "Price ($)"}, "quadrantMode": "q1"},
    "annotations": [
      {"id": "old_eq", "type": "projection", "coords": {"x": 33.33, "y": 53.33}, "label": "E", "projectTo": "both", "showCoordinates": true},
      {"id": "new_eq", "type": "projection", "coords": {"x": 30, "y": 60}, "label": "E₁", "projectTo": "both", "showCoordinates": true}
    ]
  },
  "interpretationFields": [
    {"id": "new_price", "type": "numeric", "question": "What is the new equilibrium price after the tax?", "correctAnswer": 60, "tolerance": 2, "marks": 2},
    {"id": "consumer_burden", "type": "numeric", "question": "Calculate the tax burden on the consumer (per unit).", "correctAnswer": 6.67, "tolerance": 0.5, "marks": 3}
  ]
}

PHYSICS/SCIENCE GRAPH GOLD STANDARD (EXPONENTIAL DECAY) — for radioactive decay, half-life, or any smooth asymptotic curve:
Given: Initial activity A₀ = 800 counts/min, half-life = 40s. Formula: A = 800 × (0.5)^(t/40)
At t=120s: A = 800 × (0.5)^3 = 100
IMPORTANT: Use graph_interpretation (pre-drawn smooth curve), NOT graph_plotting. Generate 20+ data points for a smooth curve.
{
  "graphType": "interpretation",
  "graphConfig": {
    "chartType": "line", "xLabel": "Time (s)", "yLabel": "Activity (counts/min)",
    "domainX": [0, 200], "domainY": [0, 850], "xDomain": [0, 200], "yDomain": [0, 850],
    "series": [
      {"id": "decay", "label": "Radioactive Decay", "data": [
        {"x":0,"y":800},{"x":8,"y":685},{"x":16,"y":587},{"x":24,"y":503},{"x":32,"y":431},
        {"x":40,"y":400},{"x":48,"y":343},{"x":56,"y":294},{"x":64,"y":252},{"x":72,"y":216},
        {"x":80,"y":200},{"x":88,"y":171},{"x":96,"y":147},{"x":104,"y":126},{"x":112,"y":108},
        {"x":120,"y":100},{"x":128,"y":86},{"x":136,"y":73},{"x":144,"y":63},{"x":152,"y":54},
        {"x":160,"y":50},{"x":168,"y":43},{"x":176,"y":37},{"x":184,"y":31},{"x":192,"y":27},{"x":200,"y":25}
      ], "color": "#8b5cf6", "showLine": true}
    ],
    "grid": {"show": true, "stepX": 20, "stepY": 100},
    "subjectProfile": {"subject": "Physics", "axisLabels": {"x": "Time (s)", "y": "Activity (counts/min)"}, "quadrantMode": "q1"}
  },
  "interpretationFields": [
    {"id": "activity_120", "type": "numeric", "question": "Use the graph to find the activity after 120 seconds.", "correctAnswer": 100, "tolerance": 10, "marks": 2},
    {"id": "half_life", "type": "numeric", "question": "Determine the half-life from the graph.", "correctAnswer": 40, "tolerance": 3, "marks": 2}
  ]
}

BUSINESS GRAPH GOLD STANDARD (BREAK-EVEN ANALYSIS) — for Fixed Cost / Total Cost / Total Revenue overlays:
Given: Fixed costs = $2000, Variable cost per unit = $8, Selling price = $20 per unit.
Total Cost (TC) = 2000 + 8Q, Total Revenue (TR) = 20Q
Break-even: 20Q = 2000 + 8Q → 12Q = 2000 → Q ≈ 167 units
{
  "graphType": "interpretation",
  "graphConfig": {
    "chartType": "line", "xLabel": "Output (units)", "yLabel": "Cost / Revenue ($)",
    "domainX": [0, 350], "domainY": [0, 7000], "xDomain": [0, 350], "yDomain": [0, 7000],
    "series": [
      {"id": "fixed_cost", "label": "Fixed Cost (FC)", "data": [{"x":0,"y":2000},{"x":100,"y":2000},{"x":167,"y":2000},{"x":250,"y":2000},{"x":350,"y":2000}], "color": "#ef4444", "showLine": true, "lineStyle": "solid"},
      {"id": "total_cost", "label": "Total Cost (TC)", "data": [{"x":0,"y":2000},{"x":50,"y":2400},{"x":100,"y":2800},{"x":167,"y":3336},{"x":250,"y":4000},{"x":350,"y":4800}], "color": "#3b82f6", "showLine": true, "lineStyle": "solid"},
      {"id": "total_revenue", "label": "Total Revenue (TR)", "data": [{"x":0,"y":0},{"x":50,"y":1000},{"x":100,"y":2000},{"x":167,"y":3340},{"x":250,"y":5000},{"x":350,"y":7000}], "color": "#22c55e", "showLine": true, "lineStyle": "solid"}
    ],
    "grid": {"show": true, "stepX": 50, "stepY": 1000},
    "subjectProfile": {"subject": "Business", "axisLabels": {"x": "Output (units)", "y": "Cost / Revenue ($)"}, "quadrantMode": "q1"},
    "annotations": [
      {"id": "breakeven", "type": "projection", "coords": {"x": 167, "y": 3340}, "label": "Break-even Point", "projectTo": "both", "showCoordinates": true}
    ]
  },
  "interpretationFields": [
    {"id": "breakeven_qty", "type": "numeric", "question": "Identify the break-even quantity from the graph.", "correctAnswer": 167, "tolerance": 5, "marks": 2},
    {"id": "margin_safety", "type": "numeric", "question": "If the current output is 500 units, calculate the margin of safety.", "correctAnswer": 333, "tolerance": 10, "marks": 3}
  ]
}

***** SMOOTH CURVE vs DISCRETE PATH — ROUTING RULE *****
When generating graph questions for non-math subjects, choose the correct mode:

MODE 1 — DISCRETE PATH (graph_plotting): Use for PIECEWISE LINEAR scenarios only:
  - Distance-time, speed-time, velocity-time journeys
  - Supply/demand lines where the student DRAWS the lines
  - Any scenario described as a sequence of distinct events connected by straight segments

MODE 2 — SMOOTH PRE-DRAWN CURVE (graph_interpretation): Use for CURVED relationships:
  - Exponential decay (radioactive decay, capacitor discharge, cooling curves)
  - Enzyme kinetics, rate of reaction curves
  - Any exponential, logarithmic, or asymptotic relationship
  - Break-even analysis, cost/revenue overlays
  - Generate 15-30 data points using the mathematical formula for a smooth appearance
  - The student READS values from the pre-drawn curve, not draws it

EXCEPTION — If the question says "plot" or "sketch" an exponential/curved relationship:
  - STILL use graph_interpretation with the pre-drawn curve
  - Add interpretationFields asking the student to read specific values
  - This avoids jagged straight-line rendering for naturally curved relationships

Graph questions for ${setData.subject_id} (NON-MATH SUBJECT - DISCRETE PATH MODE):
- For graph_plotting questions, you MUST use expectedPath (array of vertices), NOT markingFormula.
- Do NOT compute smooth mathematical curves. The answer is a SEQUENCE OF KEY EVENTS connected by straight lines.
- correct_answer MUST be an object with ALL of the following:
  {
    "graphType": "plotting",
    "graphConfig": {
      "chartType": "line",
      "xLabel": "Time (s)",
      "yLabel": "Distance (m)",
      "xDomain": [0, max],
      "yDomain": [0, max],
      "domainX": [0, max],
      "domainY": [0, max],
      "series": [],
      "grid": {"show": true, "stepX": appropriate_step, "stepY": appropriate_step},
      "subjectProfile": {
        "subject": "${setData.subject_id}",
        "axisLabels": {"x": "appropriate label with units", "y": "appropriate label with units"},
        "quadrantMode": "q1"
      }
    },
    "plottingAnswer": {
      "expectedPoints": [same vertices as expectedPath],
      "toleranceUnits": appropriate_for_scale,
      "marksPerPoint": 1,
      "expectedPath": [
        {"x": 0, "y": 0},
        {"x": 100, "y": 300},
        {"x": 200, "y": 300},
        {"x": 300, "y": 600}
      ],
      "pathAnnotations": [
        {"pointIndex": 0, "label": "Start"},
        {"pointIndex": 2, "label": "Stationary"},
        {"pointIndex": 3, "label": "End"}
      ]
    }
  }

***** ABSOLUTE RULES FOR NON-MATH GRAPH PLOTTING — VIOLATION = BROKEN GRAPH *****
1. series.data MUST be an EMPTY array [] — student plots from scratch
2. expectedPath is REQUIRED — array of discrete vertices defining the correct piecewise path
3. markingFormula is STRICTLY FORBIDDEN — causes cubic/polynomial rendering bugs
4. expectedCurve is STRICTLY FORBIDDEN — expectedPath replaces it entirely
5. expectedPoints MUST match expectedPath vertices exactly
6. toleranceUnits: use 1 for scales 0-30, use 5 for scales 0-100, use 15 for scales 0-600
7. pathAnnotations is REQUIRED — label EVERY vertex with its physical meaning
8. All coordinates must be positive (quadrant 1 only)
9. Flat segments: "stays at 300m for 100s" = TWO points with same y-value
10. NEVER use polynomial functions (x^2, x^3, sin(x), etc.) — only straight-line segments
11. subjectProfile is REQUIRED with correct axis labels and units

EXCEPTION — SMOOTH CURVE SCENARIOS (exponential, logarithmic, rate curves):
If the question involves a smooth mathematical curve (e.g., radioactive decay, enzyme kinetics,
charging/discharging curves, cooling curves, population growth):
- Do NOT use graph_plotting with discrete path mode
- Instead use graph_interpretation with pre-drawn curve data (15-30 computed data points)
- The student READS from the pre-drawn curve, not draws it
- Use the PHYSICS/SCIENCE GRAPH GOLD STANDARD template above
- This avoids jagged straight-line rendering for naturally curved relationships
- Reserve graph_plotting ONLY for piecewise linear journeys (distance-time, speed-time, supply/demand lines)

GOLD STANDARD — copy this structure for ALL speed-time and distance-time graphs:
{
  "graphType": "plotting",
  "graphConfig": {
    "chartType": "line", "xLabel": "Time (s)", "yLabel": "Speed (m/s)",
    "domainX": [0, 25], "domainY": [0, 25], "xDomain": [0, 25], "yDomain": [0, 25],
    "series": [], "grid": {"show": true, "stepX": 5, "stepY": 5},
    "subjectProfile": {"subject": "Physics", "axisLabels": {"x": "Time (s)", "y": "Speed (m/s)"}, "quadrantMode": "q1"}
  },
  "plottingAnswer": {
    "expectedPoints": [{"x": 0, "y": 0}, {"x": 10, "y": 20}, {"x": 20, "y": 20}],
    "toleranceUnits": 1, "marksPerPoint": 1,
    "expectedPath": [{"x": 0, "y": 0}, {"x": 10, "y": 20}, {"x": 20, "y": 20}],
    "pathAnnotations": [{"pointIndex": 0, "label": "Start (at rest)"}, {"pointIndex": 1, "label": "Reaches 20 m/s"}, {"pointIndex": 2, "label": "Constant speed"}]
  }
}
` : `
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
      "grid": {"show": true, "stepX": 1, "stepY": 1},
      "annotations": [
        {"id": "ann1", "type": "point", "coords": {"x": 3, "y": 5}, "label": "Maximum", "showCoordinates": true},
        {"id": "ann2", "type": "intercept", "axis": "x", "label": "Root"},
        {"id": "ann3", "type": "region", "label": "Area", "fillBetween": {"curveSeriesId": "reference", "fromX": 0, "toX": 3}}
      ]
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
`}

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

***** UNIQUENESS & RANDOMIZATION RULES (CRITICAL) *****
IMPORTANT: Even if the same PDF or resource is uploaded multiple times, YOU MUST generate COMPLETELY DIFFERENT questions:
1. RANDOM CONSTANTS: If the example uses f(x) = x(x+2)(1-x), use different roots like f(x) = x(x+3)(2-x) or f(x) = (x-1)(x+1)(3-x)
2. DIFFERENT FUNCTION LETTERS: If examples use f(x), you use g(x), h(x), or p(x) instead
3. VARIED TRANSFORMATIONS: Don't repeat the same transformations (f(x+2), f(x-2), etc.) - mix up the shifts: f(x+3), f(2x), 2f(x), -f(x), etc.
4. UNIQUE DOMAINS: Calculate different x-domains and y-domains based on new roots and asymptotes
5. RANDOM QUESTION STRUCTURE: Vary whether questions ask for coordinates, equations, sketches, or interpretations
6. Example: If provided examples show "sketch f(x) = 1/(x+1)", you generate "find the asymptotes of g(x) = 1/(x-2)" with completely different asymptote positions

${specContent ? 'Specification (excerpt):\n' + specContent.substring(0, 5000) : ''}
${exampleQuestionsContent ? `
EXAMPLE QUESTIONS - STYLE GUIDE ONLY (NOT TO BE REPEATED):
The user has provided example questions. Study these ONLY for:
1. STYLE of questions (how they're worded, complexity level)
2. STRUCTURE of multi-part questions (a, b, c patterns)
3. COMMAND VERBS used (Sketch, State, Find, etc.)
4. GRAPH SETUP (grid, domains, labels)
5. MARKS allocation patterns
** DO NOT repeat the same constants, function letters, or transformation directions from the examples **
** Generate completely new mathematical content while maintaining the same STYLE **

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
          if (v.includes('```')) issues.push({ path, issue: 'contains markdown fence' });
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
                  options: { type: 'array', items: { type: 'string' }, nullable: true },
                  worked_solution: { type: 'string', nullable: true },
                  table_data: { type: 'object', nullable: true },
                },
              },
            },
          },
        },
      },
    } as const;

    const nonMathGraphWarning = !isMathSubject && needsGraphs
      ? ' CRITICAL: This is a NON-MATH subject. For graph_plotting questions you MUST use expectedPath (array of discrete vertices). ' +
        'You are STRICTLY FORBIDDEN from using markingFormula or expectedCurve. ' +
        'You are STRICTLY FORBIDDEN from generating polynomial/cubic/quadratic curves. ' +
        'Every graph answer MUST be a piecewise linear path with pathAnnotations. ' +
        'Use the DISCRETE PATH template from the instructions — no smooth curves allowed.'
      : '';

    const baseSystemPrompt =
      'You are an expert practice question generator. ' +
      'You MUST call the function generate_practice_questions. ' +
      'Do not output any other text. ' +
      'Wrap all math in $...$ or $$...$$ LaTeX delimiters. Use proper LaTeX commands like \\frac, \\sqrt, x^{2}.' +
      nonMathGraphWarning;

    const strictRetryPrompt = 'Return valid data. Use $...$ for inline math and $$...$$ for block math.';

    const callAi = async (attempt: 0 | 1 | 2) => {
      const sys = attempt === 0 ? baseSystemPrompt : `${baseSystemPrompt} ${strictRetryPrompt}`;

      // Reliability fallback chain:
      // - Attempt 1: Gemini Flash (best balance of speed + quality for complex prompts)
      // - Attempt 2: Gemini Pro (stronger reasoning, handles complex tool schemas better)
      // - Attempt 3: GPT-5-mini (different provider as final fallback)
      const modelChain = [
        'google/gemini-2.5-flash',
        'google/gemini-2.5-pro',
        'openai/gpt-5-mini'
      ];
      const model = modelChain[Math.min(attempt, modelChain.length - 1)];

      const controller = new AbortController();
      // Generous timeouts - complex graph prompts with tool calling need time
      const timeoutMs = attempt === 0 ? 120_000 : attempt === 1 ? 150_000 : 180_000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;
      try {
        console.log(`Calling Lovable AI (tool mode) with model: ${model}`);
        response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            // OpenAI models: use max_completion_tokens (higher for graph-heavy output)
            // Google models: use temperature=0 for deterministic output
            ...(model.startsWith('openai/') 
              ? { max_completion_tokens: 16000 } 
              : { temperature: 0, max_tokens: 16000 }),
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: prompt },
            ],
            tools: [tool],
            tool_choice: { type: 'function', function: { name: 'generate_practice_questions' } },
          }),
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          throw new Error(`AI request timed out after ${Math.round(timeoutMs / 1000)}s (model=${model}).`);
        }
        throw e;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);

        if (response.status === 429) {
          throw new Error('AI rate limit exceeded. Please try again in a moment.');
        }
        if (response.status === 402) {
          throw new Error('AI usage limit reached. Please add credits and try again.');
        }

        // Include response body snippet for clearer debugging.
        throw new Error(`AI API error (${response.status}): ${errorText.slice(0, 300)}`);
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
      // Gateway/provider-level errors come back in a different shape (no tool_calls).
      if (ai?.error) {
        const code = ai.error?.code;
        const message = ai.error?.message || 'Unknown AI provider error';
        const provider = ai.error?.metadata?.provider_name;
        const raw = ai.error?.metadata?.raw;
        const extra = [provider ? `provider=${provider}` : null, raw ? `raw=${raw}` : null].filter(Boolean).join(' ');
        throw new Error(`AI provider error${code ? ` (${code})` : ''}: ${message}${extra ? ` (${extra})` : ''}`);
      }

      const msg = ai?.choices?.[0]?.message;
      const toolCalls = msg?.tool_calls;
      const call = Array.isArray(toolCalls) ? toolCalls[0] : null;

      if (!call?.function?.arguments) {
        // Some models occasionally place JSON in message.content instead of tool_calls.
        const content = msg?.content;
        if (typeof content === 'string' && content.trim().length > 0) {
          const trimmed = content.trim();
          const jsonCandidate = trimmed.startsWith('{') ? trimmed : (trimmed.match(/\{[\s\S]*\}$/)?.[0] ?? null);
          if (jsonCandidate) {
            try {
              return JSON.parse(jsonCandidate);
            } catch {
              const sanitized = sanitizeJsonString(jsonCandidate);
              return JSON.parse(sanitized);
            }
          }
        }

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
      // Pre-validation: remap invalid question types the AI sometimes invents
      if (payload && typeof payload === 'object' && 'questions' in payload && Array.isArray((payload as any).questions)) {
        const typeRemap: Record<string, string> = {
          'numeric': 'short_answer',
          'numeric_entry': 'short_answer',
          'numeric_response': 'short_answer',
          'fill_in_blank': 'short_answer',
          'calculation': 'short_answer',
          'standard': 'short_answer',
          'open_ended': 'extended',
          'long_answer': 'extended',
          'free_response': 'extended',
          'essay': 'extended',
          'extended_response': 'extended',
          'multiple_choice': 'mcq',
          'true_false': 'mcq',
        };
        for (const q of (payload as any).questions) {
          if (q.question_type && typeRemap[q.question_type]) {
            console.warn(`Remapping invalid question_type "${q.question_type}" -> "${typeRemap[q.question_type]}"`);
            q.question_type = typeRemap[q.question_type];
          } else if (q.question_type && !['short_answer', 'extended', 'mcq', 'table_grid', 'graph_interpretation', 'graph_plotting', 'graph_transformation'].includes(q.question_type)) {
            const fallback = (q.marks && q.marks >= 6) ? 'extended' : 'short_answer';
            console.warn(`Unknown question_type "${q.question_type}" -> fallback "${fallback}"`);
            q.question_type = fallback;
          }
        }
      }
      const parsed = GeneratePracticeQuestionsSchema.safeParse(payload);
      if (!parsed.success) {
        console.error('Schema validation failed:', parsed.error.flatten());
        throw new Error('AI returned invalid question data (schema validation failed)');
      }

      // If the model returns EXTRA questions, keep the first N rather than failing and retrying.
      // This dramatically improves reliability and reduces timeouts for graph-heavy sets.
      let normalizedQuestions = parsed.data.questions;
      if (normalizedQuestions.length < setData.question_count) {
        throw new Error(`AI returned ${normalizedQuestions.length} questions, expected ${setData.question_count}`);
      }
      if (normalizedQuestions.length > setData.question_count) {
        console.warn(`AI returned ${normalizedQuestions.length} questions; trimming to ${setData.question_count}`);
        normalizedQuestions = normalizedQuestions.slice(0, setData.question_count);
      }

      // Enforce: question_latex must be null
      for (const q of normalizedQuestions) {
        if (q.question_latex !== null && q.question_latex !== undefined) {
          throw new Error('question_latex must be null');
        }
      }

      // Enforce: no LaTeX/backslashes/non-ASCII in ANY string fields
      const violations = findStringViolations({ ...parsed.data, questions: normalizedQuestions });
      if (violations.length) {
        console.error('String violations found:', violations.slice(0, 50));
        throw new Error('AI returned forbidden characters (markdown fences)');
      }

      return { ...parsed.data, questions: normalizedQuestions };
    };

    let generated: z.infer<typeof GeneratePracticeQuestionsSchema> | null = null;
    let lastErr: unknown = null;

    for (const attempt of [0, 1, 2] as const) {
      try {
        const ai = await callAi(attempt);
        const toolPayload = extractToolArgs(ai);
        generated = validateOrThrow(toolPayload);
        console.log(`AI generation succeeded on attempt ${attempt + 1}`);
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`AI generation attempt ${attempt + 1} failed:`, e);
        // If this isn't the last attempt, continue to next model
        if (attempt < 2) {
          console.log(`Retrying with next model in fallback chain...`);
        }
      }
    }

    if (!generated) {
      throw lastErr instanceof Error ? lastErr : new Error('AI generation failed');
    }

    // Backslash escaping disabled — backslashes are now intentional LaTeX commands (e.g. \frac, \sqrt)
    const questions = generated.questions;

    if (!questions || !Array.isArray(questions)) {
      throw new Error('AI response does not contain a valid questions array');
    }

    console.log(`Generated ${questions.length} questions`);
    
    // =====================================================================
    // PHASE 5.5: NON-MATH GRAPH ENFORCEMENT (Deterministic Post-Processing)
    // =====================================================================
    // The AI often ignores the "use expectedPath" instruction and generates
    // smooth math curves for Physics/Economics questions. This step enforces
    // the discrete path mode by stripping conflicting data and ensuring
    // expectedPath exists for non-math graph_plotting questions.
    if (!isMathSubject) {
      for (const q of questions) {
        if (q.question_type !== 'graph_plotting') continue;
        
        let graphData: any = null;
        try {
          graphData = typeof q.correct_answer === 'string'
            ? JSON.parse(q.correct_answer)
            : q.correct_answer;
        } catch { continue; }
        
        if (!graphData || graphData.graphType !== 'plotting') continue;
        
        const pa = graphData.plottingAnswer;
        if (!pa) continue;
        
        // RULE 1: Strip markingFormula — it causes the engine to render smooth curves
        if (pa.markingFormula) {
          console.warn(`[NON-MATH ENFORCEMENT] Q${q.question_number}: Stripping markingFormula "${pa.markingFormula}" — not allowed for ${setData.subject_id}`);
          delete pa.markingFormula;
        }
        
        // RULE 2: If expectedPath exists, strip expectedCurve to prevent conflict
        if (Array.isArray(pa.expectedPath) && pa.expectedPath.length >= 2) {
          if (pa.expectedCurve) {
            console.info(`[NON-MATH ENFORCEMENT] Q${q.question_number}: Stripping expectedCurve — expectedPath takes priority`);
            delete pa.expectedCurve;
          }
          // Sync expectedPoints with expectedPath vertices
          pa.expectedPoints = pa.expectedPath.map((p: any) => ({ x: p.x, y: p.y }));
          console.info(`[NON-MATH ENFORCEMENT] Q${q.question_number}: expectedPath OK with ${pa.expectedPath.length} vertices`);
        } else {
          // RULE 3: AI didn't provide expectedPath — try to salvage from expectedCurve or series data
          // Check if the existing curve data looks piecewise (few points with sharp corners)
          const curveData = pa.expectedCurve?.data || graphData.graphConfig?.series?.[0]?.data;
          if (Array.isArray(curveData) && curveData.length >= 2) {
            if (curveData.length <= 20) {
              // Few enough points — likely already piecewise, promote to expectedPath
              pa.expectedPath = curveData.map((p: any) => ({ x: p.x, y: p.y }));
              pa.expectedPoints = pa.expectedPath;
              delete pa.expectedCurve;
              console.info(`[NON-MATH ENFORCEMENT] Q${q.question_number}: Promoted ${curveData.length}-point curve to expectedPath`);
            } else {
              // Too many points = smooth polynomial curve (EXACTLY the cubic bug).
              // DO NOT salvage — this produces the broken cubic rendering.
              // Instead, discard the curve entirely and downgrade to short_answer.
              console.warn(`[NON-MATH ENFORCEMENT] Q${q.question_number}: REJECTING ${curveData.length}-point smooth curve — AI generated a polynomial instead of discrete path. Downgrading to short_answer.`);
              delete pa.expectedCurve;
              // Clear all curve data to prevent any rendering
              if (graphData.graphConfig?.series) {
                graphData.graphConfig.series = [];
              }
              // Downgrade question type since we can't render this correctly
              q.question_type = 'short_answer';
              q.correct_answer = 'See worked solution for the correct graph description.';
              continue; // Skip remaining rules for this question
            }
          } else {
            console.warn(`[NON-MATH ENFORCEMENT] Q${q.question_number}: No expectedPath and no salvageable curve data — graph may not render correctly`);
          }
        }
        
        // RULE 4: Clear series.data for plotting questions (student plots from scratch)
        if (graphData.graphConfig?.series) {
          for (const s of graphData.graphConfig.series) {
            if (Array.isArray(s.data) && s.data.length > 0) {
              console.info(`[NON-MATH ENFORCEMENT] Q${q.question_number}: Clearing series "${s.id}" data (${s.data.length} points) — student plots from scratch`);
              s.data = [];
            }
          }
        }
        
        // RULE 5: Ensure toleranceUnits is appropriate for scale
        if (pa.toleranceUnits && pa.toleranceUnits < 1 && pa.expectedPath?.length > 0) {
          const maxCoord = Math.max(
            ...pa.expectedPath.map((p: any) => Math.max(Math.abs(p.x), Math.abs(p.y)))
          );
          if (maxCoord > 10) {
            pa.toleranceUnits = Math.max(1, Math.round(maxCoord * 0.05));
            console.info(`[NON-MATH ENFORCEMENT] Q${q.question_number}: Adjusted toleranceUnits to ${pa.toleranceUnits} for scale ${maxCoord}`);
          }
        }
        
        // Write back the corrected data
        q.correct_answer = graphData;
      }
    }
    
    // =====================================================================
    // PHASE 6: SUB-QUESTION GROUPING - Share base graph data across 1a, 1b, 1c, etc.
    // =====================================================================
    // Group questions by their root number (e.g., "1a", "1b", "1c" all belong to group "1")
    // The first question in each group establishes the base function and curve data
    interface QuestionGroup {
      rootNumber: string;
      baseFunction?: string;        // e.g., "x(x+2)(1-x)"
      baseCurveData?: Array<{ x: number; y: number }>;
      baseDomainX?: [number, number];
      baseDomainY?: [number, number];
      baseSeries?: any[];           // Full series array for reuse
      baseGraphConfig?: any;        // Full graphConfig for reuse
      /** 
       * CRITICAL: The marking formula from part (a) - e.g., "(x-1)*(x-3)*(x+2)"
       * This is the algebraic source of truth for all sub-question transformations.
       */
      baseMarkingFormula?: string;
      questions: number[];          // Indices into questions array
    }
    
    const questionGroups = new Map<string, QuestionGroup>();
    
    // Build question groups
    questions.forEach((q: any, idx: number) => {
      const qNum = String(q.question_number || idx + 1);
      // Extract root number: "1a" -> "1", "10b" -> "10", "2" -> "2"
      const rootMatch = qNum.match(/^(\d+)/);
      const rootNumber = rootMatch ? rootMatch[1] : qNum;
      
      if (!questionGroups.has(rootNumber)) {
        questionGroups.set(rootNumber, {
          rootNumber,
          questions: [],
        });
      }
      questionGroups.get(rootNumber)!.questions.push(idx);
    });
    
    console.log(`Question groups: ${Array.from(questionGroups.keys()).join(', ')}`);
    
    // Helper function to extract function from question text
    // Matches ANY function letter: f(x), g(x), q(x), p(x), h(x), etc.
    const extractBaseFunctionFromText = (text: string): string | null => {
      // Pattern: <letter>(x) = expression
      const fxMatch = text.match(/[a-zA-Z]\s*\(\s*x\s*\)\s*=\s*([^,.]+?)(?:[,.]|is\s+shown|\s+has|\s+where|$)/i);
      if (fxMatch) {
        return fxMatch[1].trim();
      }
      // Pattern: y = expression (not involving function notation)
      const yMatch = text.match(/y\s*=\s*([^,]+?)(?:[,.]|is\s+shown|\s+has|$)/i);
      if (yMatch && !/[a-zA-Z]\(x\)/.test(yMatch[1])) {
        return yMatch[1].trim();
      }
      return null;
    };

    // Helper: extract a polynomial formula from a textual algebraic answer
    // e.g., "q(x) = -2x^3 + 6x + 4" → "-2x^3 + 6x + 4"
    const extractFormulaFromAlgebraicAnswer = (answer: string): string | null => {
      if (!answer || typeof answer !== 'string') return null;
      // Match patterns like "q(x) = -2x^3 + 6x + 4" or "p(x) = (x+1)(x-2)(x+3)"
      const match = answer.match(/[a-zA-Z]\s*\(\s*x\s*\)\s*=\s*(.+)/i);
      if (match) return match[1].trim();
      // Match "y = expression"
      const yMatch = answer.match(/y\s*=\s*(.+)/i);
      if (yMatch) return yMatch[1].trim();
      return null;
    };
    
    // First pass: identify and store base functions from first questions in each group
    for (const [rootNum, group] of questionGroups) {
      if (group.questions.length < 2) continue; // Skip single-question groups
      
      const firstQIdx = group.questions[0];
      const firstQ = questions[firstQIdx];
      const qText = firstQ.question_text || '';
      
      // Try to extract base function from the first question
      const baseFunc = extractBaseFunctionFromText(qText);
      if (baseFunc) {
        group.baseFunction = baseFunc;
        console.log(`Group ${rootNum}: Base function = "${baseFunc}"`);
      }
      
      // If the first question has graphConfig with series, store it
      try {
        const graphData = typeof firstQ.correct_answer === 'string' 
          ? JSON.parse(firstQ.correct_answer) 
          : firstQ.correct_answer;
        
        if (graphData?.graphConfig?.series?.length > 0) {
          const series = graphData.graphConfig.series;
          if (series[0]?.data?.length >= 3) {
            group.baseCurveData = series[0].data;
            group.baseSeries = series;
            group.baseGraphConfig = graphData.graphConfig;
            group.baseDomainX = graphData.graphConfig.domainX || graphData.graphConfig.xDomain;
            group.baseDomainY = graphData.graphConfig.domainY || graphData.graphConfig.yDomain;
            console.log(`Group ${rootNum}: Captured base curve with ${series[0].data.length} points`);
          }
        }
        
        // CRITICAL: Extract and store the markingFormula from the first question
        if (graphData?.plottingAnswer?.markingFormula) {
          group.baseMarkingFormula = graphData.plottingAnswer.markingFormula;
          console.log(`Group ${rootNum}: Captured base markingFormula = "${group.baseMarkingFormula}"`);
        } else if (baseFunc) {
          const formulaFromText = extractMarkingFormula(`y = ${baseFunc}`);
          if (formulaFromText) {
            group.baseMarkingFormula = formulaFromText;
            console.log(`Group ${rootNum}: Derived markingFormula from baseFunction = "${group.baseMarkingFormula}"`);
          }
        }
      } catch (e) {
        // Ignore parse errors - base will be generated later if needed
      }
      
      // =====================================================================
      // NEW: Extract formula from ALGEBRAIC parent answers (e.g., 3a → 3b)
      // =====================================================================
      // When 3a is "find q(x) = ..." (short_answer), and 3b is "sketch q(x)",
      // the formula from 3a's correct_answer becomes the markingFormula for 3b.
      if (!group.baseMarkingFormula) {
        const firstAnswer = typeof firstQ.correct_answer === 'string' 
          ? firstQ.correct_answer 
          : JSON.stringify(firstQ.correct_answer);
        
        const algebraicFormula = extractFormulaFromAlgebraicAnswer(firstAnswer);
        if (algebraicFormula) {
          // Normalize the formula for evaluation (replace ^ with proper notation, etc.)
          const normalized = normalizeFormulaExpression(algebraicFormula);
          if (normalized) {
            group.baseMarkingFormula = normalized;
            console.log(`Group ${rootNum}: Extracted markingFormula from algebraic answer = "${normalized}"`);
            
            // Also generate curve data from this formula for the group
            const domainX: [number, number] = [-5, 5];
            const curveBranches = generateCurveFromMarkingFormula(normalized, domainX);
            if (curveBranches.length > 0 && curveBranches[0].data.length >= 3) {
              group.baseCurveData = curveBranches[0].data;
              group.baseGraphConfig = {
                chartType: 'line',
                xLabel: 'x',
                yLabel: 'y',
                domainX,
                domainY: [-10, 10],
                xDomain: domainX,
                yDomain: [-10, 10],
                grid: { show: true, stepX: 1, stepY: 1 },
                series: curveBranches.map(b => ({
                  id: b.id || 'reference',
                  label: b.label || 'y = q(x)',
                  data: b.data,
                  showLine: true,
                  lineStyle: 'solid'
                }))
              };
              group.baseDomainX = domainX;
              
              // Auto-fit Y domain from curve data
              const yVals = curveBranches.flatMap(b => b.data.map(p => p.y));
              const validY = yVals.filter(y => Math.abs(y) < 100);
              if (validY.length > 0) {
                const yPad = Math.max(2, (Math.max(...validY) - Math.min(...validY)) * 0.2);
                group.baseDomainY = [Math.floor(Math.min(...validY) - yPad), Math.ceil(Math.max(...validY) + yPad)];
                group.baseGraphConfig.domainY = group.baseDomainY;
                group.baseGraphConfig.yDomain = group.baseDomainY;
              }
              
              console.log(`Group ${rootNum}: Generated ${curveBranches[0].data.length} curve points from algebraic formula`);
            }
          }
        }
      }
    }
    
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
      
      const questionTextRaw = q.question_text || '';
      const questionText = questionTextRaw.toLowerCase();
      
      // =====================================================================
      // SUB-QUESTION GROUP DETECTION
      // =====================================================================
      // Check if this question is part of a group and should inherit base graph data
      const qNum = String(q.question_number || idx + 1);
      const rootMatch = qNum.match(/^(\d+)/);
      const rootNumber = rootMatch ? rootMatch[1] : qNum;
      const group = questionGroups.get(rootNumber);
      const isSubQuestion = group && group.questions.length > 1 && group.questions[0] !== idx;
      const isFirstInGroup = group && group.questions[0] === idx;
      
      // Check if this question references ANY function letter without defining it (depends on parent)
      // Matches: f(x+...), q(x), p(-x), 2f(x), -g(x), etc.
      const referencesFWithoutDefining = /\b[a-zA-Z]\s*\(\s*x\s*[+-]|\b[a-zA-Z]\s*\(\s*-?\s*x\s*\)|\b[0-9]+[a-zA-Z]\s*\(x\)|-[a-zA-Z]\s*\(x\)/i.test(questionTextRaw) &&
                                          !/[a-zA-Z]\s*\(\s*x\s*\)\s*=/i.test(questionTextRaw);
      
      // Check if question says "graph shows/of" or "sketch y = <letter>(x)" without defining it
      // CRITICAL FIX: Also match "y = -h(x)", "y = 2f(x)", "y = -p(x+1)" etc.
      // The regex now allows an optional sign/coefficient between "y =" and the function letter
      const mentionsUndefinedGraph = (/\b(the\s+)?(graph|diagram|curve)\s+(shows|of)\s+(y\s*=\s*)?-?\s*\d*\s*[a-zA-Z]\s*\(/i.test(questionTextRaw) ||
                                      /\b(sketch|plot|draw)\s+(the\s+)?(graph|curve)?\s*(of\s+)?y\s*=\s*-?\s*\d*\s*[a-zA-Z]\s*\(/i.test(questionTextRaw)) &&
                                     !/[a-zA-Z]\s*\(\s*x\s*\)\s*=/i.test(questionTextRaw);
      
      // *** FIX 1: "The graph shows..." pattern MUST have a graph ***
      // If question says "graph shows" or "diagram shows" but doesn't have graph_plotting type, fix it
      const hasGraphShowsPattern = /\b(the\s+)?(graph|diagram|curve|figure)\s+(shows|displays|represents|illustrates)\b/i.test(questionTextRaw);
      const hasSketchVerb = /\bsketch\b/i.test(questionText);
      const hasPlotVerb = /\bplot\b/i.test(questionText);
      const hasDrawVerb = /\bdraw\b/i.test(questionText);
      const needsGraphInput = hasSketchVerb || hasPlotVerb || hasDrawVerb;
      
      // *** FIX 2: Sketch questions MUST have graph_plotting input type ***
      if (needsGraphInput && q.question_type !== 'graph_plotting' && q.question_type !== 'graph_interpretation') {
        console.info(`Question ${q.question_number}: Converting "${q.question_type}" to graph_plotting - contains "${hasSketchVerb ? 'sketch' : hasPlotVerb ? 'plot' : 'draw'}" command`);
        q.question_type = 'graph_plotting';
        
        // Ensure we have graph data
        if (!q.correct_answer || typeof q.correct_answer === 'string' && !q.correct_answer.includes('graphConfig')) {
          q.correct_answer = null; // Will be regenerated below
        }
      }
      
      // =====================================================================
      // FORMULA-DRIVEN INHERITANCE FROM PARENT QUESTION (1a -> 1b, 1c, etc.)
      // =====================================================================
      // This ensures sub-questions inherit the EXACT mathematical context from
      // the parent question and apply transformations ALGEBRAICALLY to the formula.
      if (isSubQuestion && (referencesFWithoutDefining || mentionsUndefinedGraph)) {
        console.info(`Question ${q.question_number}: Sub-question references f(x) - checking for inherited base formula`);
        
        // Try to get base formula and curve from group
        if (group?.baseGraphConfig) {
          // Parse transformation from question text
          const transformSpec = parseTransformFromText(questionTextRaw);
          
          const hasTransform = transformSpec.shiftX !== 0 || transformSpec.shiftY !== 0 ||
                               transformSpec.scaleY !== 1 || transformSpec.scaleX !== 1 ||
                               transformSpec.reflectX || transformSpec.reflectY;
          
          logMathEngineOperation('SubQuestionTransformParsed', {
            questionNumber: q.question_number,
            rootNumber,
            baseMarkingFormula: group.baseMarkingFormula || 'none',
            parsedTransform: transformSpec,
            hasTransform
          });
          
          // =================================================================
          // CRITICAL: FORMULA-DRIVEN TRANSFORMATION (Source of Truth)
          // =================================================================
          // If we have a base markingFormula, apply the transformation ALGEBRAICALLY
          // e.g., if f(x) = (x-1)*(x-3)*(x+2) and we need f(x-2),
          // the result is ((x-2)-1)*((x-2)-3)*((x-2)+2) = (x-3)*(x-5)*x
          let transformedMarkingFormula: string | null = null;
          let transformedCurveBranches: any[] = [];
          
          if (group.baseMarkingFormula) {
            // Apply algebraic transformation to the formula
            transformedMarkingFormula = applyFormulaTransform(group.baseMarkingFormula, transformSpec);
            
            logMathEngineOperation('FormulaAlgebraicTransform', {
              questionNumber: q.question_number,
              baseFormula: group.baseMarkingFormula,
              transform: transformSpec,
              transformedFormula: transformedMarkingFormula
            });
            
            // Generate curve data from the transformed formula (mathematically accurate)
            const domainX: [number, number] = group.baseDomainX || [-6, 6];
            transformedCurveBranches = generateCurveFromMarkingFormula(transformedMarkingFormula, domainX);
            
            if (transformedCurveBranches.length > 0) {
              console.log(`Question ${q.question_number}: Generated ${transformedCurveBranches.reduce((sum, b) => sum + b.data.length, 0)} points from transformed formula`);
            }
          } else if (group.baseCurveData) {
            // Fallback: Apply coordinate transformation if no formula available
            console.warn(`Question ${q.question_number}: No baseMarkingFormula - falling back to coordinate transformation`);
            
            const transformedData = group.baseCurveData.map(pt => {
              let newX = pt.x;
              let newY = pt.y;
              
              // Horizontal transformations
              newX = pt.x + transformSpec.shiftX;
              if (transformSpec.reflectY) {
                newX = -pt.x;
              }
              
              // Vertical transformations
              newY = pt.y * transformSpec.scaleY;
              if (transformSpec.reflectX) {
                newY = -newY;
              }
              newY = newY + transformSpec.shiftY;
              
              return { 
                x: Math.round(newX * 1000) / 1000, 
                y: Math.round(newY * 1000) / 1000 
              };
            });
            
            transformedCurveBranches = [{
              id: 'expected',
              label: 'Expected',
              data: transformedData,
              showLine: true,
              lineStyle: 'dashed',
              color: '#22c55e'
            }];
          }
          
          // =================================================================
          // SHADOW GRAPH: Show parent curve as visual reference
          // =================================================================
          // The "shadow" is the original f(x) curve rendered in grey/muted
          // so students can see the transformation context without going back
          const shadowSeries = group.baseCurveData ? [{
            id: 'shadow-reference',
            label: 'y = f(x) (reference)',
            data: group.baseCurveData,
            showLine: true,
            lineStyle: 'dashed' as const,
            color: 'hsl(220 8.9% 46.1%)', // Muted grey
          }] : [];
          
          // Calculate domain - use base domain but adjust for transformation
          let domainX: [number, number] = group.baseDomainX || [-6, 6];
          let domainY: [number, number] = group.baseDomainY || [-6, 6];
          
          // Expand domain to fit both shadow and transformed curves
          if (transformSpec.shiftX !== 0) {
            const shift = transformSpec.shiftX;
            domainX = [
              Math.min(domainX[0], domainX[0] + shift) - 1,
              Math.max(domainX[1], domainX[1] + shift) + 1
            ];
          }
          
          // Adjust y domain for vertical transformations
          if (transformedCurveBranches.length > 0) {
            const allY = transformedCurveBranches.flatMap(b => b.data.map((p: any) => p.y));
            const validY = allY.filter((y: number) => Math.abs(y) < 50);
            if (validY.length > 0) {
              const minY = Math.min(...validY);
              const maxY = Math.max(...validY);
              const yPad = Math.max(2, (maxY - minY) * 0.2);
              domainY = [Math.floor(minY - yPad), Math.ceil(maxY + yPad)];
            }
          }
          
          // Build the graph config with shadow reference
          const inheritedGraphConfig = {
            ...group.baseGraphConfig,
            domainX,
            domainY,
            xDomain: domainX,
            yDomain: domainY,
            // Include shadow curve as the only visible series during answering
            series: shadowSeries,
            // Flag that this uses inherited data
            isInheritedFromParent: true,
            parentQuestionId: `${rootNumber}a`,
          };
          
          // Build the expected curve for marking
          const expectedCurve = transformedCurveBranches.length > 1
            ? transformedCurveBranches
            : transformedCurveBranches[0] || {
                id: 'expected',
                label: 'Expected',
                data: [],
                showLine: true,
                lineStyle: 'dashed',
                color: '#22c55e'
              };
          
          // Build plottingAnswer with formula-driven curve
          const graphData = {
            graphType: 'plotting',
            graphConfig: inheritedGraphConfig,
            plottingAnswer: {
              // THE FORMULA IS THE PRIMARY SOURCE OF TRUTH
              markingFormula: transformedMarkingFormula,
              baseFormula: group.baseMarkingFormula || null,
              appliedTransform: hasTransform ? transformSpec : null,
              
              // Use key points from transformed curve for grading
              expectedPoints: transformedCurveBranches.length > 0
                ? transformedCurveBranches[0].data.filter((_: any, i: number) => i % 20 === 0).slice(0, 5)
                : [],
              toleranceUnits: 0.5,
              marksPerPoint: Math.max(1, Math.floor(q.marks / 3)),
              expectedCurve,
              
              // Store shadow curve reference for client rendering
              shadowCurve: group.baseCurveData ? {
                id: 'shadow',
                label: 'y = f(x)',
                data: group.baseCurveData,
                showLine: true,
                lineStyle: 'dashed',
                color: 'hsl(220 8.9% 46.1%)',
              } : null,
            }
          };
          
          q.correct_answer = graphData;
          console.info(`Question ${q.question_number}: Inherited base graph from Q${rootNumber}a and applied transformation`);
        }
      }
      
      // Store base graph data for first question in group (for later sub-questions to inherit)
      if (isFirstInGroup && group && !group.baseCurveData) {
        // Will be populated after graph generation below
      }
      
      // =====================================================================
      // FIX 3: "The graph shows g(x)" with UNDEFINED g(x) - must generate fallback
      // =====================================================================
      // If question says "graph shows y = g(x)" but g(x) is never defined, generate a fallback
      if (mentionsUndefinedGraph && !isSubQuestion) {
        console.warn(`Question ${q.question_number}: References undefined g(x) - generating fallback curve`);
        
        // Generate a sensible fallback function (quadratic or cubic)
        // Use different functions based on question number to add variety
        const functionVariants = [
          { fn: { type: 'quadratic' as const, a: 1, b: 0, c: -4 }, label: 'g(x) = x² - 4' },
          { fn: { type: 'factored_cubic' as const, roots: [0, -2, 2] }, label: 'g(x) = x(x+2)(x-2)' },
          { fn: { type: 'quadratic' as const, a: -1, b: 2, c: 3 }, label: 'g(x) = -x² + 2x + 3' },
          { fn: { type: 'polynomial' as const, coefficients: [0, 1, 0, 1] }, label: 'g(x) = x + x³' },
        ];
        
        const variant = functionVariants[idx % functionVariants.length];
        const fallbackDomain: [number, number] = [-5, 5];
        const fallbackBranches = generateCurveData(variant.fn, fallbackDomain, IDENTITY_TRANSFORM);
        
        if (fallbackBranches.length > 0 && fallbackBranches[0].data.length > 0) {
          // Calculate y domain from generated data
          const yValues = fallbackBranches[0].data.map(p => p.y);
          const minY = Math.min(...yValues);
          const maxY = Math.max(...yValues);
          const yPad = Math.max(2, (maxY - minY) * 0.2);
          const domainY: [number, number] = [Math.floor(minY - yPad), Math.ceil(maxY + yPad)];
          
          const fallbackGraphData = {
            graphType: 'plotting',
            graphConfig: {
              chartType: 'line',
              xLabel: 'x',
              yLabel: 'y',
              domainX: fallbackDomain,
              domainY: domainY,
              xDomain: fallbackDomain,
              yDomain: domainY,
              grid: { show: true, stepX: 1, stepY: 1 },
              series: [{
                id: 'gx',
                label: variant.label,
                data: fallbackBranches[0].data,
                showLine: true,
                lineStyle: 'solid',
                color: 'hsl(var(--primary))'
              }]
            },
            plottingAnswer: {
              expectedPoints: fallbackBranches[0].data.filter((p, i) => i % 15 === 0).slice(0, 3),
              toleranceUnits: 0.5,
              marksPerPoint: Math.max(1, Math.floor(q.marks / 2)),
              expectedCurve: {
                id: 'expected',
                label: 'Expected',
                data: fallbackBranches[0].data,
                showLine: true,
                lineStyle: 'dashed',
                color: '#22c55e'
              }
            }
          };
          
          q.correct_answer = fallbackGraphData;
          q.question_type = 'graph_plotting';
          
          // Store as base for any sub-questions
          if (group && isFirstInGroup) {
            group.baseFunction = variant.label;
            group.baseCurveData = fallbackBranches[0].data;
            group.baseDomainX = fallbackDomain;
            group.baseDomainY = domainY;
            group.baseSeries = fallbackGraphData.graphConfig.series;
            group.baseGraphConfig = fallbackGraphData.graphConfig;
          }
          
          console.info(`Question ${q.question_number}: Generated fallback g(x) curve with ${fallbackBranches[0].data.length} points`);
        }
      }
      
      // *** FIX 3b: "The graph shows..." MUST include visible graph data ***
      if (hasGraphShowsPattern && q.question_type !== 'graph_plotting' && q.question_type !== 'graph_interpretation') {
        console.info(`Question ${q.question_number}: Converting to graph_plotting - says "graph shows" but was ${q.question_type}`);
        q.question_type = needsGraphInput ? 'graph_plotting' : 'graph_interpretation';
        q.correct_answer = null; // Force regeneration
      }
      
      // *** CRITICAL: COMMAND VERB DETECTION - Convert graph questions to short_answer when appropriate ***
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
      else if (isGraphType && !needsGraphInput && !hasGraphShowsPattern) {
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
          
          // NEW: For non-math subjects, expectedPath IS the valid data — skip math engine entirely
          if (!isMathSubject && graphData?.plottingAnswer?.expectedPath?.length >= 2) {
            hasValidData = true;
            console.info(`Q${q.question_number}: expectedPath has ${graphData.plottingAnswer.expectedPath.length} vertices — skipping math curve generation`);
          }
          
          if (!hasValidData) {
            const series = graphData?.graphConfig?.series;
            if (Array.isArray(series) && series.length > 0) {
              const firstSeries = series[0];
              if (Array.isArray(firstSeries?.data) && firstSeries.data.length >= 3) {
                hasValidData = true;
              }
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
          
          // NEW: For economics/science, detect linear equations and generate correct data
          if (extractedPoints.length === 0) {
            const linearEqs = parseLinearEquations(qText);
            if (linearEqs.length > 0) {
              console.info(`Question ${q.question_number}: Detected ${linearEqs.length} linear equation(s) — generating coordinates from equations`);
              hasValidData = true; // Mark as valid so fallback doesn't overwrite
              
              const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b'];
              const generatedSeries: any[] = [];
              
              for (let eqIdx = 0; eqIdx < linearEqs.length; eqIdx++) {
                const eq = linearEqs[eqIdx];
                const xIntercept = eq.slope !== 0 ? Math.abs(eq.intercept / eq.slope) : 50;
                const maxX = Math.ceil(xIntercept * 1.1 / 5) * 5;
                const points: Array<{x: number; y: number}> = [];
                const numPts = 6;
                for (let i = 0; i < numPts; i++) {
                  const x = Math.round((i * maxX / (numPts - 1)) * 100) / 100;
                  const y = Math.round((eq.intercept + eq.slope * x) * 100) / 100;
                  if (y >= 0) points.push({ x, y });
                }
                generatedSeries.push({
                  id: eq.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                  label: eq.label,
                  data: points,
                  showLine: true,
                  color: colors[eqIdx % colors.length]
                });
              }
              
              // Build the correct graphConfig with proper axis scaling
              const allYs = generatedSeries.flatMap((s: any) => s.data.map((p: any) => p.y));
              const allXs = generatedSeries.flatMap((s: any) => s.data.map((p: any) => p.x));
              const maxY = Math.ceil(Math.max(...allYs) * 1.1 / 10) * 10;
              const maxXVal = Math.ceil(Math.max(...allXs) * 1.1 / 5) * 5;
              
              try {
                const existingGraphData = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer;
                if (existingGraphData && existingGraphData.graphConfig) {
                  existingGraphData.graphConfig.series = generatedSeries;
                  existingGraphData.graphConfig.xDomain = [0, maxXVal];
                  existingGraphData.graphConfig.yDomain = [0, maxY];
                  existingGraphData.graphConfig.domainX = [0, maxXVal];
                  existingGraphData.graphConfig.domainY = [0, maxY];
                  existingGraphData.graphConfig.xLabel = existingGraphData.graphConfig.xLabel || 'Quantity (Q)';
                  existingGraphData.graphConfig.yLabel = existingGraphData.graphConfig.yLabel || 'Price (P)';
                  q.correct_answer = JSON.stringify(existingGraphData);
                }
              } catch {
                // If we can't parse existing, build fresh
                const freshData = {
                  graphType: 'interpretation',
                  graphConfig: {
                    chartType: 'line',
                    xLabel: 'Quantity (Q)',
                    yLabel: 'Price (P)',
                    xDomain: [0, maxXVal],
                    yDomain: [0, maxY],
                    domainX: [0, maxXVal],
                    domainY: [0, maxY],
                    series: generatedSeries,
                    grid: { show: true, stepX: Math.ceil(maxXVal / 10), stepY: Math.ceil(maxY / 10) }
                  },
                  interpretationFields: [{ id: 'answer', type: 'text', question: 'Enter your answer based on the graph', correctAnswer: '', marks: 2 }]
                };
                q.correct_answer = JSON.stringify(freshData);
              }
            }
          }
          
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
          
          // Track if this is a discontinuous function requiring multiple branches
          let isDiscontinuous = false;
          let curveBranches: Array<Array<{x: number, y: number}>> = [];
          
          // ========== MATH ENGINE INTEGRATION ==========
          // Use the centralized math engine for function parsing and curve generation
          
          // Parse function type from question text
          const parsedFunction = parseFunctionFromText(qText);
          const parsedTransform = parseTransformFromText(qText);
          
          // Detect if this is a "sketch" question (student should get empty grid)
          const isSketchQuestion = /\bsketch\b/i.test(qText);
          
          logMathEngineOperation('ParsedQuestion', {
            questionNumber: q.question_number,
            parsedFunction: parsedFunction?.type || 'null',
            transform: parsedTransform,
            isSketch: isSketchQuestion
          });
          
          if (parsedFunction) {
            // Check if function is reasonable to sketch first
            const initialDomain: [number, number] = [-6, 6];
            const sketchability = isSketchable(parsedFunction, initialDomain);
            
            if (!sketchability.sketchable) {
              logMathEngineOperation('ComplexFunctionDowngrade', {
                questionNumber: q.question_number,
                reason: sketchability.reason
              });
              // Downgrade to feature-based question
              q.question_type = 'short_answer';
              q.correct_answer = {
                textAnswer: 'Identify key features: asymptotes, intercepts, and behaviour.',
                alternatives: []
              };
              hasValidData = true;
            } else {
              // Extract key features first
              const features = extractKeyFeatures(parsedFunction, initialDomain);
              
              // *** FIX: Use student-friendly domain calculation ***
              const friendlyDomain = calculateStudentFriendlyDomain(parsedFunction, features);
              const domainX = friendlyDomain.x;
              const domainY = friendlyDomain.y;
              const stepX = friendlyDomain.stepX;
              const stepY = friendlyDomain.stepY;
              
              logMathEngineOperation('DomainCalculated', {
                questionNumber: q.question_number,
                domainX,
                domainY,
                stepX,
                stepY,
                keyFeatures: features
              });
              
              // Generate base curve using math engine with correct domain
              const baseBranches = generateCurveData(parsedFunction, domainX, IDENTITY_TRANSFORM);
              
              // Generate transformed curve if transform is not identity
              const hasTransform = parsedTransform.shiftX !== 0 || parsedTransform.shiftY !== 0 ||
                                   parsedTransform.scaleY !== 1 || parsedTransform.scaleX !== 1 ||
                                   parsedTransform.reflectX || parsedTransform.reflectY;
              
              const transformedBranches = hasTransform 
                ? applyTransform(baseBranches, parsedTransform)
                : baseBranches.map(b => ({ ...b, id: `expected-${b.id}`, label: 'Expected', lineStyle: 'dashed' as const, color: '#22c55e' }));
              
              logMathEngineOperation('CurveGenerated', {
                questionNumber: q.question_number,
                baseBranches: baseBranches.length,
                transformedBranches: transformedBranches.length,
                domain: { x: domainX, y: domainY },
                features
              });
              
              // Build graphConfig with student-friendly grid
              const graphConfig = {
                chartType: 'line' as const,
                xLabel: 'x',
                yLabel: 'y',
                xDomain: domainX,
                yDomain: domainY,
                domainX: domainX,
                domainY: domainY,
                grid: { show: true, stepX, stepY },
                series: baseBranches.map((b, idx) => ({
                  ...b,
                  color: 'hsl(var(--primary))',
                  label: idx === 0 ? 'y = f(x)' : ''
                })),
                isSketchMode: isSketchQuestion,
              // Store key features for marking
              keyFeatures: features,
            };
            
            // Transform key features if transformation was detected
            // This ensures expectedPoints match the TRANSFORMED curve, not the base function
            const transformedFeatures = hasTransform 
              ? transformKeyFeatures(features, parsedTransform)
              : features;
            
            // ========== FORMULA-DRIVEN SOURCE OF TRUTH ==========
            // Extract markingFormula from question text for mathematically accurate rendering
            const rawMarkingFormula = extractMarkingFormula(qText);
            let markingFormula = rawMarkingFormula;
            
            // If we have a transform, apply it to the formula algebraically
            if (markingFormula && hasTransform) {
              markingFormula = applyFormulaTransform(markingFormula, parsedTransform);
              logMathEngineOperation('FormulaTransformed', {
                questionNumber: q.question_number,
                baseFormula: rawMarkingFormula,
                transform: parsedTransform,
                transformedFormula: markingFormula
              });
            }
            
            // If we have a markingFormula, use it to generate curve data (more reliable than struct-based)
            let formulaDerivedCurve = transformedBranches;
            if (markingFormula) {
              const formulaCurve = generateCurveFromMarkingFormula(markingFormula, domainX);
              if (formulaCurve.length > 0 && formulaCurve[0].data.length >= 10) {
                formulaDerivedCurve = formulaCurve;
                logMathEngineOperation('CurveFromFormula', {
                  questionNumber: q.question_number,
                  markingFormula,
                  pointCount: formulaCurve.reduce((sum, b) => sum + b.data.length, 0),
                  branches: formulaCurve.length
                });
              }
            }
            
            logMathEngineOperation('FeatureTransformation', {
              questionNumber: q.question_number,
              hasTransform,
              markingFormula: markingFormula || 'none',
              baseFeatures: features,
              transformedFeatures: hasTransform ? transformedFeatures : 'no transform applied',
              appliedTransform: hasTransform ? parsedTransform : null
            });
            
            // Build plottingAnswer with TRANSFORMED expectedPoints for correct marking
            // AND the markingFormula for deterministic curve rendering
            const plottingAnswer = {
              // *** THE FORMULA-DRIVEN SOURCE OF TRUTH ***
              // This formula can be evaluated to generate the "correct answer" curve
              markingFormula: markingFormula || null,
              formulaType: parsedFunction?.type || 'unknown',
              
              // Use transformed features for marking - these are the coordinates
              // where the student should plot turning points, etc.
              expectedPoints: transformedFeatures.turningPoints
                .map(tp => ({ x: tp.x, y: tp.y }))
                .concat(
                  // Only include x-intercepts if no vertical shift (otherwise they're at different y values)
                  parsedTransform.shiftY === 0 
                    ? transformedFeatures.intercepts.x.map(xi => ({ x: xi, y: 0 }))
                    : []
                )
                .slice(0, 5),
              toleranceUnits: 0.5,
              marksPerPoint: Math.max(1, Math.floor(q.marks / 3)),
              // expectedCurve: now computed from markingFormula when available
              expectedCurve: formulaDerivedCurve.length > 1 
                ? formulaDerivedCurve 
                : formulaDerivedCurve[0] || { id: 'expected', label: 'Expected', data: [], showLine: true, lineStyle: 'dashed', color: '#22c55e' },
              // Store marking tolerances
              markingTolerance: {
                intercepts: 1.0,
                turningPoints: 1.5,
                asymptoteAvoidance: 0.3
              },
              // Use TRANSFORMED asymptotes for marking
              asymptotes: transformedFeatures.asymptotes.vertical,
              // Store transformation metadata for marking verification
              appliedTransform: hasTransform ? parsedTransform : null,
              // Keep original base features and formula for reference
              baseFeatures: features,
              baseFormula: rawMarkingFormula || null
            };
            
            // ========== VALIDATION STEP ==========
            // Verify that the expectedCurve data matches the transformation
            // This catches any mismatch between question text and stored answer data
            
            // Sample a point from the expected curve to validate
            const curveData = transformedBranches[0]?.data;
            if (curveData && curveData.length > 0 && transformedFeatures.turningPoints.length > 0) {
              // Check if a turning point in transformed features matches a point on the curve
              const tp = transformedFeatures.turningPoints[0];
              const nearestPoint = curveData.reduce((prev, curr) => 
                Math.abs(curr.x - tp.x) < Math.abs(prev.x - tp.x) ? curr : prev
              );
              
              const yDiff = Math.abs(nearestPoint.y - tp.y);
              
              if (yDiff > 1.0) {
                // Mismatch detected! The curve data doesn't match transformed features
                // Re-apply transformation to ensure consistency
                logMathEngineOperation('TransformationMismatchDetected', {
                  questionNumber: q.question_number,
                  expectedTurningPoint: tp,
                  nearestCurvePoint: nearestPoint,
                  yDiff,
                  action: 'Re-applying transformation to ensure data consistency'
                });
                
                // Force recalculate using applyTransform
                const correctedBranches = applyTransform(baseBranches, parsedTransform);
                plottingAnswer.expectedCurve = correctedBranches.length > 1 
                  ? correctedBranches 
                  : correctedBranches[0] || plottingAnswer.expectedCurve;
              }
            }
            
            // Log final validated state
            logMathEngineOperation('ValidationComplete', {
              questionNumber: q.question_number,
              functionType: parsedFunction?.type || 'unknown',
              hasTransform,
              transformApplied: hasTransform ? parsedTransform : null,
              expectedPointsCount: plottingAnswer.expectedPoints?.length || 0,
              expectedCurvePoints: Array.isArray(plottingAnswer.expectedCurve) 
                ? plottingAnswer.expectedCurve.reduce((sum, b) => sum + (b.data?.length || 0), 0)
                : plottingAnswer.expectedCurve?.data?.length || 0
            });
            
            // ========== AUDIT V5 FIX #2: SECRET MARKING FORMULA ==========
            // If no explicit markingFormula but question describes features,
            // reverse-engineer a formula from the described turning points/intercepts
            if (!plottingAnswer.markingFormula) {
              const secretResult = generateSecretMarkingFormula(qText);
              
              if (secretResult.formula) {
                plottingAnswer.markingFormula = secretResult.formula;
                (plottingAnswer as any)._isSecretFormula = true;
                
                // Regenerate expectedCurve from secret formula
                const secretCurve = generateCurveFromMarkingFormula(secretResult.formula, domainX);
                if (secretCurve.length > 0 && secretCurve[0].data.length >= 10) {
                  plottingAnswer.expectedCurve = secretCurve.length > 1 
                    ? secretCurve 
                    : secretCurve[0];
                }
                
                logMathEngineOperation('SecretFormulaApplied', {
                  questionNumber: q.question_number,
                  features: secretResult.features,
                  secretFormula: secretResult.formula,
                  curvePointCount: secretCurve.reduce((sum, b) => sum + b.data.length, 0)
                });
              }
            }
            
            // ========== AUDIT V5 FIX #3: ASYMPTOTE VALIDATION ==========
            // For questions mentioning asymptotes, validate the formula has correct behavior
            const hasAsymptoteMention = /asymptote|1\/|reciprocal|undefined\s*at/i.test(qText);
            if (hasAsymptoteMention && plottingAnswer.markingFormula) {
              const asymptoteValidation = validateAsymptoteQuestion(qText, plottingAnswer.markingFormula);
              
              logMathEngineOperation('AsymptoteValidationResult', {
                questionNumber: q.question_number,
                valid: asymptoteValidation.valid,
                reason: asymptoteValidation.reason,
                plotPointCount: asymptoteValidation.plotPointCount,
                expectedAsymptotes: asymptoteValidation.expectedAsymptotes,
                actualAsymptotes: asymptoteValidation.actualAsymptotes
              });
              
              // If invalid, flag for potential re-generation
              if (!asymptoteValidation.valid) {
                console.warn(`Question ${q.question_number}: Asymptote validation failed - ${asymptoteValidation.reason}`);
                (plottingAnswer as any)._asymptoteValidationFailed = true;
                (plottingAnswer as any)._asymptoteValidationReason = asymptoteValidation.reason;
                
                // If we have too few points, the curve won't render properly
                if (asymptoteValidation.plotPointCount < 50) {
                  // Try to create a basic reciprocal function
                  const asymptotes = asymptoteValidation.expectedAsymptotes;
                  if (asymptotes.length > 0) {
                    const newFormula = `1/(x-${asymptotes[0]})`;
                    const newCurve = generateCurveFromMarkingFormula(newFormula, domainX);
                    if (newCurve.length > 0 && newCurve[0].data.length >= 50) {
                      plottingAnswer.markingFormula = newFormula;
                      plottingAnswer.expectedCurve = newCurve.length > 1 ? newCurve : newCurve[0];
                      console.log(`Question ${q.question_number}: Auto-corrected to basic reciprocal: ${newFormula}`);
                    }
                  }
                }
              }
            }
              
              graphData = {
                graphType: 'plotting',
                graphConfig,
                plottingAnswer
              };
              
              q.correct_answer = graphData;
              hasValidData = true;
            }
          } else {
            // Fallback to legacy parsing if math engine couldn't parse
            // Extract key points mentioned in question
            const pointMatches = qText.matchAll(/\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/g);
            const extractedPoints: Array<{x: number, y: number}> = [];
            for (const match of pointMatches) {
              extractedPoints.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
            }
            
            if (extractedPoints.length >= 3) {
              // Use Lagrange interpolation through key points
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
              
              if (baseCurveData.length >= 10) {
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
                    }],
                    isSketchMode: /\bsketch\b/i.test(qText),
                  },
                  plottingAnswer: {
                    expectedPoints: extractedPoints.slice(0, 5),
                    toleranceUnits: 0.5,
                    marksPerPoint: Math.max(1, Math.floor(q.marks / 3)),
                    expectedCurve: {
                      id: 'expected',
                      label: 'Expected',
                      data: baseCurveData,
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
          }
        }
        
        // If still no valid data after generation attempt, try one more time with fallback
        if (!hasValidData) {
          const qText = q.question_text || '';
          const hasSketchCommand = /\bsketch\b/i.test(qText);
          const hasPlotCommand = /\bplot\b/i.test(qText);
          const hasDrawCommand = /\bdraw\b/i.test(qText);
          const hasGraphShowsPhrase = /\b(the\s+)?(graph|diagram|curve)\s+(shows|displays|represents)\b/i.test(qText);
          
          // CRITICAL: If question uses sketch/plot/draw, NEVER downgrade to extended
          // Instead, generate a minimal fallback graph
          if (hasSketchCommand || hasPlotCommand || hasDrawCommand || hasGraphShowsPhrase) {
            console.warn(`Question ${q.question_number}: Using fallback graph for sketch/plot question`);
            
            // Use the fallback generator from graph-validator
            const fallbackSpec = generateFallbackGraphSpec(q.question_type, qText);
            
            if (fallbackSpec) {
              q.correct_answer = fallbackSpec;
              hasValidData = true;
              console.info(`Question ${q.question_number}: Applied fallback graphSpec for sketch question`);
            } else {
              // Absolute last resort - create minimal empty grid for sketching
              q.correct_answer = {
                graphType: 'plotting',
                graphConfig: {
                  chartType: 'line',
                  xLabel: 'x',
                  yLabel: 'y',
                  xDomain: [-6, 6],
                  yDomain: [-6, 6],
                  domainX: [-6, 6],
                  domainY: [-6, 6],
                  grid: { show: true, stepX: 1, stepY: 1 },
                  series: [],  // Empty - student will sketch
                  isSketchMode: true,
                },
                plottingAnswer: {
                  expectedPoints: [],
                  toleranceUnits: 1.0,
                  marksPerPoint: 1,
                }
              };
              hasValidData = true;
              console.info(`Question ${q.question_number}: Created minimal empty grid for sketching`);
            }
          } else {
            // Only downgrade non-sketch questions that genuinely can't render
            console.warn(`Question ${q.question_number}: Could not generate curve data, downgrading to extended`);
            q.question_type = 'extended';
            q.correct_answer = 'This question requires graphical analysis. Show your working.';
          }
        }
        }
        
        // ========== TRANSFORMATION RECOVERY POST-PROCESSING ==========
        // Detect graph questions where the AI generated an expectedCurve identical to the
        // reference series, despite the question asking for a transformation (e.g., f(x-2), -f(x)).
        // Apply coordinate transformation to fix the expectedCurve.
        if (q.question_type === 'graph_plotting') {
          try {
            const gd = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer;
            const refSeries = gd?.graphConfig?.series;
            const expCurve = gd?.plottingAnswer?.expectedCurve;
            const existingFormula = gd?.plottingAnswer?.markingFormula;
            const qText = q.question_text || '';
            
            // Only run if: no markingFormula, has reference, has expectedCurve, question mentions transform
            if (!existingFormula && refSeries?.length > 0 && expCurve) {
              const refData = refSeries[0]?.data;
              const expData = Array.isArray(expCurve) ? expCurve[0]?.data : expCurve?.data;
              
              if (refData?.length >= 5 && expData?.length >= 5) {
                // Compare first 5 points to detect identical (untransformed) data
                const isIdentical = refData.slice(0, 5).every((pt: any, i: number) =>
                  expData[i] && Math.abs(pt.x - expData[i].x) < 0.05 && Math.abs(pt.y - expData[i].y) < 0.05
                );
                
                if (isIdentical) {
                  // Parse transformation from question text
                  const parsedTransform = parseTransformFromText(qText);
                  const hasTransform = parsedTransform.shiftX !== 0 || parsedTransform.shiftY !== 0 ||
                                       parsedTransform.scaleY !== 1 || parsedTransform.reflectX || parsedTransform.reflectY;
                  
                  if (hasTransform) {
                    console.log(`Question ${q.question_number}: TRANSFORM RECOVERY - expectedCurve identical to reference, applying:`, parsedTransform);
                    
                    // Apply coordinate transformation to reference data
                    const transformedData = refData.map((pt: any) => {
                      let x = pt.x + parsedTransform.shiftX;
                      let y = pt.y;
                      if (parsedTransform.reflectY) x = -pt.x;
                      y *= parsedTransform.scaleY;
                      if (parsedTransform.reflectX) y = -y;
                      y += parsedTransform.shiftY;
                      return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
                    });
                    
                    const fixedCurve = {
                      id: 'expected',
                      label: 'Expected',
                      data: transformedData,
                      showLine: true,
                      lineStyle: 'dashed',
                      color: '#22c55e'
                    };
                    
                    if (gd.plottingAnswer) {
                      gd.plottingAnswer.expectedCurve = fixedCurve;
                      gd.plottingAnswer.appliedTransform = parsedTransform;
                      gd.plottingAnswer._transformRecovered = true;
                    }
                    
                    q.correct_answer = gd;
                    console.log(`Question ${q.question_number}: TRANSFORM RECOVERY complete - ${transformedData.length} points transformed`);
                  }
                }
              }
            }
          } catch (e) {
            // Non-critical - skip recovery
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
      
      // ========== PRE-STORAGE ASSERTION: markingFormula must be a real expression ==========
      // If markingFormula is a bare function reference like "f(x)" or "g(x)", it cannot
      // be evaluated. Log a warning and null it out so the frontend falls back to expectedCurve.
      if (q.question_type === 'graph_plotting') {
        try {
          const gd = typeof q.correct_answer === 'string' ? JSON.parse(q.correct_answer) : q.correct_answer;
          if (gd?.plottingAnswer?.markingFormula) {
            const mf = String(gd.plottingAnswer.markingFormula).trim();
            const isBareRef = /^[a-zA-Z]\(x\)$/.test(mf);
            if (isBareRef) {
              console.error(`Question ${q.question_number}: PRE-STORAGE ASSERTION FAILED — markingFormula is bare reference "${mf}", nulling out`);
              gd.plottingAnswer.markingFormula = null;
              q.correct_answer = gd;
            }
          }
          // FINAL SAFETY NET: Strip markingFormula for non-math subjects no matter what
          if (!isMathSubject && gd?.plottingAnswer?.markingFormula) {
            console.warn(`Q${q.question_number}: FINAL SAFETY NET — stripping markingFormula for non-math subject`);
            gd.plottingAnswer.markingFormula = null;
            q.correct_answer = gd;
          }
        } catch { /* non-critical */ }
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
      
      // Parse question_number to extract the integer part for sorting
      // Examples: "1" -> 1, "2a" -> 2, "10b" -> 10, "3c" -> 3
      const numMatch = q.question_number.match(/^(\d+)/);
      const questionNumberInt = numMatch ? parseInt(numMatch[1], 10) : null;
      
      // CRITICAL FIX: For graph_plotting and graph_interpretation questions,
      // the graph data is stored in correct_answer but the frontend reads from options.
      // Copy graph data to options field for these question types.
      let options = q.options || null;
      if ((q.question_type === 'graph_plotting' || q.question_type === 'graph_interpretation') && 
          typeof q.correct_answer === 'object' && q.correct_answer !== null) {
        // The correct_answer contains the graphConfig and plottingAnswer - copy to options
        options = q.correct_answer;
        console.log(`Question ${q.question_number}: Copied graph data to options field`);
      }
      
      return {
        set_id: setId,
        question_number: q.question_number,
        question_number_int: questionNumberInt,
        question_text: q.question_text,
        question_latex: q.question_latex || null,
        question_type: q.question_type,
        marks: q.marks,
        subtopic: q.subtopic,
        difficulty_level: q.difficulty_level,
        has_math: q.has_math || false,
        equation_complexity: q.equation_complexity || null,
        correct_answer: correctAnswer,
        options: options,
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

  } catch (error: any) {
    console.error('Error generating practice questions:', error);
    
    // Update set status to failed
    await supabaseClient
      .from('practice_question_sets')
      .update({
        extraction_status: 'failed',
        extraction_error: error.message,
      })
      .eq('id', setId);
  }
}

// Main request handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const userId = claimsData.claims.sub as string;
    console.log('Authenticated user:', userId);

    // Parse request body
    const body = await req.json();
    const setId = body.setId;

    if (!setId) {
      return new Response(
        JSON.stringify({ error: 'Set ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Generating practice questions for set:', setId);

    // Use service role key for server-side operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get practice set details
    const { data: setData, error: setError } = await supabaseClient
      .from('practice_question_sets')
      .select('*')
      .eq('id', setId)
      .maybeSingle();

    if (setError) {
      throw setError;
    }
    if (!setData) {
      return new Response(
        JSON.stringify({ error: `Practice set not found: ${setId}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verify the user owns this practice set
    if (setData.user_id !== userId) {
      console.error('User does not own this practice set:', { userId, setUserId: setData.user_id });
      return new Response(
        JSON.stringify({ error: 'You do not have permission to generate this practice set.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Update status to extracting immediately
    await supabaseClient
      .from('practice_question_sets')
      .update({ extraction_status: 'extracting' })
      .eq('id', setId);

    // Start background generation using EdgeRuntime.waitUntil
    // This ensures the work completes even after the response is sent
    (globalThis as any).EdgeRuntime?.waitUntil(
      generateQuestionsInBackground(setId, userId, setData)
    );

    // Return immediate response - client will poll for status
    console.log('Background generation started for set:', setId);
    return new Response(
      JSON.stringify({ 
        success: true, 
        status: 'started',
        message: 'Generation started. Poll for status updates.',
        setId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error starting practice question generation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
