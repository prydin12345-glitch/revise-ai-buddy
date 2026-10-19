import { supabase } from "@/integrations/supabase/exam-metadata-client";
import type { LibraryKind } from "./library-item-cache";

/** Public metadata only. Page past PostgREST's row limit instead of showing partial mark totals. */
export async function loadLibraryQuestionMetadata(kind: LibraryKind, itemIds: string[]) {
  const rows: Array<{ itemId: string; marks: number | null }> = [];
  const seen = new Set<string>();
  const pageSize = 500;
  for (let chunk = 0; chunk < itemIds.length; chunk += 25) {
    const ids = itemIds.slice(chunk, chunk + 25);
    for (let offset = 0; ; offset += pageSize) {
      const result = kind === "exam"
        ? await supabase.from("exam_question_metadata").select("id, exam_id, marks").in("exam_id", ids).order("id").range(offset, offset + pageSize - 1)
        : await supabase.from("practice_questions").select("id, set_id, marks").in("set_id", ids).order("id").range(offset, offset + pageSize - 1);
      if (result.error) throw result.error;
      for (const row of result.data || []) {
        if (!row.id || seen.has(row.id)) throw new Error("Question metadata is incomplete or repeated. Retry to load mark totals.");
        seen.add(row.id);
        const itemId = "exam_id" in row ? row.exam_id : row.set_id;
        if (!itemId || !ids.includes(itemId)) throw new Error("Question metadata does not match this library.");
        rows.push({ itemId, marks: row.marks });
      }
      if ((result.data?.length || 0) < pageSize) break;
    }
  }
  return rows;
}
