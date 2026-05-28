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

    // Student context — defensive, swallow errors per query
    const safe = async <T>(p: Promise<{ data: T | null }>): Promise<T | null> => {
      try { return (await p).data; } catch { return null; }
    };

    const [recentSets, recentExams, userSubjects] = await Promise.all([
      safe(supabase
        .from('practice_question_sets')
        .select('subject_id, subtopics, created_at')
        .eq('user_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(5) as any),
      safe(supabase
        .from('exam_submissions')
        .select('total_score, total_marks, submitted_at, exams(title)')
        .eq('student_id', user.id)
        .eq('status', 'submitted')
        .not('total_score', 'is', null)
        .gt('total_marks', 0)
        .order('submitted_at', { ascending: false })
        .limit(5) as any),
      safe(supabase
        .from('user_subjects')
        .select('subject_name')
        .eq('user_id', user.id)
        .limit(5) as any),
    ]);

    const subjects = (userSubjects as any[] | null)?.map(s => s.subject_name).filter(Boolean).join(', ') || 'not set';
    const recentScores = (recentExams as any[] | null)
      ?.filter(e => (e.total_marks ?? 0) > 0 && e.total_score !== null && e.total_score !== undefined)
      .map(e => {
        const pct = Math.round((Number(e.total_score) / Number(e.total_marks)) * 100);
        return `${e.exams?.title ?? 'Exam'}: ${pct}%`;
      }).join(', ') || 'no completed exams yet';
    const recentTopics = (recentSets as any[] | null)?.map(s => s.topic).filter(Boolean).join(', ') || 'none';

    const studentContext = `Student context:
- Subjects: ${subjects}
- Recent exam scores: ${recentScores}
- Recent practice topics: ${recentTopics}`;

    const systemPrompt = `You are an AI tutor for Examly, an exam practice platform.

${studentContext}

Your role:
- Give concise, specific advice based on the student's actual performance data above
- Never give generic revision tips — always reference their specific weak areas when data exists
- Keep responses under 120 words unless the student explicitly asks for a detailed explanation
- When suggesting practice, say "I can generate practice questions on this — just let me know"
- Be encouraging but honest
- Use plain text — no LaTeX, no markdown headers, no bullet symbols unless asked
- You can help with: explaining wrong answers, revision planning, topic explanations, exam technique`;

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

    // Increment rate limit + save user message (fire and forget)
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
