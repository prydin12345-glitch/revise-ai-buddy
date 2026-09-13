import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as existingClient } from "./client";
import type { Database, Json } from "./types";

// Lovable generates types.ts from the deployed schema. The assessment-tier
// migration is prepared but NOT yet applied, so its columns are declared here
// in an ordinary app-owned module. Once the migration runs and types are
// regenerated, the generated definitions take precedence automatically and
// this file can be deleted. Nothing here creates a column, a second client or
// a permission — it is a type assertion on the existing client only.

type Tables = Database["public"]["Tables"];

type Extend<T extends keyof Tables, Pending> = Omit<
  Tables[T],
  "Row" | "Insert" | "Update"
> & {
  Row: Tables[T]["Row"] & Omit<Pending, keyof Tables[T]["Row"]>;
  Insert: Tables[T]["Insert"] &
    Partial<Omit<Pending, keyof Tables[T]["Insert"]>>;
  Update: Tables[T]["Update"] &
    Partial<Omit<Pending, keyof Tables[T]["Update"]>>;
};

type PendingProfileColumns = { assessment_tier: string | null };
type PendingContextColumns = { generation_context: Json | null };

export type DatabaseWithProfileContext = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<
      Tables,
      "subject_exam_profiles" | "exams" | "practice_question_sets"
    > & {
      subject_exam_profiles: Extend<
        "subject_exam_profiles",
        PendingProfileColumns
      >;
      exams: Extend<"exams", PendingContextColumns>;
      practice_question_sets: Extend<
        "practice_question_sets",
        PendingContextColumns
      >;
    };
  };
};

export const supabase = existingClient as unknown as SupabaseClient<DatabaseWithProfileContext>;
