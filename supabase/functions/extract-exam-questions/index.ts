import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.2.1";
import { detectLiteraryText, buildLiteraryTextInstructions, buildExtractSafetyInstruction } from "../_shared/copyright-rules.ts";

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
  let profileMeta: { mcq_options_count?: number; include_graphs?: boolean; include_tables?: boolean } = {};
  
  if (formatData) {
    // Extract profile metadata — keys may be camelCase (from frontend) or snake_case
    if (formatData.profile_metadata && typeof formatData.profile_metadata === 'object') {
      const pm = formatData.profile_metadata;
      profileMeta = {
        mcq_options_count: pm.mcq_options_count ?? pm.mcqOptionsCount ?? undefined,
        include_graphs: pm.include_graphs ?? pm.includeGraphs ?? undefined,
        include_tables: pm.include_tables ?? pm.includeTables ?? undefined,
      };
    }

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

  const parsedData = await callAI(lovableApiKey, systemPrompt, extractionPrompt, hasResourcePack);
  
  if (!parsedData.questions?.length) {
    await supabase.from('exams').update({ extraction_status: 'failed', extraction_error: 'No questions found' }).eq('id', draftId);
    throw new Error('No questions found');
  }

  // Sort questions
  let questions = parsedData.questions.sort((a: any, b: any) => 
    normalizeQNum(a.question_number).localeCompare(normalizeQNum(b.question_number))
  );

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
    const qType = q.question_type || 'short_answer';
    let correctAnswer = q.correct_answer;
    let options = q.options || null;
    
    // For graph questions, correct_answer is a JSON object — stringify for storage and copy to options
    if ((qType === 'graph_plotting' || qType === 'graph_interpretation') && typeof correctAnswer === 'object' && correctAnswer !== null) {
      options = correctAnswer;
      correctAnswer = JSON.stringify(correctAnswer);
      console.log(`Q${q.question_number}: Graph question detected, synced to options`);
    } else if (qType === 'mcq') {
      // Validate MCQ correct_answer — do NOT silently default to 'A'
      if (!correctAnswer) {
        console.error(`Missing correct_answer for MCQ Q${q.question_number}: "${(q.question_text || '').slice(0, 80)}"`);
        // Leave as null — do not guess
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
  const regenQuestionType: 'mcq' | 'short_answer' | 'long_form' | 'mixed' = isMcqOnlyProfile ? 'mcq' : (desiredMcqCount === 0 ? 'mixed' : 'mixed');
  await regenerateQuestions(inserted?.filter((q: any) => !q.has_figures) || [], supabase, lovableApiKey, hasResourcePack, resourcePackContext, exam.subject_id, isCustomNicheForValidation, regenQuestionType);

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
  } = params;

  const totalQuestions = desiredMcqCount + desiredWrittenCount;
  const isMcqOnly = desiredMcqCount > 0 && desiredWrittenCount === 0;
  const isWrittenOnly = desiredWrittenCount > 0 && desiredMcqCount === 0;
  const isMixed = desiredMcqCount > 0 && desiredWrittenCount > 0;

  // ── SYSTEM PROMPT ──────────────────────────────────────────────────────────
  const systemPrompt = `You are an expert exam question writer.
Your only job is to write original, high quality exam questions.
You always return valid JSON and nothing else.
Every question you write must be directly and specifically about: "${subject}"`;

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
      questionCountBlock += `Generate exactly ${parentQuestionCount} parent questions, each with up to ${maxPartsPerQuestion} sub-parts labelled (a), (b), (c) etc.
Total written parts should be approximately ${desiredWrittenCount}.`;
    } else {
      questionCountBlock += `Generate ${desiredWrittenCount} written questions using a mix of standalone questions and questions with sub-parts.`;
    }
    if (includeExtended && extendedResponseMarks > 0) {
      questionCountBlock += `\nThe final question must be an extended response question worth ${extendedResponseMarks} marks.`;
    }
  } else if (isMixed) {
    questionCountBlock += `Generate two sections:
Section A: ${desiredMcqCount} multiple choice questions (standalone, numbered 1 through ${desiredMcqCount}, 1 mark each)
Section B: ${desiredWrittenCount} written questions (${questionStructure === 'sub_questions' ? `${parentQuestionCount} parent questions with sub-parts` : 'standalone questions'})
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

  // ── BLOCK 8: OUTPUT FORMAT ────────────────────────────────────────────────
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

  // ── ASSEMBLE USER PROMPT ──────────────────────────────────────────────────
  const userPrompt = [
    contextBlock,
    subjectRulesBlock,
    questionCountBlock,
    mcqRulesBlock,
    writtenRulesBlock,
    sourceBlock,
    topicTagBlock,
    outputBlock,
  ].filter(s => s.trim().length > 0).join('\n\n');

  return { systemPrompt, userPrompt };
}

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string, hasResourcePack: boolean) {
  // Use stronger model for custom niche subjects to reduce hallucination
  const sysLower = systemPrompt.toLowerCase();
  const isNicheSubject = !(
    sysLower.includes('math') || sysLower.includes('physics') ||
    sysLower.includes('chemistry') || sysLower.includes('biology') ||
    sysLower.includes('english') || sysLower.includes('history') ||
    sysLower.includes('geography') || sysLower.includes('econ') ||
    sysLower.includes('computer') || sysLower.includes('psychology')
  );
  const selectedModel = isNicheSubject ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash';
  console.log(`AI model selected: ${selectedModel} (niche=${isNicheSubject})`);

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: selectedModel,
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
