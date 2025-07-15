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
      }
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
          expires_at: string | null
          password_hash: string | null
          max_clicks: number | null
          qr_code_url: string | null
          custom_meta: Json
          tags: string[]
          total_clicks: number
          unique_clicks: number
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
          expires_at?: string | null
          password_hash?: string | null
          max_clicks?: number | null
          qr_code_url?: string | null
          custom_meta?: Json
          tags?: string[]
          total_clicks?: number
          unique_clicks?: number
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
          expires_at?: string | null
          password_hash?: string | null
          max_clicks?: number | null
          qr_code_url?: string | null
          custom_meta?: Json
          tags?: string[]
          total_clicks?: number
          unique_clicks?: number
          created_at?: string
          updated_at?: string
        }
      }
      clicks: {
        Row: {
          id: string
          link_id: string
          visitor_id: string | null
          user_agent: string | null
          device_type: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
          device_name: string | null
          browser_name: string | null
          browser_version: string | null
          os_name: string | null
          os_version: string | null
          ip_address: string | null
          country: string | null
          country_code: string | null
          region: string | null
          city: string | null
          latitude: number | null
          longitude: number | null
          timezone: string | null
          referrer_url: string | null
          referrer_domain: string | null
          utm_source: string | null
          utm_medium: string | null
          utm_campaign: string | null
          utm_term: string | null
          utm_content: string | null
          is_bot: boolean
          custom_data: Json
          clicked_at: string
        }
        Insert: {
          id?: string
          link_id: string
          visitor_id?: string | null
          user_agent?: string | null
          device_type?: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
          device_name?: string | null
          browser_name?: string | null
          browser_version?: string | null
          os_name?: string | null
          os_version?: string | null
          ip_address?: string | null
          country?: string | null
          country_code?: string | null
          region?: string | null
          city?: string | null
          latitude?: number | null
          longitude?: number | null
          timezone?: string | null
          referrer_url?: string | null
          referrer_domain?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_term?: string | null
          utm_content?: string | null
          is_bot?: boolean
          custom_data?: Json
          clicked_at?: string
        }
        Update: {
          id?: string
          link_id?: string
          visitor_id?: string | null
          user_agent?: string | null
          device_type?: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
          device_name?: string | null
          browser_name?: string | null
          browser_version?: string | null
          os_name?: string | null
          os_version?: string | null
          ip_address?: string | null
          country?: string | null
          country_code?: string | null
          region?: string | null
          city?: string | null
          latitude?: number | null
          longitude?: number | null
          timezone?: string | null
          referrer_url?: string | null
          referrer_domain?: string | null
          utm_source?: string | null
          utm_medium?: string | null
          utm_campaign?: string | null
          utm_term?: string | null
          utm_content?: string | null
          is_bot?: boolean
          custom_data?: Json
          clicked_at?: string
        }
      }
      custom_domains: {
        Row: {
          id: string
          user_id: string
          domain: string
          is_verified: boolean
          verification_token: string | null
          ssl_status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          domain: string
          is_verified?: boolean
          verification_token?: string | null
          ssl_status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          domain?: string
          is_verified?: boolean
          verification_token?: string | null
          ssl_status?: string
          created_at?: string
          updated_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          user_id: string
          name: string
          key_hash: string
          last_used_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          key_hash: string
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          key_hash?: string
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      device_type: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
      link_type: 'url' | 'deep_link'
    }
  }
} 