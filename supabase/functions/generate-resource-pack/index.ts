import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUBJECT_TEMPLATES: Record<string, { types: string[]; prompt: string }> = {
  english: {
    types: ['text_extract', 'article', 'transcript'],
    prompt: 'Generate realistic prose extracts, articles, or speech transcripts suitable for literary analysis.',
  },
  english_literature: {
    types: ['text_extract', 'poem_excerpt'],
    prompt: 'Generate authentic-feeling literary prose extracts or poetry excerpts with rich language for close reading analysis.',
  },
  english_language: {
    types: ['article', 'transcript', 'text_extract'],
    prompt: 'Generate realistic newspaper articles, interview transcripts, or non-fiction texts for language analysis.',
  },
  history: {
    types: ['primary_source', 'historian_interpretation'],
    prompt: 'Generate historically authentic primary source documents (letters, speeches, reports) and contrasting historian interpretations.',
  },
  geography: {
    types: ['case_study', 'data_table', 'article'],
    prompt: 'Generate detailed geographical case studies with realistic data about places, environments, and human-environment interactions.',
  },
  economics: {
    types: ['case_study', 'data_table', 'graph'],
    prompt: 'Generate realistic business/economic case studies with market data, company profiles, and economic indicators.',
  },
  biology: {
    types: ['experiment_data', 'data_table', 'graph'],
    prompt: 'Generate realistic experimental results, biological data tables, and research findings suitable for scientific analysis.',
  },
  chemistry: {
    types: ['experiment_data', 'data_table'],
    prompt: 'Generate realistic chemical experiment data, reaction results, and quantitative analysis data.',
  },
  physics: {
    types: ['experiment_data', 'data_table', 'graph'],
    prompt: 'Generate realistic physics experiment data, measurements, and calculated results for analysis.',
  },
  psychology: {
    types: ['case_study', 'data_table', 'article'],
    prompt: 'Generate realistic psychological case studies, research summaries, and experimental findings.',
  },
  sociology: {
    types: ['case_study', 'data_table', 'article'],
    prompt: 'Generate realistic sociological case studies, survey data, and research findings about social phenomena.',
  },
};

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
    const { subjectId, topic, educationalTier, examBoard, subtopics, resourceCount, resourceTypes } = body;

    if (!subjectId || !topic) {
      throw new Error('subjectId and topic are required');
    }

    console.log('Generating resource pack:', { subjectId, topic, resourceCount });

    // Get subject-specific template
    const template = SUBJECT_TEMPLATES[subjectId.toLowerCase()] || {
      types: ['text_extract', 'data_table'],
      prompt: 'Generate realistic exam-style resources suitable for the subject.',
    };

    const typesToGenerate = resourceTypes || template.types;
    const count = Math.min(resourceCount || 3, 5);

    // Determine complexity based on educational tier
    const tierLower = (educationalTier || '').toLowerCase();
    let complexityLevel = 'moderate';
    let wordCountRange = '200-400';
    
    if (tierLower.includes('gcse') || tierLower.includes('ks4')) {
      complexityLevel = 'simple to moderate';
      wordCountRange = '150-300';
    } else if (tierLower.includes('a-level') || tierLower.includes('ib') || tierLower.includes('advanced')) {
      complexityLevel = 'moderate to complex';
      wordCountRange = '300-500';
    } else if (tierLower.includes('university') || tierLower.includes('undergraduate')) {
      complexityLevel = 'complex';
      wordCountRange = '400-700';
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

    // Generate resources using AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const generationPrompt = `You are an expert exam paper writer creating realistic resource materials for ${subjectId} examinations.

TOPIC: ${topic}
EDUCATIONAL LEVEL: ${educationalTier || 'Secondary'}
${examBoard ? `EXAM BOARD STYLE: ${examBoard}` : ''}
${subtopics?.length ? `RELATED SUBTOPICS: ${subtopics.join(', ')}` : ''}

TASK: Generate ${count} distinct resources that would appear in an exam insert or resource booklet.

RESOURCE TYPES TO GENERATE: ${typesToGenerate.join(', ')}

COMPLEXITY: ${complexityLevel}
WORD COUNT RANGE for text resources: ${wordCountRange} words

${template.prompt}

REQUIREMENTS:
1. Each resource must be self-contained and realistic
2. Use appropriate source labels (Source A, Source B, Extract 1, Table 1, etc.)
3. Include authentic-feeling attributions where appropriate
4. For data tables, include realistic numerical data
5. Resources should work together to enable comparative analysis questions
6. Match the style and complexity of real ${examBoard || 'UK exam board'} papers

Return a JSON object with this exact structure:
{
  "resources": [
    {
      "source_label": "Source A",
      "resource_type": "text_extract",
      "content_text": "Full realistic text content here spanning ${wordCountRange} words...",
      "content_json": null,
      "word_count": 320,
      "attribution": "Adapted from [realistic source], 2023",
      "difficulty_contribution": "moderate",
      "display_order": 0
    },
    {
      "source_label": "Table 1",
      "resource_type": "data_table",
      "content_text": null,
      "content_json": {
        "title": "Table title",
        "headers": ["Column1", "Column2", "Column3"],
        "rows": [["data", "data", "data"], ["data", "data", "data"]]
      },
      "word_count": null,
      "attribution": "Data from [realistic source]",
      "difficulty_contribution": "simple",
      "display_order": 1
    }
  ]
}

Generate exactly ${count} high-quality resources that could realistically appear in a ${educationalTier || 'secondary level'} ${subjectId} exam.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert exam paper writer. Generate realistic, high-quality exam resources. Return only valid JSON.' },
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
    let generatedContent = aiResult.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse generated resources');
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    const resources = parsedResult.resources || [];

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

    // Update pack status to ready
    await supabaseClient
      .from('resource_packs')
      .update({ status: 'ready' })
      .eq('id', packId);

    return new Response(
      JSON.stringify({
        packId,
        title: packData.title,
        items: resourceItems,
      }),
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
