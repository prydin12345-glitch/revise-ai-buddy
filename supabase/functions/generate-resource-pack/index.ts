import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/* ─── subject-specific prompt builders ─── */

function buildEnglishLanguagePrompt(params: {
  sourceType: string;
  topic: string;
  extractLength: string;
  readingLevel: string;
  lineNumbering: string;
  educationalTier?: string;
  examBoard?: string;
}) {
  const lengthMap: Record<string, { words: string; lines: string }> = {
    short:  { words: '280–320', lines: '1–30' },
    medium: { words: '480–520', lines: '1–50' },
    long:   { words: '780–820', lines: '1–80' },
  };
  const len = lengthMap[params.extractLength] || lengthMap.medium;
  const lineRule = params.lineNumbering === 'every_line'
    ? 'Number every line (1, 2, 3…) in the left margin.'
    : 'Number every 5th line (5, 10, 15…) in the left margin.';

  const sourceTypeLabels: Record<string, string> = {
    '21st_century_fiction': '21st century prose fiction',
    '19th_century_fiction': '19th century prose fiction',
    'literary_nonfiction': 'Literary non-fiction',
    'travel_writing': 'Travel writing',
    'newspaper_article': 'Newspaper / magazine article',
    'autobiography': 'Autobiography or memoir',
    'descriptive_writing': 'Descriptive writing',
  };
  const sourceLabel = sourceTypeLabels[params.sourceType] || params.sourceType;

  return `You are generating an original English Language exam insert in the style of ${params.examBoard || 'AQA'} GCSE Paper 1.

Generate a Source A extract with these properties:
- Source type: ${sourceLabel}
- Theme / scenario: ${params.topic}
- Target length: ${len.words} words (approximately lines ${len.lines})
- Reading level: ${params.readingLevel?.replace('_', ' ') || 'GCSE Higher'}

FORMAT REQUIREMENTS:
1. Start with a header block:
   "Source A: ${sourceLabel}"
   "{Fictional Title} by {Fictional Author Name}"
   "An extract from {fictional publication context and year}"

2. Write the prose extract as flowing literary fiction or non-fiction.
   - Use varied sentence structures.
   - Include literary devices (metaphor, simile, imagery).
   - Build atmosphere and character naturally.
   - Do NOT use clichéd or obviously AI phrases.

3. ${lineRule}

4. End with: "END OF SOURCE A"

5. After the extract, output a JSON metadata block (fenced in \`\`\`json):
{
  "title": "fictional title",
  "author": "fictional author name",
  "sourceType": "${sourceLabel}",
  "lineCount": <number>,
  "keyPassages": [
    { "lines": "12-18", "theme": "example", "suitable_for": "language analysis" },
    { "lines": "28-35", "theme": "example", "suitable_for": "structure question" }
  ]
}

Return the full content_text (header + numbered lines + END marker) and the metadata JSON in content_json.`;
}

function buildEnglishLiteraturePrompt(params: {
  sourceType: string;
  topic: string;
  extractLength: string;
  readingLevel: string;
  lineNumbering: string;
  educationalTier?: string;
  examBoard?: string;
}) {
  const lengthMap: Record<string, string> = {
    short: '180–220',
    medium: '380–420',
    long:  '580–620',
  };
  const wordRange = lengthMap[params.extractLength] || lengthMap.medium;
  const lineRule = params.lineNumbering === 'every_line'
    ? 'Number every line.'
    : 'Number every 5th line.';

  return `You are generating an original English Literature extract for a ${params.readingLevel?.replace('_', ' ') || 'GCSE'} exam.

Extract type: ${params.sourceType?.replace('_', ' ')}
Theme / focus: ${params.topic}
Target length: ${wordRange} words
${lineRule}

Include a fictional author name, title, and publication year header. Write rich literary prose with strong thematic content suitable for close reading analysis. End with "END OF EXTRACT".

After the extract, output a JSON metadata block (fenced in \`\`\`json):
{
  "title": "...",
  "author": "...",
  "sourceType": "...",
  "lineCount": <number>,
  "keyPassages": [ { "lines": "...", "theme": "...", "suitable_for": "..." } ]
}`;
}

