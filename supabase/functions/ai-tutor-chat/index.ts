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

    const { message, conversationHistory, selectedExamId, selectedSetId, sessionId, selectedTitle } = await req.json();
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

    const [
      recentSets,
      recentExams,
      userSubjects,
      practiceSubjects,
      examSubjects,
      recentPracticeAnswers,
      recentExamAnswers,
    ] = await Promise.all([
      supabase.from('practice_question_sets')
        .select('id, set_name, subject_id, subtopics, created_at, status')
        .eq('user_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('exam_submissions')
        .select('id, total_score, total_marks, submitted_at, exams(id, title, subject_id)')
        .eq('student_id', user.id)
        .in('status', ['graded', 'submitted'])
        .not('total_score', 'is', null)
        .gt('total_marks', 0)
        .order('submitted_at', { ascending: false })
        .limit(8),
      supabase.from('user_subjects')
        .select('subject_name, custom_name, is_custom')
        .eq('user_id', user.id),
      supabase.from('practice_question_sets')
        .select('subject_id')
        .eq('user_id', user.id)
        .not('subject_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('exams')
        .select('subject_id')
        .eq('user_id', user.id)
        .not('subject_id', 'is', null)
        .limit(10),
      supabase.from('practice_question_answers')
        .select(`
          question_id,
          answer_text,
          score,
          is_correct,
          feedback,
          submitted_at,
          practice_questions (
            question_text,
            correct_answer,
            worked_solution,
            subtopic,
            marks,
            rationale
          ),
          practice_question_sets (
            set_name,
            subject_id,
            subtopics
          )
        `)
        .eq('user_id', user.id)
        .eq('is_correct', false)
        .not('answer_text', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(15),
      supabase.from('student_answers')
        .select(`
          question_id,
          answer_text,
          score,
          is_correct,
          feedback,
          submitted_at,
          exam_id,
          exams (
            title,
            subject_id
          )
        `)
        .eq('student_id', user.id)
        .eq('is_correct', false)
        .not('answer_text', 'is', null)
        .order('submitted_at', { ascending: false })
        .limit(15),
    ]);

    const allSubjectNames = [
      ...(userSubjects.data?.map((s: any) => s.custom_name || s.subject_name) ?? []),
      ...(practiceSubjects.data?.map((s: any) => s.subject_id) ?? []),
      ...(examSubjects.data?.map((s: any) => s.subject_id) ?? []),
    ].filter(Boolean);
    const uniqueSubjects = [...new Set(allSubjectNames)];
    const subjects = uniqueSubjects.length > 0 ? uniqueSubjects.join(', ') : 'various subjects';

    const examSummaries = recentExams.data
      ?.filter((e: any) => e.total_marks > 0 && e.total_score !== null)
      .map((e: any) => {
        const pct = Math.round((e.total_score / e.total_marks) * 100);
        const title = e.exams?.title ?? 'Exam';
        const subject = e.exams?.subject_id ?? '';
        const examId = e.exams?.id ?? '';
        const date = e.submitted_at
          ? new Date(e.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'unknown date';
        return `- "${title}"${subject ? ` (${subject})` : ''}: ${e.total_score}/${e.total_marks} = ${pct}% on ${date} [exam_id:${examId}]`;
      })
      .join('\n') || 'No completed exams yet';

    const practiceSummaries = recentSets.data
      ?.map((s: any) => {
        const topics = Array.isArray(s.subtopics) ? s.subtopics.slice(0, 3).join(', ') : s.subtopics ?? 'general';
        return `- "${s.set_name || topics}" (${s.subject_id ?? 'unknown subject'}) on ${
          new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        } [set_id:${s.id}]`;
      })
      .join('\n') || 'No practice sets yet';

    const wrongPracticeQuestions = recentPracticeAnswers.data
      ?.filter((a: any) => a.practice_questions?.question_text && a.answer_text)
      .slice(0, 8)
      .map((a: any) => {
        const q = a.practice_questions;
        const s = a.practice_question_sets;
        return [
          `  Question: "${q.question_text?.slice(0, 120)}${q.question_text?.length > 120 ? '...' : ''}"`,
          `  Topic: ${q.subtopic || s?.subject_id || 'unknown'}`,
          `  Student wrote: "${a.answer_text?.slice(0, 100)}"`,
          `  Correct answer: "${q.correct_answer?.slice(0, 100)}"`,
          `  Score: ${a.score ?? 0} marks`,
          q.rationale ? `  Why wrong: ${q.rationale.slice(0, 150)}` : null,
        ].filter(Boolean).join('\n');
      })
      .join('\n\n') || 'No practice question errors on record';

    const wrongExamQuestions = recentExamAnswers.data
      ?.filter((a: any) => a.answer_text)
      .slice(0, 8)
      .map((a: any) => {
        const exam = a.exams;
        return [
          `  Exam: "${exam?.title ?? 'unknown'}"`,
          `  Student wrote: "${a.answer_text?.slice(0, 100)}"`,
          `  Score: ${a.score ?? 0}`,
          a.feedback ? `  Feedback given: ${a.feedback.slice(0, 150)}` : null,
        ].filter(Boolean).join('\n');
      })
      .join('\n\n') || 'No exam errors on record';

    const topicErrorCounts: Record<string, number> = {};
    recentPracticeAnswers.data?.forEach((a: any) => {
      const subtopic = a.practice_questions?.subtopic;
      if (subtopic) topicErrorCounts[subtopic] = (topicErrorCounts[subtopic] ?? 0) + 1;
    });
    const weakestTopics = Object.entries(topicErrorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => `${topic} (${count} errors)`)
      .join(', ') || 'not yet determined from practice data';

    const systemPrompt = `You are an AI tutor for Examly, a personalised exam practice platform for UK students.

STUDENT PROFILE:
- Subjects: ${subjects}
- Weakest topics (from practice data): ${weakestTopics}

COMPLETED EXAMS:
${examSummaries}

RECENT PRACTICE SETS:
${practiceSummaries}

RECENT WRONG ANSWERS — PRACTICE QUIZZES:
${wrongPracticeQuestions}

RECENT WRONG ANSWERS — EXAMS:
${wrongExamQuestions}

YOUR ROLE:
You are a knowledgeable, encouraging tutor who helps students understand where they went wrong and how to improve. You have full access to the student's actual answer history above.

BEHAVIOUR RULES:
- When a student asks about a specific exam or quiz, reference the actual data above — name the specific questions they got wrong, quote their answer, explain what the correct answer was and why
- When a student asks "what did I get wrong" or similar, immediately reference the wrong answer data above — do not give a generic response
- Identify patterns in errors — if a student keeps getting the same topic wrong, point this out
- You can help with ANY academic topic, not just the student's current subjects
- Never refuse a question as out of scope
- Never give generic revision advice when you have specific data to reference

RESPONSE LENGTH — CRITICAL:
- Default response: maximum 3 sentences or 60 words. No exceptions.
- If the student asks "explain in detail" or "walk me through" or "why": maximum 120 words.
- If reviewing a specific question: state what was wrong in one sentence, state the correct answer in one sentence, give one sentence of explanation. That is three sentences total.
- Never repeat yourself. Never summarise what you just said. Never add encouragement after the answer — just stop.
- Short and direct always wins over long and thorough.

RESPONSE STYLE:
- Use plain text — no LaTeX, no markdown headers, no bullet symbols unless the student asks
- Be direct and specific — always reference actual question data when available
- When offering practice questions say "I can generate practice questions on this — just let me know"
- Tone: encouraging, direct, like a good private tutor

SPECIAL INSTRUCTIONS:
- The [exam_id:xxx] and [set_id:xxx] tags in the data above are for system use — never mention them to the student
- If a student names a specific exam, match it to the exam list above and reference its questions
- If asked to review a specific exam or quiz, walk through the wrong answers one by one
- Always tell the student the correct answer and a brief explanation of why, not just that they were wrong`;

    // Selected-exam deep context
    let selectedExamContext = '';
    if (selectedExamId) {
      const { data: examAnswers } = await supabase
        .from('student_answers')
        .select(`
          question_id,
          answer_text,
          score,
          is_correct,
          feedback,
          exam_questions (
            question_text,
            correct_answer,
            marks,
            question_number
          )
        `)
        .eq('student_id', user.id)
        .eq('exam_id', selectedExamId)
        .order('question_id');

      if (examAnswers && examAnswers.length > 0) {
        const total = examAnswers.length;
        const correct = examAnswers.filter((a: any) => a.is_correct).length;
        selectedExamContext = `
SELECTED EXAM FOR REVIEW — FULL BREAKDOWN:
Student scored ${correct}/${total} questions correct.

${examAnswers.map((a: any, i: number) => {
  const q = a.exam_questions;
  const status = a.is_correct ? '✓' : '✗';
  return [
    `Q${q?.question_number ?? i + 1} [${status}] (${a.score ?? 0}/${q?.marks ?? '?'} marks)`,
    `Question: "${q?.question_text?.slice(0, 200) ?? 'unknown'}"`,
    `Student answered: "${a.answer_text?.slice(0, 150) ?? 'no answer'}"`,
    !a.is_correct ? `Correct answer: "${q?.correct_answer?.slice(0, 150) ?? 'unknown'}"` : null,
    a.feedback ? `Feedback: ${a.feedback.slice(0, 150)}` : null,
  ].filter(Boolean).join('\n  ');
}).join('\n\n')}`;
      }
    }

    let selectedSetContext = '';
    if (selectedSetId) {
      const { data: setAnswers } = await supabase
        .from('practice_question_answers')
        .select(`
          question_id,
          answer_text,
          score,
          is_correct,
          feedback,
          practice_questions (
            question_text,
            correct_answer,
            worked_solution,
            subtopic,
            marks,
            question_number
          )
        `)
        .eq('user_id', user.id)
        .eq('set_id', selectedSetId)
        .order('question_id');

      if (setAnswers && setAnswers.length > 0) {
        const total = setAnswers.length;
        const correct = setAnswers.filter((a: any) => a.is_correct).length;
        selectedSetContext = `
SELECTED PRACTICE SET FOR REVIEW — FULL BREAKDOWN:
Student scored ${correct}/${total} questions correct.

${setAnswers.map((a: any, i: number) => {
  const q = a.practice_questions;
  const status = a.is_correct ? '✓' : '✗';
  return [
    `Q${q?.question_number ?? i + 1} [${status}] (${a.score ?? 0}/${q?.marks ?? '?'} marks)`,
    `Topic: ${q?.subtopic ?? 'unknown'}`,
    `Question: "${q?.question_text?.slice(0, 200) ?? 'unknown'}"`,
    `Student answered: "${a.answer_text?.slice(0, 150) ?? 'no answer'}"`,
    !a.is_correct ? `Correct answer: "${q?.correct_answer?.slice(0, 150) ?? 'unknown'}"` : null,
    !a.is_correct && q?.worked_solution ? `Worked solution: ${q.worked_solution.slice(0, 200)}` : null,
    a.feedback ? `Feedback: ${a.feedback.slice(0, 150)}` : null,
  ].filter(Boolean).join('\n  ');
}).join('\n\n')}`;
      }
    }

    const FOLLOWUP_INSTRUCTIONS = `

FOLLOW-UP PRACTICE QUESTIONS:
After explaining a wrong answer, you may offer a follow-up practice question to check understanding.

When you want to offer one, end your response with this EXACT format on a new line (no markdown, no code fences):
FOLLOWUP_QUESTION:{"question":"<question text>","type":"<short_answer|mcq>","options":["A. option1","B. option2","C. option3","D. option4"],"correctAnswer":"<answer or letter>","explanation":"<brief explanation>","marks":<number>}

Rules for follow-up questions:
- Only offer one after explaining a wrong answer, not for general questions
- Make it directly related to the concept the student got wrong
- For MCQ include exactly 4 options with plausible distractors and set correctAnswer to the letter (A/B/C/D)
- For short_answer leave options as an empty array []
- Keep the question concise — maximum 2 marks
- The explanation should be one sentence maximum
- Only include the FOLLOWUP_QUESTION block when genuinely useful — not after every message
- The JSON must be on a single line and be valid JSON`;

    let fullSystemPrompt = systemPrompt + FOLLOWUP_INSTRUCTIONS +
      (selectedExamContext ? '\n\n' + selectedExamContext : '') +
      (selectedSetContext ? '\n\n' + selectedSetContext : '');

    const isReviewWalkthrough =
      message.includes('Go through each question I got wrong') ||
      message.includes('go through each question');

    if (isReviewWalkthrough) {
      fullSystemPrompt += `

REVIEW MODE — CRITICAL FORMATTING RULES:
This is a question-by-question exam review. Format your response exactly like this:

For each wrong answer write:
"**Q[number] — [topic]**
You wrote: "[brief quote of student answer]"
What went wrong: [one sentence explanation]
Correct answer: [the correct answer in one sentence]"

Then a blank line before the next question.

Maximum 2 questions per response. After 2 questions end with:
"Tap any question on the right to go deeper, or ask me about a specific one."

Keep each question block to 4 lines maximum. No introduction. No conclusion. Start directly with Q1.`;
    }

    const history = Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [];
    const messages = [
      { role: 'system', content: fullSystemPrompt },
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
          max_tokens: 250,
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
      session_id: sessionId ?? null,
    });

    if (sessionId) {
      const { data: existingSession } = await supabase
        .from('ai_tutor_sessions')
        .select('message_count')
        .eq('id', sessionId)
        .maybeSingle();
      const currentSessionCount = existingSession?.message_count ?? 0;

      await supabase.from('ai_tutor_sessions').upsert({
        id: sessionId,
        user_id: user.id,
        title: (selectedExamId || selectedSetId) ? 'Review session' : 'Chat session',
        preview: message.slice(0, 80),
        selected_exam_id: selectedExamId ?? null,
        selected_set_id: selectedSetId ?? null,
        selected_title: selectedTitle ?? null,
        message_count: currentSessionCount + 2,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    }

    const encoder = new TextEncoder();
    let fullResponse = '';
    let streamedSoFar = '';
    const FOLLOWUP_MARKER = '\nFOLLOWUP_QUESTION:';

    const flushFinal = async (controller: ReadableStreamDefaultController) => {
      // Detect followup block in full response
      const idx = fullResponse.indexOf(FOLLOWUP_MARKER);
      let cleanResponse = fullResponse;
      let followupData: any = null;

      if (idx !== -1) {
        const jsonPart = fullResponse.slice(idx + FOLLOWUP_MARKER.length).trim();
        // Find a valid JSON object (greedy match through last `}`)
        const lastBrace = jsonPart.lastIndexOf('}');
        if (lastBrace !== -1) {
          const candidate = jsonPart.slice(0, lastBrace + 1);
          try {
            followupData = JSON.parse(candidate);
          } catch {
            // ignore malformed
          }
        }
        cleanResponse = fullResponse.slice(0, idx).trim();
      }

      // Flush any remaining clean text that hasn't been streamed yet
      if (cleanResponse.length > streamedSoFar.length) {
        const remaining = cleanResponse.slice(streamedSoFar.length);
        if (remaining) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: remaining })}\n\n`));
        }
      }

      if (followupData) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ followup: followupData })}\n\n`));
      }

      if (cleanResponse) {
        await supabase.from('ai_tutor_messages').insert({
          user_id: user.id,
          role: 'assistant',
          content: cleanResponse,
          session_id: sessionId ?? null,
        });
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    };

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
                await flushFinal(controller);
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content ?? '';
                if (token) {
                  fullResponse += token;

                  // Stream only safe-to-emit text (everything before the FOLLOWUP marker).
                  // If the marker hasn't appeared, hold back the last 25 chars in case
                  // it's the start of "\nFOLLOWUP_QUESTION:" arriving across token boundaries.
                  const markerIdx = fullResponse.indexOf(FOLLOWUP_MARKER);
                  let safeUpTo: number;
                  if (markerIdx !== -1) {
                    safeUpTo = markerIdx;
                  } else {
                    safeUpTo = Math.max(0, fullResponse.length - 25);
                  }

                  if (safeUpTo > streamedSoFar.length) {
                    const toEmit = fullResponse.slice(streamedSoFar.length, safeUpTo);
                    streamedSoFar = fullResponse.slice(0, safeUpTo);
                    if (toEmit) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: toEmit })}\n\n`));
                    }
                  }
                }
              } catch {
                // skip
              }
            }
          }

          await flushFinal(controller);
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
  } catch (err) {
    console.error('ai-tutor-chat error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
