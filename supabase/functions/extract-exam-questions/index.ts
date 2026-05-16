import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.2.1";
import { detectLiteraryText, buildLiteraryTextInstructions, buildExtractSafetyInstruction } from "../_shared/copyright-rules.ts";
import { logAIUsage } from "../_shared/usage-logger.ts";
import { shouldSuppressDiagram } from "../_shared/diagram-suppression.ts";
import { hasBrokenDiagramReference, scrubBrokenDiagramReferences } from "../_shared/question-text-scrubber.ts";
import { MULTI_PART_GRAPH_INSTRUCTIONS, buildBiologyInstructions, buildMathsInstructions, buildPhysicsInstructions } from "../_shared/prompt-templates.ts";

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

  // Determine if this is a custom/niche subject (not a common academic subject)
  const COMMON_SUBJECTS = [
    'mathematics', 'maths', 'math', 'physics', 'chemistry', 'biology',
    'english', 'history', 'geography', 'economics', 'business',
    'computer science', 'psychology', 'sociology', 'french', 'spanish',
    'german', 'art', 'music', 'drama', 'religious studies', 'philosophy',
    'politics', 'law', 'accounting', 'statistics', 'further maths',
    'engineering', 'design technology', 'food technology', 'pe',
    'physical education', 'environmental science', 'geology',
    'astronomy', 'media studies', 'film studies',
  ];
  const subjectLower = (exam.subject_id || '').toLowerCase();
  const isCustomNicheForValidation = !COMMON_SUBJECTS.some(s => subjectLower.includes(s));
  console.log('Is custom niche subject:', isCustomNicheForValidation, '| Subject:', exam.subject_id);
  const useOriginalStructure = exam.exam_format?.[0]?.use_original_structure ?? true;

  // Fetch user's curriculum_region for stealth framework
  let curriculumRegion: string | null = null;
  try {
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('curriculum_region')
      .eq('user_id', userId)
      .maybeSingle();
    curriculumRegion = prefs?.curriculum_region || null;
  } catch (e) {
    console.log('Could not fetch curriculum_region:', e);
  }
  console.log('Curriculum region:', curriculumRegion);

  // Fetch canonical subtopic list for controlled topic_tag vocabulary
  let canonicalTopicList: string[] = [];
  try {
    const { data: canonicalTopics } = await supabase
      .from('subject_subtopics')
      .select('subtopic')
      .ilike('subject', `%${exam.subject_id}%`);
    canonicalTopicList = canonicalTopics?.map((t: any) => t.subtopic) ?? [];
    console.log('Canonical topic list loaded:', canonicalTopicList.length, 'topics');
  } catch (e) {
    console.log('Could not fetch canonical topics:', e);
  }

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

  // Determine desired PARENT question count and MCQ/written split
  // exam_format is a one-to-one relation — PostgREST returns an object (not array)
  const rawFormat = exam.exam_format;
  const formatData = Array.isArray(rawFormat) ? rawFormat[0] : rawFormat;
  let desiredQuestionCount: number | null = null;
  let desiredMcqCount: number | null = null;
  let desiredWrittenCount: number | null = null;
  let profileMeta: { mcq_options_count?: number; include_graphs?: boolean | null; include_tables?: boolean | null; include_diagrams?: boolean | null } = {};
  
  if (formatData) {
    // Read from top-level columns (written by save-exam-format) with fallback to profile_metadata
    const pm = (formatData.profile_metadata && typeof formatData.profile_metadata === 'object') ? formatData.profile_metadata : {};
    profileMeta = {
      mcq_options_count: pm.mcq_options_count ?? pm.mcqOptionsCount ?? undefined,
      include_graphs: formatData.include_graphs ?? pm.include_graphs ?? pm.includeGraphs ?? undefined,
      include_tables: formatData.include_tables ?? pm.include_tables ?? pm.includeTables ?? undefined,
      include_diagrams: formatData.include_diagrams ?? pm.include_diagrams ?? pm.includeDiagrams ?? undefined,
    };

    if (formatData.use_original_structure === false) {
      const mcq = Math.max(formatData.mcq_count || 0, 0);
      const sa = Math.max(formatData.short_answer_count || 0, 0);
      const lf = Math.max(formatData.long_form_count || 0, 0);
      const writtenTotal = sa + lf;
      const breakdownSum = mcq + writtenTotal;

      if (breakdownSum > 0) {
        desiredQuestionCount = breakdownSum;
        desiredMcqCount = mcq;
        desiredWrittenCount = writtenTotal;
        console.log(`Profile split enforced: ${mcq} MCQ + ${writtenTotal} written = ${desiredQuestionCount} total`);
      }
    }
  }

  console.log('Profile metadata:', JSON.stringify(profileMeta));

  // Fallback: check exam title metadata for a question count hint
  if (!desiredQuestionCount && exam.title) {
    const qMatch = exam.title.match(/\b(\d+)\s*q/i);
    if (qMatch) desiredQuestionCount = parseInt(qMatch[1], 10);
  }
  
  // Check specification topics count to infer — if we have N topics, generate at least N questions
  if (!desiredQuestionCount && specTopics.length > 0) {
    desiredQuestionCount = Math.max(specTopics.length, 8);
  }

  console.log('Desired parent question count:', desiredQuestionCount, 'MCQ:', desiredMcqCount, 'Written:', desiredWrittenCount);

  // Build prompt using simplified buildPrompt
  const topicsList = specTopics.map((s: any) => s.topic_name || s);
  const topicsString = topicsList.join(' ');
  const suppressDiagrams = shouldSuppressDiagram(topicsString, '', exam.subject_id ?? '');
  const isElectricalEngineering = /electric|circuit|power system|analog|digital electronics/i.test(exam.subject_id || '');
  const hasDeltaWyeTopic = /delta.*wye|wye.*delta|delta\/wye|delta_wye|delta-star|star-delta/i.test(topicsString.toLowerCase());
  const { systemPrompt, userPrompt: extractionPrompt_raw } = buildPrompt({
    subject: exam.subject_id ?? '',
    topics: topicsList,
    desiredMcqCount: desiredMcqCount ?? 0,
    desiredWrittenCount: desiredWrittenCount ?? 0,
    questionStructure: formatData?.question_structure ?? 'standalone',
    parentQuestionCount: formatData?.parent_question_count ?? 4,
    maxPartsPerQuestion: formatData?.max_parts_per_question ?? 3,
    educationalLevel: qualificationLevel,
    curriculumRegion: curriculumRegion ?? '',
    examBoard: examBoard,
    markSchemeStyle: getBoardMarkSchemeStyle(examBoard),
    difficultyProgression: formatData?.difficulty_progression ?? 'ascending',
    calculatorPolicy: formatData?.calculator_policy ?? 'allowed',
    isCustomNiche: isCustomNicheForValidation,
    pdfContent: pdfText,
    topicTagVocabulary: canonicalTopicList,
    extendedResponseMarks: formatData?.extended_marks ?? 0,
    includeExtended: formatData?.include_extended ?? false,
    includeGraphs: profileMeta.include_graphs ?? null,
    includeTables: profileMeta.include_tables ?? null,
    includeDiagrams: profileMeta.include_diagrams ?? null,
    markDistribution: formatData?.mark_distribution ?? null,
    suppressDiagrams,
    isElectricalEngineering,
    hasDeltaWyeTopic,
  });

  let extractionPrompt = extractionPrompt_raw;

  // Inject literary copyright rules if applicable
  const specTopicNames = topicsList;
  const detectedLitText = detectLiteraryText(exam.subject_id || '', specTopicNames);
  if (detectedLitText) {
    extractionPrompt += '\n' + buildLiteraryTextInstructions(detectedLitText);
    console.log('Literary text detected:', detectedLitText, '— copyright rules injected');
  }
  extractionPrompt += '\n' + buildExtractSafetyInstruction(examBoard, exam.subject_id || '');

  const startTime = Date.now();
  const parsedData = await callAI(lovableApiKey, systemPrompt, extractionPrompt, hasResourcePack);
  
  if (!parsedData.questions?.length) {
    await supabase.from('exams').update({ extraction_status: 'failed', extraction_error: 'No questions found' }).eq('id', draftId);
    throw new Error('No questions found');
  }

  // Sort questions
  let questions = parsedData.questions.sort((a: any, b: any) => 
    normalizeQNum(a.question_number).localeCompare(normalizeQNum(b.question_number))
  );

  questions = questions.map((question: any) => {
    const hasBrokenRef = hasBrokenDiagramReference(question.question_text || '', question.diagramConfig, question.chart_data ?? question.options);
    if (!hasBrokenRef) {
      return question;
    }

    console.error(
      `Broken diagram reference detected in Q${question.question_number}: "${String(question.question_text || '').slice(0, 100)}..."`
    );

    const scrubbed = scrubBrokenDiagramReferences(question.question_text || '');
    const stillBroken = hasBrokenDiagramReference(scrubbed, null) || scrubbed.length < 30;

    return {
      ...question,
      question_text: scrubbed,
      needs_review: true,
      extraction_confidence: stillBroken ? 0.1 : Math.min(question.extraction_confidence ?? 1, 0.4),
    };
  });

  // ── POST-GENERATION VALIDATION: Reject maths-contaminated questions for custom subjects ──
  if (isCustomNicheForValidation) {
    const mathsPatterns = [
      /\bP\(X\s*[=<>≤≥]/,           // P(X = ...) probability notation
      /binomial|poisson|normal distribution/i,
      /\blet\s+X\b/i,               // "Let X be..."
      /probability.*defective/i,
      /random sample of \d+/i,
      /calculate.*P\(/i,
      /state the distribution/i,
      /\bE\(X\)|Var\(X\)/,          // expected value / variance
      /\bsolve.*equation/i,
      /\bfind.*value.*of.*x\b/i,
      /\bintegrat(e|ion)\b/i,
      /\bdifferentiat(e|ion)\b/i,
      /\bquadratic\b/i,
      /\bsimultaneous\b/i,
    ];

    const beforeCount = questions.length;
    questions = questions.filter((q: any) => {
      const text = String(q.question_text || '');
      const hasMaths = mathsPatterns.some(p => p.test(text));
      if (hasMaths) {
        console.error(`SUBJECT CONTAMINATION REJECTED: "${text.slice(0, 100)}..." is maths, not "${exam.subject_id}"`);
      }
      return !hasMaths;
    });
    const rejected = beforeCount - questions.length;
    if (rejected > 0) {
      console.warn(`Subject validation: rejected ${rejected} off-topic maths questions for "${exam.subject_id}"`);
    }
  }

  // ── MCQ-ONLY SAFETY NET: Flatten sub-parts if profile is MCQ-only ──
  const isMcqOnlyProfile = desiredMcqCount !== null && desiredMcqCount > 0 && (!desiredWrittenCount || desiredWrittenCount === 0);
  if (isMcqOnlyProfile) {
    // Group by root, keep only first sub-part per root, renumber sequentially
    const rootGroups: Record<string, any[]> = {};
    for (const q of questions) {
      const root = q.root_question_number || String(q.question_number || '').match(/^\d+/)?.[0] || q.question_number;
      if (!rootGroups[root]) rootGroups[root] = [];
      rootGroups[root].push(q);
    }
    const flatQuestions: any[] = [];
    const sortedRoots = Object.keys(rootGroups).sort((a, b) => parseInt(a) - parseInt(b));
    for (let i = 0; i < sortedRoots.length && i < desiredMcqCount; i++) {
      const group = rootGroups[sortedRoots[i]];
      const q = group[0]; // keep first sub-part only
      q.question_number = String(i + 1);
      q.parent_question_number = null;
      q.root_question_number = String(i + 1);
      q.question_type = 'mcq'; // enforce MCQ type
      flatQuestions.push(q);
    }
    if (flatQuestions.length !== questions.length) {
      console.log(`MCQ-only flattening: ${questions.length} rows -> ${flatQuestions.length} flat MCQs`);
    }
    questions = flatQuestions;
  }

  // ── MCQ TEXT CLEANUP: Strip inappropriate phrases from MCQ questions ──
  for (const q of questions) {
    if (q.question_type === 'mcq' && q.question_text) {
      // Remove "Give your answer to X significant figures/decimal places" from MCQs
      q.question_text = q.question_text
        .replace(/\.\s*Give your answer to \d+ (significant figures|decimal places|s\.f\.|d\.p\.)\.?/gi, '.')
        .replace(/Give your answer to \d+ (significant figures|decimal places|s\.f\.|d\.p\.)\.?\s*/gi, '')
        .replace(/\.\s*State your answer\.\s*/gi, '. ')
        .replace(/\.\s*Show your working\.\s*/gi, '. ')
        .trim();
      
      // If question references "provided data" / "data below" but has no table_data, rewrite the reference
      if (/based on the (provided |given )?data|the (table|data) (above|below|provided)/i.test(q.question_text) && !q.table_data) {
        console.warn(`MCQ Q${q.question_number} references external data but has none — flagging`);
        q.extraction_confidence = Math.min(q.extraction_confidence || 1, 0.4);
      }
    }
  }

  // ── HARD ENFORCEMENT: Trim to desiredQuestionCount parent questions ──
  if (desiredQuestionCount && desiredQuestionCount > 0 && !isMcqOnlyProfile) {
    const uniqueRoots = [...new Set(questions.map((q: any) => {
      const root = q.root_question_number || String(q.question_number || '').match(/^\d+/)?.[0] || q.question_number;
      return String(root);
    }))];
    
    if (uniqueRoots.length > desiredQuestionCount) {
      console.log(`AI generated ${uniqueRoots.length} parent questions but limit is ${desiredQuestionCount}. Trimming.`);
      const allowedRoots = new Set(uniqueRoots.slice(0, desiredQuestionCount));
      questions = questions.filter((q: any) => {
        const root = q.root_question_number || String(q.question_number || '').match(/^\d+/)?.[0] || q.question_number;
        return allowedRoots.has(String(root));
      });
      console.log(`Trimmed to ${questions.length} total questions (${desiredQuestionCount} parents).`);
    }
  }

  await supabase.from('exam_question_drafts').delete().eq('exam_id', draftId);
  
  const drafts = questions.map((q: any, i: number) => {
    // Normalise alternative graph type names emitted by the AI so they are
    // preserved as interactive graph questions instead of being demoted to
    // plain text long_form/short_answer in the publish step.
    let qType = q.question_type || 'short_answer';
    if (typeof qType === 'string') {
      const lower = qType.trim().toLowerCase();
      if (lower === 'graph_sketch' || lower === 'graph-sketch' || lower === 'sketch_graph' || lower === 'graph_drawing' || lower === 'curve_sketch') {
        qType = 'graph_plotting';
        q.question_type = 'graph_plotting';
        console.log(`Q${q.question_number}: Normalised question_type "${lower}" -> "graph_plotting"`);
      }
      if (lower === 'graph_transformation' || lower === 'transformation_sketch' || lower === 'multi_graph' || lower === 'graph-transformation') {
        qType = 'graph_transformation';
        q.question_type = 'graph_transformation';
      }
      // Auto-upgrade single-canvas plotting to transformation when AI emits parts[]
      const ca = q.correct_answer;
      const caObj = typeof ca === 'object' ? ca : (typeof ca === 'string' ? (() => { try { return JSON.parse(ca); } catch { return null; } })() : null);
      const hasMultipleParts = caObj && Array.isArray(caObj.parts) && caObj.parts.length > 1;
      if (qType === 'graph_plotting' && hasMultipleParts) {
        qType = 'graph_transformation';
        q.question_type = 'graph_transformation';
        console.log(`Q${q.question_number}: Auto-upgraded to graph_transformation (${caObj.parts.length} parts)`);
      }
    }
    let correctAnswer = q.correct_answer;
    let options = q.options || null;
    let graphWrapper: any = null;

    // Build a canonical graph wrapper { graphType, graphConfig, plottingAnswer }
    // from whatever fields the AI emitted (top-level, plottingAnswer, graphConfig,
    // or even directly inside correct_answer). This is what the frontend expects
    // in correct_answer for graph_plotting / graph_interpretation questions.
    if (qType === 'graph_plotting' || qType === 'graph_interpretation') {
      // Already canonical inside correct_answer
      if (typeof correctAnswer === 'object' && correctAnswer !== null && (correctAnswer as any).graphType) {
        graphWrapper = correctAnswer;
      } else if (typeof correctAnswer === 'string') {
        try {
          const parsed = JSON.parse(correctAnswer);
          if (parsed?.graphType) graphWrapper = parsed;
        } catch { /* not JSON */ }
      }

      if (!graphWrapper) {
        const pa = q.plottingAnswer ?? q.plotting_answer ?? (typeof correctAnswer === 'object' ? (correctAnswer as any)?.plottingAnswer : null) ?? null;
        const gc = q.graphConfig ?? q.graph_config ?? (typeof correctAnswer === 'object' ? (correctAnswer as any)?.graphConfig : null) ?? null;
        const interp = q.interpretationFields ?? q.interpretation_fields ?? null;
        if (pa || gc || interp) {
          const derivedConfig = gc ?? {
            chartType: 'line',
            xLabel: pa?.xLabel ?? 'x',
            yLabel: pa?.yLabel ?? 'y',
            domainX: pa?.domainX ?? [-5, 5],
            domainY: pa?.domainY ?? [-10, 10],
            grid: { show: true, stepX: pa?.stepX ?? 1, stepY: pa?.stepY ?? 1 },
            series: pa?.series ?? [],
          };
          if (qType === 'graph_interpretation' || interp) {
            graphWrapper = {
              graphType: 'interpretation',
              graphConfig: derivedConfig,
              interpretationFields: interp ?? [],
            };
          } else {
            graphWrapper = {
              graphType: 'plotting',
              graphConfig: derivedConfig,
              plottingAnswer: pa ?? {},
            };
          }
        }
      }

      if (graphWrapper) {
        // Persist the wrapper as a JSON string in correct_answer (frontend reads this)
        // and ALSO mirror to options + diagram_config for backward compat.
        correctAnswer = JSON.stringify(graphWrapper);
        options = graphWrapper;
        console.log(`Q${q.question_number}: Built canonical graph wrapper for ${qType}`);
      } else {
        console.warn(`Q${q.question_number}: ${qType} question has no graphConfig or plottingAnswer — frontend will render blank canvas`);
      }
    } else if (qType === 'graph_transformation') {
      // Build a canonical transformation wrapper preserving parts[]
      let wrapper: any = null;
      if (typeof correctAnswer === 'object' && correctAnswer !== null && ((correctAnswer as any).graphType === 'transformation' || Array.isArray((correctAnswer as any).parts))) {
        wrapper = (correctAnswer as any).graphType ? correctAnswer : { graphType: 'transformation', ...(correctAnswer as any) };
      } else if (typeof correctAnswer === 'string') {
        try {
          const parsed = JSON.parse(correctAnswer);
          if (parsed && (parsed.graphType === 'transformation' || Array.isArray(parsed.parts))) {
            wrapper = parsed.graphType ? parsed : { graphType: 'transformation', ...parsed };
          }
        } catch { /* not JSON */ }
      }
      if (!wrapper && q.transformationConfig) {
        wrapper = { graphType: 'transformation', ...q.transformationConfig };
      }
      if (wrapper) {
        correctAnswer = JSON.stringify(wrapper);
        options = wrapper;
        console.log(`Q${q.question_number}: Built canonical graph_transformation wrapper (${wrapper.parts?.length ?? 0} parts)`);
      } else {
        console.warn(`Q${q.question_number}: graph_transformation has no parts[]`);
      }
    } else if (qType === 'mcq') {
      // Validate MCQ correct_answer — do NOT silently default to 'A'
      if (!correctAnswer) {
        console.error(`Missing correct_answer for MCQ Q${q.question_number}: "${(q.question_text || '').slice(0, 80)}"`);
      } else if (options && Array.isArray(options)) {
        const answerLower = String(correctAnswer).toLowerCase().trim();
        const matchesOption = options.some(
          (opt: string) => String(opt).toLowerCase().trim() === answerLower ||
                           answerLower.length === 1 && 'abcd'.indexOf(answerLower) >= 0
        );
        if (!matchesOption) {
          console.warn(`MCQ Q${q.question_number}: correct_answer "${correctAnswer}" may not match options — flagging`);
        }
      }
    }

    // Handle chart_data — written into diagram_config (NOT options) so MCQ choices
    // and chart payloads can coexist on the same question.
    let chartPayload: any = null;
    // Diagnostic: log whether AI returned chart_data so we can detect prompt failures
    const refsChartLikely = /\b(bar chart|pie chart|table|graph|chart|histogram|frequency polygon|cumulative frequency|climate graph|box plot)\b/i.test(q.question_text || '');
    if (refsChartLikely && !q.chart_data) {
      console.warn(`Q${q.question_number}: REFERENCES_CHART_BUT_AI_RETURNED_NO_CHART_DATA — text: "${(q.question_text || '').slice(0, 120)}"`);
    }
    if (q.chart_data && typeof q.chart_data === 'object') {
      if (q.chart_data.type === 'data_table') {
        if (
          Array.isArray(q.chart_data.headers) &&
          q.chart_data.headers.length > 0 &&
          Array.isArray(q.chart_data.rows) &&
          q.chart_data.rows.length > 0
        ) {
          chartPayload = q.chart_data;
          console.log(`Q${q.question_number}: Data table chart_data stored in options`);
        } else {
          console.warn(`Q${q.question_number}: Invalid data_table chart_data — missing headers or rows`);
        }
      } else if (q.chart_data.type === 'bar_chart') {
        const validBars =
          Array.isArray(q.chart_data.bars) &&
          q.chart_data.bars.length > 0 &&
          q.chart_data.bars.every((b: any) =>
            typeof b?.label === 'string' && typeof b?.value === 'number'
          );
        const validGrouped =
          Array.isArray(q.chart_data.grouped) &&
          q.chart_data.grouped.length > 0 &&
          q.chart_data.grouped.every((g: any) =>
            typeof g?.groupLabel === 'string' &&
            Array.isArray(g?.bars) &&
            g.bars.length > 0 &&
            g.bars.every((b: any) =>
              typeof b?.label === 'string' && typeof b?.value === 'number'
            )
          );
        if (validBars || validGrouped) {
          chartPayload = q.chart_data;
          console.log(`Q${q.question_number}: Bar chart chart_data stored in options`);
        } else {
          console.warn(`Q${q.question_number}: Invalid bar_chart — missing bars or grouped`);
        }
      } else if (q.chart_data.type === 'pie_chart') {
        const validSegs =
          Array.isArray(q.chart_data.segments) &&
          q.chart_data.segments.length > 0 &&
          q.chart_data.segments.every((s: any) =>
            typeof s?.label === 'string' && typeof s?.value === 'number' && s.value >= 0
          );
        const segTotal = validSegs
          ? q.chart_data.segments.reduce((sum: number, s: any) => sum + s.value, 0)
          : 0;
        if (validSegs && segTotal > 0) {
          chartPayload = q.chart_data;
          console.log(`Q${q.question_number}: Pie chart chart_data stored in options`);
        } else {
          console.warn(`Q${q.question_number}: Invalid pie_chart — segments missing or sum to zero`);
        }
      } else if (q.chart_data.type === 'cumulative_frequency') {
        const validPoints =
          Array.isArray(q.chart_data.points) &&
          q.chart_data.points.length >= 2 &&
          q.chart_data.points.every((p: any) =>
            typeof p?.upperBoundary === 'number' &&
            typeof p?.cumulativeFrequency === 'number' &&
            p.cumulativeFrequency >= 0
          );
        const isNonDecreasing = validPoints && q.chart_data.points.every(
          (p: any, i: number) =>
            i === 0 || p.cumulativeFrequency >= q.chart_data.points[i - 1].cumulativeFrequency
        );
        if (validPoints && isNonDecreasing) {
          chartPayload = q.chart_data;
          console.log(`Q${q.question_number}: Cumulative frequency chart_data stored in options`);
        } else {
          console.warn(`Q${q.question_number}: Invalid cumulative_frequency — points missing or non-monotonic`);
        }
      } else if (q.chart_data.type === 'frequency_polygon') {
        const validClasses =
          Array.isArray(q.chart_data.classes) &&
          q.chart_data.classes.length >= 2 &&
          q.chart_data.classes.every((c: any) =>
            typeof c?.lowerBoundary === 'number' &&
            typeof c?.upperBoundary === 'number' &&
            typeof c?.frequency === 'number' &&
            c.upperBoundary > c.lowerBoundary &&
            c.frequency >= 0
          );
        const validDatasets =
          Array.isArray(q.chart_data.datasets) &&
          q.chart_data.datasets.length >= 1 &&
          q.chart_data.datasets.every((d: any) =>
            typeof d?.label === 'string' &&
            Array.isArray(d?.classes) && d.classes.length >= 2
          );
        if (validClasses || validDatasets) {
          chartPayload = q.chart_data;
          console.log(`Q${q.question_number}: Frequency polygon chart_data stored in options`);
        } else {
          console.warn(`Q${q.question_number}: Invalid frequency_polygon — needs classes or datasets`);
        }
      } else if (q.chart_data.type === 'climate_chart') {
        const validClimate =
          Array.isArray(q.chart_data.months) &&
          q.chart_data.months.length === 12 &&
          q.chart_data.months.every((m: any) =>
            typeof m?.month === 'string' &&
            typeof m?.temperature === 'number' &&
            typeof m?.precipitation === 'number' &&
            m.precipitation >= 0
          ) &&
          typeof q.chart_data.location === 'string';
        if (validClimate) {
          chartPayload = q.chart_data;
          console.log(`Q${q.question_number}: Climate chart chart_data stored in options`);
        } else {
          console.warn(`Q${q.question_number}: Invalid climate_chart — needs exactly 12 months and location`);
        }
      } else {
        chartPayload = q.chart_data;
        console.log(`Q${q.question_number}: Chart data detected (${q.chart_data.type}), stored in options`);
      }
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
      is_flagged: q.needs_review || false,
      flag_reason: q.needs_review ? 'Broken diagram reference auto-scrubbed; review required' : null,
      diagram_config: (() => {
        // Merge chart payload + correct_chart_data into diagram_config so MCQ
        // choices in `options` no longer collide with chart data.
        const baseDiagram = graphWrapper ?? q.diagramConfig ?? q.diagram_config ?? null;
        const correctChart = q.correct_chart_data ?? null;
        if (chartPayload) {
          return correctChart
            ? { ...chartPayload, correct_chart_data: correctChart }
            : chartPayload;
        }
        if (correctChart) {
          return baseDiagram && typeof baseDiagram === 'object'
            ? { ...baseDiagram, correct_chart_data: correctChart }
            : { correct_chart_data: correctChart };
        }
        return baseDiagram;
      })(),
      circuit_type: q.circuit_type ?? null,
      circuit_description: q.circuit_description ?? null,
    };
  });

  const { data: inserted, error: insertError } = await supabase.from('exam_question_drafts').insert(drafts).select();
  if (insertError) throw new Error(`Failed to save questions: ${insertError.message}`);

  // ── OPTIMISATION 2: CONDITIONAL REGENERATION — only if quality is below threshold ──
  const qualityScore = scoreGenerationQuality(questions, {
    desiredMcqCount: desiredMcqCount ?? 0,
    desiredWrittenCount: desiredWrittenCount ?? questions.length,
    subject: exam.subject_id,
    isCustomNiche: isCustomNicheForValidation,
  });
  console.log(`Generation quality score: ${qualityScore}/100`);

  const REGEN_THRESHOLD = 70;
  const regenQuestionType: 'mcq' | 'short_answer' | 'long_form' | 'mixed' = isMcqOnlyProfile ? 'mcq' : (desiredMcqCount === 0 ? 'mixed' : 'mixed');

  if (qualityScore < REGEN_THRESHOLD) {
    console.log(`Quality below ${REGEN_THRESHOLD} — running regeneration pass`);
    await regenerateQuestions(inserted?.filter((q: any) => !q.has_figures) || [], supabase, lovableApiKey, hasResourcePack, resourcePackContext, exam.subject_id, isCustomNicheForValidation, regenQuestionType);
  } else {
    console.log(`Quality above ${REGEN_THRESHOLD} — skipping regeneration pass (saved an AI call)`);
  }

  // ── POST-REGENERATION VALIDATION: Re-check for maths contamination after regen ──
  if (isCustomNicheForValidation) {
    const mathsPatterns2 = [
      /\bP\(X\s*[=<>≤≥]/, /binomial|poisson|normal distribution/i,
      /\blet\s+X\b/i, /probability.*defective/i, /random sample of \d+/i,
      /calculate.*P\(/i, /state the distribution/i, /\bE\(X\)|Var\(X\)/,
      /\bsolve.*equation/i, /\bfind.*value.*of.*x\b/i,
      /\bintegrat(e|ion)\b/i, /\bdifferentiat(e|ion)\b/i,
      /\bquadratic\b/i, /\bsimultaneous\b/i,
    ];
    const { data: regenDrafts } = await supabase.from('exam_question_drafts').select('id, question_text').eq('exam_id', draftId);
    for (const d of (regenDrafts || [])) {
      if (mathsPatterns2.some(p => p.test(d.question_text || ''))) {
        console.error(`POST-REGEN CONTAMINATION: Deleting draft "${(d.question_text || '').slice(0, 80)}..."`);
        await supabase.from('exam_question_drafts').delete().eq('id', d.id);
      }
    }
  }

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
  // Log AI usage
  await logAIUsage(supabase, {
    userId: userId,
    feature: 'exam_extraction',
    model: modelUsed,
    inputTokens: 0,
    outputTokens: 0,
    cacheHit: false,
    subject: exam.subject_id,
    durationMs: Date.now() - startTime,
  });

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

// ── Helper: Board Mark Scheme Style ──────────────────────────────────────────
function getBoardMarkSchemeStyle(board: string): string {
  const b = (board || '').toLowerCase();
  if (b.includes('aqa')) return 'AQA-style marking with AO1/AO2/AO3 breakdown';
  if (b.includes('edexcel') || b.includes('pearson')) return 'Edexcel-style with M1/A1/B1 marks';
  if (b.includes('ocr')) return 'OCR-style with command verb alignment';
  if (b.includes('ib')) return 'IB-style criterion-referenced marking (A-D)';
  if (b.includes('college_board') || b.includes('ap')) return 'AP-style rubric scoring (1-6 or 1-9)';
  if (b.includes('cambridge') || b.includes('cie')) return 'Cambridge-style with M/A/B marks';
  return 'Standard marking with clear marking points per mark';
}

// ── Simplified Prompt Builder ────────────────────────────────────────────────
function buildPrompt(params: {
  subject: string;
  topics: string[];
  desiredMcqCount: number;
  desiredWrittenCount: number;
  questionStructure: 'standalone' | 'sub_questions' | 'mixed';
  parentQuestionCount?: number;
  maxPartsPerQuestion?: number;
  educationalLevel: string;
  curriculumRegion: string;
  examBoard: string;
  markSchemeStyle: string;
  difficultyProgression: 'ascending' | 'descending' | 'mixed';
  calculatorPolicy: 'allowed' | 'not_allowed' | 'mixed';
  isCustomNiche: boolean;
  pdfContent?: string;
  topicTagVocabulary?: string[];
  extendedResponseMarks?: number;
  includeExtended?: boolean;
  includeGraphs?: boolean | null;
  includeTables?: boolean | null;
  includeDiagrams?: boolean | null;
  markDistribution?: Record<string, number> | null;
  suppressDiagrams?: boolean;
  isElectricalEngineering?: boolean;
  hasDeltaWyeTopic?: boolean;
}): { systemPrompt: string; userPrompt: string } {
  const {
    subject,
    topics,
    desiredMcqCount,
    desiredWrittenCount,
    questionStructure,
    parentQuestionCount = 4,
    maxPartsPerQuestion = 3,
    educationalLevel,
    curriculumRegion,
    examBoard,
    markSchemeStyle,
    difficultyProgression,
    calculatorPolicy,
    isCustomNiche,
    pdfContent,
    topicTagVocabulary,
    extendedResponseMarks = 0,
    includeExtended = false,
    includeGraphs,
    includeTables,
    includeDiagrams,
    markDistribution,
    suppressDiagrams = false,
    isElectricalEngineering = false,
    hasDeltaWyeTopic = false,
  } = params;

  const totalQuestions = desiredMcqCount + desiredWrittenCount;
  const isMcqOnly = desiredMcqCount > 0 && desiredWrittenCount === 0;
  const isWrittenOnly = desiredWrittenCount > 0 && desiredMcqCount === 0;
  const isMixed = desiredMcqCount > 0 && desiredWrittenCount > 0;

  // ── SYSTEM PROMPT ──────────────────────────────────────────────────────────
  const systemPrompt = `You are an expert exam question writer.
Your only job is to write original, high quality exam questions.
You always return valid JSON and nothing else.
Every question you write must be directly and specifically about: "${subject}"

CRITICAL FORMATTING RULES — follow these exactly:
- Do NOT use **double asterisks** for bold text anywhere in question_text
- Do NOT use *single asterisks* for italic text in question_text
- Do NOT use __double underscores__ for bold in question_text
- Do NOT use _single underscores_ for italic in question_text
- Do NOT use Markdown table syntax (pipes | and dashes ---) in question_text
- For tabular data ALWAYS use chart_data with type "data_table" instead
- Plain text only in question_text — write "Total" not "**Total**"
- LaTeX maths expressions using $...$ or $$...$$ are fine and encouraged
- These rules apply to question_text, correct_answer, and mark_scheme fields

CHART REFERENCE RULES:
- Do NOT write "The bar chart below shows..." or "The bar chart displays..."
- Do NOT write "The pie chart illustrates..." or "The table below presents..."
- Do NOT write ANY phrase that references a chart the student must look at
  unless chart_data is included — the chart renders automatically from chart_data
- Instead write the question directly:
  BAD: "The bar chart below shows book sales. Which day had the most sales?"
  GOOD: "Using the book sales data, which day had the most sales?"
  BAD: "The table displays the following results. Calculate the mean."
  GOOD: "Calculate the mean of the following data."
- The chart_data field causes the chart to appear automatically above the question`;

  // ── BLOCK 1: CONTEXT ───────────────────────────────────────────────────────
  const contextBlock = `
## EXAM CONTEXT
Subject: ${subject}
${topics.length > 0 ? `Topics to cover: ${topics.join(', ')}` : ''}
${educationalLevel ? `Level: ${educationalLevel}` : ''}
${curriculumRegion ? `Region: ${curriculumRegion}` : ''}
${examBoard ? `Exam board style: ${examBoard}` : ''}
${calculatorPolicy !== 'allowed' ? `Calculator: ${calculatorPolicy === 'not_allowed' ? 'NOT permitted' : 'Mixed — some questions calculator, some not'}` : ''}`.trim();

  // ── BLOCK 2: SUBJECT RULES ─────────────────────────────────────────────────
  const subjectRulesBlock = isCustomNiche ? `
## SUBJECT RULES
Every question must be about "${subject}" only.
Use only terminology, procedures, and standards from this specific domain.
Do not generate questions about mathematics, statistics, probability, or any unrelated academic subject.
A question is only acceptable if it could appear in a real assessment for "${subject}".`
  : `
## SUBJECT RULES
Every question must be about ${subject}.
Use appropriate academic terminology for ${educationalLevel} level.
Questions must match the style and difficulty of ${examBoard || curriculumRegion} examinations.`;

  // ── BLOCK 3: QUESTION COUNT AND TYPES ─────────────────────────────────────
  let questionCountBlock = `\n## WHAT TO GENERATE\n`;

  if (isMcqOnly) {
    questionCountBlock += `Generate exactly ${desiredMcqCount} multiple choice questions.
Each question must have exactly 4 answer options.
All ${desiredMcqCount} questions are standalone — number them 1 through ${desiredMcqCount}.
No sub-parts. No (a)(b)(c). Just Q1, Q2, Q3 etc.`;
  } else if (isWrittenOnly) {
    if (questionStructure === 'standalone') {
      questionCountBlock += `Generate exactly ${desiredWrittenCount} written questions.
Number them 1 through ${desiredWrittenCount}.
Each question is standalone with its own mark allocation.`;
    } else if (questionStructure === 'sub_questions') {
      questionCountBlock += `Generate written questions using a sub-part structure (e.g. Q1(a), Q1(b), Q1(c)).

Rules for sub-parts:
- Each parent question should have 2 to 4 sub-parts
- NEVER exceed 4 sub-parts on a single parent question
- Sub-parts must share a common scenario, context, or data set
- Sub-parts must increase in difficulty: (a) easiest, final part hardest
- Use the marks allocation to guide how many parts make sense:
  a low-mark question (3-4 marks total) needs only 2 parts,
  a higher-mark question (8-10 marks) can have 3-4 parts
- Total written questions: ${desiredWrittenCount}`;
    } else {
      questionCountBlock += `Generate a mix of standalone questions and questions with sub-parts.

Rules:
- Approximately half the questions should be standalone
- The other half should use sub-parts (a)(b)(c) style
- For sub-part questions: 2 to 4 parts maximum per question
- NEVER exceed 4 sub-parts on any single question
- Sub-parts must share a common context and increase in difficulty
- Total written questions: ${desiredWrittenCount}`;
    }
    if (includeExtended && extendedResponseMarks > 0) {
      questionCountBlock += `\nThe final question must be an extended response question worth ${extendedResponseMarks} marks.`;
    }
  } else if (isMixed) {
    questionCountBlock += `Generate two sections:
Section A: ${desiredMcqCount} multiple choice questions (standalone, numbered 1 through ${desiredMcqCount}, 1 mark each)
Section B: ${desiredWrittenCount} written questions (${questionStructure === 'sub_questions' ? 'using sub-part structure with 2-4 parts per parent question' : questionStructure === 'mixed' ? 'a mix of standalone and sub-part questions' : 'standalone questions'})
${includeExtended && extendedResponseMarks > 0 ? `The final written question must be an extended response worth ${extendedResponseMarks} marks.` : ''}`;
  }

  if (difficultyProgression === 'ascending') {
    questionCountBlock += `\nOrder questions from easiest to hardest.`;
  } else if (difficultyProgression === 'descending') {
    questionCountBlock += `\nOrder questions from hardest to easiest.`;
  }

  // ── BLOCK 4: MCQ RULES (only injected when there are MCQ questions) ────────
  const mcqRulesBlock = (isMcqOnly || isMixed) ? `
## MCQ RULES
Question stems must start with: What, Which, Identify, Select, According to, How, When, Where
NEVER start a MCQ stem with: State, Describe, Explain, Calculate, Discuss, Outline, Evaluate
Each question must be completely self-contained — no references to tables, data above, or provided information
All 4 options must be plausible and similar in length
The correct answer must directly and logically answer the question stem
Never append "Give your answer to X significant figures" or "Show your working" to MCQ questions` : '';

  // ── BLOCK 5: WRITTEN QUESTION RULES (only when there are written questions) ─
  const writtenRulesBlock = (isWrittenOnly || isMixed) ? `
## WRITTEN QUESTION RULES
Use appropriate command verbs for ${examBoard || curriculumRegion} style:
${examBoard?.toLowerCase().includes('aqa')
    ? '- 1-2 marks: State, Give, Identify\n- 3-4 marks: Describe, Explain\n- 5+ marks: Evaluate, Discuss, Analyse, Justify'
    : examBoard?.toLowerCase().includes('ib')
    ? '- Short: State, Define, Outline\n- Medium: Describe, Explain, Distinguish\n- Extended: Evaluate, Discuss, To what extent'
    : examBoard?.toLowerCase().includes('college_board') || examBoard?.toLowerCase().includes('ap')
    ? '- Short: Identify, Define\n- Medium: Explain, Describe\n- FRQ: Analyse, Evaluate, Justify'
    : '- Short (1-2 marks): State, Give, Identify, Name\n- Medium (3-4 marks): Describe, Explain, Outline\n- Extended (5+ marks): Evaluate, Discuss, Analyse, Justify, Compare'
}
${markSchemeStyle ? `Mark scheme style: ${markSchemeStyle}` : ''}
Each mark allocation must be shown in brackets e.g. (2 marks)
Sub-parts within a question must build on each other in difficulty` : '';

  // ── BLOCK 6: SOURCE MATERIAL (only when PDF is provided) ──────────────────
  const sourceBlock = pdfContent ? `
## SOURCE MATERIAL
Use the following as context and inspiration. Do not copy questions verbatim — write entirely new questions inspired by this content:
${pdfContent.slice(0, 40000)}` : '';

  // ── BLOCK 7: TOPIC TAGS ───────────────────────────────────────────────────
  const topicTagBlock = topicTagVocabulary && topicTagVocabulary.length > 0 ? `
## TOPIC TAGS
When setting topic_tag for each question, use only values from this list:
${topicTagVocabulary.join(', ')}` : '';

  // ── BLOCK 8: GRAPH QUESTION REQUIREMENTS ────────────────────────────────
  const graphBlock = `
## GRAPH QUESTION REQUIREMENTS — MANDATORY
If any question uses question_type "graph_plotting" or "graph_sketch", its correct_answer must include a plottingAnswer with:

{
  "plottingAnswer": {
    "markingFormula": "JavaScript evaluatable formula — use * for multiply, Math.pow(x,n) for powers, 1/(x+4) for reciprocals. NEVER include trailing $ or LaTeX. NEVER write f(x) — write the actual expression.",
    "keyPoints": [
      {"x": -2, "y": 0, "type": "root", "label": "(-2, 0)", "required": true, "marks": 1}
    ],
    "curveShapeRules": [
      {"type": "positive_cubic", "crossingsCount": 3, "marks": 1}
    ],
    "domainX": [-4, 5],
    "domainY": [-12, 8],
    "totalMarks": 4
  }
}

markingFormula examples:
  y = x(x-3)(x+2) → "x*(x-3)*(x+2)"
  y = x² - 4x + 7 → "x*x - 4*x + 7"
  y = 1/(x+4) → "1/(x+4)"
  y = 2^x → "Math.pow(2,x)"

keyPoints: Only roots (set formula=0) and y-intercept (x=0). Never turning points.
curveShapeRules type: positive_cubic|negative_cubic|positive_quadratic|negative_quadratic|reciprocal_positive|reciprocal_negative|exponential_growth|exponential_decay|logarithmic|positive_linear|negative_linear
domainX: Show all roots with 1-2 unit padding. Never [-30,30] unless genuinely needed.
totalMarks: Sum of all keyPoint marks + curveShapeRule marks.`;

  // ── BLOCK 9: OUTPUT FORMAT ────────────────────────────────────────────────
  const outputBlock = `
## OUTPUT FORMAT
Return a single JSON object in exactly this structure:
{
  "detected_subject": "${subject}",
  "subject_confidence": 0.95,
  "questions": [
    {
      "question_number": "1",
      "parent_question_number": null,
      "root_question_number": "1",
      "question_text": "Question stem here",
      "question_type": ${isMcqOnly ? '"mcq"' : '"short_answer" | "long_form" | "mcq"'},
      "marks": 1,
      "options": ${isMcqOnly ? '["Option A text", "Option B text", "Option C text", "Option D text"]' : 'null (for written questions)'},
      "correct_answer": "The full text of the correct option (MCQ) or model answer (written)",
      "mark_scheme": "Marking guidance here",
      "topic_tag": "Topic name from the list above",
      "difficulty_level": "easy | medium | hard",
      "extraction_confidence": 0.9,
      "needs_review": false,
      "has_figures": false,
      "has_tables": false,
      "has_math": false,
      "diagramConfig": null
    }
  ],
  "topics": [{"topic_name": "...", "confidence_score": 0.8}]
}

CRITICAL JSON RULES:
- Return ONLY the JSON object — no markdown, no backticks, no explanation
- Every question must have correct_answer set — never leave it null or empty
- For MCQ: correct_answer must be the FULL TEXT of the correct option, exactly matching one of the options array values
- For written: correct_answer is the model answer or key marking points
- parent_question_number is null for standalone questions and MCQs
- root_question_number equals question_number for standalone questions and MCQs
- options must be null for written questions, never an empty array`;

  // ── MEDIA INSTRUCTIONS (based on include_graphs/tables/diagrams) ────────
  const mediaInstruction = (() => {
    const parts: string[] = [];
    if (includeGraphs === true) {
      parts.push('Include graph-based questions where appropriate for this subject.');
    } else if (includeGraphs === false) {
      parts.push('Do NOT include any graph plotting or graph sketching questions.');
    }
    if (includeTables === true) {
      parts.push('Include data table questions where appropriate.');
    } else if (includeTables === false) {
      parts.push('Do NOT include questions that reference data tables or provided datasets.');
    }
    if (includeDiagrams === true) {
      parts.push('Include diagram-based questions where appropriate for this subject.');
    } else if (includeDiagrams === false) {
      parts.push('Do NOT include questions requiring diagram drawing or labelling.');
    }
    return parts.length > 0 ? `\n## MEDIA INSTRUCTIONS\n${parts.join('\n')}` : '';
  })();

  // ── MARK DISTRIBUTION INSTRUCTION ─────────────────────────────────────────
  const markDistributionInstruction = (() => {
    if (!markDistribution || Object.keys(markDistribution).length === 0) {
      if (desiredWrittenCount > 0) {
        return `\n## MARK DISTRIBUTION\nDistribute marks naturally across questions. For a ${desiredWrittenCount}-question written exam, use a mix of short questions (2-4 marks) and structured questions (6-10 marks). The total marks across all questions should roughly equal ${desiredWrittenCount * 5} marks (approximate — adjust as appropriate for the subject and level).`;
      }
      return '';
    }
    const dist = Object.entries(markDistribution)
      .filter(([, count]) => (count as number) > 0)
      .map(([marks, count]) => `${count} question${(count as number) > 1 ? 's' : ''} worth ${marks} marks`)
      .join(', ');
    return dist ? `\n## MARK DISTRIBUTION\nGenerate questions with this exact mark distribution: ${dist}.\nTotal written questions: ${desiredWrittenCount}.` : '';
  })();

  const suppressionNotice = suppressDiagrams ? `
## ABSOLUTE RULE — NO DIAGRAM REFERENCES
No circuit diagram will be shown. You MUST NOT write:
- "in the circuit shown below"
- "consider the circuit below"
- "refer to the circuit"
- "as shown in the figure"
- "from the network below"
- ANY phrase suggesting a diagram will be visible

THIS IS NON-NEGOTIABLE. Questions saying "circuit below" with no circuit will be automatically deleted from the exam.

FOR SUPERPOSITION / THEVENIN / NORTON / NODAL / MESH QUESTIONS:
You MUST describe the complete circuit topology in the question text.
Include: component values, connection topology, source types and values.

CORRECT example for superposition:
"A circuit contains a 10 V voltage source, a 2 A current source, and three resistors: R1 = 6Ω connected in series with the voltage source, R2 = 4Ω connected between the junction of R1 and the current source, and R3 = 3Ω connected from that junction to ground. The 2A current source is connected in parallel with R3. Using the Superposition Theorem, determine the current through R2."

WRONG example (will be deleted):
"Using the Superposition Theorem, determine the current through the 4Ω resistor in the circuit below."

If you cannot describe the circuit topology in text alone for a given theorem question then generate a DIFFERENT question type instead — for example a power calculation or impedance calculation that does not require a circuit diagram.
` : '';

  const nodalAnalysisInstruction = isElectricalEngineering ? `
## NODAL/MESH ANALYSIS QUESTIONS
For nodal or mesh analysis questions without diagrams:
The question MUST specify:
1. How many nodes exist and their labels (V1, V2, Va etc)
2. Which components connect between which nodes
3. All component values (resistance, impedance, source voltages)
4. Which node is the reference (ground)

Minimum information required for a solvable nodal analysis question:
"A circuit has nodes V1 and V2 with ground as reference. Between V1 and ground: 10Ω resistor. Between V2 and ground: 5Ω resistor. Between V1 and V2: 4Ω resistor. A 20V source connects from ground to V1. Using nodal analysis, find V1 and V2."

Never write a nodal analysis question that only says "use the network shown" — all topology must be in the text.
` : '';

  // ── BLOCK 10: CIRCUIT DIAGRAM INSTRUCTIONS ─────────────────────────────────
  const lowerSubject = subject.toLowerCase();
  const circuitTopicHints = ['circuit', 'resistor', 'resistance', 'emf', 'parallel', 'series',
    'impedance', 'capacitor', 'inductor', 'ac', 'alternating', 'rlc', 'electronics', 'physics'];
  const needsCircuitInstructions = circuitTopicHints.some(kw =>
    lowerSubject.includes(kw) || topics.some(t => t.toLowerCase().includes(kw)));

  const circuitBlock = needsCircuitInstructions && !suppressDiagrams ? `
## CIRCUIT DIAGRAM REQUIREMENTS
When generating circuit diagram questions, include a diagramConfig field in the question.

### Supported component types — use ONLY these exact strings:
DC: "battery", "resistor", "variable_resistor", "thermistor", "lamp", "voltmeter", "ammeter", "switch_open", "switch_closed", "diode", "motor", "fuse"
AC: "ac_source", "inductor", "capacitor", "impedance", "current_source"
Universal: "wire", "ground", "open_terminal"

### When to use AC components:
- AC circuit / alternating current → use "ac_source" not "battery"
- Inductance / coil / L in circuit → use "inductor"
- Capacitance / C in circuit → use "capacitor"
- Z = R + jX or impedance block → use "impedance"
- DC circuit → use "battery"
- Current source questions → use "current_source"

### Circuit config schema:
{
  "type": "circuit",
  "gridSpacing": 80,
  "nodes": [
    {"id": "TL", "col": 0, "row": 0},
    {"id": "TR", "col": 3, "row": 0},
    {"id": "BR", "col": 3, "row": 2},
    {"id": "BL", "col": 0, "row": 2}
  ],
  "wires": [
    {"from": "BL", "to": "TL", "component": "ac_source", "label": "100V"},
    {"from": "TL", "to": "TR", "component": "impedance", "label": "Z = 10Ω"},
    {"from": "TR", "to": "BR", "component": "ammeter", "label": "I"},
    {"from": "BR", "to": "BL", "component": "wire"}
  ],
  "junctions": [],
  "showLabels": true
}

### Rules:
- Every circuit must be a closed loop
- Minimum 4 nodes, minimum 4 wires
- Every node referenced in wires must exist in nodes array
- Labels must match the values given in the question
- Use "wire" for connections with no component
- Add ammeter when current is being calculated
- Add voltmeter in parallel (new branch) when voltage is being measured
- Set diagramConfig: null for phasor diagram questions (these cannot be rendered as circuits)

### Multi-loop circuit examples

**Two resistors in series with voltmeter across R2:**
Nodes: TL(0,0), TM0(2,0), TM1(4,0), TR(6,0), BR(6,2), BL(0,2), VM_BOT(4,3), VM_BOT2(6,3)
Wires: BL→TL: battery "6V", TL→TM0: resistor "R₁ = 4Ω", TM0→TM1: resistor "R₂ = 2Ω", TM1→TR: wire, TR→BR: wire, BR→BL: wire, TM0→VM_BOT: wire, VM_BOT→VM_BOT2: voltmeter "V", VM_BOT2→TM1: wire
Junctions: TM0, TM1

**Series-parallel combination (R₁ in series with R₂∥R₃):**
Nodes: TL(0,0), TM(2,0), TR(4,0), ML(2,2), MR(4,2), BL(0,2)
Wires: BL→TL: battery "12V", TL→TM: resistor "R₁ = 6Ω", TM→TR: resistor "R₂ = 4Ω", ML→MR: resistor "R₃ = 4Ω", TM→ML: wire, TR→MR: wire, MR→BL: wire
Junctions: TM, MR

**Wheatstone bridge:**
Nodes: TL(0,0), TM(2,0), TR(4,0), BL(0,2), BM(2,2), BR(4,2)
Wires: TL→TM: resistor "P", TM→TR: resistor "Q", BL→BM: resistor "R", BM→BR: resistor "S", TM→BM: galvanometer "G", TL→BL: battery "E", TR→BR: wire
Junctions: TM, BM

**Three components in series:**
Nodes: TL(0,0), TM1(2,0), TM2(4,0), TR(6,0), BR(6,2), BL(0,2)
Wires: BL→TL: battery, TL→TM1: resistor "R₁", TM1→TM2: resistor "R₂", TM2→TR: lamp "L₁", TR→BR: ammeter "A", BR→BL: wire

IMPORTANT RULES FOR MULTI-LOOP CIRCUITS:
- Every junction where wires branch MUST be listed in the junctions array
- Every node referenced in a wire must exist in the nodes array
- The circuit must form at least one complete closed loop
- Never leave a wire endpoint unconnected
- For parallel branches always add junction dots at both split and merge points
- Labels must exactly match the values given in the question
- "galvanometer" is a supported component type (renders as circle with G)
` : '';

  const deltaWyeBlock = hasDeltaWyeTopic && !suppressDiagrams ? `
## DELTA VS WYE COMPARISON DIAGRAM
For delta vs wye comparison questions:
Set diagramConfig: { "type": "delta_wye_comparison" }
No other fields needed — the diagram is static.
` : '';

  // ── BLOCK 11: CHART DATA INSTRUCTIONS ─────────────────────────────────────
  // Bar chart, pie chart, and data table appear across EVERY subject (Geography,
  // Economics, Biology, Sociology, Business, Psychology, Maths, etc.) so they are
  // ALWAYS included regardless of subject. Climate is gated to Geography. Box plot,
  // histogram, cumulative frequency, and frequency polygon are gated to maths/stats.
  const isGeographySubject =
    /geography|environmental|earth|climate|ecology|sustainability|urban|rural|geopolitics|international.?relations|development.?studies|tourism|planning/i.test(subject) ||
    topics.some(t =>
      /climate|weather|population|development|migration|ecosystem|biome|tectonic|river|coastal|rainfall|temperature|humidity|birth.?rate|death.?rate|gdp|hdi|urbanisation|demographic|land.?use|agriculture/i.test(t)
    );
  const isStatisticsSubject =
    /statistics|maths|mathematics|data.?handling|data.?science|data.?analysis|quantitative|analytics|biostatistics|research.?methods|econometrics|biometrics|actuarial|probability|machine.?learning|business.?intelligence|clinical.?trials|epidemiology|psychometrics|sports.?science|nursing|health.?science|social.?science|sociology|psychology|economics|biology|physics|chemistry|engineering|computer.?science/i.test(subject) ||
    topics.some(t =>
      /cumulative|frequency|quartile|box.?plot|median|interquartile|statistical|data.?handling|averages|spread|distribution|histogram|standard.?deviation|variance|correlation|regression|hypothesis|normal.?distribution|sampling|significance|confidence.?interval|survey|experiment|trial|measurement|dataset/i.test(t)
    );
  // Topic-level fallback: if any selected topic suggests stats charts, unlock them
  // even when the subject name does not match (e.g. "Business Analytics" → topics include "regression").
  const topicSuggestsStats = topics.some(t =>
    /histogram|box.?plot|quartile|cumulative|frequency.?polygon|normal.?distribution|standard.?deviation|regression|correlation|significance|confidence|variance|dispersion|skew|spread|outlier|percentile/i.test(t)
  );
  const shouldIncludeStatsCharts = isStatisticsSubject || topicSuggestsStats;

  // ── ALWAYS INCLUDED: bar chart, pie chart, data table ─────────────────────
  const alwaysIncludeCharts = `
## DATA TABLE, BAR CHART, AND PIE CHART — APPLY TO EVERY SUBJECT

🚨 CRITICAL — CHART/TABLE RECONSTRUCTION FOR EXTRACTED QUESTIONS 🚨
You are extracting questions from a source PDF. The source PDF may contain charts
and tables as IMAGES that the student app CANNOT display. The student will see ONLY
the JSON you produce — there is NO fallback to the original PDF chart image.

Therefore, whenever a question references a chart, table, graph, diagram or figure
(phrases like "the bar chart shows", "from the table", "the pie chart displays",
"using the graph", "complete the table"), you MUST reconstruct that chart/table
as a chart_data JSON object. If the source values are unreadable, INVENT plausible
values that make the question mathematically answerable and consistent with the
correct_answer. Never emit a question that depends on a chart without including
chart_data — that question becomes unanswerable for the student.

Required chart_data type by reference:
- "bar chart" / "column chart" / "dual bar chart" → type: "bar_chart"
- "pie chart" → type: "pie_chart"
- "table" (rows of data, frequency table, results table) → type: "data_table"
- "histogram" → type: "histogram"  (only if stats subject; else use bar_chart)
- "cumulative frequency" → type: "cumulative_frequency"
- "frequency polygon" → type: "frequency_polygon"
- "climate graph" → type: "climate_chart"
- "box plot" → type: "boxplot"

For ANY question providing tabular data for the student to read from (statistics,
survey results, experimental data, economic/geographical/biological/sociological data), include:
{
  "type": "data_table",
  "headers": ["Country", "GDP per capita"],
  "units": ["", "$"],
  "rows": [["Germany", 48200], ["France", 43500], ["Poland", 18400], ["Spain", 32100]],
  "caption": "Table 1: GDP per capita, 2023",
  "footnote": "Source: World Bank, 2023"
}
Rules: headers length must equal each row length. First column is usually a text label.
4–10 rows. Do NOT write "the table below shows" — write "Calculate the mean from the data".

For bar chart questions (comparing categorical values):
{
  "type": "bar_chart",
  "caption": "Figure 1: Brief description",
  "xLabel": "Category", "yLabel": "Value",
  "orientation": "vertical",
  "bars": [
    { "label": "A", "value": 45 },
    { "label": "B", "value": 72 }
  ]
}
For grouped bars use "grouped": [{ "groupLabel": "2020", "bars": [...] }] instead.
3–10 bars; positive values. Do NOT write "the bar chart below".

For pie chart questions (proportions, percentages, market share):
{
  "type": "pie_chart",
  "caption": "Figure 1: Brief description",
  "showPercentages": true,
  "segments": [
    { "label": "A", "value": 45 },
    { "label": "B", "value": 30 },
    { "label": "C", "value": 25 }
  ]
}
3–8 segments; values can be raw or percentages. Do NOT write "the pie chart below".

SPECIFIC CHART QUESTION PATTERNS — follow these exactly:

Pattern 1 — "The bar chart shows X. What/How many/Which...":
These are bar chart READING questions. You MUST include chart_data of type bar_chart
with realistic data values that make the question answerable.
Example: "On which day were the least books sold?" requires bar_chart data
with 5 bars (Mon-Fri) and different values so one day is clearly least.

Pattern 2 — "The pie chart shows X. (a) What fraction... (b) Calculate the angle...":
These are pie chart READING questions. You MUST include chart_data of type pie_chart
with segment values that match the question (e.g. if Blue is 90° out of 360°
then Blue segment value = 25 out of 100, or 30 out of 120).

Pattern 3 — "Complete the table and draw an accurate pie/bar chart":
These are CONSTRUCTION questions. Include table_grid for the table part
and correct_chart_data for the chart the student should draw.
Do NOT include chart_data (no chart shows during the exam).

Pattern 4 — "The dual bar chart shows X and Y from Jan to Jun":
These are grouped bar chart questions. Use chart_data of type bar_chart
with the grouped structure (not the simple bars structure).
Include realistic data for both groups across all time periods.

Pattern 5 — Survey/experiment results shown in a chart:
Always include the actual data values in chart_data.
The student must be able to read specific values from the chart to answer.
Do not use placeholder values — use values that make the question answerable.

For DRAW/CONSTRUCT chart questions ("draw a pie chart", "construct a bar chart"):
- The student cannot draw on screen — set chart_data to null
- Include correct_chart_data with the completed chart for the review page
- Example: { "correct_chart_data": { "type": "pie_chart", "segments": [...] } }

Do NOT include chart_data for concept-only questions like "Explain what the median represents".
`;

  // ── GEOGRAPHY-ONLY: climate chart ─────────────────────────────────────────
  const geographyCharts = isGeographySubject ? `
## CLIMATE GRAPH — GEOGRAPHY ONLY

For climate graph questions (Geography climate / biomes):
{
  "type": "climate_chart",
  "location": "Lagos, Nigeria",
  "tempUnit": "°C", "precipUnit": "mm",
  "months": [
    { "month": "Jan", "temperature": 27, "precipitation": 28 },
    ...exactly 12 entries Jan–Dec...
  ]
}
months MUST contain exactly 12 entries. Do NOT write "from the climate graph".
` : '';

  // ── MATHS / STATS-ONLY: box plot, histogram, cumulative frequency, polygon ─
  const statsCharts = shouldIncludeStatsCharts ? `
## BOX PLOT, HISTOGRAM, CUMULATIVE FREQUENCY, FREQUENCY POLYGON — MATHS/STATS

For questions involving box plots, five-number summaries, quartiles, or IQR, include a chart_data field:
{
  "type": "boxplot",
  "data": { "min": number, "q1": number, "med": number, "q3": number, "max": number },
  "outliers": [],
  "xLabel": "string",
  "domainX": [min_with_padding, max_with_padding]
}
Rules: min < q1 < med < q3 < max always. IQR must be > 0.
Question text must say "The box plot shows..." so the student knows a diagram is displayed.

For comparison questions with two box plots:
{
  "type": "boxplot_comparison",
  "datasets": [
    { "label": "Class A", "data": { "min": 42, "q1": 55, "med": 67, "q3": 78, "max": 95 }, "outliers": [] },
    { "label": "Class B", "data": { "min": 38, "q1": 50, "med": 71, "q3": 82, "max": 98 }, "outliers": [] }
  ],
  "xLabel": "Test scores",
  "domainX": [20, 110]
}

For histogram questions:
{
  "type": "histogram",
  "bins": [{ "lower": 0, "upper": 10, "frequency": 5 }, { "lower": 10, "upper": 20, "frequency": 12 }],
  "xLabel": "Height (cm)",
  "yLabel": "Frequency density"
}

For cumulative frequency questions (estimating median/quartiles from grouped data):
{
  "type": "cumulative_frequency",
  "caption": "Figure 1: Brief description",
  "xLabel": "Value", "yLabel": "Cumulative Frequency",
  "totalFrequency": 80,
  "showMedianLine": true, "showQuartileLines": true,
  "points": [
    { "upperBoundary": 20, "cumulativeFrequency": 5 },
    { "upperBoundary": 40, "cumulativeFrequency": 18 },
    { "upperBoundary": 60, "cumulativeFrequency": 42 },
    { "upperBoundary": 100, "cumulativeFrequency": 80 }
  ]
}
points must be ascending; cumulativeFrequency non-decreasing. Do NOT write "from the curve".

For frequency polygon questions (distribution comparisons):
{
  "type": "frequency_polygon",
  "xLabel": "Value", "yLabel": "Frequency",
  "classes": [
    { "lowerBoundary": 140, "upperBoundary": 150, "frequency": 8 },
    { "lowerBoundary": 150, "upperBoundary": 160, "frequency": 15 }
  ]
}
For two groups use "datasets": [{ "label": "A", "classes": [...] }, ...].
Equal class widths. Do NOT write "from the frequency polygon".

Do NOT include chart_data for concept-only questions like "Explain what the median represents".
` : '';

  // Combine — bar/pie/table always included; climate gated to geo; stats charts gated to maths.
  const chartDataBlock = `${alwaysIncludeCharts}${geographyCharts}${statsCharts}`;


  // ── ASSEMBLE USER PROMPT ──────────────────────────────────────────────────
  const userPrompt = [
    contextBlock,
    subjectRulesBlock,
    questionCountBlock,
    mcqRulesBlock,
    writtenRulesBlock,
    mediaInstruction,
    markDistributionInstruction,
    suppressionNotice,
    nodalAnalysisInstruction,
    sourceBlock,
    topicTagBlock,
    graphBlock,
    MULTI_PART_GRAPH_INSTRUCTIONS,
    circuitBlock,
    buildBiologyInstructions(subject),
    buildMathsInstructions(subject),
    (/physics|physical\s*science|natural\s*science|\bscience\b|combined\s*science|gcse\s*science|a[\s-]level\s*science|triple\s*science|optics|electronics|engineering|igcse\s*physics|ib\s*physics|ap\s*physics/i.test(subject) && !suppressDiagrams) ? buildPhysicsInstructions() : '',
    deltaWyeBlock,
    chartDataBlock,
    outputBlock,
  ].filter(s => s.trim().length > 0).join('\n\n');

  return { systemPrompt, userPrompt };
}

// Track which model was actually used for logging
let modelUsed = 'google/gemini-2.5-flash';

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string, hasResourcePack: boolean) {
  // ── OPTIMISATION 4: Always try Flash first, only upgrade to Pro on failure ──
  try {
    console.log('Attempting generation with gemini-2.5-flash');
    const result = await callAIWithModel(apiKey, systemPrompt, userPrompt, hasResourcePack, 'google/gemini-2.5-flash');
    if (result?.questions && result.questions.length > 0) {
      console.log('Flash generation successful');
      modelUsed = 'google/gemini-2.5-flash';
      return result;
    }
    console.log('Flash returned no questions — upgrading to Pro');
  } catch (flashError: any) {
    console.log('Flash failed — upgrading to Pro:', flashError.message);
  }

  // Only reach here if Flash failed
  console.log('Attempting generation with gemini-2.5-pro');
  modelUsed = 'google/gemini-2.5-pro';
  return await callAIWithModel(apiKey, systemPrompt, userPrompt, hasResourcePack, 'google/gemini-2.5-pro');
}

async function callAIWithModel(apiKey: string, systemPrompt: string, userPrompt: string, hasResourcePack: boolean, model: string) {
  console.log(`AI model selected: ${model}`);

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
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

// ── OPTIMISATION 2: Quality scoring function ──
function scoreGenerationQuality(
  questions: any[],
  params: { desiredMcqCount: number; desiredWrittenCount: number; subject: string; isCustomNiche: boolean; }
): number {
  if (!questions || questions.length === 0) return 0;
  let score = 100;

  const totalDesired = params.desiredMcqCount + params.desiredWrittenCount;
  if (totalDesired > 0 && questions.length / totalDesired < 0.8) score -= 25;

  const mcqQuestions = questions.filter(q => q.question_type === 'mcq');
  const brokenMcq = mcqQuestions.filter(q =>
    !q.options || !Array.isArray(q.options) || q.options.length !== 4 || !q.correct_answer
  );
  if (brokenMcq.length > 0) score -= (brokenMcq.length / Math.max(mcqQuestions.length, 1)) * 30;

  const missingAnswers = questions.filter(q => !q.correct_answer);
  if (missingAnswers.length > 0) score -= (missingAnswers.length / questions.length) * 25;

  if (params.isCustomNiche) {
    const mathsPatterns = [/\bP\(X\s*[=<>]/, /binomial|poisson|normal distribution/i, /\blet\s+X\b/i];
    const contaminated = questions.filter(q => mathsPatterns.some(p => p.test(q.question_text ?? '')));
    if (contaminated.length > 0) score -= contaminated.length * 15;
  }

  return Math.max(0, Math.round(score));
}

async function regenerateQuestions(questions: any[], supabase: any, apiKey: string, hasResourcePack: boolean = false, resourceContext: string = '', subjectId: string = '', isCustomNiche: boolean = false, questionType: 'mcq' | 'short_answer' | 'long_form' | 'mixed' = 'mixed') {
  // Group questions by root_question_number so sibling sub-parts are regenerated TOGETHER
  const grouped: Record<string, any[]> = {};
  for (const q of questions) {
    const root = q.root_question_number || q.parent_question_number || q.question_number;
    if (!grouped[root]) grouped[root] = [];
    grouped[root].push(q);
  }

  const rootKeys = Object.keys(grouped).slice(0, 10); // Limit to prevent timeout

  for (const rootNum of rootKeys) {
    const siblings = grouped[rootNum];
    siblings.sort((a: any, b: any) => String(a.question_number).localeCompare(String(b.question_number)));

    const siblingsSummary = siblings.map((s: any) =>
      `  Part ${s.question_number}: "${s.question_text}" [${s.marks} marks, type: ${s.question_type}]`
    ).join('\n');

    const regenPrompt = `
You are rewriting exam questions about "${subjectId}".
Write completely new questions — do not copy the originals.
Keep the same question type, mark allocation, and topic as the originals.

${isCustomNiche ? `All questions must be about "${subjectId}" only. No mathematics, statistics, or unrelated content.` : ''}

${questionType === 'mcq' ? `
These are MCQ questions. Every rewritten question must:
- Start with: What, Which, Identify, Select, According to, How, When, Where
- NEVER start with: State, Describe, Explain, Calculate, Discuss, Outline, Evaluate
- Have exactly 4 plausible options
- Have one clearly correct answer that matches an option exactly
- Be completely self-contained
` : `
These are written questions. Use appropriate command verbs.
Keep the same mark allocation.
`}

Original questions to rewrite:
${siblingsSummary}

${hasResourcePack && resourceContext ? `Source context:\n${resourceContext.slice(0, 3000)}` : ''}

Return a JSON array only:
[{"question_number": "1", "question_text": "rewritten question here", "options": ${questionType === 'mcq' ? '[\"opt A\", \"opt B\", \"opt C\", \"opt D\"]' : 'null'}, "correct_answer": "...", "mark_scheme": "..."}]
`;

    try {
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: regenPrompt }],
          temperature: questionType === 'mcq' ? 0.3 : 0.5,
          response_format: { type: 'json_object' },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        let content = data.choices?.[0]?.message?.content?.trim() || '';
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        let parsed: any[];
        try {
          const raw = JSON.parse(content);
          parsed = Array.isArray(raw) ? raw : (raw.questions || raw.parts || Object.values(raw)[0]);
          if (!Array.isArray(parsed)) throw new Error('Not array');
        } catch {
          console.error(`Failed to parse regen response for Q${rootNum}`);
          continue;
        }

        // Match regenerated texts back to original sub-parts
        for (let i = 0; i < siblings.length && i < parsed.length; i++) {
          const newText = parsed[i]?.question_text?.trim();
          if (newText && newText.length > 10) {
            const updatePayload: any = {
              original_question_text: siblings[i].question_text,
              question_text: newText,
              generation_status: 'ai_generated',
            };

            // For MCQ regen, also update options and correct_answer if provided
            if (questionType === 'mcq' && parsed[i]?.options && Array.isArray(parsed[i].options)) {
              updatePayload.options = parsed[i].options;
              if (parsed[i]?.correct_answer) {
                updatePayload.correct_answer = parsed[i].correct_answer;
              }
            }

            await supabase.from('exam_question_drafts').update(updatePayload).eq('id', siblings[i].id);
            console.log(`Regenerated Q${siblings[i].question_number} (grouped with Q${rootNum})`);
          }
        }
      }
    } catch (e) { console.error('Regen failed for Q' + rootNum, e); }
  }
}

function normalizeQNum(qNum: string): string {
  const match = String(qNum || '').match(/^(\d+)([a-z]?)(?:\(([ivx]+)\))?$/i);
  if (!match) return String(qNum || '').padStart(10, '0');
  const [, num, letter, roman] = match;
  const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };
  return `${num.padStart(3, '0')}${letter ? `_${letter}` : ''}${roman ? `_${romanMap[roman.toLowerCase()] || 0}` : ''}`;
}
