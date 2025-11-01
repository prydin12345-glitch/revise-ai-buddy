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
          difficulty_calibration: string | null
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
          difficulty_calibration?: string | null
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
          difficulty_calibration?: string | null
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
      exam_question_drafts: {
        Row: {
          circuit_description: string | null
          circuit_type: string | null
          command_verb: string | null
          correct_answer: string | null
          created_at: string | null
          data_type: string | null
          diagram_type: string | null
          difficulty_level: string | null
          equation_complexity: string | null
          exam_id: string
          extraction_confidence: number | null
          figure_urls: string[] | null
          flag_reason: string | null
          generated_diagram_url: string | null
          generation_status: string | null
          graph_description: string | null
          has_figures: boolean | null
          has_math: boolean | null
          has_tables: boolean | null
          id: string
          image_handling_strategy: string | null
          is_flagged: boolean | null
          marks: number
          needs_diagram: boolean | null
          numerical_answer: string | null
          options: Json | null
          original_page_number: number | null
          original_question_text: string | null
          parent_question_number: string | null
          question_latex: string | null
          question_number: string
          question_text: string
          question_type: string
          root_question_number: string | null
          scenario_context: string | null
          table_data: string | null
          topic_tag: string | null
        }
        Insert: {
          circuit_description?: string | null
          circuit_type?: string | null
          command_verb?: string | null
          correct_answer?: string | null
          created_at?: string | null
          data_type?: string | null
          diagram_type?: string | null
          difficulty_level?: string | null
          equation_complexity?: string | null
          exam_id: string
          extraction_confidence?: number | null
          figure_urls?: string[] | null
          flag_reason?: string | null
          generated_diagram_url?: string | null
          generation_status?: string | null
          graph_description?: string | null
          has_figures?: boolean | null
          has_math?: boolean | null
          has_tables?: boolean | null
          id?: string
          image_handling_strategy?: string | null
          is_flagged?: boolean | null
          marks: number
          needs_diagram?: boolean | null
          numerical_answer?: string | null
          options?: Json | null
          original_page_number?: number | null
          original_question_text?: string | null
          parent_question_number?: string | null
          question_latex?: string | null
          question_number: string
          question_text: string
          question_type: string
          root_question_number?: string | null
          scenario_context?: string | null
          table_data?: string | null
          topic_tag?: string | null
        }
        Update: {
          circuit_description?: string | null
          circuit_type?: string | null
          command_verb?: string | null
          correct_answer?: string | null
          created_at?: string | null
          data_type?: string | null
          diagram_type?: string | null
          difficulty_level?: string | null
          equation_complexity?: string | null
          exam_id?: string
          extraction_confidence?: number | null
          figure_urls?: string[] | null
          flag_reason?: string | null
          generated_diagram_url?: string | null
          generation_status?: string | null
          graph_description?: string | null
          has_figures?: boolean | null
          has_math?: boolean | null
          has_tables?: boolean | null
          id?: string
          image_handling_strategy?: string | null
          is_flagged?: boolean | null
          marks?: number
          needs_diagram?: boolean | null
          numerical_answer?: string | null
          options?: Json | null
          original_page_number?: number | null
          original_question_text?: string | null
          parent_question_number?: string | null
          question_latex?: string | null
          question_number?: string
          question_text?: string
          question_type?: string
          root_question_number?: string | null
          scenario_context?: string | null
          table_data?: string | null
          topic_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_question_drafts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          circuit_description: string | null
          circuit_type: string | null
          command_verb: string | null
          correct_answer: string | null
          created_at: string
          data_type: string | null
          diagram_type: string | null
          difficulty_level: string | null
          equation_complexity: string | null
          exam_id: string
          extraction_confidence: number | null
          figure_urls: string[] | null
          generated_diagram_url: string | null
          graph_description: string | null
          has_figures: boolean | null
          has_math: boolean | null
          has_tables: boolean | null
          id: string
          is_verified: boolean | null
          marks: number
          needs_diagram: boolean | null
          numerical_answer: string | null
          options: Json | null
          original_page_number: number | null
          parent_question_number: string | null
          question_latex: string | null
          question_number: string
          question_text: string
          question_type: string
          root_question_number: string | null
          scenario_context: string | null
          table_data: string | null
          topic_tag: string | null
        }
        Insert: {
          circuit_description?: string | null
          circuit_type?: string | null
          command_verb?: string | null
          correct_answer?: string | null
          created_at?: string
          data_type?: string | null
          diagram_type?: string | null
          difficulty_level?: string | null
          equation_complexity?: string | null
          exam_id: string
          extraction_confidence?: number | null
          figure_urls?: string[] | null
          generated_diagram_url?: string | null
          graph_description?: string | null
          has_figures?: boolean | null
          has_math?: boolean | null
          has_tables?: boolean | null
          id?: string
          is_verified?: boolean | null
          marks: number
          needs_diagram?: boolean | null
          numerical_answer?: string | null
          options?: Json | null
          original_page_number?: number | null
          parent_question_number?: string | null
          question_latex?: string | null
          question_number: string
          question_text: string
          question_type: string
          root_question_number?: string | null
          scenario_context?: string | null
          table_data?: string | null
          topic_tag?: string | null
        }
        Update: {
          circuit_description?: string | null
          circuit_type?: string | null
          command_verb?: string | null
          correct_answer?: string | null
          created_at?: string
          data_type?: string | null
          diagram_type?: string | null
          difficulty_level?: string | null
          equation_complexity?: string | null
          exam_id?: string
          extraction_confidence?: number | null
          figure_urls?: string[] | null
          generated_diagram_url?: string | null
          graph_description?: string | null
          has_figures?: boolean | null
          has_math?: boolean | null
          has_tables?: boolean | null
          id?: string
          is_verified?: boolean | null
          marks?: number
          needs_diagram?: boolean | null
          numerical_answer?: string | null
          options?: Json | null
          original_page_number?: number | null
          parent_question_number?: string | null
          question_latex?: string | null
          question_number?: string
          question_text?: string
          question_type?: string
          root_question_number?: string | null
          scenario_context?: string | null
          table_data?: string | null
          topic_tag?: string | null
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
      exam_specifications: {
        Row: {
          assessment_objectives: string[] | null
          created_at: string | null
          exam_id: string
          id: string
          page_numbers: number[] | null
          topic_name: string
        }
        Insert: {
          assessment_objectives?: string[] | null
          created_at?: string | null
          exam_id: string
          id?: string
          page_numbers?: number[] | null
          topic_name: string
        }
        Update: {
          assessment_objectives?: string[] | null
          created_at?: string | null
          exam_id?: string
          id?: string
          page_numbers?: number[] | null
          topic_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_specifications_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_submissions: {
        Row: {
          created_at: string | null
          exam_id: string
          id: string
          status: string | null
          student_id: string
          submitted_at: string | null
          time_taken_seconds: number | null
          total_marks: number | null
          total_score: number | null
        }
        Insert: {
          created_at?: string | null
          exam_id: string
          id?: string
          status?: string | null
          student_id: string
          submitted_at?: string | null
          time_taken_seconds?: number | null
          total_marks?: number | null
          total_score?: number | null
        }
        Update: {
          created_at?: string | null
          exam_id?: string
          id?: string
          status?: string | null
          student_id?: string
          submitted_at?: string | null
          time_taken_seconds?: number | null
          total_marks?: number | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_submissions_exam_id_fkey"
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
          display_order: number | null
          exam_board: string | null
          extraction_error: string | null
          extraction_status: string | null
          file_url: string | null
          id: string
          qualification_level: string | null
          specification_file_url: string | null
          status: Database["public"]["Enums"]["exam_status"]
          subject_id: string
          title: string
          total_questions_extracted: number | null
          type: Database["public"]["Enums"]["exam_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          exam_board?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          file_url?: string | null
          id?: string
          qualification_level?: string | null
          specification_file_url?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id: string
          title: string
          total_questions_extracted?: number | null
          type?: Database["public"]["Enums"]["exam_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          exam_board?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          file_url?: string | null
          id?: string
          qualification_level?: string | null
          specification_file_url?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_id?: string
          title?: string
          total_questions_extracted?: number | null
          type?: Database["public"]["Enums"]["exam_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      revision_goals: {
        Row: {
          created_at: string
          deadline: string | null
          id: string
          subject: string
          subject_color: string | null
          target_exams: number
          target_percentage: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          id?: string
          subject: string
          subject_color?: string | null
          target_exams?: number
          target_percentage?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          id?: string
          subject?: string
          subject_color?: string | null
          target_exams?: number
          target_percentage?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      revision_tasks: {
        Row: {
          created_at: string
          date: string
          day: string
          duration: number | null
          exam_id: string | null
          exam_title: string | null
          focus_topic: string | null
          id: string
          is_completed: boolean
          subject: string
          subject_color: string
          time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          day: string
          duration?: number | null
          exam_id?: string | null
          exam_title?: string | null
          focus_topic?: string | null
          id?: string
          is_completed?: boolean
          subject: string
          subject_color?: string
          time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          day?: string
          duration?: number | null
          exam_id?: string | null
          exam_title?: string | null
          focus_topic?: string | null
          id?: string
          is_completed?: boolean
          subject?: string
          subject_color?: string
          time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_tasks_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      student_answers: {
        Row: {
          answer_text: string | null
          exam_id: string
          feedback: string | null
          id: string
          is_correct: boolean | null
          question_id: string
          score: number | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          answer_text?: string | null
          exam_id: string
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          score?: number | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          answer_text?: string | null
          exam_id?: string
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          score?: number | null
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
      user_subjects: {
        Row: {
          created_at: string
          id: string
          subject_color: string
          subject_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_color?: string
          subject_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_color?: string
          subject_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
