import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get exam details
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*')
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
      return new Response(JSON.stringify({ error: 'Failed to download PDF' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract text from PDF using simple text extraction
    const arrayBuffer = await pdfData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to string and extract visible text (basic PDF text extraction)
    let pdfText = '';
    try {
      const decoder = new TextDecoder('utf-8');
      const rawText = decoder.decode(uint8Array);
      
      // Extract text between stream markers and clean up PDF formatting
      const textMatches = rawText.match(/\(([^)]+)\)/g);
      if (textMatches) {
        pdfText = textMatches
          .map(match => match.slice(1, -1)) // Remove parentheses
          .join(' ')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\/g, '');
      }
      
      // Fallback: try to extract any readable text
      if (!pdfText || pdfText.length < 50) {
        pdfText = rawText.replace(/[^\x20-\x7E\n]/g, ' ').trim();
      }
    } catch (error) {
      console.error('PDF text extraction error:', error);
      pdfText = 'Unable to extract text from PDF';
    }

    console.log('Calling Lovable AI for question extraction...');
    console.log('Extracted text length:', pdfText.length);

    const extractionPrompt = `You are an expert exam document parser. Extract ALL questions from this exam paper with extreme precision.

EXAM CONTENT:
${pdfText}

CRITICAL REQUIREMENTS:
1. Preserve EXACT original wording - do not paraphrase or rewrite
2. Maintain original question numbering (e.g., 1, 2, 3 OR 1a, 1b, 2a)
3. Detect mark values from text like "[5 marks]" or "(10)" or "5 marks" - extract the number
4. Identify question types:
   - "mcq": Multiple choice with lettered options (a, b, c, d)
   - "short_answer": Questions expecting 1-3 sentence answers
   - "long_form": Essay questions or detailed explanations
5. For figures/diagrams: Set has_figures=true if diagram is mentioned
6. For tables: Set has_tables=true if table is mentioned
7. Extract topic from question context (e.g., "Algebra - Linear Equations")
8. Rate extraction confidence (0.0-1.0) based on text clarity
9. For MCQs, identify correct answer if present (from answer key section or marked in question)

FORMAT REQUIREMENTS:
- Extract multi-page questions as single entries
- Include sub-questions as separate entries (1a, 1b become separate questions)
- Capture option text exactly as shown
- Default marks to 1 if not found
- If you can't find proper questions, extract any numbered items as questions

RETURN ONLY VALID JSON ARRAY (no markdown, no explanation):
[
  {
    "question_number": 1,
    "question_type": "mcq",
    "question_text": "Exact question text preserved",
    "marks": 5,
    "options": {"a": "Option A text", "b": "Option B text", "c": "Option C text", "d": "Option D text"},
    "correct_answer": "b",
    "original_page_number": 1,
    "has_figures": false,
    "has_tables": false,
    "topic_tag": "Subject - Topic",
    "difficulty_level": "medium",
    "extraction_confidence": 0.95
  }
]`;

    // Call Gemini 2.5 Flash (faster and better for text processing)
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert exam document parser. Return ONLY valid JSON arrays without markdown formatting.'
          },
          {
            role: 'user',
            content: extractionPrompt
          }
        ],
        temperature: 0.1,
      }),
    });

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

    const aiData = await aiResponse.json();
    let extractedContent = aiData.choices?.[0]?.message?.content || '[]';
    
    // Clean up markdown formatting if present
    extractedContent = extractedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    console.log('Raw AI response:', extractedContent);

    let extractedQuestions = [];
    try {
      extractedQuestions = JSON.parse(extractedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      await supabase
        .from('exams')
        .update({ 
          extraction_status: 'failed',
          extraction_error: 'Failed to parse extracted questions'
        })
        .eq('id', draftId);
      return new Response(JSON.stringify({ error: 'Failed to parse extracted questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    console.log(`Extracted ${extractedQuestions.length} questions`);

    // Delete existing drafts for this exam
    await supabase
      .from('exam_question_drafts')
      .delete()
      .eq('exam_id', draftId);

    // Clean and save to drafts table - force sequential numbering to avoid TEXT type issues
    const draftsToInsert = extractedQuestions.map((q: any, index: number) => ({
      exam_id: draftId,
      // Convert question_number to string and preserve original if provided
      question_number: String(q.question_number || (index + 1)),
      question_type: q.question_type || 'short_answer',
      question_text: q.question_text || '',
      marks: q.marks || 1,
      options: q.options || null,
      correct_answer: q.correct_answer || null,
      original_page_number: q.original_page_number || 1,
      has_figures: q.has_figures || false,
      has_tables: q.has_tables || false,
      figure_urls: q.figure_urls || [],
      topic_tag: q.topic_tag || null,
      difficulty_level: q.difficulty_level || null,
      extraction_confidence: q.extraction_confidence || 0.9,
    }));

    const { error: draftError } = await supabase
      .from('exam_question_drafts')
      .insert(draftsToInsert);

    if (draftError) {
      console.error('Draft insertion error:', draftError);
      const errorMessage = `Database error: ${draftError.message || 'Failed to save questions'}`;
      await supabase
        .from('exams')
        .update({ 
          extraction_status: 'failed',
          extraction_error: errorMessage
        })
        .eq('id', draftId);
      return new Response(JSON.stringify({ 
        error: 'Failed to save extracted questions',
        details: errorMessage 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update exam status to completed
    await supabase
      .from('exams')
      .update({
        extraction_status: 'completed',
        total_questions_extracted: extractedQuestions.length,
        extraction_error: null
      })
      .eq('id', draftId);

    return new Response(JSON.stringify({ 
      success: true,
      totalQuestions: extractedQuestions.length 
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
