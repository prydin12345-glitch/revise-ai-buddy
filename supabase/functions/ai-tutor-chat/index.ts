import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DAILY_MESSAGE_LIMIT = 50;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorised' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorised' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, conversationHistory } = await req.json();
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit
    const today = new Date().toISOString().split('T')[0];
    const { data: rateData } = await supabase
      .from('ai_tutor_rate_limits')
      .select('message_count')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    const currentCount = rateData?.message_count ?? 0;
    if (currentCount >= DAILY_MESSAGE_LIMIT) {
      return new Response(
        JSON.stringify({
          error: 'daily_limit_reached',
          message: `You have reached your daily limit of ${DAILY_MESSAGE_LIMIT} messages. Your limit resets at midnight.`,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const safe = async <T>(p: Promise<{ data: T | null }>): Promise<T | null> => {
      try { return (await p).data; } catch { return null; }
    };

    const [recentSets, recentExams, userSubjects, practiceSubjects, examSubjects] = await Promise.all([
      safe(supabase
        .from('practice_question_sets')
        .select('subject_id, subtopics, created_at')
        .eq('user_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(5) as any),
      safe(supabase
        .from('exam_submissions')
        .select('total_score, total_marks, submitted_at, exams(title, subject_id)')
        .eq('student_id', user.id)
        .in('status', ['graded', 'submitted'])
        .not('total_score', 'is', null)
        .gt('total_marks', 0)
        .order('submitted_at', { ascending: false })
        .limit(5) as any),
      safe(supabase
        .from('user_subjects')
        .select('subject_name, custom_name, is_custom')
        .eq('user_id', user.id) as any),
      safe(supabase
        .from('practice_question_sets')
        .select('subject_id')
        .eq('user_id', user.id)
        .not('subject_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20) as any),
      safe(supabase
        .from('exams')
        .select('subject_id')
        .eq('user_id', user.id)
        .not('subject_id', 'is', null)
        .limit(10) as any),
    ]);

    const allSubjectNames = [
      ...((userSubjects as any[] | null)?.map(s => s.custom_name || s.subject_name) ?? []),
      ...((practiceSubjects as any[] | null)?.map(s => s.subject_id) ?? []),
      ...((examSubjects as any[] | null)?.map(s => s.subject_id) ?? []),
    ].filter(Boolean);
    const uniqueSubjects = [...new Set(allSubjectNames)];
    const subjects = uniqueSubjects.length > 0 ? uniqueSubjects.join(', ') : 'various subjects';

    const recentScores = (recentExams as any[] | null)
      ?.filter(e => (e.total_marks ?? 0) > 0 && e.total_score !== null && e.total_score !== undefined)
      .map(e => {
        const pct = Math.round((Number(e.total_score) / Number(e.total_marks)) * 100);
        return `${e.exams?.title ?? 'Exam'}: ${pct}%`;
      }).join(', ') || 'no completed exams yet';
    const recentTopics = (recentSets as any[] | null)?.flatMap(s => s.subtopics ?? []).filter(Boolean).slice(0, 8).join(', ') || 'none yet';

    const systemPrompt = `You are an AI tutor for Examly, a revision and exam practice platform.

Student profile:
- Main exam subjects: ${subjects}
- Recent completed exam scores: ${recentScores}
- Recently practised topics: ${recentTopics}

Your behaviour:
- You are a knowledgeable tutor who can help with ANY academic or professional topic
- Do NOT refuse questions because they are outside the student's exam subjects
- If a student asks about a specialist topic like NHS sterilization protocols, medical equipment, law, music theory, or any other subject — answer it helpfully and accurately
- You have broad academic knowledge — use it
- When the question relates to their exam subjects, reference their specific performance data
- When the question is outside their exam subjects, answer it as a knowledgeable tutor would
- Never say a topic is "outside our scope" — there is no scope limit

Response style:
- Keep responses under 120 words unless the student asks for a detailed explanation
- Be specific and practical — avoid generic advice
- Use plain text — no LaTeX, no markdown headers
- When you suggest practice questions say "I can generate practice questions on this — just let me know"
- Be encouraging and direct

If the student asks about their exam performance, reference their actual data above.
If the student asks a general knowledge or subject question, answer it directly without referencing their exam data unless relevant.`;

    const history = Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [];
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const aiResponse = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages,
          max_tokens: 400,
          temperature: 0.7,
          stream: true,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'AI service is busy. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please contact support.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'AI service unavailable. Please try again.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('ai_tutor_rate_limits').upsert({
      user_id: user.id,
      date: today,
      message_count: currentCount + 1,
    }, { onConflict: 'user_id,date' });

    await supabase.from('ai_tutor_messages').insert({
      user_id: user.id,
      role: 'user',
      content: message,
    });

    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiResponse.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (data === '[DONE]') {
                if (fullResponse) {
                  await supabase.from('ai_tutor_messages').insert({
                    user_id: user.id,
                    role: 'assistant',
                    content: fullResponse,
                  });
                }
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content ?? '';
                if (token) {
                  fullResponse += token;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                }
              } catch {
                // skip
              }
            }
          }

          if (fullResponse) {
            await supabase.from('ai_tutor_messages').insert({
              user_id: user.id,
              role: 'assistant',
              content: fullResponse,
            });
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('Stream error:', err);
          try { controller.close(); } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('ai-tutor-chat error:', err);
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
