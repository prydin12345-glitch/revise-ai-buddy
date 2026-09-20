import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_exams",
  title: "List my exam papers",
  description: "List the signed-in user's exam papers, newest first, with board, level and status.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("How many papers to return."),
    status: z.string().trim().min(1).optional().describe("Only return papers with this status."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("exams")
      .select("id, title, subject_id, status, exam_board, qualification_level, extraction_status, total_questions_extracted, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new ToolError(error.message);

    const exams = (data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? "Untitled exam"),
      subject: row.subject_id ?? null,
      status: row.status ?? null,
      examBoard: row.exam_board ?? null,
      level: row.qualification_level ?? null,
      extractionStatus: row.extraction_status ?? null,
      questionCount: row.total_questions_extracted ?? null,
      createdAt: row.created_at ?? null,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(exams, null, 2) }],
      structuredContent: { exams },
    };
  },
});
