// FILE: supabase/functions/derive-exam-topics/index.ts
// Phase 1 of the smart-upload plan: derive a topic scope from an uploaded
// exam PDF so scopeless uploads get the same quality boundary a profile
// provides. Called by CreateExam after upload, before extraction; the user
// confirms/edits the topics, which then bound generation.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless@0.2.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function extractPdfText(fileUrl: string | null, supabase: any): Promise<string> {
  if (!fileUrl) return "";
  const { data, error } = await supabase.storage.from("exam-files").download(fileUrl);
  if (error || !data) return "";
  try {
    const arr = new Uint8Array(await data.arrayBuffer());
    const pdf = await getDocument({ data: arr, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str || "").join(" "));
    }
    pdf.cleanup();
    return pages.join("\n\n").replace(/\s+/g, " ").trim();
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(await data.arrayBuffer()));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { draftId } = await req.json();
    const { data: exam } = await supabase
      .from("exams")
      .select("id, user_id, file_url, subject_id, qualification_level")
      .eq("id", draftId)
      .single();
    if (!exam || exam.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const pdfText = await extractPdfText(exam.file_url, supabase);
    if (!pdfText || pdfText.length < 200) {
      return new Response(JSON.stringify({ topics: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prompt = `This is text from a ${exam.subject_id || ""} ${exam.qualification_level || ""} exam paper. Identify the 5-9 CURRICULUM TOPICS the paper actually assesses (specification-module level, e.g. "Water and carbon cycles", "Changing places" — not individual question subjects). Cover only what the paper genuinely tests; do not pad with topics it doesn't touch.
Return ONLY a JSON array of topic strings.

PAPER TEXT (sampled):
${pdfText.slice(0, 6000)}
${pdfText.length > 8000 ? "[...]\n" + pdfText.slice(8000, 12000) : ""}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });
    let topics: string[] = [];
    if (resp.ok) {
      const data = await resp.json();
      const raw = data.choices?.[0]?.message?.content || "";
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          topics = (JSON.parse(match[0]) as any[])
            .filter((t) => typeof t === "string" && t.trim().length > 2)
            .map((t) => t.trim())
            .slice(0, 9);
        } catch { /* fall through with empty */ }
      }
    }
    console.log(`[derive-topics] draft=${draftId} derived ${topics.length} topics`);
    return new Response(JSON.stringify({ topics }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[derive-topics] error:", e);
    return new Response(JSON.stringify({ topics: [], error: String(e) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
