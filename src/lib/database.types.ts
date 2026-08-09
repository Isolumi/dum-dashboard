export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)";
  };
  public: {
    Tables: {
      calendar_connections: {
        Row: {
          created_at: string;
          encrypted_refresh_token: string;
          scope: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          encrypted_refresh_token: string;
          scope?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          encrypted_refresh_token?: string;
          scope?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      calendar_oauth_states: {
        Row: {
          created_at: string;
          expires_at: string;
          redirect_uri: string;
          state_hash: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          redirect_uri: string;
          state_hash: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          redirect_uri?: string;
          state_hash?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount: number;
          category: Database["public"]["Enums"]["category"];
          created_at: string;
          id: string;
          item: string;
          last_synced_at: string | null;
          notion_entry_id: string | null;
          notion_synced: boolean;
          purchase_date: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          category: Database["public"]["Enums"]["category"];
          created_at?: string;
          id?: string;
          item: string;
          last_synced_at?: string | null;
          notion_entry_id?: string | null;
          notion_synced?: boolean;
          purchase_date: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          category?: Database["public"]["Enums"]["category"];
          created_at?: string;
          id?: string;
          item?: string;
          last_synced_at?: string | null;
          notion_entry_id?: string | null;
          notion_synced?: boolean;
          purchase_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_user_id_users_id_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ledgers: {
        Row: {
          amount: number;
          created_at: string;
          debtor_id: string;
          expense_id: string;
          id: string;
          item: string;
          notion_entry_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          debtor_id: string;
          expense_id: string;
          id?: string;
          item: string;
          notion_entry_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          debtor_id?: string;
          expense_id?: string;
          id?: string;
          item?: string;
          notion_entry_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledgers_debtor_id_users_id_fk";
            columns: ["debtor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledgers_expense_id_expenses_id_fk";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      todos: {
        Row: {
          created_at: string;
          due_date: string | null;
          due_date_has_time: boolean;
          id: string;
          name: string;
          priority: Database["public"]["Enums"]["todo_priority"];
          sort_order: number;
          status: Database["public"]["Enums"]["todo_status"];
        };
        Insert: {
          created_at?: string;
          due_date?: string | null;
          due_date_has_time?: boolean;
          id?: string;
          name: string;
          priority?: Database["public"]["Enums"]["todo_priority"];
          sort_order?: number;
          status?: Database["public"]["Enums"]["todo_status"];
        };
        Update: {
          created_at?: string;
          due_date?: string | null;
          due_date_has_time?: boolean;
          id?: string;
          name?: string;
          priority?: Database["public"]["Enums"]["todo_priority"];
          sort_order?: number;
          status?: Database["public"]["Enums"]["todo_status"];
        };
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string;
          discord_id: string;
          id: string;
          name: string;
          notion_id: string;
        };
        Insert: {
          created_at?: string;
          discord_id: string;
          id?: string;
          name: string;
          notion_id: string;
        };
        Update: {
          created_at?: string;
          discord_id?: string;
          id?: string;
          name?: string;
          notion_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      category: "food" | "transportation" | "entertainment" | "essentials" | "bills" | "other";
      priority: "High" | "Medium" | "Low";
      status: "Not Started" | "In Progress" | "Done";
      todo_priority: "high" | "low";
      todo_status: "not_started" | "started" | "complete";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      category: ["food", "transportation", "entertainment", "essentials", "bills", "other"],
      priority: ["High", "Medium", "Low"],
      status: ["Not Started", "In Progress", "Done"],
      todo_priority: ["high", "low"],
      todo_status: ["not_started", "started", "complete"],
    },
  },
} as const;

// --- Helper type aliases (added manually, not generated) ---
export type Todo = Database["public"]["Tables"]["todos"]["Row"];
export type TodoInsert = Database["public"]["Tables"]["todos"]["Insert"];
export type TodoUpdate = Database["public"]["Tables"]["todos"]["Update"];
export type TodoPriority = Database["public"]["Enums"]["todo_priority"];
export type TodoStatus = Database["public"]["Enums"]["todo_status"];
