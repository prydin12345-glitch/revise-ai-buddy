import { corsHeaders } from "../_shared/cors-headers.ts";
import { buildGenerationContext, formatGenerationContextPrompt } from "../_shared/generation-context.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { questionText, subjectName, educationalTier, curriculumRegion } = await req.json();

    if (!questionText || !subjectName) {
      return new Response(JSON.stringify({ error: "Missing questionText or subjectName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build combined generation context
    const genCtx = buildGenerationContext(curriculumRegion, educationalTier);
    const contextBlock = formatGenerationContextPrompt(genCtx);

    const systemPrompt = `You are an expert exam question editor for UK and international exam boards (AQA, Edexcel, OCR, IB).
Your job is to take a tutor's raw question and rephrase it into formal, exam-board style language.

${contextBlock}

Rules:
- Preserve all mathematical/scientific requirements exactly.
- Use proper command verbs matching the generation context above.
- Maintain any LaTeX notation wrapped in $ delimiters.
- Do NOT change the difficulty or add new parts.
- Keep the same mark allocation intent.
- Output ONLY the polished question text, nothing else.`;

    const userPrompt = `Subject: ${subjectName}
Level: ${genCtx.level} (${genCtx.region})

Raw question:
${questionText}

Polished question:`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not set");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} — ${errText}`);
    }

    const result = await response.json();
    const polishedText = result.choices?.[0]?.message?.content?.trim() || questionText;

    return new Response(JSON.stringify({ polishedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("polish-question error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
