export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      links: {
        Row: {
          id: string
          user_id: string | null
          short_code: string
          original_url: string
          title: string | null
          description: string | null
          ios_deep_link: string | null
          android_deep_link: string | null
          fallback_url: string | null
          link_type: 'url' | 'deep_link'
          is_active: boolean
          click_count: number
          qr_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          short_code: string
          original_url: string
          title?: string | null
          description?: string | null
          ios_deep_link?: string | null
          android_deep_link?: string | null
          fallback_url?: string | null
          link_type?: 'url' | 'deep_link'
          is_active?: boolean
          click_count?: number
          qr_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          short_code?: string
          original_url?: string
          title?: string | null
          description?: string | null
          ios_deep_link?: string | null
          android_deep_link?: string | null
          fallback_url?: string | null
          link_type?: 'url' | 'deep_link'
          is_active?: boolean
          click_count?: number
          qr_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      link_analytics: {
        Row: {
          id: string
          link_id: string
          clicked_at: string
          ip_address: string | null
          country: string | null
          city: string | null
          user_agent: string | null
          referer: string | null
          browser: string | null
          os: string | null
          device: string | null
        }
        Insert: {
          id?: string
          link_id: string
          clicked_at?: string
          ip_address?: string | null
          country?: string | null
          city?: string | null
          user_agent?: string | null
          referer?: string | null
          browser?: string | null
          os?: string | null
          device?: string | null
        }
        Update: {
          id?: string
          link_id?: string
          clicked_at?: string
          ip_address?: string | null
          country?: string | null
          city?: string | null
          user_agent?: string | null
          referer?: string | null
          browser?: string | null
          os?: string | null
          device?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_analytics_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
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
      increment_click_count: {
        Args: {
          link_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}