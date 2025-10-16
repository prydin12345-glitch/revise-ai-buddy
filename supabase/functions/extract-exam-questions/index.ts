import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.2.1";

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

    // Extract text from PDF using pdfjs-serverless
    const arrayBuffer = await pdfData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    let pdfText = '';
    try {
      // Primary method: Use pdfjs-serverless for proper PDF parsing
      console.log('Attempting PDF parsing with pdfjs-serverless...');
      const pdf = await getDocument({ data: uint8Array, useSystemFonts: true }).promise;
      const pages: string[] = [];
      
      console.log(`PDF has ${pdf.numPages} pages`);
      
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
      
      console.log(`Extracted ${pdfText.length} characters using pdfjs-serverless`);
    } catch (pdfError) {
      console.error('pdfjs-serverless parsing failed, trying fallback method:', pdfError);
      
      // Fallback: Basic text extraction
      try {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const rawText = decoder.decode(uint8Array);
        
        // Extract text between parentheses (PDF text objects)
        const textMatches = rawText.match(/\(([^)]+)\)/g);
        if (textMatches && textMatches.length > 10) {
          pdfText = textMatches
            .map(match => match.slice(1, -1))
            .join(' ')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\n')
            .replace(/\\t/g, ' ')
            .replace(/\\(.)/g, '$1');
        }
        
        // If still empty, try aggressive cleaning
        if (!pdfText || pdfText.length < 100) {
          const cleanedText = rawText
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\xFF]/g, ' ')
            .replace(/\s+/g, ' ')
            .split(/[\/\[\]<>{}]/g)
            .filter(part => {
              const letters = part.match(/[a-zA-Z]/g);
              return letters && letters.length > 3;
            })
            .join(' ');
          
          if (cleanedText.length > pdfText.length) {
            pdfText = cleanedText;
          }
        }
        
        console.log(`Fallback extraction yielded ${pdfText.length} characters`);
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError);
      }
    }
    
    // Final cleanup
    pdfText = pdfText
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .trim();
    
    // Validate extracted text with more lenient threshold
    const readableChars = pdfText.match(/[a-zA-Z0-9]/g);
    const readableRatio = readableChars ? readableChars.length / pdfText.length : 0;
    
    console.log(`Final text: ${pdfText.length} chars, readability: ${(readableRatio * 100).toFixed(1)}%`);
    
    if (readableRatio < 0.25 || pdfText.length < 100) {
      console.error('Text validation failed - appears corrupted or too short');
      await supabase
        .from('exams')
        .update({ 
          extraction_status: 'failed',
          extraction_error: 'PDF text extraction failed - document may be scanned or corrupted'
        })
        .eq('id', draftId);
      return new Response(JSON.stringify({ 
        error: 'PDF text extraction failed',
        details: 'This PDF may be a scanned image or have an unsupported format. Please try uploading a text-based PDF.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Calling Lovable AI for question extraction...');
    console.log('Extracted text length:', pdfText.length);

    const extractionPrompt = `You are an expert exam document parser. Extract ALL questions AND identify key educational topics from this exam paper.

EXAM CONTENT:
${pdfText}

CRITICAL REQUIREMENTS FOR QUESTIONS:
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

CRITICAL REQUIREMENTS FOR TOPICS:
1. Identify 3-7 main EDUCATIONAL topics covered in this exam
2. Use SPECIFIC subject-matter topics (e.g., "Cell Biology", "Enzymes", "Photosynthesis", "Shakespearean Literature")
3. DO NOT use generic document structure terms (e.g., NOT "PDF Structure", "Data Compression")
4. Rate confidence 0.0-1.0 for each topic based on prominence in exam

FORMAT REQUIREMENTS:
- Extract multi-page questions as single entries
- Include sub-questions as separate entries (1a, 1b become separate questions)
- Capture option text exactly as shown
- Default marks to 1 if not found
- If you can't find proper questions, extract any numbered items as questions

RETURN ONLY VALID JSON OBJECT (no markdown, no explanation):
{
  "questions": [
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
  ],
  "topics": [
    {
      "name": "Cell Biology",
      "confidence": 0.9
    },
    {
      "name": "Enzymes and Catalysis",
      "confidence": 0.85
    }
  ]
}`;

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
            content: 'You are an expert exam document parser. You MUST return ONLY valid JSON in the exact format specified, with no markdown formatting, no explanations, and no apologies. If the content is unclear, do your best to extract what you can.'
          },
          {
            role: 'user',
            content: extractionPrompt
          }
        ],
        response_format: { type: 'json_object' },
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
    let extractedContent = aiData.choices?.[0]?.message?.content || '{"questions":[],"topics":[]}';
    
    // Clean up markdown formatting if present
    extractedContent = extractedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    console.log('Raw AI response:', extractedContent.substring(0, 500));

    let parsedData: any = { questions: [], topics: [] };
    try {
      parsedData = JSON.parse(extractedContent);
      // Handle if AI returned array directly instead of object with questions property
      if (Array.isArray(parsedData)) {
        parsedData = { questions: parsedData, topics: [] };
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Response content:', extractedContent);
      
      // Check if AI returned an error message instead of JSON
      if (extractedContent.includes('sorry') || extractedContent.includes('cannot')) {
        await supabase
          .from('exams')
          .update({ 
            extraction_status: 'failed',
            extraction_error: 'Unable to extract questions - PDF may be scanned or have poor text quality'
          })
          .eq('id', draftId);
        return new Response(JSON.stringify({ 
          error: 'PDF content extraction failed',
          details: 'The PDF text quality is too poor for automatic extraction. Try a text-based PDF instead of a scanned image.'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      await supabase
        .from('exams')
        .update({ 
          extraction_status: 'failed',
          extraction_error: 'Failed to parse AI response'
        })
        .eq('id', draftId);
      return new Response(JSON.stringify({ error: 'Failed to parse extracted questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const extractedQuestions = parsedData.questions || [];
    const extractedTopics = parsedData.topics || [];

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

    console.log(`Extracted ${extractedQuestions.length} questions and ${extractedTopics.length} topics`);

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

    // Delete and insert topics if extracted
    if (extractedTopics.length > 0) {
      // Delete existing topics
      await supabase
        .from('exam_topics')
        .delete()
        .eq('exam_id', draftId);

      // Insert new topics
      const topicsToInsert = extractedTopics.map((topic: any) => ({
        exam_id: draftId,
        topic_name: topic.name,
        confidence_score: topic.confidence || 0.8
      }));

      const { error: topicsError } = await supabase
        .from('exam_topics')
        .insert(topicsToInsert);

      if (topicsError) {
        console.error('Topics insertion error:', topicsError);
        // Don't fail the whole operation if topics fail
      } else {
        console.log(`Inserted ${extractedTopics.length} topics`);
      }
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
      totalQuestions: extractedQuestions.length,
      totalTopics: extractedTopics.length
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
