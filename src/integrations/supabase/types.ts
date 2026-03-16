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
      ai_usage_tracking: {
        Row: {
          cost_credits: number | null
          created_at: string | null
          feature_name: string
          id: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          cost_credits?: number | null
          created_at?: string | null
          feature_name: string
          id?: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          cost_credits?: number | null
          created_at?: string | null
          feature_name?: string
          id?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      class_assignments: {
        Row: {
          academic_year: string | null
          class_name: string
          created_at: string
          id: string
          is_active: boolean
          school_id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          academic_year?: string | null
          class_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          school_id: string
          student_id: string
          teacher_id: string
        }
        Update: {
          academic_year?: string | null
          class_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          school_id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_goals: {
        Row: {
          blocks_completed: number
          completed_minutes: number
          created_at: string | null
          date: string
          id: string
          longest_focus_block: number | null
          target_minutes: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blocks_completed?: number
          completed_minutes?: number
          created_at?: string | null
          date: string
          id?: string
          longest_focus_block?: number | null
          target_minutes?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blocks_completed?: number
          completed_minutes?: number
          created_at?: string | null
          date?: string
          id?: string
          longest_focus_block?: number | null
          target_minutes?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exam_assignments: {
        Row: {
          assigned_by: string
          assignment_type: string
          class_name: string | null
          created_at: string
          deadline: string | null
          exam_id: string
          id: string
          is_active: boolean
          is_grades_released: boolean
          marks_release_date: string | null
          marks_visibility: string | null
          metadata: Json | null
          release_date: string | null
          target_id: string | null
        }
        Insert: {
          assigned_by: string
          assignment_type: string
          class_name?: string | null
          created_at?: string
          deadline?: string | null
          exam_id: string
          id?: string
          is_active?: boolean
          is_grades_released?: boolean
          marks_release_date?: string | null
          marks_visibility?: string | null
          metadata?: Json | null
          release_date?: string | null
          target_id?: string | null
        }
        Update: {
          assigned_by?: string
          assignment_type?: string
          class_name?: string | null
          created_at?: string
          deadline?: string | null
          exam_id?: string
          id?: string
          is_active?: boolean
          is_grades_released?: boolean
          marks_release_date?: string | null
          marks_visibility?: string | null
          metadata?: Json | null
          release_date?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_assignments_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
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
          exam_started_at: string | null
          id: string
          is_late: boolean | null
          last_accessed_at: string | null
          status: string | null
          student_id: string
          submitted_at: string | null
          time_remaining_seconds: number | null
          time_taken_seconds: number | null
          total_marks: number | null
          total_score: number | null
        }
        Insert: {
          created_at?: string | null
          exam_id: string
          exam_started_at?: string | null
          id?: string
          is_late?: boolean | null
          last_accessed_at?: string | null
          status?: string | null
          student_id: string
          submitted_at?: string | null
          time_remaining_seconds?: number | null
          time_taken_seconds?: number | null
          total_marks?: number | null
          total_score?: number | null
        }
        Update: {
          created_at?: string | null
          exam_id?: string
          exam_started_at?: string | null
          id?: string
          is_late?: boolean | null
          last_accessed_at?: string | null
          status?: string | null
          student_id?: string
          submitted_at?: string | null
          time_remaining_seconds?: number | null
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
          allow_retakes: boolean | null
          assigned_by: string | null
          created_at: string
          detected_subject: string | null
          display_order: number | null
          exam_board: string | null
          extraction_error: string | null
          extraction_status: string | null
          file_processed_at: string | null
          file_url: string | null
          grade_released: boolean | null
          id: string
          is_template: boolean | null
          qualification_level: string | null
          resource_pack_id: string | null
          show_feedback_per_question: boolean | null
          shuffle_questions: boolean | null
          specification_file_url: string | null
          status: Database["public"]["Enums"]["exam_status"]
          subject_confidence: number | null
          subject_id: string
          subject_mismatch: boolean | null
          time_limit_per_question: number | null
          title: string
          total_questions_extracted: number | null
          type: Database["public"]["Enums"]["exam_type"]
          updated_at: string
          user_id: string
          visibility: string | null
        }
        Insert: {
          allow_retakes?: boolean | null
          assigned_by?: string | null
          created_at?: string
          detected_subject?: string | null
          display_order?: number | null
          exam_board?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          file_processed_at?: string | null
          file_url?: string | null
          grade_released?: boolean | null
          id?: string
          is_template?: boolean | null
          qualification_level?: string | null
          resource_pack_id?: string | null
          show_feedback_per_question?: boolean | null
          shuffle_questions?: boolean | null
          specification_file_url?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_confidence?: number | null
          subject_id: string
          subject_mismatch?: boolean | null
          time_limit_per_question?: number | null
          title: string
          total_questions_extracted?: number | null
          type?: Database["public"]["Enums"]["exam_type"]
          updated_at?: string
          user_id: string
          visibility?: string | null
        }
        Update: {
          allow_retakes?: boolean | null
          assigned_by?: string | null
          created_at?: string
          detected_subject?: string | null
          display_order?: number | null
          exam_board?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          file_processed_at?: string | null
          file_url?: string | null
          grade_released?: boolean | null
          id?: string
          is_template?: boolean | null
          qualification_level?: string | null
          resource_pack_id?: string | null
          show_feedback_per_question?: boolean | null
          shuffle_questions?: boolean | null
          specification_file_url?: string | null
          status?: Database["public"]["Enums"]["exam_status"]
          subject_confidence?: number | null
          subject_id?: string
          subject_mismatch?: boolean | null
          time_limit_per_question?: number | null
          title?: string
          total_questions_extracted?: number | null
          type?: Database["public"]["Enums"]["exam_type"]
          updated_at?: string
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exams_resource_pack_id_fkey"
            columns: ["resource_pack_id"]
            isOneToOne: false
            referencedRelation: "resource_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      favourite_exams: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourite_exams_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      favourite_practice_sets: {
        Row: {
          created_at: string | null
          id: string
          set_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          set_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          set_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourite_practice_sets_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "practice_question_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_tags: {
        Row: {
          created_at: string
          created_by: string
          id: string
          tag: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          tag: string
          thread_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          tag?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_tags_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "question_feedback_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      group_announcements: {
        Row: {
          attachment_url: string | null
          created_at: string
          group_id: string
          id: string
          message: string
          title: string
          tutor_id: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          group_id: string
          id?: string
          message: string
          title: string
          tutor_id: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          group_id?: string
          id?: string
          message?: string
          title?: string
          tutor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_announcements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          is_active: boolean
          joined_at: string
          role: string | null
          student_id: string
        }
        Insert: {
          group_id: string
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: string | null
          student_id: string
        }
        Update: {
          group_id?: string
          id?: string
          is_active?: boolean
          joined_at?: string
          role?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "student_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_data: Json | null
          body: string | null
          created_at: string
          id: string
          is_pinned: boolean | null
          is_read: boolean
          link_url: string | null
          metadata: Json | null
          read_at: string | null
          recipient_role: string | null
          snoozed_until: string | null
          source_role: string | null
          source_user_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_data?: Json | null
          body?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          is_read?: boolean
          link_url?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_role?: string | null
          snoozed_until?: string | null
          source_role?: string | null
          source_user_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_data?: Json | null
          body?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          is_read?: boolean
          link_url?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_role?: string | null
          snoozed_until?: string | null
          source_role?: string | null
          source_user_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      practice_question_answers: {
        Row: {
          accuracy_marks: number | null
          answer_latex: string | null
          answer_text: string | null
          created_at: string | null
          feedback: string | null
          id: string
          is_correct: boolean | null
          method_marks: number | null
          question_id: string
          score: number | null
          set_id: string
          submitted_at: string | null
          updated_at: string | null
          user_id: string
          working_out: string | null
        }
        Insert: {
          accuracy_marks?: number | null
          answer_latex?: string | null
          answer_text?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          method_marks?: number | null
          question_id: string
          score?: number | null
          set_id: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id: string
          working_out?: string | null
        }
        Update: {
          accuracy_marks?: number | null
          answer_latex?: string | null
          answer_text?: string | null
          created_at?: string | null
          feedback?: string | null
          id?: string
          is_correct?: boolean | null
          method_marks?: number | null
          question_id?: string
          score?: number | null
          set_id?: string
          submitted_at?: string | null
          updated_at?: string | null
          user_id?: string
          working_out?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "practice_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_question_answers_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "practice_question_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_question_sets: {
        Row: {
          created_at: string | null
          difficulty_level: string | null
          difficulty_mode: string | null
          educational_tier: string | null
          exam_board: string | null
          example_questions_file_url: string | null
          extraction_error: string | null
          extraction_status: string | null
          id: string
          include_graphs: boolean | null
          include_tables: boolean | null
          notes: string | null
          question_count: number
          resource_mode: string | null
          resource_pack_id: string | null
          set_name: string
          specification_file_url: string | null
          status: string | null
          subject_id: string
          subtopics: string[]
          total_questions_generated: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          difficulty_level?: string | null
          difficulty_mode?: string | null
          educational_tier?: string | null
          exam_board?: string | null
          example_questions_file_url?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          include_graphs?: boolean | null
          include_tables?: boolean | null
          notes?: string | null
          question_count: number
          resource_mode?: string | null
          resource_pack_id?: string | null
          set_name: string
          specification_file_url?: string | null
          status?: string | null
          subject_id: string
          subtopics: string[]
          total_questions_generated?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          difficulty_level?: string | null
          difficulty_mode?: string | null
          educational_tier?: string | null
          exam_board?: string | null
          example_questions_file_url?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          include_graphs?: boolean | null
          include_tables?: boolean | null
          notes?: string | null
          question_count?: number
          resource_mode?: string | null
          resource_pack_id?: string | null
          set_name?: string
          specification_file_url?: string | null
          status?: string | null
          subject_id?: string
          subtopics?: string[]
          total_questions_generated?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_question_sets_resource_pack_id_fkey"
            columns: ["resource_pack_id"]
            isOneToOne: false
            referencedRelation: "resource_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_questions: {
        Row: {
          correct_answer: string | null
          created_at: string | null
          difficulty_level: string | null
          equation_complexity: string | null
          has_math: boolean | null
          id: string
          marks: number
          options: Json | null
          question_latex: string | null
          question_number: string
          question_number_int: number | null
          question_text: string
          question_type: string
          resource_item_ids: string[] | null
          resource_references: string[] | null
          set_id: string | null
          subtopic: string
          worked_solution: string | null
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string | null
          difficulty_level?: string | null
          equation_complexity?: string | null
          has_math?: boolean | null
          id?: string
          marks: number
          options?: Json | null
          question_latex?: string | null
          question_number: string
          question_number_int?: number | null
          question_text: string
          question_type: string
          resource_item_ids?: string[] | null
          resource_references?: string[] | null
          set_id?: string | null
          subtopic: string
          worked_solution?: string | null
        }
        Update: {
          correct_answer?: string | null
          created_at?: string | null
          difficulty_level?: string | null
          equation_complexity?: string | null
          has_math?: boolean | null
          id?: string
          marks?: number
          options?: Json | null
          question_latex?: string | null
          question_number?: string
          question_number_int?: number | null
          question_text?: string
          question_type?: string
          resource_item_ids?: string[] | null
          resource_references?: string[] | null
          set_id?: string | null
          subtopic?: string
          worked_solution?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_questions_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "practice_question_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_set_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_question_index: number | null
          flagged_question_ids: string[] | null
          id: string
          last_accessed_at: string | null
          questions_attempted: number | null
          questions_correct: number | null
          session_data: Json | null
          set_id: string
          time_spent_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_question_index?: number | null
          flagged_question_ids?: string[] | null
          id?: string
          last_accessed_at?: string | null
          questions_attempted?: number | null
          questions_correct?: number | null
          session_data?: Json | null
          set_id: string
          time_spent_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_question_index?: number | null
          flagged_question_ids?: string[] | null
          id?: string
          last_accessed_at?: string | null
          questions_attempted?: number | null
          questions_correct?: number | null
          session_data?: Json | null
          set_id?: string
          time_spent_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_set_progress_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "practice_question_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      question_feedback_threads: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          notify_on_reply: boolean | null
          notify_on_resolve: boolean | null
          question_id: string
          resolved_at: string | null
          resolved_by: string | null
          responded_at: string | null
          status: string
          student_comment: string
          student_id: string
          tutor_id: string | null
          tutor_response: string | null
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          notify_on_reply?: boolean | null
          notify_on_resolve?: boolean | null
          question_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          responded_at?: string | null
          status?: string
          student_comment: string
          student_id: string
          tutor_id?: string | null
          tutor_response?: string | null
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          notify_on_reply?: boolean | null
          notify_on_resolve?: boolean | null
          question_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          responded_at?: string | null
          status?: string
          student_comment?: string
          student_id?: string
          tutor_id?: string | null
          tutor_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_feedback_threads_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_items: {
        Row: {
          attribution: string | null
          content_html: string | null
          content_json: Json | null
          content_text: string | null
          content_url: string | null
          created_at: string | null
          difficulty_contribution: string | null
          display_order: number | null
          id: string
          pack_id: string
          resource_type: string
          source_label: string
          word_count: number | null
        }
        Insert: {
          attribution?: string | null
          content_html?: string | null
          content_json?: Json | null
          content_text?: string | null
          content_url?: string | null
          created_at?: string | null
          difficulty_contribution?: string | null
          display_order?: number | null
          id?: string
          pack_id: string
          resource_type: string
          source_label: string
          word_count?: number | null
        }
        Update: {
          attribution?: string | null
          content_html?: string | null
          content_json?: Json | null
          content_text?: string | null
          content_url?: string | null
          created_at?: string | null
          difficulty_contribution?: string | null
          display_order?: number | null
          id?: string
          pack_id?: string
          resource_type?: string
          source_label?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_items_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "resource_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_packs: {
        Row: {
          created_at: string | null
          educational_tier: string | null
          exam_board: string | null
          example_paper_url: string | null
          file_processed_at: string | null
          id: string
          learned_patterns: Json | null
          pack_type: string
          processing_error: string | null
          source_file_url: string | null
          status: string | null
          subject_id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          educational_tier?: string | null
          exam_board?: string | null
          example_paper_url?: string | null
          file_processed_at?: string | null
          id?: string
          learned_patterns?: Json | null
          pack_type: string
          processing_error?: string | null
          source_file_url?: string | null
          status?: string | null
          subject_id: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          educational_tier?: string | null
          exam_board?: string | null
          example_paper_url?: string | null
          file_processed_at?: string | null
          id?: string
          learned_patterns?: Json | null
          pack_type?: string
          processing_error?: string | null
          source_file_url?: string | null
          status?: string | null
          subject_id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      revision_goals: {
        Row: {
          auto_schedule: boolean | null
          confidence_level: number | null
          created_at: string
          current_percentage: number | null
          custom_goal_text: string | null
          deadline: string | null
          effort_estimate: number | null
          goal_type: string
          id: string
          schedule_status: string | null
          scheduled_tasks_count: number | null
          subject: string
          subject_color: string | null
          subject_id: string | null
          target_exams: number
          target_metric: Json | null
          target_percentage: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_schedule?: boolean | null
          confidence_level?: number | null
          created_at?: string
          current_percentage?: number | null
          custom_goal_text?: string | null
          deadline?: string | null
          effort_estimate?: number | null
          goal_type: string
          id?: string
          schedule_status?: string | null
          scheduled_tasks_count?: number | null
          subject: string
          subject_color?: string | null
          subject_id?: string | null
          target_exams?: number
          target_metric?: Json | null
          target_percentage?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_schedule?: boolean | null
          confidence_level?: number | null
          created_at?: string
          current_percentage?: number | null
          custom_goal_text?: string | null
          deadline?: string | null
          effort_estimate?: number | null
          goal_type?: string
          id?: string
          schedule_status?: string | null
          scheduled_tasks_count?: number | null
          subject?: string
          subject_color?: string | null
          subject_id?: string | null
          target_exams?: number
          target_metric?: Json | null
          target_percentage?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_goals_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_tasks: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          auto_rescheduled: boolean | null
          confidence_after: number | null
          confidence_before: number | null
          created_at: string
          created_by: string | null
          date: string
          day: string
          due_date: string | null
          duration: number | null
          exam_id: string | null
          exam_title: string | null
          focus_session_duration: number | null
          focus_session_started_at: string | null
          focus_topic: string | null
          generated_from_goal_id: string | null
          id: string
          idle_since: string | null
          is_auto_scheduled: boolean | null
          is_completed: boolean
          is_private: boolean | null
          is_teacher_assigned: boolean | null
          last_modified_at: string | null
          linked_practice_set_id: string | null
          missed_count: number | null
          next_review_date: string | null
          parent_task_id: string | null
          priority: string | null
          progress_percentage: number | null
          reminder_days_before: number | null
          spaced_profile: Json | null
          status: string | null
          subject: string
          subject_color: string
          target_score: number | null
          time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          auto_rescheduled?: boolean | null
          confidence_after?: number | null
          confidence_before?: number | null
          created_at?: string
          created_by?: string | null
          date: string
          day: string
          due_date?: string | null
          duration?: number | null
          exam_id?: string | null
          exam_title?: string | null
          focus_session_duration?: number | null
          focus_session_started_at?: string | null
          focus_topic?: string | null
          generated_from_goal_id?: string | null
          id?: string
          idle_since?: string | null
          is_auto_scheduled?: boolean | null
          is_completed?: boolean
          is_private?: boolean | null
          is_teacher_assigned?: boolean | null
          last_modified_at?: string | null
          linked_practice_set_id?: string | null
          missed_count?: number | null
          next_review_date?: string | null
          parent_task_id?: string | null
          priority?: string | null
          progress_percentage?: number | null
          reminder_days_before?: number | null
          spaced_profile?: Json | null
          status?: string | null
          subject: string
          subject_color?: string
          target_score?: number | null
          time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          auto_rescheduled?: boolean | null
          confidence_after?: number | null
          confidence_before?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          day?: string
          due_date?: string | null
          duration?: number | null
          exam_id?: string | null
          exam_title?: string | null
          focus_session_duration?: number | null
          focus_session_started_at?: string | null
          focus_topic?: string | null
          generated_from_goal_id?: string | null
          id?: string
          idle_since?: string | null
          is_auto_scheduled?: boolean | null
          is_completed?: boolean
          is_private?: boolean | null
          is_teacher_assigned?: boolean | null
          last_modified_at?: string | null
          linked_practice_set_id?: string | null
          missed_count?: number | null
          next_review_date?: string | null
          parent_task_id?: string | null
          priority?: string | null
          progress_percentage?: number | null
          reminder_days_before?: number | null
          spaced_profile?: Json | null
          status?: string | null
          subject?: string
          subject_color?: string
          target_score?: number | null
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
          {
            foreignKeyName: "revision_tasks_generated_from_goal_id_fkey"
            columns: ["generated_from_goal_id"]
            isOneToOne: false
            referencedRelation: "revision_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_tasks_linked_practice_set_id_fkey"
            columns: ["linked_practice_set_id"]
            isOneToOne: false
            referencedRelation: "practice_question_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "revision_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          country: string | null
          created_at: string
          domain: string | null
          id: string
          is_active: boolean
          license_end_date: string | null
          license_start_date: string | null
          license_type: string | null
          max_students: number | null
          max_teachers: number | null
          name: string
          region: string | null
          settings: Json | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          license_end_date?: string | null
          license_start_date?: string | null
          license_type?: string | null
          max_students?: number | null
          max_teachers?: number | null
          name: string
          region?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          license_end_date?: string | null
          license_start_date?: string | null
          license_type?: string | null
          max_students?: number | null
          max_teachers?: number | null
          name?: string
          region?: string | null
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      session_feedback: {
        Row: {
          confidence_rating: number
          created_at: string | null
          id: string
          notes: string | null
          task_id: string
          understood: boolean
          user_id: string
        }
        Insert: {
          confidence_rating: number
          created_at?: string | null
          id?: string
          notes?: string | null
          task_id: string
          understood?: boolean
          user_id: string
        }
        Update: {
          confidence_rating?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          task_id?: string
          understood?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_feedback_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "revision_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      student_answers: {
        Row: {
          answer_format: string | null
          answer_latex: string | null
          answer_text: string | null
          exam_id: string
          feedback: string | null
          flagged_at: string | null
          id: string
          is_correct: boolean | null
          is_flagged: boolean | null
          question_id: string
          score: number | null
          student_id: string
          submitted_at: string
          table_answers: Json | null
        }
        Insert: {
          answer_format?: string | null
          answer_latex?: string | null
          answer_text?: string | null
          exam_id: string
          feedback?: string | null
          flagged_at?: string | null
          id?: string
          is_correct?: boolean | null
          is_flagged?: boolean | null
          question_id: string
          score?: number | null
          student_id: string
          submitted_at?: string
          table_answers?: Json | null
        }
        Update: {
          answer_format?: string | null
          answer_latex?: string | null
          answer_text?: string | null
          exam_id?: string
          feedback?: string | null
          flagged_at?: string | null
          id?: string
          is_correct?: boolean | null
          is_flagged?: boolean | null
          question_id?: string
          score?: number | null
          student_id?: string
          submitted_at?: string
          table_answers?: Json | null
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
      student_groups: {
        Row: {
          capacity: number | null
          created_at: string
          description: string | null
          id: string
          invite_code: string | null
          is_active: boolean
          is_suggested: boolean | null
          name: string
          settings: Json | null
          subjects_covered: Json | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string | null
          is_active?: boolean
          is_suggested?: boolean | null
          name: string
          settings?: Json | null
          subjects_covered?: Json | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string | null
          is_active?: boolean
          is_suggested?: boolean | null
          name?: string
          settings?: Json | null
          subjects_covered?: Json | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subject_exam_profiles: {
        Row: {
          calculator_policy: string | null
          created_at: string
          difficulty_progression: string | null
          educational_tier: string | null
          exam_board: string | null
          extended_marks: number | null
          id: string
          include_extended: boolean | null
          mark_distribution: Json | null
          max_parts_per_question: number | null
          mcq_count: number | null
          mcq_position: string | null
          parent_question_count: number | null
          profile_name: string
          question_count: number
          question_structure: string | null
          structure_preset: string | null
          subject_name: string
          time_limit_minutes: number | null
          topics: string[]
          updated_at: string
          user_id: string
          written_question_count: number | null
        }
        Insert: {
          calculator_policy?: string | null
          created_at?: string
          difficulty_progression?: string | null
          educational_tier?: string | null
          exam_board?: string | null
          extended_marks?: number | null
          id?: string
          include_extended?: boolean | null
          mark_distribution?: Json | null
          max_parts_per_question?: number | null
          mcq_count?: number | null
          mcq_position?: string | null
          parent_question_count?: number | null
          profile_name: string
          question_count?: number
          question_structure?: string | null
          structure_preset?: string | null
          subject_name: string
          time_limit_minutes?: number | null
          topics?: string[]
          updated_at?: string
          user_id: string
          written_question_count?: number | null
        }
        Update: {
          calculator_policy?: string | null
          created_at?: string
          difficulty_progression?: string | null
          educational_tier?: string | null
          exam_board?: string | null
          extended_marks?: number | null
          id?: string
          include_extended?: boolean | null
          mark_distribution?: Json | null
          max_parts_per_question?: number | null
          mcq_count?: number | null
          mcq_position?: string | null
          parent_question_count?: number | null
          profile_name?: string
          question_count?: number
          question_structure?: string | null
          structure_preset?: string | null
          subject_name?: string
          time_limit_minutes?: number | null
          topics?: string[]
          updated_at?: string
          user_id?: string
          written_question_count?: number | null
        }
        Relationships: []
      }
      subject_master_topics: {
        Row: {
          created_at: string
          id: string
          subject_name: string
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subject_name: string
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subject_name?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      subject_subtopics: {
        Row: {
          created_at: string | null
          educational_tier: string | null
          exam_board: string | null
          id: string
          is_user_added: boolean | null
          subject: string
          subtopic: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          educational_tier?: string | null
          exam_board?: string | null
          id?: string
          is_user_added?: boolean | null
          subject: string
          subtopic: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          educational_tier?: string | null
          exam_board?: string | null
          id?: string
          is_user_added?: boolean | null
          subject?: string
          subtopic?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subjects: {
        Row: {
          category: string
          common_topics: Json | null
          created_at: string | null
          default_exam_types: Json | null
          default_spaced_profile: Json | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          category: string
          common_topics?: Json | null
          created_at?: string | null
          default_exam_types?: Json | null
          default_spaced_profile?: Json | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          common_topics?: Json | null
          created_at?: string | null
          default_exam_types?: Json | null
          default_spaced_profile?: Json | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      teacher_verifications: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          rejection_reason: string | null
          school_id: string
          status: string
          teacher_id: string
          updated_at: string
          verification_method: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          school_id: string
          status?: string
          teacher_id: string
          updated_at?: string
          verification_method?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          rejection_reason?: string | null
          school_id?: string
          status?: string
          teacher_id?: string
          updated_at?: string
          verification_method?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_verifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_aliases: {
        Row: {
          alias: string
          canonical_topic: string
          created_at: string | null
          id: string
          subject: string | null
        }
        Insert: {
          alias: string
          canonical_topic: string
          created_at?: string | null
          id?: string
          subject?: string | null
        }
        Update: {
          alias?: string
          canonical_topic?: string
          created_at?: string | null
          id?: string
          subject?: string | null
        }
        Relationships: []
      }
      tutor_manual_exams: {
        Row: {
          created_at: string
          educational_tier: string | null
          estimated_minutes: number | null
          id: string
          marking_preference: string
          question_ids: string[]
          status: string
          subject_color: string | null
          subject_name: string
          title: string
          total_marks: number | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          educational_tier?: string | null
          estimated_minutes?: number | null
          id?: string
          marking_preference?: string
          question_ids?: string[]
          status?: string
          subject_color?: string | null
          subject_name: string
          title: string
          total_marks?: number | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          educational_tier?: string | null
          estimated_minutes?: number | null
          id?: string
          marking_preference?: string
          question_ids?: string[]
          status?: string
          subject_color?: string | null
          subject_name?: string
          title?: string
          total_marks?: number | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tutor_profiles: {
        Row: {
          availability: Json | null
          bio: string | null
          created_at: string | null
          id: string
          onboarding_completed: boolean | null
          preferred_group_size: number | null
          student_count_estimate: number | null
          subjects_taught: Json | null
          teaching_mode: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          availability?: Json | null
          bio?: string | null
          created_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          preferred_group_size?: number | null
          student_count_estimate?: number | null
          subjects_taught?: Json | null
          teaching_mode?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          availability?: Json | null
          bio?: string | null
          created_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          preferred_group_size?: number | null
          student_count_estimate?: number | null
          subjects_taught?: Json | null
          teaching_mode?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tutor_question_bank: {
        Row: {
          created_at: string
          estimated_minutes: number | null
          expected_answer: string | null
          id: string
          marking_preference: string
          max_marks: number
          metadata: Json | null
          options: Json | null
          question_text: string
          question_type: string
          subject_name: string
          topic_tag: string | null
          tutor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimated_minutes?: number | null
          expected_answer?: string | null
          id?: string
          marking_preference?: string
          max_marks?: number
          metadata?: Json | null
          options?: Json | null
          question_text: string
          question_type?: string
          subject_name: string
          topic_tag?: string | null
          tutor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimated_minutes?: number | null
          expected_answer?: string | null
          id?: string
          marking_preference?: string
          max_marks?: number
          metadata?: Json | null
          options?: Json | null
          question_text?: string
          question_type?: string
          subject_name?: string
          topic_tag?: string | null
          tutor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_onboarding_status: {
        Row: {
          completed_at: string | null
          created_at: string | null
          goals_completed: boolean | null
          id: string
          last_step: string | null
          role: string
          subjects_completed: boolean | null
          tutor_profile_completed: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          goals_completed?: boolean | null
          id?: string
          last_step?: string | null
          role: string
          subjects_completed?: boolean | null
          tutor_profile_completed?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          goals_completed?: boolean | null
          id?: string
          last_step?: string | null
          role?: string
          subjects_completed?: boolean | null
          tutor_profile_completed?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          accent_color: string | null
          ai_feedback_detail: string | null
          beta_features_enabled: boolean | null
          confirm_resolve_feedback: boolean | null
          created_at: string | null
          curriculum_region: string | null
          display_name: string | null
          email_notifications: boolean | null
          enable_ai_suggestions: boolean | null
          font_size: string | null
          high_contrast_mode: boolean | null
          id: string
          in_app_notifications: boolean | null
          language: string | null
          preferred_educational_level: string | null
          preferred_exam_board: string | null
          push_notifications: boolean | null
          save_revision_history: boolean | null
          theme_mode: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          ai_feedback_detail?: string | null
          beta_features_enabled?: boolean | null
          confirm_resolve_feedback?: boolean | null
          created_at?: string | null
          curriculum_region?: string | null
          display_name?: string | null
          email_notifications?: boolean | null
          enable_ai_suggestions?: boolean | null
          font_size?: string | null
          high_contrast_mode?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          language?: string | null
          preferred_educational_level?: string | null
          preferred_exam_board?: string | null
          push_notifications?: boolean | null
          save_revision_history?: boolean | null
          theme_mode?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accent_color?: string | null
          ai_feedback_detail?: string | null
          beta_features_enabled?: boolean | null
          confirm_resolve_feedback?: boolean | null
          created_at?: string | null
          curriculum_region?: string | null
          display_name?: string | null
          email_notifications?: boolean | null
          enable_ai_suggestions?: boolean | null
          font_size?: string | null
          high_contrast_mode?: boolean | null
          id?: string
          in_app_notifications?: boolean | null
          language?: string | null
          preferred_educational_level?: string | null
          preferred_exam_board?: string | null
          push_notifications?: boolean | null
          save_revision_history?: boolean | null
          theme_mode?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone_number: string | null
          student_code: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone_number?: string | null
          student_code?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone_number?: string | null
          student_code?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_name: string | null
          device_type: string | null
          id: string
          ip_address: unknown
          last_active: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          last_active?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          last_active?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string | null
          current_streak: number
          id: string
          last_exam_submitted_at: string | null
          longest_streak: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_streak?: number
          id?: string
          last_exam_submitted_at?: string | null
          longest_streak?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_streak?: number
          id?: string
          last_exam_submitted_at?: string | null
          longest_streak?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subjects: {
        Row: {
          created_at: string
          curriculum_tag: string | null
          custom_name: string | null
          exam_board: string | null
          id: string
          is_custom: boolean | null
          proficiency_estimate: number | null
          subject_category: string | null
          subject_color: string
          subject_id: string | null
          subject_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          curriculum_tag?: string | null
          custom_name?: string | null
          exam_board?: string | null
          id?: string
          is_custom?: boolean | null
          proficiency_estimate?: number | null
          subject_category?: string | null
          subject_color?: string
          subject_id?: string | null
          subject_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          curriculum_tag?: string | null
          custom_name?: string | null
          exam_board?: string | null
          id?: string
          is_custom?: boolean | null
          proficiency_estimate?: number | null
          subject_category?: string | null
          subject_color?: string
          subject_id?: string | null
          subject_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_subject_stats: {
        Row: {
          blocks_count: number
          created_at: string | null
          id: string
          subject: string
          subject_color: string
          total_minutes: number
          updated_at: string | null
          user_id: string
          week_start: string
        }
        Insert: {
          blocks_count?: number
          created_at?: string | null
          id?: string
          subject: string
          subject_color?: string
          total_minutes?: number
          updated_at?: string | null
          user_id: string
          week_start: string
        }
        Update: {
          blocks_count?: number
          created_at?: string | null
          id?: string
          subject?: string
          subject_color?: string
          total_minutes?: number
          updated_at?: string | null
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      student_profiles_safe: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          student_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          student_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          student_code?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_deadline_change_notifications: {
        Args: {
          p_exam_id: string
          p_exam_title: string
          p_new_deadline: string
        }
        Returns: string[]
      }
      create_group_announcement_notifications: {
        Args: {
          p_action_data?: Json
          p_body: string
          p_group_id: string
          p_title: string
          p_type: string
        }
        Returns: string[]
      }
      create_notification: {
        Args: {
          p_body: string
          p_link_url?: string
          p_metadata?: Json
          p_recipient_role?: string
          p_source_role?: string
          p_source_user_id?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      create_student_notification: {
        Args: {
          p_action_data?: Json
          p_body: string
          p_student_id: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      generate_student_code: {
        Args: { p_first_name: string; p_last_name: string }
        Returns: string
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          is_primary: boolean
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _student_id: string }
        Returns: boolean
      }
      is_group_tutor: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_exam: {
        Args: { _exam_id: string; _user_id: string }
        Returns: boolean
      }
      validate_invite_code: {
        Args: { p_code: string }
        Returns: {
          group_id: string
          group_name: string
          tutor_display_name: string
        }[]
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "tutor" | "admin"
      exam_status:
        | "draft"
        | "analyzing"
        | "ready"
        | "published"
        | "in-progress"
        | "completed"
        | "archived"
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
      app_role: ["student", "teacher", "tutor", "admin"],
      exam_status: [
        "draft",
        "analyzing",
        "ready",
        "published",
        "in-progress",
        "completed",
        "archived",
      ],
      exam_type: ["uploaded", "generated"],
    },
  },
} as const
