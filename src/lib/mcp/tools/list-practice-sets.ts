import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_practice_sets",
  title: "List my practice quizzes",
  description: "List the signed-in user's practice quiz sets, newest first, with topics and difficulty.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("How many practice sets to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("practice_question_sets")
      .select("id, set_name, subject_id, subtopics, question_count, difficulty_level, exam_board, educational_tier, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) throw new ToolError(error.message);

    const sets = (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.set_name ?? "Untitled quiz"),
      subject: row.subject_id ?? null,
      topics: Array.isArray(row.subtopics) ? row.subtopics.map((t: unknown) => String(t)) : [],
      questionCount: row.question_count ?? null,
      difficulty: row.difficulty_level ?? null,
      examBoard: row.exam_board ?? null,
      tier: row.educational_tier ?? null,
      status: row.status ?? null,
      createdAt: row.created_at ?? null,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(sets, null, 2) }],
      structuredContent: { practiceSets: sets },
    };
  },
});
