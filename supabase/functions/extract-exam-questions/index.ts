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

  // Download and extract PDF text
  const pdfText = await extractPdfText(exam.file_url, supabase);
  const useFallbackMode = pdfText.length < 100;

  // Build prompt and call AI
  const extractionPrompt = buildPrompt(exam, pdfText, resourcePackContext, specTopics, examBoard, qualificationLevel, useOriginalStructure, useFallbackMode);
  const systemPrompt = hasResourcePack
    ? 'You are an expert exam generator with STRICT source adherence. ONLY use characters/content from provided sources. Return valid JSON.'
    : 'You are an expert exam generator. Create original questions. Return valid JSON.';

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
  
  const drafts = questions.map((q: any, i: number) => ({
    exam_id: draftId,
    question_number: String(q.question_number || i + 1),
    question_type: q.question_type || 'short_answer',
    question_text: q.question_text || '',
    question_latex: q.question_latex || null,
    has_math: q.has_math || false,
    parent_question_number: q.parent_question_number || null,
    root_question_number: q.root_question_number || String(q.question_number || i + 1).match(/^\d+/)?.[0],
    marks: q.marks || 1,
    options: q.options || null,
    correct_answer: q.question_type === 'mcq' ? (q.correct_answer || 'A') : q.correct_answer,
    has_figures: q.has_figures || false,
    has_tables: q.has_tables || false,
    topic_tag: q.topic_tag || null,
    difficulty_level: q.difficulty_level || null,
    extraction_confidence: q.extraction_confidence || 0.9,
    generation_status: useFallbackMode ? 'ai_generated' : 'extracted',
  }));

  const { data: inserted, error: insertError } = await supabase.from('exam_question_drafts').insert(drafts).select();
  if (insertError) throw new Error(`Failed to save questions: ${insertError.message}`);

  // Regenerate non-image questions if needed (only when NOT resource-based)
  if (useOriginalStructure && !hasResourcePack) {
    await regenerateQuestions(inserted?.filter((q: any) => !q.has_figures) || [], supabase, lovableApiKey);
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

async function extractPdfText(fileUrl: string, supabase: any): Promise<string> {
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

function buildPrompt(exam: any, pdfText: string, resourceCtx: string, specs: any[], board: string, level: string, useOriginal: boolean, fallback: boolean): string {
  const specList = specs.length ? `Topics: ${specs.map((s: any) => s.topic_name).join(', ')}\n` : '';
  const mode = fallback 
    ? `Generate typical ${board.toUpperCase()} ${level} ${exam.subject_id} questions (no PDF text available).`
    : useOriginal ? 'PRESERVE structure but create NEW wording.' : 'Generate NEW questions from content.';
  
  return `${resourceCtx}
Extract/generate questions for ${board.toUpperCase()} ${level} ${exam.subject_id}.
${specList}${mode}

Use LaTeX for math: "$x^2$", "$\\frac{1}{2}$". NEVER use HTML tags.

PDF CONTENT:
${pdfText.substring(0, 45000)}

Return JSON: {"detected_subject":"string","subject_confidence":0.9,"questions":[{"question_number":"1","question_type":"short_answer","question_text":"...","marks":2,"topic_tag":"...","difficulty_level":"medium","has_figures":false}],"topics":[{"topic_name":"...","confidence_score":0.8}]}`;
}

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string, hasResourcePack: boolean) {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
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

async function regenerateQuestions(questions: any[], supabase: any, apiKey: string) {
  for (const q of questions.slice(0, 20)) { // Limit to prevent timeout
    const prompt = `Create a NEW question testing same concept as: "${q.question_text}"\nTopic: ${q.topic_tag}, Marks: ${q.marks}\n\nReturn ONLY the new question text.`;
    
    try {
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
        }),
      });
      
      if (resp.ok) {
        const data = await resp.json();
        const newText = data.choices?.[0]?.message?.content;
        if (newText) {
          await supabase.from('exam_question_drafts').update({
            original_question_text: q.question_text,
            question_text: newText,
            generation_status: 'ai_generated',
          }).eq('id', q.id);
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
