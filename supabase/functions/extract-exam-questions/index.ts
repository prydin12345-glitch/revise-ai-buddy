import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.2.1";

declare const EdgeRuntime: { waitUntil(promise: Promise<any>): void };

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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { draftId } = await req.json();
    if (!draftId) {
      return new Response(JSON.stringify({ error: 'Draft ID required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Extracting questions for exam:', draftId);

    await supabase.from('exams').update({ extraction_status: 'extracting' }).eq('id', draftId);

    EdgeRuntime.waitUntil(
      processExamExtraction(draftId, user.id, supabase, lovableApiKey)
        .catch(async (error) => {
          console.error('Background processing error:', error);
          await supabase.from('exams').update({ 
            extraction_status: 'failed',
            extraction_error: error instanceof Error ? error.message : 'Unknown error'
          }).eq('id', draftId);
        })
    );

    return new Response(JSON.stringify({ status: 'processing', message: 'Question extraction started' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in extract-exam-questions:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processExamExtraction(draftId: string, userId: string, supabase: any, lovableApiKey: string) {
  console.log('Starting background extraction for:', draftId);

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*, exam_format(*), exam_specifications(*)')
    .eq('id', draftId)
    .eq('user_id', userId)
    .single();

  if (examError || !exam) throw new Error('Exam not found');

  const examBoard = exam.exam_board || 'generic';
  const qualificationLevel = exam.qualification_level || 'not specified';
  const specTopics = exam.exam_specifications || [];
  const useOriginalStructure = exam.exam_format?.[0]?.use_original_structure ?? true;

  // Load resource pack if exists
  let resourcePackContext = '';
  let hasResourcePack = false;
  
  if (exam.resource_pack_id) {
    const packResult = await loadResourcePack(exam.resource_pack_id, supabase, lovableApiKey, exam);
    resourcePackContext = packResult.context;
    hasResourcePack = packResult.hasResourcePack;
  }

  // Download and extract PDF text (optional reference file)
  const pdfText = exam.file_url ? await extractPdfText(exam.file_url, supabase) : '';
  if (!exam.file_url) {
    console.log('No reference file found; generating from selected profile/topics and settings');
  }
  const useFallbackMode = pdfText.length < 100;

  // Determine desired question count from exam_format
  const formatData = exam.exam_format?.[0];
  const desiredQuestionCount = formatData?.use_original_structure === false
    ? (formatData.mcq_count || 0) + (formatData.short_answer_count || 0) + (formatData.long_form_count || 0)
    : null; // null = let AI decide based on PDF

  // Resolve stealth archetype for difficulty calibration
  const archetype = resolveStealthArchetype(qualificationLevel, exam.subject_id || '');
  console.log('Stealth archetype resolved:', archetype.name);

  // Build prompt and call AI - ALWAYS generate NEW questions (never copy verbatim)
  const extractionPrompt = buildPrompt(exam, pdfText, resourcePackContext, specTopics, examBoard, qualificationLevel, false, useFallbackMode, desiredQuestionCount, archetype);
  const systemPrompt = hasResourcePack
    ? 'You are an expert exam generator producing professional-standard assessment papers. Create COMPLETELY NEW and ORIGINAL questions based on the source content. Use the sources for context/themes but generate fresh question wording. DO NOT copy questions from the PDF. Return valid JSON.'
    : 'You are an expert exam generator producing professional-standard assessment papers. Create COMPLETELY NEW and ORIGINAL questions inspired by the content. DO NOT copy questions verbatim. Return valid JSON.';

  const parsedData = await callAI(lovableApiKey, systemPrompt, extractionPrompt, hasResourcePack);
  
  if (!parsedData.questions?.length) {
    await supabase.from('exams').update({ extraction_status: 'failed', extraction_error: 'No questions found' }).eq('id', draftId);
    throw new Error('No questions found');
  }

  // Sort and insert questions
  const questions = parsedData.questions.sort((a: any, b: any) => 
    normalizeQNum(a.question_number).localeCompare(normalizeQNum(b.question_number))
  );

  await supabase.from('exam_question_drafts').delete().eq('exam_id', draftId);
  
  const drafts = questions.map((q: any, i: number) => {
    const qType = q.question_type || 'short_answer';
    let correctAnswer = q.correct_answer;
    let options = q.options || null;
    
    // For graph questions, correct_answer is a JSON object — stringify for storage and copy to options
    if ((qType === 'graph_plotting' || qType === 'graph_interpretation') && typeof correctAnswer === 'object' && correctAnswer !== null) {
      options = correctAnswer;
      correctAnswer = JSON.stringify(correctAnswer);
      console.log(`Q${q.question_number}: Graph question detected, synced to options`);
    } else if (qType === 'mcq') {
      correctAnswer = correctAnswer || 'A';
    }

    // Handle chart_data (box plots, histograms) — store in options for frontend rendering
    if (q.chart_data && typeof q.chart_data === 'object') {
      options = q.chart_data;
      console.log(`Q${q.question_number}: Chart data detected (${q.chart_data.type}), stored in options`);
    }

    return {
      exam_id: draftId,
      question_number: String(q.question_number || i + 1),
      question_type: qType,
      question_text: q.question_text || '',
      question_latex: q.question_latex || null,
      has_math: q.has_math || false,
      parent_question_number: q.parent_question_number || null,
      root_question_number: q.root_question_number || String(q.question_number || i + 1).match(/^\d+/)?.[0],
      marks: q.marks || 1,
      options,
      correct_answer: typeof correctAnswer === 'object' ? JSON.stringify(correctAnswer) : correctAnswer,
      has_figures: q.has_figures || false,
      has_tables: q.has_tables || false,
      topic_tag: q.topic_tag || null,
      difficulty_level: q.difficulty_level || null,
      extraction_confidence: q.extraction_confidence || 0.9,
      generation_status: 'ai_generated',
      graph_description: q.graph_description || null,
    };
  });

  const { data: inserted, error: insertError } = await supabase.from('exam_question_drafts').insert(drafts).select();
  if (insertError) throw new Error(`Failed to save questions: ${insertError.message}`);

  // ALWAYS regenerate questions with new wording (regardless of resource pack)
  await regenerateQuestions(inserted?.filter((q: any) => !q.has_figures) || [], supabase, lovableApiKey, hasResourcePack, resourcePackContext);

  // Save topics
  if (parsedData.topics?.length) {
    await supabase.from('exam_topics').delete().eq('exam_id', draftId);
    await supabase.from('exam_topics').insert(parsedData.topics.map((t: any) => ({
      exam_id: draftId, topic_name: t.topic_name, confidence_score: t.confidence_score || 0.8
    })));
  }

  // Final update
  await supabase.from('exams').update({
    extraction_status: 'completed',
    total_questions_extracted: questions.length,
    extraction_error: null,
    detected_subject: parsedData.detected_subject,
    subject_confidence: parsedData.subject_confidence,
  }).eq('id', draftId);

  console.log('Extraction completed:', questions.length, 'questions');
}

async function loadResourcePack(packId: string, supabase: any, apiKey: string, exam: any) {
  const { data: pack } = await supabase.from('resource_packs').select('*').eq('id', packId).maybeSingle();
  if (!pack) return { context: '', hasResourcePack: false };

  // Extract pending pack
  if (pack.status === 'pending' && pack.source_file_url) {
    const packText = await extractPdfText(pack.source_file_url, supabase);
    if (packText) {
      const resources = await extractResources(packText, apiKey, exam);
      await supabase.from('resource_items').delete().eq('pack_id', packId);
      for (let i = 0; i < resources.length; i++) {
        await supabase.from('resource_items').insert({
          pack_id: packId,
          source_label: resources[i].source_label || `Resource ${i + 1}`,
          resource_type: resources[i].resource_type || 'text_extract',
          content_text: resources[i].content_text,
          display_order: i,
        });
      }
      await supabase.from('resource_packs').update({ status: 'ready' }).eq('id', packId);
    }
  }

  // Load items
  const { data: items } = await supabase.from('resource_items').select('*').eq('pack_id', packId).order('display_order');
  if (!items?.length) return { context: '', hasResourcePack: false };

  const allText = items.map((r: any) => r.content_text || '').join(' ');
  const names = [...new Set(allText.match(/\b[A-Z][a-z]+\b/g) || [])].slice(0, 15).join(', ');

  let context = `\n🚨 RESOURCE-BASED EXAM - USE ONLY SOURCE CONTENT 🚨\nCharacter names MUST be from: "${names}". DO NOT invent names.\n\n📚 SOURCES:\n`;
  for (const item of items) {
    context += `--- ${item.source_label} ---\n${item.content_text || ''}\n\n`;
  }
  return { context, hasResourcePack: true };
}

async function extractResources(text: string, apiKey: string, exam: any) {
  const prompt = `Extract resources from this exam insert for ${exam.subject_id}. Return JSON: {"resources":[{"source_label":"Source A","resource_type":"text_extract","content_text":"..."}]}.\n\nTEXT:\n${text.substring(0, 25000)}`;
  
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });
  
  if (!resp.ok) return [{ source_label: 'Source A', resource_type: 'text_extract', content_text: text.substring(0, 8000) }];
  
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]).resources || []; } catch { }
  }
  return [{ source_label: 'Source A', resource_type: 'text_extract', content_text: text.substring(0, 8000) }];
}

