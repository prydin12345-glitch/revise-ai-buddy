import { corsHeaders } from "../_shared/cors-headers.ts";

const VALID_CATEGORIES = [
  'english_language', 'english_literature', 'mathematics',
  'biology', 'chemistry', 'physics', 'geography', 'history',
  'business', 'computer_science', 'psychology', 'sociology',
  'art_design', 'music', 'physical_education', 'other'
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subjectName } = await req.json();

    if (!subjectName || typeof subjectName !== "string") {
      return new Response(
        JSON.stringify({ error: "subjectName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing API key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 50,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: `Classify this academic subject into exactly one category.

Subject: "${subjectName}"

Categories:
- english_language (for English Language, Creative Writing, Communication Studies)
- english_literature (for English Literature, Literary Studies, World Literature)
- mathematics (for Maths, Further Maths, Statistics, Pure Mathematics)
- biology (for Biology, Human Biology, Marine Biology, Ecology)
- chemistry (for Chemistry, Organic Chemistry, Biochemistry)
- physics (for Physics, Applied Physics, Astrophysics, Engineering)
- geography (for Geography, Environmental Science, Earth Science, Geology)
- history (for History, Ancient History, Modern History, Classical Civilisation)
- business (for Business Studies, Economics, Accounting, Finance)
- computer_science (for Computer Science, IT, Computing, Programming)
- psychology (for Psychology, Cognitive Science)
- sociology (for Sociology, Politics, Government, Law, Philosophy, Religious Studies)
- art_design (for Art, Design, Graphics, Photography, Textiles, Fashion)
- music (for Music, Music Technology, Performing Arts, Drama, Dance, Theatre)
- physical_education (for PE, Sports Science, Health & Fitness)
- other (for anything that doesn't clearly fit)

Reply with ONLY the category name, nothing else.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status, await response.text());
      return new Response(
        JSON.stringify({ category: "other" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const rawCategory = (data.choices?.[0]?.message?.content || "other").trim().toLowerCase();

    const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : "other";

    return new Response(
      JSON.stringify({ category }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error classifying subject:", error);
    return new Response(
      JSON.stringify({ category: "other" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
