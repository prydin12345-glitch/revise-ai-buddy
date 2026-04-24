import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors-headers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const userId = user.id;

    // Helper for safe parallel fetches that ignore missing tables / errors.
    const safeFetch = async (
      label: string,
      query: () => Promise<{ data: unknown; error: unknown }>,
    ) => {
      try {
        const { data, error } = await query();
        if (error) return [label, null] as const;
        return [label, data] as const;
      } catch {
        return [label, null] as const;
      }
    };

    const fetches = await Promise.all([
      safeFetch("profile", () =>
        admin.from("user_profiles").select("*").eq("id", userId).maybeSingle()),
      safeFetch("roles", () =>
        admin.from("user_roles").select("*").eq("user_id", userId)),
      safeFetch("preferences", () =>
        admin.from("user_preferences").select("*").eq("user_id", userId).maybeSingle()),
      safeFetch("subjects_studied", () =>
        admin.from("user_subjects").select("*").eq("user_id", userId)),
      safeFetch("onboarding_status", () =>
        admin.from("user_onboarding_status").select("*").eq("user_id", userId).maybeSingle()),
      safeFetch("exams_created", () =>
        admin.from("exams").select("*, exam_topics(*), exam_questions(*)").eq("user_id", userId)),
      safeFetch("exam_submissions", () =>
        admin.from("exam_submissions").select("*").eq("student_id", userId)),
      safeFetch("student_answers", () =>
        admin.from("student_answers").select("*").eq("student_id", userId)),
      safeFetch("practice_sets", () =>
        admin.from("practice_question_sets").select("*, practice_questions(*)").eq("user_id", userId)),
      safeFetch("practice_progress", () =>
        admin.from("practice_set_progress").select("*").eq("user_id", userId)),
      safeFetch("practice_answers", () =>
        admin.from("practice_question_answers").select("*").eq("user_id", userId)),
      safeFetch("revision_goals", () =>
        admin.from("revision_goals").select("*").eq("user_id", userId)),
      safeFetch("revision_tasks", () =>
        admin.from("revision_tasks").select("*").eq("user_id", userId)),
      safeFetch("daily_goals", () =>
        admin.from("daily_goals").select("*").eq("user_id", userId)),
      safeFetch("weekly_subject_stats", () =>
        admin.from("weekly_subject_stats").select("*").eq("user_id", userId)),
      safeFetch("class_memberships", () =>
        admin.from("group_members").select("*, student_groups(name, invite_code)").eq("student_id", userId)),
      safeFetch("notifications", () =>
        admin.from("notifications").select("*").eq("user_id", userId)),
      safeFetch("ai_usage_summary", () =>
        admin.from("ai_usage_tracking").select("*").eq("user_id", userId)),
      safeFetch("feedback_threads", () =>
        admin.from("question_feedback_threads").select("*").eq("student_id", userId)),
    ]);

    const dataMap: Record<string, unknown> = {};
    for (const [label, data] of fetches) dataMap[label] = data;

    const exportData = {
      export_info: {
        generated_at: new Date().toISOString(),
        user_id: userId,
        email: user.email,
        note:
          "This file contains all personal data held by Examly for your account, " +
          "exported in compliance with UK GDPR Article 20 (Right to Data Portability).",
      },
      account: {
        email: user.email,
        created_at: user.created_at,
        last_sign_in: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
      },
      ...dataMap,
    };

    const filename = `examly-data-export-${new Date().toISOString().split("T")[0]}.json`;

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
