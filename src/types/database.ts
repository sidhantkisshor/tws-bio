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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      clicks: {
        Row: {
          browser_name: string | null
          browser_version: string | null
          city: string | null
          clicked_at: string | null
          country: string | null
          country_code: string | null
          custom_data: Json | null
          device_name: string | null
          device_type: Database["public"]["Enums"]["device_type"] | null
          id: string
          ip_address: unknown
          is_bot: boolean | null
          latitude: number | null
          link_id: string
          longitude: number | null
          os_name: string | null
          os_version: string | null
          referrer_domain: string | null
          referrer_url: string | null
          region: string | null
          timezone: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          visitor_id: string | null
        }
        Insert: {
          browser_name?: string | null
          browser_version?: string | null
          city?: string | null
          clicked_at?: string | null
          country?: string | null
          country_code?: string | null
          custom_data?: Json | null
          device_name?: string | null
          device_type?: Database["public"]["Enums"]["device_type"] | null
          id?: string
          ip_address?: unknown
          is_bot?: boolean | null
          latitude?: number | null
          link_id: string
          longitude?: number | null
          os_name?: string | null
          os_version?: string | null
          referrer_domain?: string | null
          referrer_url?: string | null
          region?: string | null
          timezone?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Update: {
          browser_name?: string | null
          browser_version?: string | null
          city?: string | null
          clicked_at?: string | null
          country?: string | null
          country_code?: string | null
          custom_data?: Json | null
          device_name?: string | null
          device_type?: Database["public"]["Enums"]["device_type"] | null
          id?: string
          ip_address?: unknown
          is_bot?: boolean | null
          latitude?: number | null
          link_id?: string
          longitude?: number | null
          os_name?: string | null
          os_version?: string | null
          referrer_domain?: string | null
          referrer_url?: string | null
          region?: string | null
          timezone?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          is_verified: boolean | null
          ssl_status: string | null
          updated_at: string | null
          user_id: string
          verification_token: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          is_verified?: boolean | null
          ssl_status?: string | null
          updated_at?: string | null
          user_id: string
          verification_token?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          is_verified?: boolean | null
          ssl_status?: string | null
          updated_at?: string | null
          user_id?: string
          verification_token?: string | null
        }
        Relationships: []
      }
      links: {
        Row: {
          android_deep_link: string | null
          created_at: string | null
          custom_meta: Json | null
          description: string | null
          expires_at: string | null
          fallback_url: string | null
          id: string
          ios_deep_link: string | null
          is_active: boolean | null
          link_type: Database["public"]["Enums"]["link_type"] | null
          max_clicks: number | null
          original_url: string
          password_hash: string | null
          qr_code_url: string | null
          short_code: string
          tags: string[] | null
          title: string | null
          total_clicks: number | null
          unique_clicks: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          android_deep_link?: string | null
          created_at?: string | null
          custom_meta?: Json | null
          description?: string | null
          expires_at?: string | null
          fallback_url?: string | null
          id?: string
          ios_deep_link?: string | null
          is_active?: boolean | null
          link_type?: Database["public"]["Enums"]["link_type"] | null
          max_clicks?: number | null
          original_url: string
          password_hash?: string | null
          qr_code_url?: string | null
          short_code: string
          tags?: string[] | null
          title?: string | null
          total_clicks?: number | null
          unique_clicks?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          android_deep_link?: string | null
          created_at?: string | null
          custom_meta?: Json | null
          description?: string | null
          expires_at?: string | null
          fallback_url?: string | null
          id?: string
          ios_deep_link?: string | null
          is_active?: boolean | null
          link_type?: Database["public"]["Enums"]["link_type"] | null
          max_clicks?: number | null
          original_url?: string
          password_hash?: string | null
          qr_code_url?: string | null
          short_code?: string
          tags?: string[] | null
          title?: string | null
          total_clicks?: number | null
          unique_clicks?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_link: {
        Args: {
          p_short_code: string
          p_original_url: string
          p_user_id?: string
        }
        Returns: Database['public']['Tables']['links']['Row']
      }
      increment_link_clicks:
        | { Args: { link_id: string }; Returns: undefined }
        | { Args: { link_id: string; visitor_id: string }; Returns: undefined }
      uid: { Args: never; Returns: string }
    }
    Enums: {
      device_type: "desktop" | "mobile" | "tablet" | "bot" | "unknown"
      link_type: "url" | "deep_link"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      device_type: ["desktop", "mobile", "tablet", "bot", "unknown"],
      link_type: ["url", "deep_link"],
    },
  },
} as const