function buildHistoryPrompt(params: {
  sourceType: string;
  topic: string;
  extraFields?: Record<string, string>;
  educationalTier?: string;
  examBoard?: string;
}) {
  const timePeriod = params.extraFields?.timePeriod || '20th_century';
  return `You are generating realistic historical source material for a ${params.educationalTier || 'GCSE'} History exam.

Source type: ${params.sourceType?.replace('_', ' ')}
Historical focus: ${params.topic}
Time period: ${timePeriod.replace('_', ' ')}
Exam board style: ${params.examBoard || 'UK exam board'}

REQUIREMENTS:
1. Include a provenance block: Author/origin, date, context (e.g. "From a letter written by Lord Palmerston to Queen Victoria, March 1854").
2. Write authentic-feeling prose appropriate to the period and source type.
3. Use period-appropriate language and terminology.
4. Keep to 200-400 words.

Return a JSON object:
{
  "resources": [{
    "source_label": "Source A",
    "resource_type": "${params.sourceType}",
    "content_text": "<full text with provenance header>",
    "content_json": { "provenance": { "author": "...", "date": "...", "context": "..." } },
    "word_count": <number>,
    "attribution": "<provenance line>",
    "difficulty_contribution": "moderate",
    "display_order": 0
  }]
}`;
}

function buildSciencePrompt(params: {
  sourceType: string;
  topic: string;
  extraFields?: Record<string, string>;
  educationalTier?: string;
  examBoard?: string;
  count: number;
}) {
  const dataFormat = params.extraFields?.dataFormat || 'results_table';
  return `You are generating realistic scientific resource material for a ${params.educationalTier || 'GCSE'} ${params.examBoard || ''} Science exam.

Resource type: ${params.sourceType?.replace('_', ' ')}
Topic: ${params.topic}
Data format preference: ${dataFormat.replace('_', ' ')}
Number of resources: ${params.count}

REQUIREMENTS:
1. Use realistic numerical data with appropriate units and significant figures.
2. Include proper scientific terminology.
3. For results tables: include column headers, units, and 5-8 data rows.
4. For graph data: provide data points that would create a meaningful trend.
5. Label sources as Table 1, Figure 1, etc.

Return a JSON object:
{
  "resources": [
    {
      "source_label": "Table 1",
      "resource_type": "${params.sourceType}",
      "content_text": "<description or null>",
      "content_json": { "title": "...", "headers": [...], "rows": [[...], ...] },
      "word_count": null,
      "attribution": "Experimental data",
      "difficulty_contribution": "moderate",
      "display_order": 0
    }
  ]
}`;
}

function buildGenericPrompt(params: {
  sourceType: string;
  topic: string;
  subjectId: string;
  educationalTier?: string;
  examBoard?: string;
  count: number;
}) {
  return `You are an expert exam paper writer creating realistic resource materials for ${params.subjectId} examinations.

TOPIC: ${params.topic}
SOURCE TYPE: ${params.sourceType?.replace('_', ' ')}
EDUCATIONAL LEVEL: ${params.educationalTier || 'Secondary'}
${params.examBoard ? `EXAM BOARD STYLE: ${params.examBoard}` : ''}

Generate ${params.count} distinct resources that would appear in an exam insert or resource booklet.

REQUIREMENTS:
1. Each resource must be self-contained and realistic.
2. Use appropriate source labels (Source A, Source B, Table 1, etc.).
3. Include authentic-feeling attributions where appropriate.
4. For data tables, include realistic numerical data with headers and rows in content_json.
5. Match the style and complexity of real ${params.examBoard || 'UK exam board'} papers.
6. Word count: 200-400 words for text resources.

Return a JSON object:
{
  "resources": [
    {
      "source_label": "Source A",
      "resource_type": "${params.sourceType}",
      "content_text": "...",
      "content_json": null,
      "word_count": <number>,
      "attribution": "...",
      "difficulty_contribution": "moderate",
      "display_order": 0
    }
  ]
}`;
}

