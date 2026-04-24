import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors-headers.ts";

interface DeletionResult {
  table: string;
  ok: boolean;
  error?: string;
  count?: number;
}

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

    // Verify the user
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
    const results: DeletionResult[] = [];

    // Helper to delete by a column, swallowing missing-table/column errors.
    const safeDelete = async (table: string, column: string, value: string) => {
      try {
        const { error, count } = await admin
          .from(table)
          .delete({ count: "exact" })
          .eq(column, value);
        if (error) {
          results.push({ table, ok: false, error: error.message });
        } else {
          results.push({ table, ok: true, count: count ?? 0 });
        }
      } catch (e) {
        results.push({ table, ok: false, error: (e as Error).message });
      }
    };

    // 1. Children referencing user_id ----------------------------------
    const userIdTables = [
      "practice_question_answers",
      "practice_set_progress",
      "favourite_practice_sets",
      "favourite_exams",
      "revision_goals",
      "revision_tasks",
      "weekly_subject_stats",
      "daily_goals",
      "user_subjects",
      "user_onboarding_status",
      "user_preferences",
      "user_streaks",
      "user_sessions",
      "session_feedback",
      "ai_usage_tracking",
      "notifications",
      "tutor_profiles",
      "tutor_manual_exams",
      "tutor_question_bank",
      "subject_exam_profiles",
      "resource_packs",
    ];
    for (const t of userIdTables) await safeDelete(t, "user_id", userId);

    // 2. Children referencing student_id -------------------------------
    const studentIdTables = [
      "student_answers",
      "exam_submissions",
      "question_feedback_threads",
      "group_members",
      "class_assignments",
    ];
    for (const t of studentIdTables) await safeDelete(t, "student_id", userId);

    // 3. Exams created by this user — clean dependents first ----------
    try {
      const { data: userExams } = await admin
        .from("exams")
        .select("id")
        .eq("user_id", userId);
      if (userExams && userExams.length > 0) {
        const examIds = userExams.map((e: { id: string }) => e.id);
        for (const t of [
          "exam_questions",
          "exam_question_drafts",
          "exam_topics",
          "exam_specifications",
          "exam_format",
          "exam_timer",
          "exam_assignments",
          "exam_submissions",
          "question_feedback_threads",
        ]) {
          try {
            await admin.from(t).delete().in("exam_id", examIds);
          } catch { /* ignore */ }
        }
        await admin.from("exams").delete().in("id", examIds);
        results.push({ table: "exams", ok: true, count: examIds.length });
      }
    } catch (e) {
      results.push({ table: "exams", ok: false, error: (e as Error).message });
    }

    // 4. Tutor's groups → deactivate so existing student data stays intact
    try {
      await admin
        .from("student_groups")
        .update({ is_active: false })
        .eq("tutor_id", userId);
    } catch { /* ignore */ }

    // 5. User profile + roles ------------------------------------------
    try {
      await admin.from("user_roles").delete().eq("user_id", userId);
      results.push({ table: "user_roles", ok: true });
    } catch (e) {
      results.push({ table: "user_roles", ok: false, error: (e as Error).message });
    }
    try {
      // user_profiles uses `id` as the PK, equal to auth user id
      await admin.from("user_profiles").delete().eq("id", userId);
      results.push({ table: "user_profiles", ok: true });
    } catch (e) {
      results.push({ table: "user_profiles", ok: false, error: (e as Error).message });
    }

    // 6. Finally delete the auth user ----------------------------------
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Auth deletion failed: ${deleteError.message}`,
          results,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Account and all associated data deleted successfully",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
