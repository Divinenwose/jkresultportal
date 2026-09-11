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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          approved: boolean | null
          average: number | null
          created_at: string
          days_absent: number | null
          days_opened: number | null
          days_present: number | null
          id: string
          next_term_begins: string | null
          overall_grade: string | null
          principal_comment: string | null
          session: string
          student_id: string
          teacher_comment: string | null
          term: Database["public"]["Enums"]["school_term"]
          total_marks: number | null
          updated_at: string
        }
        Insert: {
          approved?: boolean | null
          average?: number | null
          created_at?: string
          days_absent?: number | null
          days_opened?: number | null
          days_present?: number | null
          id?: string
          next_term_begins?: string | null
          overall_grade?: string | null
          principal_comment?: string | null
          session: string
          student_id: string
          teacher_comment?: string | null
          term: Database["public"]["Enums"]["school_term"]
          total_marks?: number | null
          updated_at?: string
        }
        Update: {
          approved?: boolean | null
          average?: number | null
          created_at?: string
          days_absent?: number | null
          days_opened?: number | null
          days_present?: number | null
          id?: string
          next_term_begins?: string | null
          overall_grade?: string | null
          principal_comment?: string | null
          session?: string
          student_id?: string
          teacher_comment?: string | null
          term?: Database["public"]["Enums"]["school_term"]
          total_marks?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          created_at: string
          exam: number | null
          first_test: number | null
          grade: string | null
          id: string
          second_test: number | null
          session: string
          student_id: string
          subject_comment: string | null
          subject_id: string
          submitted: boolean | null
          term: Database["public"]["Enums"]["school_term"]
          total: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam?: number | null
          first_test?: number | null
          grade?: string | null
          id?: string
          second_test?: number | null
          session: string
          student_id: string
          subject_comment?: string | null
          subject_id: string
          submitted?: boolean | null
          term: Database["public"]["Enums"]["school_term"]
          total?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam?: number | null
          first_test?: number | null
          grade?: string | null
          id?: string
          second_test?: number | null
          session?: string
          student_id?: string
          subject_comment?: string | null
          subject_id?: string
          submitted?: boolean | null
          term?: Database["public"]["Enums"]["school_term"]
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          active_session: string
          active_term: string
          id: string
          updated_at: string
        }
        Insert: {
          active_session?: string
          active_term?: string
          id?: string
          updated_at?: string
        }
        Update: {
          active_session?: string
          active_term?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          class: Database["public"]["Enums"]["school_class"]
          created_at: string
          date_of_birth: string | null
          full_name: string
          gender: string
          id: string
          parent_user_id: string | null
          photo_url: string | null
          spin: string
          updated_at: string
        }
        Insert: {
          class: Database["public"]["Enums"]["school_class"]
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          gender: string
          id?: string
          parent_user_id?: string | null
          photo_url?: string | null
          spin: string
          updated_at?: string
        }
        Update: {
          class?: Database["public"]["Enums"]["school_class"]
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          gender?: string
          id?: string
          parent_user_id?: string | null
          photo_url?: string | null
          spin?: string
          updated_at?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          class: Database["public"]["Enums"]["school_class"]
          id: string
          name: string
          teacher_user_id: string | null
        }
        Insert: {
          class: Database["public"]["Enums"]["school_class"]
          id?: string
          name: string
          teacher_user_id?: string | null
        }
        Update: {
          class?: Database["public"]["Enums"]["school_class"]
          id?: string
          name?: string
          teacher_user_id?: string | null
        }
        Relationships: []
      }
      teacher_assignments: {
        Row: {
          class: Database["public"]["Enums"]["school_class"]
          id: string
          subject_id: string
          teacher_user_id: string
        }
        Insert: {
          class: Database["public"]["Enums"]["school_class"]
          id?: string
          subject_id: string
          teacher_user_id: string
        }
        Update: {
          class?: Database["public"]["Enums"]["school_class"]
          id?: string
          subject_id?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_grade: { Args: { score: number }; Returns: string }
      generate_spin: { Args: never; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "parent"
      school_class: "JSS1" | "JSS2" | "JSS3" | "SS1" | "SS2" | "SS3"
      school_term: "First Term" | "Second Term" | "Third Term"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "teacher", "parent"],
      school_class: ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"],
      school_term: ["First Term", "Second Term", "Third Term"],
    },
  },
} as const
