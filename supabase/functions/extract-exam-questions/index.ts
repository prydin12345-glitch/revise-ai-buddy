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

    // Fetch format settings
    const { data: formatSettings } = await supabase
      .from('exam_format')
      .select('*')
      .eq('exam_id', draftId)
      .single();
    
    const useOriginalStructure = formatSettings?.use_original_structure ?? true;
    console.log('Use original structure:', useOriginalStructure);

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
    
    // Validate extracted text with lenient threshold
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

    // Build format-aware instructions
    const structureInstructions = useOriginalStructure 
      ? `✨ STRUCTURE PRESERVATION MODE - FULL AI GENERATION:

CRITICAL: Generate COMPLETELY NEW questions. Never copy original wording.

1. **Analyze Structure**:
   - Count questions by type (MCQ, short answer, long form)
   - Note marks distribution for each question
   - Identify topics and difficulty progression

2. **Generate NEW Questions**:
   - Match SAME structure (e.g., if original has 4×3-mark MCQs, generate 4×3-mark MCQs)
   - Cover SAME topics in similar order
   - Test SAME concepts but with:
     ✓ DIFFERENT wording and phrasing
     ✓ DIFFERENT examples and scenarios
     ✓ DIFFERENT numerical values and data
     ✓ DIFFERENT names, places, and contexts
   - For MCQs: Create ENTIRELY NEW options testing the same concept
   - Preserve overall flow and difficulty curve

3. **Copyright Compliance**:
   - NEVER copy any original text verbatim
   - NEVER reference specific diagrams, figures, or page numbers
   - Replace all specific examples with equivalent alternatives
   - Change all numerical data while maintaining concept validity

4. **Quality Standards**:
   - Questions must test identical learning objectives
   - Difficulty level must match original
   - Mark allocation must be preserved
   - All questions must be self-contained (no external references)`
      : `🎯 FLEXIBLE GENERATION MODE:
1. Analyze topics and difficulty levels from the document
2. Generate a balanced set of NEW questions based on:
   - Topics identified (prioritize most prominent topics)
   - Mix of question types (MCQ, short answer, long form)
   - Progressive difficulty (easy → medium → hard)
3. Total questions and marks can vary from original
4. Focus on comprehensive topic coverage
5. All questions must be freshly generated (no verbatim copying)`;

    const extractionPrompt = `You are an expert exam question GENERATOR specializing in creating original, copyright-safe educational assessments.

🎯 YOUR MISSION: Generate BRAND NEW questions inspired by this exam's content.

${structureInstructions}

IMPORTANT INSTRUCTIONS:
1. For Multiple Choice Questions (MCQ), extract all options (A, B, C, D, etc.)
2. Identify if questions reference figures, diagrams, tables, or images
3. Tag each question with a relevant topic (e.g., "Biology - Cell Structure", "Physics - Mechanics")
4. Assess difficulty: easy, medium, or hard
5. Note the page number where each question appears
6. Extract the marks allocated to each question

The exam text is below:

---
${pdfText}
---

Return a JSON object with this structure:
{
  "questions": [
    {
      "question_number": "string (e.g., '1', '1a', 'Q1')",
      "question_type": "mcq | short_answer | long_form",
      "question_text": "string (the full question text)",
      "marks": number,
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."] (only for MCQ, null otherwise),
      "correct_answer": "string (if explicitly stated, null otherwise)",
      "original_page_number": number,
      "has_figures": boolean,
      "has_tables": boolean,
      "topic_tag": "string",
      "difficulty_level": "easy | medium | hard",
      "extraction_confidence": number (0.0 to 1.0)
    }
  ],
  "topics": [
    {
      "topic_name": "string",
      "confidence_score": number (0.0 to 1.0)
    }
  ]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are an expert exam question generator. Your role is to create NEW, original questions inspired by exam content, never copying verbatim. Always generate fresh wording, examples, and data while preserving educational objectives. Return valid JSON only.' },
          { role: 'user', content: extractionPrompt }
        ],
        response_format: { type: "json_object" }
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
    extractedContent = extractedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    console.log('Raw AI response:', extractedContent.substring(0, 200));

    let parsedData: any = { questions: [], topics: [] };
    try {
      parsedData = JSON.parse(extractedContent);
      if (Array.isArray(parsedData)) {
        parsedData = { questions: parsedData, topics: [] };
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
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

    // Delete existing drafts
    await supabase
      .from('exam_question_drafts')
      .delete()
      .eq('exam_id', draftId);

    // Insert questions with generation status
    const draftsToInsert = extractedQuestions.map((q: any, index: number) => ({
      exam_id: draftId,
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
      generation_status: useOriginalStructure ? 'structure_inspired' : 'extracted',
      image_handling_strategy: null,
      original_question_text: null,
    }));

    const { data: insertedQuestions, error: draftError } = await supabase
      .from('exam_question_drafts')
      .insert(draftsToInsert)
      .select();

    if (draftError) {
      console.error('Draft insertion error:', draftError);
      await supabase
        .from('exams')
        .update({ 
          extraction_status: 'failed',
          extraction_error: `Failed to save questions: ${draftError.message}`
        })
        .eq('id', draftId);
      return new Response(JSON.stringify({ error: 'Failed to save extracted questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process ALL questions when use_original_structure is true (Full AI Generation)
    if (useOriginalStructure) {
      console.log('Full AI generation mode: Regenerating ALL questions...');
      const nonImageQuestions = insertedQuestions?.filter((q: any) => !q.has_figures) || [];
      
      for (const question of nonImageQuestions) {
        try {
          const regenerationPrompt = `Original question structure: "${question.question_text}"
