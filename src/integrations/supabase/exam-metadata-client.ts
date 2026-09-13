import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as existingClient } from "./client";
import type { Database } from "./types";

// Lovable generates types.ts from the deployed schema. Keep the two pending
// view declarations here so frontend checks can run before their migration.
// This declaration does not create views or change database permissions.
type PendingExamViews = {
  exam_question_metadata: {
    Row: {
      id: string;
      exam_id: string;
      question_number: string;
      marks: number;
    };
    Relationships: [];
  };
  exam_submission_metadata: {
    Row: {
      id: string;
      exam_id: string;
      student_id: string;
      status: string | null;
      time_remaining_seconds: number | null;
      last_accessed_at: string | null;
      exam_started_at: string | null;
      submitted_at: string | null;
      time_taken_seconds: number | null;
      total_score: number | null;
      total_marks: number | null;
    };
    Relationships: [];
  };
};

type GeneratedViews = Database["public"]["Views"];

export type DatabaseWithExamMetadata = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Views"> & {
    // Once Lovable generates these views, its definitions take precedence.
    Views: GeneratedViews & Omit<PendingExamViews, keyof GeneratedViews>;
  };
};

// A schema-specific type assertion on the SAME client. No second connection,
// auth store, token or runtime query is created, and existing types stay intact.
export const supabase = existingClient as SupabaseClient<DatabaseWithExamMetadata>;