async function extractPdfText(fileUrl: string | null, supabase: any): Promise<string> {
  if (!fileUrl) return '';
  const { data, error } = await supabase.storage.from('exam-files').download(fileUrl);
  if (error || !data) return '';

  try {
    const arr = new Uint8Array(await data.arrayBuffer());
    const pdf = await getDocument({ data: arr, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str || '').join(' '));
    }
    pdf.cleanup();
    return pages.join('\n\n').replace(/\s+/g, ' ').trim();
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(await data.arrayBuffer()));
  }
}

function buildPrompt(exam: any, pdfText: string, resourceCtx: string, specs: any[], board: string, level: string, useOriginal: boolean, fallback: boolean, desiredQuestionCount: number | null = null): string {
  const specList = specs.length ? `Topics: ${specs.map((s: any) => s.topic_name).join(', ')}\n` : '';
  
  const mode = fallback 
    ? `Generate typical ${board.toUpperCase()} ${level} ${exam.subject_id} questions (no PDF text available).`
    : `CRITICAL: Generate COMPLETELY NEW and ORIGINAL questions inspired by this exam paper. 
DO NOT copy questions from the PDF - create fresh questions that test similar skills but with:
- Different wording and phrasing
- Different specific references or examples
- Fresh scenarios or contexts
The uploaded PDF is for INSPIRATION ONLY - your questions must be unique.`;

  // Detect if the subject warrants automatic graph generation
  const subjectId = (exam.subject_id || '').toLowerCase();
  const topicNames = specs.map((s: any) => (s.topic_name || '').toLowerCase()).join(' ');
  const pdfLower = pdfText.substring(0, 5000).toLowerCase();
  const combinedText = `${subjectId} ${topicNames} ${pdfLower}`;
  
  const graphPriorityKeywords = [
    'graph', 'curve', 'plot', 'sketch', 'coordinate', 'transform', 'function',
    'f(x)', 'y=', 'linear', 'quadratic', 'cubic', 'parabola', 'asymptote',
    'gradient', 'intercept', 'tangent', 'differentiation', 'integration',
    'polynomial', 'exponential', 'logarithm', 'trigonometric', 'sine', 'cosine',
    'velocity', 'acceleration', 'force', 'displacement', 'momentum', 'energy',
    'supply', 'demand', 'cost', 'revenue', 'profit', 'equilibrium',
    'concentration', 'rate', 'temperature', 'pressure', 'volume',
    'distance-time', 'velocity-time', 'force-extension', 'current-voltage',
    'ph curve', 'market equilibrium', 'projectile motion', 'kinetic energy'
  ];
  
  const needsGraphs = graphPriorityKeywords.some(kw => combinedText.includes(kw));
  const isMathSubject = subjectId.includes('math') || subjectId.includes('maths');

  let graphInstructions = '';
  if (needsGraphs) {
    graphInstructions = `

AUTOMATIC GRAPH GENERATION (VISUAL-HEAVY TOPICS DETECTED):
When a question covers a topic that is better tested visually, you MUST generate a graph question.
Supported question_types: "graph_plotting", "graph_interpretation", "short_answer", "mcq", "long_form"

For graph_plotting questions, correct_answer MUST be a JSON object (not a string):
{
  "graphType": "plotting",
  "graphConfig": {
    "chartType": "line",
    "xLabel": "x-axis label with units",
    "yLabel": "y-axis label with units",
    "domainX": [min, max],
    "domainY": [min, max],
    "series": [{"name": "Reference", "data": [{"x":0,"y":0}, ...], "color": "#3b82f6"}]${!isMathSubject ? `,
    "subjectProfile": {"subject": "${exam.subject_id}", "quadrantMode": "q1"}` : ''}
  },
  "plottingAnswer": {${isMathSubject ? `
    "markingFormula": "algebraic expression e.g. x^2 - 3*x + 2",
    "expectedCurve": [{"x":0,"y":2}, {"x":1,"y":0}, ...at least 10 points],
    "tolerancePercent": 8` : `
    "expectedPath": [{"x":0,"y":0}, {"x":100,"y":300}, ...ordered vertices],
    "pathAnnotations": [{"pointIndex":0,"label":"Start"}, ...],
    "toleranceUnits": 15`}
  }
}

For graph_interpretation questions, correct_answer MUST be:
{
  "graphType": "interpretation",
  "graphConfig": { ...same as above with populated series.data... },
  "interpretationFields": [
    {"id": "field1", "label": "What is the gradient?", "expectedAnswer": "2.5", "tolerance": 0.2}
  ]
}

GRAPH-PRIORITY SUBTOPICS (auto-generate graph when these appear):
- Physics: distance-time, velocity-time, force-extension, current-voltage, pressure-volume, projectile motion
- Economics: supply & demand, market equilibrium, cost curves, revenue curves, price elasticity
- Chemistry: pH curves, rate of reaction, concentration-time, gas laws
- Mathematics: coordinate geometry, transformations, functions, calculus sketching
- Biology: population growth, enzyme activity, rate of reaction

RULES:
- At least 20% of questions should be graph questions when visual topics are detected
- If a question says "sketch", "plot", "draw" or "the graph shows" it MUST be graph_plotting
- Graph questions MUST have complete graphConfig with series.data containing at least 10 points
- LaTeX is ONLY for text fields. NEVER put LaTeX in graphConfig numeric data or coordinate arrays
`;
  }

  // HIERARCHICAL QUESTION STRUCTURE INSTRUCTIONS
  const questionCountInstruction = desiredQuestionCount
    ? `\nSTRICT QUESTION COUNT: Generate EXACTLY ${desiredQuestionCount} PARENT questions (numbered 1, 2, 3, ..., ${desiredQuestionCount}).`
    : '';

  const hierarchicalInstructions = `

HIERARCHICAL QUESTION STRUCTURE (CRITICAL):
1. A "Parent Question" is a top-level numbered question: Q1, Q2, Q3, etc.
2. Sub-parts (a), (b), (c) are children of a parent question and do NOT count toward the question limit.
3. When a question naturally has multiple parts, you MUST split them into separate sub-part entries.
${questionCountInstruction}

SUB-PART FORMATTING RULES:
- NEVER combine sub-parts (a) and (b) into a single question_text block.
- Each sub-part MUST be its own separate entry in the questions array.
- Each sub-part MUST have its own marks value.
- Use question_number format: "1" for parent, "1a" or "1(a)" for sub-parts, "1b" for second sub-part, etc.
- Set parent_question_number to the parent's number (e.g., "1" for sub-part "1a").
- Set root_question_number to the top-level number (e.g., "1").

EXAMPLE: A question with 2 parts should produce 2 entries:
[
  {"question_number": "1a", "question_text": "Find the value of x...", "marks": 3, "parent_question_number": "1", "root_question_number": "1"},
  {"question_number": "1b", "question_text": "Hence, determine...", "marks": 4, "parent_question_number": "1", "root_question_number": "1"}
]

A standalone question with no sub-parts:
[
  {"question_number": "2", "question_text": "Calculate the area...", "marks": 5, "parent_question_number": null, "root_question_number": "2"}
]
`;

  return `${resourceCtx}
Generate NEW questions for ${board.toUpperCase()} ${level} ${exam.subject_id}.
${specList}${mode}

Wrap ALL math in LaTeX delimiters: $...$ for inline, $$...$$ for standalone equations.
Use proper LaTeX: \\frac{a}{b}, \\sqrt{x}, x^{2}, \\pi, \\theta
${hierarchicalInstructions}${graphInstructions}
REFERENCE PDF (USE FOR INSPIRATION - DO NOT COPY):
${pdfText.substring(0, 45000)}

Return JSON: {"detected_subject":"string","subject_confidence":0.9,"questions":[{"question_number":"1a","question_type":"short_answer|mcq|long_form|graph_plotting|graph_interpretation","question_text":"YOUR NEW QUESTION (one sub-part only)","marks":2,"topic_tag":"...","difficulty_level":"medium","has_figures":false,"correct_answer":"string or JSON object for graph questions","parent_question_number":"1 or null","root_question_number":"1"}],"topics":[{"topic_name":"...","confidence_score":0.8}]}`;
}

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string, hasResourcePack: boolean) {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      // Gemini uses max_tokens, OpenAI uses max_completion_tokens
      max_tokens: 32000,
      temperature: hasResourcePack ? 0.1 : 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) throw new Error('AI extraction failed');
  
  const data = await resp.json();
  let content = data.choices?.[0]?.message?.content || '{}';
  content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  
  try { return JSON.parse(content); } 
  catch { return { questions: [], topics: [] }; }
}

