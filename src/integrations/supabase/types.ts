export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      exam_format: {
        Row: {
          exam_id: string
          id: string
          long_form_count: number | null
          long_form_marks_each: number | null
          mcq_count: number | null
          mcq_marks_each: number | null
          short_answer_count: number | null
          short_answer_marks_each: number | null
          use_original_structure: boolean | null
        }
        Insert: {
          exam_id: string
          id?: string
          long_form_count?: number | null
          long_form_marks_each?: number | null
          mcq_count?: number | null
          mcq_marks_each?: number | null
          short_answer_count?: number | null
          short_answer_marks_each?: number | null
          use_original_structure?: boolean | null
        }
        Update: {
          exam_id?: string
          id?: string
          long_form_count?: number | null
          long_form_marks_each?: number | null
          mcq_count?: number | null
          mcq_marks_each?: number | null
          short_answer_count?: number | null
          short_answer_marks_each?: number | null
          use_original_structure?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_format_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: true
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: string | null
          created_at: string
          exam_id: string
          id: string
          marks: number
          options: Json | null
          question_number: number
          question_text: string
          question_type: string
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          exam_id: string
          id?: string
          marks: number
          options?: Json | null
          question_number: number
          question_text: string
          question_type: string
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          exam_id?: string
          id?: string
          marks?: number
          options?: Json | null
          question_number?: number
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_timer: {
        Row: {
          duration_minutes: number | null
          enabled: boolean | null
          exam_id: string
          id: string
        }
        Insert: {
          duration_minutes?: number | null
          enabled?: boolean | null
          exam_id: string
          id?: string
        }
        Update: {
          duration_minutes?: number | null
          enabled?: boolean | null
          exam_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_timer_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: true
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_topics: {
        Row: {
          confidence_score: number | null
          exam_id: string
          id: string
          topic_name: string
        }
        Insert: {
          confidence_score?: number | null
          exam_id: string
          id?: string
          topic_name: string
        }
        Update: {
          confidence_score?: number | null
          exam_id?: string
          id?: string
          topic_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_topics_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          status: Database["public"]["Enums"]["exam_status"]
          subject_id: string
          title: string
          type: Database["public"]["Enums"]["exam_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id: string
          title: string
          type?: Database["public"]["Enums"]["exam_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id?: string
          title?: string
          type?: Database["public"]["Enums"]["exam_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_answers: {
        Row: {
          answer_text: string | null
          exam_id: string
          id: string
          question_id: string
          student_id: string
          submitted_at: string
        }
        Insert: {
          answer_text?: string | null
          exam_id: string
          id?: string
          question_id: string
          student_id: string
          submitted_at?: string
        }
        Update: {
          answer_text?: string | null
          exam_id?: string
          id?: string
          question_id?: string
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_answers_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      exam_status:
        | "draft"
        | "analyzing"
        | "ready"
        | "published"
        | "in-progress"
        | "completed"
      exam_type: "uploaded" | "generated"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      exam_status: [
        "draft",
        "analyzing",
        "ready",
        "published",
        "in-progress",
        "completed",
      ],
      exam_type: ["uploaded", "generated"],
    },
  },
} as const
