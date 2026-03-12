import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildExtractSafetyInstruction } from "../_shared/copyright-rules.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
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
    const { fileUrl, subjectId, educationalTier, examBoard, title } = body;

    if (!fileUrl || !subjectId) {
      throw new Error('fileUrl and subjectId are required');
    }

    console.log('Extracting resource pack from:', fileUrl);

    // Download the PDF file
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('exam-files')
      .download(fileUrl);

    if (downloadError) throw downloadError;

    const pdfText = await fileData.text();
    console.log('PDF text length:', pdfText.length);

    // Create resource pack record
    const { data: packData, error: packError } = await supabaseClient
      .from('resource_packs')
      .insert({
        user_id: userId,
        title: title || 'Uploaded Resource Pack',
        subject_id: subjectId,
        educational_tier: educationalTier,
        exam_board: examBoard,
        pack_type: 'uploaded',
        source_file_url: fileUrl,
        status: 'processing',
      })
      .select()
      .single();

    if (packError) throw packError;

    const packId = packData.id;

    // Use AI to extract and structure resources
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const extractionPrompt = `You are an expert at analyzing exam insert/resource booklets and extracting structured resources.

Given the following PDF text content from an exam insert or resource booklet, identify and extract all discrete resources (sources, texts, data tables, images described, etc.).

PDF CONTENT:
${pdfText.substring(0, 30000)}

EXTRACTION RULES:
1. Identify each distinct resource (Source A, Source B, Extract 1, Figure 1, Table 1, etc.)
2. Preserve the original source labels used in the document
3. Classify each resource type: text_extract, case_study, data_table, map, image, graph, transcript, article, experiment_data, poem_excerpt, primary_source, historian_interpretation
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
      throw new Error('Failed to extract resources from document');
    }

    const aiResult = await aiResponse.json();
    let extractedContent = aiResult.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = extractedContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse extraction results');
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    const resources = parsedResult.resources || [];

    console.log(`Extracted ${resources.length} resources`);

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
    console.error('Error in extract-resource-pack:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to extract resources' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