async function regenerateQuestions(questions: any[], supabase: any, apiKey: string, hasResourcePack: boolean = false, resourceContext: string = '') {
  for (const q of questions.slice(0, 20)) { // Limit to prevent timeout
    // Build a stronger prompt that emphasizes creating DIFFERENT questions
    const basePrompt = hasResourcePack
      ? `You have access to source material. Create a COMPLETELY NEW and DIFFERENT question that tests similar skills to this original question, but with ENTIRELY DIFFERENT wording, focus, and approach.

ORIGINAL QUESTION (DO NOT COPY THIS - create something NEW):
"${q.question_text}"

REQUIREMENTS:
- Test the same SKILL TYPE (e.g., analysis, inference, evaluation) but on DIFFERENT aspects
- Use DIFFERENT line references or focus on DIFFERENT parts of the source
- Create FRESH wording - no phrases from the original
- Same mark allocation: ${q.marks} marks
- Topic: ${q.topic_tag || 'general'}

${resourceContext ? `SOURCE CONTEXT:\n${resourceContext.substring(0, 3000)}` : ''}

Return ONLY the new question text, nothing else.`
      : `Create a COMPLETELY NEW question that tests the same concept/skill as the original below, but with ENTIRELY DIFFERENT:
- Wording and phrasing
- Context or scenario
- Specific details or examples

ORIGINAL QUESTION (DO NOT COPY - use only as inspiration):
"${q.question_text}"

Topic: ${q.topic_tag || 'general'}, Marks: ${q.marks}

Return ONLY the new question text.`;
    
    try {
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: basePrompt }],
          temperature: 0.7, // Higher temperature for more creativity/variation
        }),
      });
      
      if (resp.ok) {
        const data = await resp.json();
        const newText = data.choices?.[0]?.message?.content?.trim();
        if (newText && newText.length > 10 && newText !== q.question_text) {
          await supabase.from('exam_question_drafts').update({
            original_question_text: q.question_text,
            question_text: newText,
            generation_status: 'ai_generated',
          }).eq('id', q.id);
          console.log(`Regenerated Q${q.question_number} with new wording`);
        }
      }
    } catch (e) { console.error('Regen failed for', q.question_number, e); }
  }
}

function normalizeQNum(qNum: string): string {
  const match = String(qNum || '').match(/^(\d+)([a-z]?)(?:\(([ivx]+)\))?$/i);
  if (!match) return String(qNum || '').padStart(10, '0');
  const [, num, letter, roman] = match;
  const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
  return `${num.padStart(3, '0')}${letter ? `_${letter}` : ''}${roman ? `_${romanMap[roman.toLowerCase()] || 0}` : ''}`;
}
