import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_exam_results",
  title: "List my exam results",
  description: "List the signed-in student's completed exam attempts with score, marks and time taken.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("How many attempts to return."),
    examId: z.string().uuid().optional().describe("Only return attempts for this exam paper."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, examId }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("exam_submissions")
      .select("id, exam_id, status, total_score, total_marks, time_taken_seconds, submitted_at")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(limit ?? 20);
    if (examId) query = query.eq("exam_id", examId);

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    const results = (data ?? []).map((row) => {
      const score = row.total_score === null || row.total_score === undefined ? null : Number(row.total_score);
      const marks = row.total_marks ?? null;
      return {
        id: String(row.id),
        examId: String(row.exam_id),
        status: row.status ?? null,
        score,
        totalMarks: marks,
        percentage: score !== null && marks ? Math.round((score / marks) * 100) : null,
        timeTakenSeconds: row.time_taken_seconds ?? null,
        submittedAt: row.submitted_at ?? null,
      };
    });

    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      structuredContent: { results },
    };
  },
});
