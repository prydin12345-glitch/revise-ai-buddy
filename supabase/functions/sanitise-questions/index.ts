import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitiseFeedback } from "../_shared/sanitise-feedback.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── ADMIN-ONLY GUARD ─────────────────────────────────────────────────
  // This maintenance endpoint rewrites the entire question bank with
  // service-role privileges. It must never be callable by ordinary users.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: { user }, error: authError } =
    await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorised" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: adminRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!adminRow) {
    console.warn(`sanitise-questions blocked: non-admin user ${user.id}`);
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // ─────────────────────────────────────────────────────────────────────

  const batchSize = 200;
  let offset = 0;
  let totalUpdated = 0;
  let totalScanned = 0;

  while (true) {
    const { data: questions, error } = await supabase
      .from("practice_questions")
      .select("id, question_text, correct_answer, rationale, worked_solution")
      .range(offset, offset + batchSize - 1)
      .order("created_at", { ascending: false });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message, totalUpdated, totalScanned }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!questions || questions.length === 0) break;

    for (const q of questions) {
      totalScanned++;
      const cleanText = sanitiseFeedback(q.question_text ?? "");
      const cleanAnswer = sanitiseFeedback(q.correct_answer ?? "");
      const cleanRationale = sanitiseFeedback(q.rationale ?? "");
      const cleanWorked = sanitiseFeedback(q.worked_solution ?? "");

      const updates: Record<string, string> = {};
      if (q.question_text != null && cleanText !== q.question_text) updates.question_text = cleanText;
      if (q.correct_answer != null && cleanAnswer !== q.correct_answer) updates.correct_answer = cleanAnswer;
      if (q.rationale != null && cleanRationale !== q.rationale) updates.rationale = cleanRationale;
      if (q.worked_solution != null && cleanWorked !== q.worked_solution) updates.worked_solution = cleanWorked;

      if (Object.keys(updates).length > 0) {
        await supabase.from("practice_questions").update(updates).eq("id", q.id);
        totalUpdated++;
      }
    }

    offset += batchSize;
    if (questions.length < batchSize) break;
  }

  return new Response(
    JSON.stringify({ success: true, totalScanned, totalUpdated }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
