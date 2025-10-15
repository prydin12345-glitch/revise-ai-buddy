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

    console.log('Publishing exam:', draftId);

    // Verify exam ownership and fetch data
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

    // Fetch exam format
    const { data: format } = await supabase
      .from('exam_format')
      .select('*')
      .eq('exam_id', draftId)
      .single();

    // Fetch topics
    const { data: topics } = await supabase
      .from('exam_topics')
      .select('topic_name')
      .eq('exam_id', draftId);

    const topicNames = topics?.map(t => t.topic_name).join(', ') || 'General';

    // Generate questions using Lovable AI
    let questionsData = [];
    
    if (format) {
      const prompt = `You are an expert exam creator. Create exam questions based on the following requirements:

${format.use_original_structure ? 'Use the original exam structure from the document.' : `Custom format:
- Multiple Choice Questions: ${format.mcq_count || 0} questions, ${format.mcq_marks_each || 0} marks each
- Short Answer Questions: ${format.short_answer_count || 0} questions, ${format.short_answer_marks_each || 0} marks each
- Long Form Questions: ${format.long_form_count || 0} questions, ${format.long_form_marks_each || 0} marks each`}

Topics to cover: ${topicNames}

For each question, provide:
1. Question type (mcq/short_answer/long_form)
2. Question text
3. Marks allocation
4. For MCQs: Provide 4 options as {a: "text", b: "text", c: "text", d: "text"} and the correct answer (a/b/c/d)
5. For other types: A suggested answer key

Return ONLY a valid JSON array with this exact structure:
[
  {
    "type": "mcq",
    "text": "Question text here?",
    "marks": 2,
    "options": {"a": "Option A", "b": "Option B", "c": "Option C", "d": "Option D"},
    "correctAnswer": "a"
  }
]`;

      console.log('Calling Lovable AI for question generation...');
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            { role: 'system', content: 'You are an expert exam creator. Return only valid JSON arrays.' },
            { role: 'user', content: prompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        console.error('AI API error:', aiResponse.status, await aiResponse.text());
        throw new Error('Failed to generate questions');
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '[]';
      
      // Parse AI response
      try {
        questionsData = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
      } catch (e) {
        console.error('Failed to parse AI response:', content);
        questionsData = [];
      }
    }

    // Insert questions into database
    if (questionsData.length > 0) {
      const questionInserts = questionsData.map((q: any, index: number) => ({
        exam_id: draftId,
        question_number: index + 1,
        question_type: q.type,
        question_text: q.text,
        marks: q.marks,
        options: q.options || null,
        correct_answer: q.correctAnswer || null,
      }));

      const { error: insertError } = await supabase
        .from('exam_questions')
        .insert(questionInserts);

      if (insertError) {
        console.error('Insert questions error:', insertError);
        throw new Error('Failed to save questions');
      }

      console.log(`Generated and saved ${questionsData.length} questions`);
    }

    // Update status to published
    const { error: updateError } = await supabase
      .from('exams')
      .update({ status: 'published' })
      .eq('id', draftId);

    if (updateError) {
      console.error('Publish error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to publish exam' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      examId: draftId,
      questionsGenerated: questionsData.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in publish-exam:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