Topic: ${question.topic_tag}
Type: ${question.question_type}
Marks: ${question.marks}
Difficulty: ${question.difficulty_level}

Generate a COMPLETELY NEW question that:
1. Tests the SAME learning objective/concept
2. Uses DIFFERENT wording, phrasing, and structure
3. Provides DIFFERENT examples, scenarios, or contexts
4. If numerical data is involved, use NEW synthetic values
5. For MCQs: Create ENTIRELY NEW options (if applicable)
6. Maintains the same difficulty and mark value
7. Never copies any original text

CRITICAL: Be creative! Change names, locations, scenarios, values - make it fresh while testing the same skill.

Return ONLY the new question text (and options if MCQ), no explanation.`;

          const regenResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'You are an expert at creating original exam questions. Never copy verbatim - always generate fresh content while preserving educational value.' },
                { role: 'user', content: regenerationPrompt }
              ],
            }),
          });

          if (regenResponse.ok) {
            const regenData = await regenResponse.json();
            const newQuestionText = regenData.choices?.[0]?.message?.content || question.question_text;
            
            await supabase
              .from('exam_question_drafts')
              .update({
                original_question_text: question.question_text,
                question_text: newQuestionText,
                generation_status: 'ai_generated',
              })
              .eq('id', question.id);
            
            console.log(`Regenerated question ${question.question_number} with AI`);
          }
        } catch (regenError) {
          console.error(`Failed to regenerate question ${question.question_number}:`, regenError);
        }
      }
    }

    // Process image-based questions using Hybrid Approach
    console.log('Processing image-based questions...');
    const imageQuestions = insertedQuestions?.filter((q: any) => q.has_figures) || [];
    
    for (const question of imageQuestions) {
      try {
        const strategy = determineImageStrategy(question);
        console.log(`Question ${question.question_number}: Using ${strategy} strategy`);
        
        if (strategy === 'concept_replacement') {
          const replacementPrompt = `Original question references an image: "${question.question_text}"
Topic: ${question.topic_tag}
Marks: ${question.marks}
Difficulty: ${question.difficulty_level}

Generate a COMPLETELY NEW question that:
1. Tests the SAME concept/skill without requiring any visual aid
2. Provides all necessary context in text form
3. Uses DIFFERENT wording, scenarios, and examples
4. If the original involves data/measurements, generate NEW synthetic values
   Example: Change "800,000 births" to "230,000 births"
   Example: Change "Figure 5 shows..." to "Consider a population where..."
5. Maintains the same difficulty level and awards the same marks
6. Includes realistic data that makes analytical sense
7. Is self-contained with no external references

IMPORTANT: 
- Generate synthetic data/values where needed
- Use different contexts (change locations, names, scenarios)
- Never reference the original document
- Make the question analytically equivalent but conceptually fresh

Return ONLY the new question text, no additional explanation.`;

          const replaceResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'You are an expert at creating exam questions that test concepts without requiring visual aids.' },
                { role: 'user', content: replacementPrompt }
              ],
            }),
          });

          if (replaceResponse.ok) {
            const replaceData = await replaceResponse.json();
            const newQuestionText = replaceData.choices?.[0]?.message?.content || question.question_text;
            
            await supabase
              .from('exam_question_drafts')
              .update({
                original_question_text: question.question_text,
                question_text: newQuestionText,
                generation_status: 'ai_generated',
                image_handling_strategy: 'concept_replacement',
                has_figures: false,
              })
              .eq('id', question.id);
            
            console.log(`Replaced image question ${question.question_number} with concept-based version`);
          }
        } else {
          // Keep original with reference warning
          const wrappedText = `[📷 IMAGE REFERENCE] ${question.question_text}\n\n⚠️ Note: This question references a diagram from the original document (page ${question.original_page_number}). Students should refer to the uploaded PDF.`;
          
          await supabase
            .from('exam_question_drafts')
            .update({
              original_question_text: question.question_text,
              question_text: wrappedText,
              generation_status: 'image_referenced',
              image_handling_strategy: 'original_reference',
            })
            .eq('id', question.id);
          
          console.log(`Kept image reference for question ${question.question_number}`);
        }
      } catch (imgError) {
        console.error(`Failed to process image question ${question.question_number}:`, imgError);
      }
    }

    // Save topics
    if (extractedTopics.length > 0) {
      await supabase
        .from('exam_topics')
        .delete()
        .eq('exam_id', draftId);

      const topicsToInsert = extractedTopics.map((topic: any) => ({
        exam_id: draftId,
        topic_name: topic.topic_name,
        confidence_score: topic.confidence_score || 0.8
      }));

      await supabase
        .from('exam_topics')
        .insert(topicsToInsert);

      console.log(`Inserted ${extractedTopics.length} topics`);
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
      topics: extractedTopics.length
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

// Helper function to determine image handling strategy (Hybrid Approach)
function determineImageStrategy(question: any): 'concept_replacement' | 'original_reference' {
  const imageKeywords = ['graph', 'diagram', 'chart', 'figure', 'table', 'image', 'illustration', 'plot'];
  const questionLower = question.question_text.toLowerCase();
  
  const hasComplexVisual = imageKeywords.some(kw => questionLower.includes(kw));
  
  // Use original reference for complex analytical questions with high marks
  if (hasComplexVisual && question.marks >= 4) {
    return 'original_reference';
  }
  
  // Use concept replacement for simpler questions
  return 'concept_replacement';
}
