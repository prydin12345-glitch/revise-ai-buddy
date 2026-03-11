import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.2.1";
import { getRegionalPersona, getRegionAwareSubjectInstructions, getExamHardeningRules } from "../_shared/regional-personas.ts";
import { buildGenerationContext, formatGenerationContextPrompt } from "../_shared/generation-context.ts";

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

  // Determine desired PARENT question count
  const formatData = exam.exam_format?.[0];
  let desiredQuestionCount: number | null = null;
  
  if (formatData) {
    if (formatData.use_original_structure === false) {
      // Custom format or profile-locked: check breakdown first
      const mcq = formatData.mcq_count || 0;
      const sa = formatData.short_answer_count || 0;
      const lf = formatData.long_form_count || 0;
      const breakdownSum = mcq + sa + lf;
      
      if (breakdownSum > 0) {
        // If only short_answer_count is set (profile total stored here), treat as total
        if (mcq === 0 && lf === 0 && sa > 0) {
          desiredQuestionCount = sa;
          console.log('Profile question count from exam_format:', desiredQuestionCount);
        } else {
          desiredQuestionCount = breakdownSum;
        }
      }
    }
  }

  // Fallback: check exam title metadata for a question count hint
  if (!desiredQuestionCount && exam.title) {
    const qMatch = exam.title.match(/\b(\d+)\s*q/i);
    if (qMatch) desiredQuestionCount = parseInt(qMatch[1], 10);
  }
  
  // Check specification topics count to infer — if we have N topics, generate at least N questions
  if (!desiredQuestionCount && specTopics.length > 0) {
    desiredQuestionCount = Math.max(specTopics.length, 8);
  }

  console.log('Desired parent question count:', desiredQuestionCount);

  // Resolve stealth archetype for difficulty calibration
  const archetype = resolveStealthArchetype(qualificationLevel, exam.subject_id || '', curriculumRegion);
  console.log('Stealth archetype resolved:', archetype.name, 'region:', curriculumRegion);

  // Build prompt and call AI - ALWAYS generate NEW questions (never copy verbatim)
  const extractionPrompt = buildPrompt(exam, pdfText, resourcePackContext, specTopics, examBoard, qualificationLevel, false, useFallbackMode, desiredQuestionCount, archetype, curriculumRegion, canonicalTopicList);

  // Detect custom niche subject for system prompt and post-validation
  const subjectLower = (exam.subject_id || '').toLowerCase();
  const isCustomNicheForValidation = !(
    subjectLower.includes('math') || subjectLower.includes('physics') ||
    subjectLower.includes('chemistry') || subjectLower.includes('biology') ||
    subjectLower.includes('english') || subjectLower.includes('history') ||
    subjectLower.includes('geography') || subjectLower.includes('econ') ||
    subjectLower.includes('computer') || subjectLower.includes('psychology') ||
    subjectLower.includes('business') || subjectLower.includes('law') ||
    subjectLower.includes('politics') || subjectLower.includes('statistic')
  );

  // System prompt — subject name FIRST for custom subjects
  const systemPromptOpening = `YOUR SUBJECT THIS SESSION: "${exam.subject_id}"\nALL questions must be about "${exam.subject_id}" ONLY.\n\n`;
  const baseSystemPrompt = hasResourcePack
    ? 'You are an expert exam generator producing professional-standard assessment papers. Create COMPLETELY NEW and ORIGINAL questions based on the source content. Use the sources for context/themes but generate fresh question wording. DO NOT copy questions from the PDF. Return valid JSON.'
    : 'You are an expert exam generator producing professional-standard assessment papers. Create COMPLETELY NEW and ORIGINAL questions inspired by the content. DO NOT copy questions verbatim. Return valid JSON.';
  const systemPrompt = systemPromptOpening + baseSystemPrompt;

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

  // ── HARD ENFORCEMENT: Trim to desiredQuestionCount parent questions ──
  if (desiredQuestionCount && desiredQuestionCount > 0) {
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
  await regenerateQuestions(inserted?.filter((q: any) => !q.has_figures) || [], supabase, lovableApiKey, hasResourcePack, resourcePackContext, exam.subject_id, isCustomNicheForValidation);

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

// ── Stealth Archetype System ──────────────────────────────────────────────────
interface StealthArchetype {
  name: string;
  promptBlock: string;
  minSubParts: number;
  requireScenario: boolean;
}

function resolveStealthArchetype(qualificationLevel: string, subjectId: string, curriculumRegion?: string | null): StealthArchetype {
  const level = (qualificationLevel || '').toLowerCase();
  const subject = (subjectId || '').toLowerCase();
  const region = (curriculumRegion || '').toUpperCase();
  const isMath = subject.includes('math') || subject.includes('maths') || subject.includes('statistics') || subject.includes('stats');
  const isPhysics = subject.includes('physics');
  const isEcon = subject.includes('econ');
  const isEnglish = subject.includes('english');
  const isChemistry = subject.includes('chem');
  const isBiology = subject.includes('bio');
  const isHistory = subject.includes('history') || subject.includes('hist');
  const isGeography = subject.includes('geography') || subject.includes('geog');

  // Region-based flags
  const isUKRegion = region === 'GB' || region === 'UK';
  const isUSRegion = region === 'US';
  const isAURegion = region === 'AU';
  const isCARegion = region === 'CA';
  const isAERegion = region === 'AE';
  const isINRegion = region === 'IN';
  const isSGRegion = region === 'SG';
  const isHKRegion = region === 'HK';
  const isIERegion = region === 'IE';
  const isNZRegion = region === 'NZ';
  const isZARegion = region === 'ZA';
  const isIBRegion = region === 'IB';

  const isLevel2 = level.includes('college') || level.includes('16_18') || level.includes('a_level') || level.includes('a-level') || level.includes('level 2');
  const isLevel1 = level.includes('secondary') || level.includes('14_16') || level.includes('gcse') || level.includes('level 1');
  // Region-aware effective levels
  const effectiveLevel2 = isLevel2 || (isUKRegion && (level.includes('college') || level.includes('sixth') || level.includes('advanced')));
  const effectiveLevel1 = isLevel1 || (isUKRegion && (level.includes('secondary') || level.includes('high')));

  // ── US Region ──
  if (isUSRegion && isMath) {
    return {
      name: 'US_AP_MATHS',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: AP Mathematics (US College Board Standard)
1. Questions must follow AP Calculus/Statistics free-response format.
2. Multi-part: (a) set-up/compute, (b) interpret/justify, (c) extend/evaluate.
3. Use formal AP command language: "justify your answer", "interpret in context", "is there sufficient evidence".
4. LaTeX for all math. Mark ranges: 3-9 points per question.
5. Include real-world data sets and scenarios (surveys, experiments, observational studies).
`
    };
  }

  // ── Australia ──
  if (isAURegion && isMath) {
    return {
      name: 'AU_ATAR_MATHS',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: ATAR Mathematics (Australian Standard)
1. Questions follow WACE/HSC/VCE extended-response style.
2. Multi-part with escalating difficulty: (a) routine calculation, (b) application, (c) analysis.
3. Command verbs: "show that", "hence find", "determine", "explain why".
4. LaTeX for all notation. Real-world contexts required.
`
    };
  }

  // ── India ──
  if (isINRegion && isMath) {
    return {
      name: 'IN_CBSE_MATHS',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: CBSE/ISC Mathematics (Indian Board Standard)
1. Questions follow CBSE Board Examination pattern with Section A (1 mark), B (2 marks), C (3 marks), D (5 marks).
2. Include "prove that", "show that", "find the value of" command verbs.
3. Emphasis on step-by-step working and formal mathematical proof.
4. LaTeX for all notation. Combine theory and application.
`
    };
  }

  // ── Singapore ──
  if (isSGRegion && isMath) {
    return {
      name: 'SG_GCE_MATHS',
      minSubParts: 3,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: GCE A-Level Mathematics (Singapore Standard)
1. Follow Cambridge A-Level format used in Singapore. Multi-part structured questions.
2. Escalation: (i) straightforward, (ii) application, (iii) contextual interpretation.
3. Command verbs: "show that", "hence or otherwise", "deduce", "state".
4. LaTeX for all math. Mark schemes: 8-12 marks per question.
`
    };
  }

  // ── Hong Kong ──
  if (isHKRegion && isMath) {
    return {
      name: 'HK_DSE_MATHS',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: DSE Mathematics (Hong Kong Standard)
1. Follow HKDSE format: conventional questions and multiple-choice.
2. Multi-part: (a) routine, (b) problem-solving, (c) non-routine application.
3. Real-world contexts. Use "find", "show that", "explain".
4. LaTeX for all notation.
`
    };
  }

  // ── Ireland ──
  if (isIERegion && isMath) {
    return {
      name: 'IE_LC_MATHS',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: Leaving Certificate Mathematics (Irish Standard)
1. Follow Leaving Cert Higher/Ordinary Level format.
2. Multi-part with contexts: statistics, probability, calculus, algebra.
3. Command verbs: "investigate", "verify", "show", "solve".
4. LaTeX for all notation. Emphasis on mathematical reasoning.
`
    };
  }

  // ── New Zealand ──
  if (isNZRegion && isMath) {
    return {
      name: 'NZ_NCEA_MATHS',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: NCEA Mathematics (New Zealand Standard)
1. Follow NCEA Achievement Standard format: Achieved, Merit, Excellence tiers.
2. Questions escalate from procedural (Achieved) to relational (Merit) to extended abstract (Excellence).
3. Real-world modelling contexts required.
4. LaTeX for all math notation.
`
    };
  }

  // ── South Africa ──
  if (isZARegion && isMath) {
    return {
      name: 'ZA_NSC_MATHS',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: NSC Mathematics (South African Standard)
1. Follow NSC Paper 1 (Algebra/Calculus) and Paper 2 (Geometry/Trig/Stats) format.
2. Multi-part structured questions with mark allocations.
3. Command verbs: "determine", "prove", "show that", "calculate".
4. LaTeX for all notation. Include data handling/statistics contexts.
`
    };
  }

  // ── IB Diploma ──
  if (isIBRegion && isMath) {
    return {
      name: 'IB_DIPLOMA_MATHS',
      minSubParts: 3,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: IB Diploma Mathematics (International Baccalaureate Standard)
1. Follow IB Mathematics AA/AI Paper 1 & 2 format.
2. Multi-part: (a) show/prove, (b) hence find, (c) interpret/evaluate.
3. Emphasis on mathematical communication and notation.
4. Use "hence or otherwise", "show that", "find", "verify".
5. LaTeX for all notation. Mark ranges: 6-15 marks per question.
6. Include GDC (graphing calculator) and non-GDC sections as appropriate.
`
    };
  }

  // ── UAE / Canada / generic international (non-math subjects fall through) ──
  if ((isAERegion || isCARegion) && isMath) {
    return {
      name: 'INTL_STANDARD_MATHS',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: International Standard Mathematics
1. Multi-part questions with real-world contexts.
2. Escalate from routine calculation to application to evaluation.
3. Use formal command verbs: "calculate", "show that", "explain", "justify".
4. LaTeX for all notation. Mark ranges: 6-12 marks per question.
`
    };
  }

  if ((effectiveLevel2 || isLevel2) && isMath) {
    return {
      name: 'UK_A_LEVEL_MATHS',
      minSubParts: 3,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: Advanced Level 2 Mathematics (Professional Exam Standard)
You are writing questions that match the tone and rigour of a UK A-Level Mathematics paper.

MANDATORY RULES:
1. SCENARIO-FIRST: Every parent question MUST open with a named character and a real-world dataset.
   Examples: "Barbara is investigating the relationship between GDP and population density.",
   "A machine puts liquid into bottles. The volume, $V$ ml, follows $V \\sim N(503, 2.6^2)$."
2. MULTI-PART ESCALATION (THREE-TIER STRUCTURE): Each parent question MUST have 3-5 sub-parts following this cognitive progression:
   (a) Calculation — A straightforward application of a formula. e.g., "Calculate $P(X = 4)$.", "Find $P(X > 10)$."
   (b) Constraint/Assumption — Ask for a condition, assumption, or model justification. e.g., "State two assumptions required for this model.", "Explain why a Poisson distribution is appropriate here.", "State the distribution of $\\bar{X}$."
   (c) 'Show That' / Reverse Question — Higher-difficulty task forcing logarithms, algebraic rearrangement, or inverse reasoning. e.g., "Given that $P(X = 0) = 0.05$, show that $\\lambda \\approx 3.0$.", "Test, at the 5% significance level, whether..."
   (d) Evaluation/Interpretation (2-3 marks) — e.g., "Comment on the validity of this model."
3. MANDATORY FORMAL NOTATION:
   - Use formal probability notation in EVERY question: $P(X = 4)$, $P(X < 2)$, $P(X \\leq 1)$, NOT "Find the likelihood of fewer than 2".
   - State distributions explicitly: $X \\sim \\text{Po}(3.5)$, $Y \\sim B(20, 0.3)$, $W \\sim N(50, 4^2)$.
   - Use the word "probability", NEVER "likelihood" or "chance".
   - Do NOT name distributions in the question text (e.g., do NOT say "Poisson process") — let the student identify the model from context.
4. CLINICAL LINGUISTIC STYLING:
   - Use exam board command verbs ONLY: 'Calculate', 'Determine', 'Evaluate', 'Verify', 'State', 'Show that', 'Hence', 'Deduce', 'Justify', 'Give your answer to 3 significant figures'.
   - NEVER use conversational language: no "Find the likelihood", no "What are the chances", no "How likely is it".
   - At least ONE sub-part per question must require a text-based explanation in context (e.g., "Interpret this value in context.").
5. MARK SCHEME ALIGNMENT:
   - Every sub-part's correct_answer MUST include M1/A1/B1 marking breakdown.
   - M1 = Method mark (correct approach/formula setup), A1 = Accuracy mark (correct numerical answer), B1 = Independent mark (standalone fact/definition).
   - Format: Include marking breakdown in correct_answer like: "M1 for identifying $\\lambda = 3.5$, M1 for $P(X \\leq 1) = P(X=0) + P(X=1)$, A1 for 0.1359"
   - Total marks per sub-part must equal the sum of M/A/B marks.
6. STATISTICS BLUEPRINTS (use these structures when relevant topics appear):
   - Hypothesis Testing: State $H_0$/$H_1$, calculate test statistic, compare with critical value, conclude in context.
   - Normal Distribution: Given $X \\sim N(\\mu, \\sigma^2)$, find probabilities, use coding ($Y = \\frac{X - a}{b}$), inverse normal.
   - Binomial/Poisson: Model real situations, approximate with Normal when $n$ is large.
   - Regression/Correlation: Interpret $r$, use regression line for prediction, comment on extrapolation.
   - Box Plots with Outliers: Provide summary statistics and ask students to identify outliers using $Q_1 - 1.5 \\times IQR$ rule.

CHART DATA FOR STATISTICAL DIAGRAMS:
When a question involves box plots, histograms, or cumulative frequency diagrams, include a "chart_data" field:
{
  "chart_data": {
    "type": "boxplot",
    "data": { "min": 7.6, "q1": 19.5, "med": 23.5, "q3": 26.5, "max": 32.5 },
    "outliers": [7.6],
    "xLabel": "Temperature (°C)",
    "domainX": [5, 35]
  }
}
The frontend will render this as a crisp SVG chart. Do NOT describe the chart in text — provide the data.

7. MARK WEIGHTING: Total marks per parent question should be 8-15. Individual sub-parts: 1-5 marks each.
8. NEVER generate standalone single-mark questions. Every question must have depth.
9. MINIMUM 4 marks per question — no simple 1-2 mark procedural tasks without reasoning.
`
    };
  }

  if ((effectiveLevel1 || isLevel1) && isMath) {
    return {
      name: 'UK_GCSE_MATHS',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: Level 1 Mathematics (Secondary Standard)
MANDATORY RULES:
1. Questions should use real-world contexts (shopping, travel, measurement, data handling).
2. Each parent question should have 2-3 sub-parts escalating from recall to application.
3. Use command verbs: 'calculate', 'work out', 'give your answer to...', 'explain why'.
4. LaTeX for all math: $\\frac{a}{b}$, $x^2$, $\\sqrt{x}$.
5. Mark range per parent: 4-8 marks total.
6. Include chart_data for any questions involving statistical diagrams (box plots, bar charts, pie charts).
`
    };
  }

  // ── Regional Biology Archetypes ──
  if (isUSRegion && isBiology) {
    return { name: 'US_AP_BIO', minSubParts: 2, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: AP Biology (US College Board)
1. Free-response format: "Design an experiment", "Justify your answer using evidence".
2. Data analysis from tables, diagrams, phylogenetic trees.
3. Command verbs: Describe, Explain, Justify, Calculate, Predict, Analyze.
4. Multi-part: (a) identify/describe, (b) explain mechanism, (c) predict outcome, (d) justify.
` };
  }
  if (isINRegion && isBiology) {
    return { name: 'IN_CBSE_BIO', minSubParts: 2, requireScenario: false, promptBlock: `
DIFFICULTY ARCHETYPE: CBSE Biology (Indian Board)
1. "Draw and label", "Differentiate between" — diagram-heavy.
2. Structured: 1-mark (define), 2-mark (differentiate), 3-mark (explain with diagram), 5-mark (detailed).
3. Command verbs: Define, Describe, Explain, Differentiate, Draw, Label, Give reasons.
` };
  }
  if (isSGRegion && isBiology) {
    return { name: 'SG_CAMBRIDGE_BIO', minSubParts: 2, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: Cambridge Biology (Singapore)
1. "Suggest an explanation", high-complexity application.
2. Command verbs: State, Describe, Explain, Suggest, Predict, Deduce, Calculate.
3. Multi-step experimental analysis with data interpretation.
` };
  }
  if (isIBRegion && isBiology) {
    return { name: 'IB_BIO', minSubParts: 2, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: IB Biology (International Baccalaureate)
1. Data-based questions, extended response. IB command terms: Outline, Describe, Explain, Discuss, Evaluate, Suggest, Deduce.
2. Include experimental design, data analysis, ethical evaluation.
3. Reference IB assessment objectives: AO1 (knowledge), AO2 (application), AO3 (synthesis).
` };
  }

  // ── Regional Chemistry Archetypes ──
  if (isUSRegion && isChemistry) {
    return { name: 'US_AP_CHEM', minSubParts: 2, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: AP Chemistry (US College Board)
1. Free-response: "Design a procedure", "Calculate the molar mass".
2. Equilibrium, thermodynamics, kinetics emphasis.
3. Command verbs: Calculate, Justify, Explain, Design, Predict, Represent.
4. AP FRQ scoring (multi-point rubric).
` };
  }
  if (isINRegion && isChemistry) {
    return { name: 'IN_CBSE_CHEM', minSubParts: 2, requireScenario: false, promptBlock: `
DIFFICULTY ARCHETYPE: CBSE Chemistry (Indian Board)
1. "Write the balanced equation", "Name the product", derivation-based.
2. Organic reaction mechanisms, inorganic qualitative analysis.
3. Command verbs: Define, Write, Balance, Name, Explain, Derive, Calculate.
` };
  }
  if (isSGRegion && isChemistry) {
    return { name: 'SG_CAMBRIDGE_CHEM', minSubParts: 3, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: Cambridge Chemistry (Singapore)
1. Multi-step calculations, organic synthesis pathways.
2. Command verbs: State, Describe, Explain, Suggest, Predict, Deduce, Calculate.
3. High-complexity novel reaction scenarios.
` };
  }
  if (isIBRegion && isChemistry) {
    return { name: 'IB_CHEM', minSubParts: 2, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: IB Chemistry (International Baccalaureate)
1. Data analysis, "Deduce the structure", IB command terms.
2. Include data-based questions, stoichiometric calculations, spectroscopic analysis.
3. IB command terms: Define, State, Describe, Explain, Deduce, Predict, Discuss, Evaluate.
` };
  }

  // ── Regional Physics Archetypes ──
  if (isUSRegion && isPhysics) {
    return { name: 'US_AP_PHYSICS', minSubParts: 2, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: AP Physics (US College Board)
1. "Derive an expression", "Justify with physics principles" — FRQ format.
2. Multi-part problem solving with both conceptual and quantitative questions.
3. Command verbs: Derive, Calculate, Justify, Explain, Sketch, Rank, Determine.
4. AP FRQ scoring rubric format.
` };
  }
  if (isINRegion && isPhysics) {
    return { name: 'IN_CBSE_PHYSICS', minSubParts: 2, requireScenario: false, promptBlock: `
DIFFICULTY ARCHETYPE: CBSE Physics (Indian Board)
1. "Derive" expressions, numerical problems with step-by-step working.
2. Ray diagrams, circuit diagrams, force diagrams mandatory.
3. Command verbs: Define, State, Derive, Prove, Calculate, Draw, Explain.
4. Structured: 1-mark (define), 2-mark (state law), 3-mark (numerical), 5-mark (derive + numerical).
` };
  }
  if (isSGRegion && isPhysics) {
    return { name: 'SG_CAMBRIDGE_PHYSICS', minSubParts: 3, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: Cambridge Physics (Singapore)
1. "Calculate the magnitude", multi-part with "hence" chains.
2. Command verbs: State, Calculate, Determine, Explain, Show that, Deduce, Sketch.
3. High mathematical rigour with formal SI notation.
` };
  }
  if (isIBRegion && isPhysics) {
    return { name: 'IB_PHYSICS', minSubParts: 2, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: IB Physics (International Baccalaureate)
1. Paper 2/3 format with data-based questions and extended response.
2. IB command terms: Define, State, Outline, Describe, Explain, Deduce, Determine, Calculate, Discuss, Evaluate.
3. Experimental design, data analysis, uncertainty calculations.
` };
  }

  // ── Regional Economics Archetypes ──
  if (isUSRegion && isEcon) {
    return { name: 'US_AP_ECON', minSubParts: 2, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: AP Economics (US College Board)
1. "Using a correctly labeled graph, show..." — FRQ with mandatory diagrams.
2. Free-response with graph requirements for major questions.
3. Command verbs: Define, Identify, Calculate, Explain, Show (on graph), Determine.
4. Include both Micro and Macro AP-style questions.
` };
  }
  if (isIBRegion && isEcon) {
    return { name: 'IB_ECON', minSubParts: 2, requireScenario: true, promptBlock: `
DIFFICULTY ARCHETYPE: IB Economics (International Baccalaureate)
1. Paper 1: Essay — "Using real-world examples, evaluate...".
2. Paper 2: Data response with calculations and diagram analysis.
3. IB command terms: Define, Describe, Explain, Analyse, Discuss, Evaluate, Compare, Contrast.
` };
  }

  // ── Regional English Archetypes ──
  if (isUSRegion && isEnglish) {
    return { name: 'US_AP_ENGLISH', minSubParts: 1, requireScenario: false, promptBlock: `
DIFFICULTY ARCHETYPE: AP English Language & Composition (US College Board)
1. Rhetorical analysis essay, argument essay, synthesis essay.
2. Passage-based analysis with rhetorical strategies (ethos, pathos, logos).
3. Command verbs: Analyze, Evaluate, Argue, Synthesize, Explain.
4. AP scoring rubric (1-6 scale for essays).
` };
  }
  if (isIBRegion && isEnglish) {
    return { name: 'IB_ENGLISH', minSubParts: 1, requireScenario: false, promptBlock: `
DIFFICULTY ARCHETYPE: IB English (International Baccalaureate)
1. Paper 1: Guided literary analysis of unseen text.
2. Paper 2: Comparative essay on studied works.
3. IB command terms: Analyse, Compare, Evaluate, Discuss, Examine, Comment.
4. Reference IB assessment criteria (Criterion A-D).
` };
  }

  // ── Regional History/Geography Archetypes ──
  if (isUSRegion && isHistory) {
    return { name: 'US_AP_HISTORY', minSubParts: 2, requireScenario: false, promptBlock: `
DIFFICULTY ARCHETYPE: AP History (US College Board)
1. Document-Based Question (DBQ), Long Essay (LEQ), Short Answer (SAQ).
2. Command verbs: Describe, Explain, Evaluate, Compare, Analyze, Identify.
3. Require specific historical evidence and thesis-driven argument.
` };
  }
  if (isIBRegion && isHistory) {
    return { name: 'IB_HISTORY', minSubParts: 2, requireScenario: false, promptBlock: `
DIFFICULTY ARCHETYPE: IB History (International Baccalaureate)
1. Paper 1: Source-based with OPVL analysis.
2. Paper 2/3: Essay with comparative and evaluative tasks.
3. IB command terms: Describe, Explain, Analyse, Compare, Contrast, Evaluate, Discuss, "To what extent".
` };
  }

  // ── Existing UK-specific archetypes ──
  if ((effectiveLevel2 || isLevel2) && isPhysics) {
    return {
      name: 'UK_A_LEVEL_PHYSICS',
      minSubParts: 3,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: Advanced Level 2 Physics (Professional Standard)
1. Every question must include a physical scenario with specific numerical data.
2. Sub-parts escalate: (a) define/state, (b) calculate using equations, (c) explain/evaluate.
3. Use LaTeX for all equations: $F = ma$, $v = u + at$, $E_k = \\frac{1}{2}mv^2$.
4. Include graph questions for motion, force-extension, V-I characteristics.
5. Mark range per parent: 8-15 marks.
`
    };
  }

  if ((effectiveLevel2 || isLevel2) && isEcon) {
    return {
      name: 'UK_A_LEVEL_ECONOMICS',
      minSubParts: 3,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: Advanced Level 2 Economics (Professional Standard)
1. Every question must reference real economic data, markets, or policy scenarios.
2. Sub-parts: (a) define key terms, (b) analyse using diagrams/data, (c) evaluate arguments, (d) discuss.
3. Include chart_data for supply-demand diagrams, cost curves, market equilibrium.
4. Use command verbs: 'analyse', 'evaluate', 'to what extent', 'discuss'.
5. Mark range per parent: 8-20 marks.
`
    };
  }

  // ── Custom/Professional/Niche Subject Archetype ──
  // Fires BEFORE generic fallback for subjects that don't match any standard academic subject
  const isCustomProfessionalSubject = !isMath && !isPhysics && !isChemistry && !isBiology &&
    !isEnglish && !isHistory && !isGeography && !isEcon;

  if (isCustomProfessionalSubject) {
    return {
      name: 'CUSTOM_PROFESSIONAL',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: Specialist / Professional / Vocational Subject
You are generating assessment questions for a specialist professional
or vocational subject: "${subjectId}".
The domain is ENTIRELY defined by the subject name and topics provided.
There is NO standard academic template — do not borrow from other subjects.

MANDATORY GENERATION RULES FOR THIS ARCHETYPE:
1. Questions must assess knowledge specific to "${subjectId}" ONLY
2. Use terminology, standards, regulations, and procedures from this domain
3. Question styles: scenario-based, procedural knowledge,
   regulatory/compliance understanding, practical application
4. Do NOT use probability, statistics, algebra, calculus, or any
   pure mathematics unless the subject explicitly requires it
5. Do NOT generate graphs, coordinate geometry, or formula-based questions
6. Mark scheme should use descriptive marking points (B1 for knowledge),
   NOT M1/A1 codes (those are for maths)
7. For professional/vocational subjects, questions should reflect
   real workplace assessment style
8. Every question must be answerable ONLY by someone trained in "${subjectId}"
`
    };
  }

  // Generic fallback for any Level 2 subject
  if (effectiveLevel2 || isLevel2) {
    return {
      name: 'GENERIC_LEVEL_2',
      minSubParts: 2,
      requireScenario: true,
      promptBlock: `
DIFFICULTY ARCHETYPE: Advanced Level 2 (Professional Standard)
1. Every question must use a real-world scenario or dataset as context.
2. Sub-parts must escalate: (a) recall/identify, (b) apply/analyse, (c) evaluate/justify.
3. Use formal academic language and command verbs: 'evaluate', 'analyse', 'justify', 'to what extent'.
4. Mark range per parent: 6-15 marks.
5. Use LaTeX for any mathematical notation.
`
    };
  }

  return {
    name: 'GENERIC_ACADEMIC',
    minSubParts: 1,
    requireScenario: false,
    promptBlock: `
DIFFICULTY ARCHETYPE: General Academic Standard
1. Questions should test understanding, not just recall.
2. Include a mix of short-answer and extended-response questions.
3. Use LaTeX for mathematical notation where applicable.
`
  };
}

// ── Prompt Builder ───────────────────────────────────────────────────────────
function buildPrompt(exam: any, pdfText: string, resourceCtx: string, specs: any[], board: string, level: string, useOriginal: boolean, fallback: boolean, desiredQuestionCount: number | null = null, archetype?: StealthArchetype, curriculumRegion?: string | null, canonicalTopicList?: string[]): string {
  const specList = specs.length ? `Topics: ${specs.map((s: any) => s.topic_name).join(', ')}\n` : '';

  // Inject regional persona and region-aware subject instructions
  const regionalPersona = getRegionalPersona(curriculumRegion || '');
  const regionSubjectInstructions = getRegionAwareSubjectInstructions(exam.subject_id || '', board, level, curriculumRegion || '');
  const genCtx = buildGenerationContext(curriculumRegion, level);
  const generationContextPrompt = formatGenerationContextPrompt(genCtx);
  
  const mode = fallback 
    ? `Generate typical ${level} ${exam.subject_id} questions (no PDF text available).`
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

  // Subject classification for graph/maths gating
  const isMathSubject = subjectId.includes('math') || subjectId.includes('maths') ||
    subjectId.includes('statistic') || subjectId.includes('calculus') || subjectId.includes('algebra');
  const isPhysicsSubject = subjectId.includes('physics') || subjectId.includes('mechanics') || subjectId.includes('electronic');
  const isChemSubject = subjectId.includes('chemistry') || subjectId.includes('chemical');
  const isBioSubject = subjectId.includes('biology') || subjectId.includes('biolog');
  const isEconSubject = subjectId.includes('econ');
  const isGeogSubject = subjectId.includes('geography') || subjectId.includes('geog');
  const isRecognisedSTEM = isMathSubject || isPhysicsSubject || isChemSubject || isBioSubject;
  const isRecognisedGraphSubject = isRecognisedSTEM || isEconSubject || isGeogSubject;

  // Only graph-specific keywords (not domain-ambiguous ones like "temperature", "pressure")
  const graphSpecificKeywords = [
    'graph', 'curve', 'plot', 'sketch', 'coordinate', 'transform', 'function',
    'f(x)', 'y=', 'linear', 'quadratic', 'cubic', 'parabola', 'asymptote',
    'gradient', 'intercept', 'tangent', 'differentiation', 'integration',
    'polynomial', 'exponential', 'logarithm', 'trigonometric', 'sine', 'cosine',
    'distance-time', 'velocity-time', 'force-extension', 'current-voltage',
    'supply', 'demand', 'market equilibrium', 'projectile motion',
  ];

  // Require BOTH a recognised STEM/graph subject AND graph keywords
  const needsGraphs = isRecognisedGraphSubject && graphSpecificKeywords.some(kw => combinedText.includes(kw));

  // Detect custom/niche professional subjects
  const isCustomNicheSubject = !isRecognisedSTEM &&
    !subjectId.includes('english') && !subjectId.includes('history') &&
    !isGeogSubject && !subjectId.includes('business') && !isEconSubject &&
    !subjectId.includes('psychology') && !subjectId.includes('computer') &&
    !subjectId.includes('law') && !subjectId.includes('politics');

  let graphInstructions = '';
  if (needsGraphs && !isCustomNicheSubject) {
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
    "markingFormula": "REQUIRED — the evaluatable algebraic expression using * for multiplication, ^ for powers, standard function names (sin, cos, ln, abs, sqrt, exp). Examples: 'x^2 - 4*x + 7', '(x+2)*(x-1)*(x-3)', '1/(x+4)', 'sin(2*x)', 'abs(x-2)'. For transformations, pre-compute the substitution: if f(x)=(x+2)*(x-1)*(x-3) and question asks for f(x+1), write '(x+3)*x*(x-2)'. NEVER leave null or as bare reference like 'f(x)'.",
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

RULES:
- At least 20% of questions should be graph questions when visual topics are detected
- If a question says "sketch", "plot", "draw" or "the graph shows" it MUST be graph_plotting
- Graph questions MUST have complete graphConfig with series.data containing at least 10 points
- LaTeX is ONLY for text fields. NEVER put LaTeX in graphConfig numeric data or coordinate arrays
`;
  }

  // HIERARCHICAL QUESTION STRUCTURE INSTRUCTIONS
  const questionCountInstruction = desiredQuestionCount
    ? `
STRICT QUESTION COUNT RULE (CRITICAL — DO NOT VIOLATE):
You MUST generate EXACTLY ${desiredQuestionCount} PARENT questions, numbered 1, 2, 3, ..., ${desiredQuestionCount}.
- A "Parent Question" = one top-level numbered question (Q1, Q2, etc.)
- Sub-parts (a, b, c, d) are CHILDREN of a parent and DO NOT count toward the ${desiredQuestionCount} limit.
- If the limit is ${desiredQuestionCount}, you produce exactly ${desiredQuestionCount} distinct root_question_number values.
- VIOLATION: Producing fewer or more than ${desiredQuestionCount} parent questions is WRONG.
- COUNT CHECK: Before returning, count the number of unique root_question_number values. It MUST equal ${desiredQuestionCount}.`
    : '';

  const minParts = archetype?.minSubParts || 2;
  const hierarchicalInstructions = `

HIERARCHICAL QUESTION STRUCTURE (CRITICAL):
1. A "Parent Question" is a top-level numbered question: Q1, Q2, Q3, etc.
2. Sub-parts (a), (b), (c) are children of a parent question and do NOT count toward the question limit.
3. Each parent question MUST have at least ${minParts} sub-parts that escalate in difficulty.
${questionCountInstruction}

SUB-PART FORMATTING RULES:
- NEVER combine sub-parts (a) and (b) into a single question_text block.
- Each sub-part MUST be its own separate entry in the questions array.
- Each sub-part MUST have its own marks value.
- Use question_number format: "1a" for first sub-part, "1b" for second, etc. Do NOT create a bare "1" entry — only sub-parts appear in the array.
- Set parent_question_number to the parent's number (e.g., "1" for sub-part "1a").
- Set root_question_number to the top-level number (e.g., "1").

QUESTION TEXT QUALITY RULES (CRITICAL):
- Every sub-part question_text MUST contain an explicit, answerable instruction or question.
- NEVER write a question_text that only describes a scenario without asking the student to DO something.
- BAD EXAMPLE: "A quality control engineer needs to determine the likelihood that a battery has a lifespan ranging from 450 to 550 hours."
- GOOD EXAMPLE: "Find the probability that a randomly selected battery has a lifespan between 450 and 550 hours."
- Every question_text MUST start with or contain a command verb: Find, Calculate, State, Show that, Determine, Test, Explain, Justify, Comment on, Hence, Deduce, etc.
- The scenario/context goes in the FIRST sub-part's question_text. Subsequent sub-parts can reference "Using your answer to part (a)..." etc.

EXAMPLE OUTPUT for a question with 3 parts:
[
  {"question_number": "1a", "question_text": "Sarah records the heights, in cm, of 30 plants. The mean height is 45 cm and the standard deviation is 8.2 cm.\\n\\nState the null and alternative hypotheses to test whether the mean height has increased.", "marks": 1, "parent_question_number": "1", "root_question_number": "1"},
  {"question_number": "1b", "question_text": "Using a 5% significance level, find the critical value for this test.", "marks": 3, "parent_question_number": "1", "root_question_number": "1"},
  {"question_number": "1c", "question_text": "State your conclusion in context, giving a reason for your answer.", "marks": 2, "parent_question_number": "1", "root_question_number": "1"}
]
`;

  // Inject stealth archetype prompt
  const archetypeBlock = archetype?.promptBlock || '';

  // Scenario requirement — use subject-appropriate examples
  const scenarioExamples = isCustomNicheSubject
    ? `Examples relevant to "${exam.subject_id}":
- "A technician is performing a quarterly validation test on a large porous load sterilizer."
- "A hospital decontamination unit receives a batch of surgical instruments for processing."
- "An engineer reviews the maintenance log for an autoclave that failed its daily Bowie-Dick test."`
    : `Examples:
- "Sarah records the daily rainfall, in mm, for her town over a 30-day period."
- "A factory produces bolts. The length, $L$ mm, of a bolt follows $L \\sim N(50, 0.4^2)$."
- "Tom is investigating whether there is a correlation between hours studied and test scores."`;

  const scenarioRequirement = archetype?.requireScenario ? `
SCENARIO REQUIREMENT (MANDATORY):
Every parent question MUST begin with a named character or professional context and a real-world scenario.
DO NOT generate abstract standalone questions without context.
The scenario goes in the FIRST sub-part (part a). Later sub-parts reference it.
Use diverse names and scenarios.
${scenarioExamples}
` : '';

  const hardeningRules = getExamHardeningRules();

  // SUBJECT LOCK — hard constraint to prevent subject drift
  const subjectLockInstruction = `
ABSOLUTE RULE — READ THIS FIRST:
You are generating questions EXCLUSIVELY for this subject:
"${exam.subject_id}"

This is a HARD CONSTRAINT. You must NEVER generate questions about:
- Any other academic subject
- Mathematics, statistics, or probability (unless the subject explicitly requires it)
- Physics, chemistry, biology, history, geography or any other domain
- Generic exam-style questions unrelated to "${exam.subject_id}"

EVERY question you generate must:
1. Be directly and specifically about "${exam.subject_id}"
2. Use terminology, procedures, standards, and concepts from "${exam.subject_id}" only
3. Be answerable by someone who has studied "${exam.subject_id}"
4. Be completely unanswerable by someone who has NOT studied "${exam.subject_id}"

If you cannot generate enough high-quality questions about "${exam.subject_id}"
without drifting into other subjects, generate FEWER questions of higher quality.
`;

  // Subject lock repeat — placed AFTER archetype to reassert dominance
  const subjectLockRepeat = `
===== SUBJECT DOMAIN REMINDER (MANDATORY) =====
You are STILL generating questions about: "${exam.subject_id}"
Every question must be about this subject and NOTHING else.
If any instruction above conflicts with this subject domain,
IGNORE that instruction and stay within "${exam.subject_id}".
================================================
`;

  // Explicit prohibitions for custom/niche subjects
  const customSubjectProhibitions = isCustomNicheSubject ? `
EXPLICITLY PROHIBITED for subject "${exam.subject_id}":
- Do NOT generate: probability questions (P(X=...), binomial, Poisson, normal distribution)
- Do NOT generate: algebra or equation solving (find x, solve for y)
- Do NOT generate: graph plotting or coordinate geometry
- Do NOT generate: calculus, differentiation, integration
- Do NOT generate: statistics, data analysis with mathematical formulas
- Do NOT generate: ANY question that could appear in a Mathematics exam
- Do NOT use M1/A1 mark scheme codes — use B1 (knowledge point) marks instead

If you are about to generate a question involving X as a variable
in an equation, STOP and generate a subject-specific question instead.
` : '';

  // For custom subjects, skip chart data schemas and LaTeX-heavy instructions
  const chartSchemas = isCustomNicheSubject ? '' : `
CHART DATA SCHEMAS:
When a question includes tabular or visual data, populate the "chart_data" field:
- Box Plot: {"type":"boxplot","data":{"min":10,"q1":15,"med":20,"q3":28,"max":35},"outliers":[4,42],"xLabel":"Height (cm)"}
- Histogram (unequal class widths): {"type":"histogram","bins":[{"lower":0,"upper":10,"frequency":5},{"lower":10,"upper":25,"frequency":30}],"xLabel":"Time (s)","yLabel":"Frequency Density"}
- Scatter with regression: Include regression data in graph_plotting config via series + a "regressionLine" field: {"slope":0.8,"intercept":2.1}
`;

  const latexInstruction = isCustomNicheSubject
    ? 'Use LaTeX only if the subject requires mathematical or scientific notation.'
    : `Wrap ALL math in LaTeX delimiters: $...$ for inline, $$...$$ for standalone equations.
Use proper LaTeX: \\frac{a}{b}, \\sqrt{x}, x^{2}, \\pi, \\theta, \\Sigma x, \\Sigma x^2, \\Sigma xy, S_{xx}, S_{xy}`;

  return `${subjectLockInstruction}
${regionalPersona}
${generationContextPrompt}
${regionSubjectInstructions ? `\n${regionSubjectInstructions}\n` : ''}
${hardeningRules}
${resourceCtx}
Generate NEW questions for ${level} ${exam.subject_id}.
${specList}${mode}
${archetypeBlock}
${subjectLockRepeat}
${customSubjectProhibitions}
${scenarioRequirement}
${latexInstruction}

${!fallback ? `MARK DISTRIBUTION CLONING: When a reference PDF is provided, replicate the mark allocation pattern from the original paper. If the reference gives 5 marks to a 'Show that' derivation, your generated equivalent must also allocate 5 marks. Match the ratio of low-mark (1-2) to high-mark (5+) questions.` : ''}
${hierarchicalInstructions}${graphInstructions}
REFERENCE PDF (USE FOR INSPIRATION - DO NOT COPY):
${pdfText.substring(0, 45000)}
${chartSchemas}

${canonicalTopicList && canonicalTopicList.length > 0 ? `
TOPIC TAG CONTROLLED VOCABULARY (CRITICAL):
You MUST set topic_tag to EXACTLY one value from this list — do not invent new values, do not change capitalisation, do not add plurals:
${canonicalTopicList.join(', ')}
` : `Set topic_tag to a clear descriptive topic name using Title Case (e.g. "Quadratic Equations" not "quadratic_equations" or "quadratics").`}

Return JSON: {"detected_subject":"string","subject_confidence":0.9,"questions":[{"question_number":"1a","question_type":"short_answer|mcq|long_form|graph_plotting|graph_interpretation","question_text":"YOUR NEW QUESTION (one sub-part only, MUST contain a command verb)","marks":2,"topic_tag":"...","difficulty_level":"medium","has_figures":false,"correct_answer":"string or JSON object for graph questions","chart_data":null,"parent_question_number":"1 or null","root_question_number":"1"}],"topics":[{"topic_name":"...","confidence_score":0.8}]}`;
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

async function regenerateQuestions(questions: any[], supabase: any, apiKey: string, hasResourcePack: boolean = false, resourceContext: string = '', subjectId: string = '', isCustomNiche: boolean = false) {
  // Group questions by root_question_number so sibling sub-parts are regenerated TOGETHER
  const grouped: Record<string, any[]> = {};
  for (const q of questions) {
    const root = q.root_question_number || q.parent_question_number || q.question_number;
    if (!grouped[root]) grouped[root] = [];
    grouped[root].push(q);
  }

  const hardeningRules = getExamHardeningRules();
  const rootKeys = Object.keys(grouped).slice(0, 10); // Limit to prevent timeout

  for (const rootNum of rootKeys) {
    const siblings = grouped[rootNum];
    // Sort by question_number so sub-parts are in order
    siblings.sort((a: any, b: any) => String(a.question_number).localeCompare(String(b.question_number)));

    const siblingsSummary = siblings.map((s: any) => 
      `  Part ${s.question_number}: "${s.question_text}" [${s.marks} marks, type: ${s.question_type}]`
    ).join('\n');

    // Subject-aware regeneration rules
    const subjectRules = isCustomNiche ? `
SUBJECT LOCK (CRITICAL): You are rewriting questions for "${subjectId}" ONLY.
- Do NOT introduce mathematics, probability, statistics, or algebra
- Do NOT use LaTeX distribution notation like $X \\sim B(n,p)$ or $N(\\mu, \\sigma^2)$
- Do NOT generate formula-based or calculation-based questions
- Use domain-specific terminology from "${subjectId}"
- Questions must be answerable ONLY by someone trained in "${subjectId}"
- Use command verbs: State, Describe, Explain, Identify, Outline, Evaluate, Justify, Compare
- Keep mark allocations: ${siblings.map((s: any) => `${s.question_number}=${s.marks}m`).join(', ')}.
` : `
CRITICAL RULES:
1. SCENARIO LOCKING: Introduce ONE scenario in the first sub-part. ALL subsequent sub-parts MUST stay within that EXACT same scenario. NEVER switch topics between parts.
2. CLINICAL TONE: No fluff adjectives ("renowned", "bustling", "freshly"). State facts plainly.
3. FORMAL NOTATION: Define distributions explicitly using LaTeX: $X \\sim B(n,p)$, $Y \\sim N(\\mu, \\sigma^2)$, $Z \\sim \\text{Po}(\\lambda)$. Use "probability" NEVER "likelihood".
4. COMMAND VERBS: Every sub-part must start with Calculate, State, Determine, Show that, Test, Explain, Justify, Hence, or Deduce.
5. LOGICAL PROGRESSION: (a) base calculation, (b) assumption/constraint, (c) scale/approximate/test.
6. For large-sample sub-parts (n ≥ 30): instruct "Use a suitable approximation" and require continuity correction.
7. For sub-parts worth 4+ marks: include guidance like "State your hypotheses clearly. Show your working."
8. Keep mark allocations: ${siblings.map((s: any) => `${s.question_number}=${s.marks}m`).join(', ')}.
`;

    const basePrompt = `${hardeningRules}

${isCustomNiche ? `YOUR SUBJECT: "${subjectId}" — ALL rewritten questions must be about this subject ONLY.\n` : ''}
You are rewriting an entire multi-part exam question. ALL sub-parts MUST share the SAME scenario/context (Thread Rule).

ORIGINAL QUESTION GROUP (Q${rootNum}) — DO NOT COPY, create something NEW:
${siblingsSummary}

Topic: ${siblings[0]?.topic_tag || 'general'}
${isCustomNiche ? `Subject: ${subjectId}` : ''}

${subjectRules}

${hasResourcePack && resourceContext ? `SOURCE CONTEXT:\n${resourceContext.substring(0, 3000)}\n` : ''}

Return a JSON array of objects, one per sub-part, in this exact format:
[{"question_number": "${siblings[0]?.question_number}", "question_text": "new text here"}, ...]
Return ONLY the JSON array.`;

    try {
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: basePrompt }],
          temperature: 0.5,
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
            await supabase.from('exam_question_drafts').update({
              original_question_text: siblings[i].question_text,
              question_text: newText,
              generation_status: 'ai_generated',
            }).eq('id', siblings[i].id);
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
