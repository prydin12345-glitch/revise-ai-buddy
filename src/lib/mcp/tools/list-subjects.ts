import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_subjects",
  title: "List my subjects",
  description: "List the subjects the signed-in student or tutor has added, with exam board and category.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("user_subjects")
      .select("id, subject_name, custom_name, subject_category, exam_board, curriculum_tag, proficiency_estimate")
      .order("subject_name");
    if (error) throw new ToolError(error.message);

    const subjects = (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.custom_name ?? row.subject_name ?? "Untitled subject"),
      category: row.subject_category ?? null,
      examBoard: row.exam_board ?? null,
      level: row.curriculum_tag ?? null,
      proficiency: row.proficiency_estimate ?? null,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(subjects, null, 2) }],
      structuredContent: { subjects },
    };
  },
});