/* ─── main handler ─── */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Session expired. Please refresh and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    const userId = claimsData.claims.sub;

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json();
    const {
      subjectId,
      topic,
      educationalTier,
      examBoard,
      subtopics,
      resourceCount,
      sourceType,
      extractLength,
      readingLevel,
      lineNumbering,
      extraFields,
      resourceTypes, // legacy compat
    } = body;

    if (!subjectId || !topic) {
      throw new Error('subjectId and topic are required');
    }

    console.log('Generating resource pack:', { subjectId, topic, sourceType, extractLength });

    const subjectLower = subjectId.toLowerCase();
    const isEnglishLanguage = subjectLower.includes('english_language') || subjectLower.includes('english language') || subjectLower === 'english';
    const isEnglishLit = subjectLower.includes('english_literature') || subjectLower.includes('english literature');
    const isHistory = subjectLower.includes('history');
    const isScience = ['biology', 'chemistry', 'physics', 'science'].some(s => subjectLower.includes(s));

    // Determine resource count
    const rawCount = typeof resourceCount === 'number' ? resourceCount : parseInt(String(resourceCount ?? extraFields?.resourceCount ?? ''), 10);
    const count = Math.max(1, Math.min(Number.isFinite(rawCount) ? rawCount : (isEnglishLanguage || isEnglishLit ? 1 : 3), 5));

    // Build subject-specific prompt
    let generationPrompt: string;

    if (isEnglishLit) {
      generationPrompt = buildEnglishLiteraturePrompt({ sourceType, topic, extractLength, readingLevel, lineNumbering, educationalTier, examBoard });
    } else if (isEnglishLanguage) {
      generationPrompt = buildEnglishLanguagePrompt({ sourceType, topic, extractLength, readingLevel, lineNumbering, educationalTier, examBoard });
    } else if (isHistory) {
      generationPrompt = buildHistoryPrompt({ sourceType, topic, extraFields, educationalTier, examBoard });
    } else if (isScience) {
      generationPrompt = buildSciencePrompt({ sourceType, topic, extraFields, educationalTier, examBoard, count });
    } else {
      generationPrompt = buildGenericPrompt({ sourceType, topic, subjectId, educationalTier, examBoard, count });
    }

    // Create resource pack record
    const { data: packData, error: packError } = await supabaseClient
      .from('resource_packs')
      .insert({
        user_id: userId,
        title: `${topic} Resources`,
        subject_id: subjectId,
        educational_tier: educationalTier,
        exam_board: examBoard,
        pack_type: 'ai_generated',
        status: 'processing',
      })
      .select()
      .single();

    if (packError) throw packError;
    const packId = packData.id;

    // Generate via AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const isEnglish = isEnglishLanguage || isEnglishLit;
    const systemMessage = isEnglish
      ? 'You are an expert English exam paper writer. Generate realistic, high-quality exam inserts with proper literary quality. Return only valid JSON where requested, otherwise return the formatted extract followed by a JSON metadata block.'
      : 'You are an expert exam paper writer. Generate realistic, high-quality exam resources. Return only valid JSON.';

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: generationPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI generation failed:', errorText);
      throw new Error('Failed to generate resources');
    }

    const aiResult = await aiResponse.json();
    const generatedContent = aiResult.choices?.[0]?.message?.content || '';

    let resources: any[] = [];

    if (isEnglish) {
      // English mode: single resource with full text + metadata
      let contentText = generatedContent;
      let contentJson: any = null;

      // Try to extract JSON metadata from the response
      const jsonFenceMatch = generatedContent.match(/```json\s*([\s\S]*?)```/);
      if (jsonFenceMatch) {
        try {
          contentJson = JSON.parse(jsonFenceMatch[1]);
          // Remove JSON block from content text
          contentText = generatedContent.replace(/```json[\s\S]*?```/, '').trim();
        } catch { /* keep raw */ }
      } else {
        const jsonMatch = generatedContent.match(/\{[\s\S]*"keyPassages"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            contentJson = JSON.parse(jsonMatch[0]);
            contentText = generatedContent.substring(0, generatedContent.indexOf(jsonMatch[0])).trim();
          } catch { /* keep raw */ }
        }
      }

      resources = [{
        source_label: 'Source A',
        resource_type: sourceType || 'text_extract',
        content_text: contentText,
        content_json: contentJson,
        word_count: contentText.split(/\s+/).length,
        attribution: contentJson?.author ? `${contentJson.title} by ${contentJson.author}` : null,
        difficulty_contribution: 'moderate',
        display_order: 0,
      }];
    } else {
      // Standard JSON mode
      const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse generated resources');

      const parsed = JSON.parse(jsonMatch[0]);
      resources = parsed.resources || [];

      if (!Array.isArray(resources) || resources.length === 0) {
        resources = [{
          source_label: 'Source A',
          resource_type: sourceType || 'text_extract',
          content_text: `Resource based on topic: ${topic}`,
          content_json: null,
          word_count: null,
          attribution: null,
          difficulty_contribution: 'moderate',
          display_order: 0,
        }];
      }
      resources = resources.slice(0, count);
    }

    console.log(`Generated ${resources.length} resources`);

    // Insert resource items
    const resourceItems = [];
    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];
      const { data: itemData, error: itemError } = await supabaseClient
        .from('resource_items')
        .insert({
          pack_id: packId,
          source_label: resource.source_label || `Resource ${i + 1}`,
          resource_type: resource.resource_type || 'text_extract',
          content_text: resource.content_text || null,
          content_json: resource.content_json || null,
          word_count: resource.word_count || null,
          attribution: resource.attribution || null,
          difficulty_contribution: resource.difficulty_contribution || 'moderate',
          display_order: resource.display_order ?? i,
        })
        .select()
        .single();

      if (itemError) {
        console.error('Error inserting resource item:', itemError);
        continue;
      }
      resourceItems.push(itemData);
    }

    // Update pack status
    await supabaseClient
      .from('resource_packs')
      .update({ status: 'ready' })
      .eq('id', packId);

    return new Response(
      JSON.stringify({ packId, title: packData.title, items: resourceItems }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-resource-pack:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate resources' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
