/**
 * Manually authored Supabase Database types matching
 * `supabase/migrations/0001_init.sql`. When the Supabase CLI is available
 * in CI, this file can be regenerated with:
 *
 *   npx supabase gen types typescript --schema public > src/types/supabase.ts
 *
 * Until then, this file is the source of truth. Keep it in sync whenever
 * the SQL schema changes.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      tlds: {
        Row: {
          id: string;
          slug: string;
          name: string;
          env_prefix: string;
          cloudflare_zone_id: string;
          enabled: boolean;
          is_primary: boolean;
          display_order: number;
          label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          env_prefix: string;
          cloudflare_zone_id: string;
          enabled?: boolean;
          is_primary?: boolean;
          display_order?: number;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          env_prefix?: string;
          cloudflare_zone_id?: string;
          enabled?: boolean;
          is_primary?: boolean;
          display_order?: number;
          label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          customer_id: string;
          full_name: string | null;
          email: string;
          mobile: string;
          address: string | null;
          status: Database["public"]["Enums"]["profile_status"];
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          customer_id?: string;
          full_name?: string | null;
          email: string;
          mobile: string;
          address?: string | null;
          status?: Database["public"]["Enums"]["profile_status"];
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          full_name?: string | null;
          email?: string;
          mobile?: string;
          address?: string | null;
          status?: Database["public"]["Enums"]["profile_status"];
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      otp_codes: {
        Row: {
          id: string;
          email: string;
          code_hash: string;
          purpose: Database["public"]["Enums"]["otp_purpose"];
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          code_hash: string;
          purpose: Database["public"]["Enums"]["otp_purpose"];
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          code_hash?: string;
          purpose?: Database["public"]["Enums"]["otp_purpose"];
          expires_at?: string;
          consumed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      domains: {
        Row: {
          id: string;
          user_id: string;
          tld_id: string;
          name: string;
          full_domain: string;
          operational_status: Database["public"]["Enums"]["domain_operational_status"];
          verification_status: Database["public"]["Enums"]["domain_verification_status"];
          dns_mode: Database["public"]["Enums"]["domain_dns_mode"];
          custom_ns: string[] | null;
          cloudflare_record_id: string | null;
          registered_at: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tld_id: string;
          name: string;
          full_domain?: string;
          operational_status?: Database["public"]["Enums"]["domain_operational_status"];
          verification_status?: Database["public"]["Enums"]["domain_verification_status"];
          dns_mode?: Database["public"]["Enums"]["domain_dns_mode"];
          custom_ns?: string[] | null;
          cloudflare_record_id?: string | null;
          registered_at?: string;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tld_id?: string;
          name?: string;
          full_domain?: string;
          operational_status?: Database["public"]["Enums"]["domain_operational_status"];
          verification_status?: Database["public"]["Enums"]["domain_verification_status"];
          dns_mode?: Database["public"]["Enums"]["domain_dns_mode"];
          custom_ns?: string[] | null;
          cloudflare_record_id?: string | null;
          registered_at?: string;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "domains_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "domains_tld_id_fkey";
            columns: ["tld_id"];
            isOneToOne: false;
            referencedRelation: "tlds";
            referencedColumns: ["id"];
          },
        ];
      };
      dns_records: {
        Row: {
          id: string;
          domain_id: string;
          tld_id: string;
          type: Database["public"]["Enums"]["dns_record_type"];
          name: string;
          content: string;
          ttl: number;
          priority: number | null;
          cloudflare_record_id: string | null;
          source: Database["public"]["Enums"]["dns_record_source"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          domain_id: string;
          tld_id?: string;
          type: Database["public"]["Enums"]["dns_record_type"];
          name: string;
          content: string;
          ttl?: number;
          priority?: number | null;
          cloudflare_record_id?: string | null;
          source?: Database["public"]["Enums"]["dns_record_source"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          domain_id?: string;
          tld_id?: string;
          type?: Database["public"]["Enums"]["dns_record_type"];
          name?: string;
          content?: string;
          ttl?: number;
          priority?: number | null;
          cloudflare_record_id?: string | null;
          source?: Database["public"]["Enums"]["dns_record_source"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dns_records_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dns_records_tld_id_fkey";
            columns: ["tld_id"];
            isOneToOne: false;
            referencedRelation: "tlds";
            referencedColumns: ["id"];
          },
        ];
      };
      txt_review_queue: {
        Row: {
          id: string;
          domain_id: string;
          user_id: string;
          name: string;
          content: string;
          reason: string | null;
          status: Database["public"]["Enums"]["txt_review_status"];
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          domain_id: string;
          user_id: string;
          name: string;
          content: string;
          reason?: string | null;
          status?: Database["public"]["Enums"]["txt_review_status"];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          domain_id?: string;
          user_id?: string;
          name?: string;
          content?: string;
          reason?: string | null;
          status?: Database["public"]["Enums"]["txt_review_status"];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "txt_review_queue_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "txt_review_queue_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "txt_review_queue_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string | null;
          session_token: string | null;
          tld_id: string;
          domain_name: string;
          full_domain: string;
          hosting_plan_id: string | null;
          hosting_type: Database["public"]["Enums"]["cart_hosting_type"] | null;
          custom_ns_values: string[] | null;
          custom_ip_value: string | null;
          addons: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_token?: string | null;
          tld_id: string;
          domain_name: string;
          full_domain: string;
          hosting_plan_id?: string | null;
          hosting_type?: Database["public"]["Enums"]["cart_hosting_type"] | null;
          custom_ns_values?: string[] | null;
          custom_ip_value?: string | null;
          addons?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_token?: string | null;
          tld_id?: string;
          domain_name?: string;
          full_domain?: string;
          hosting_plan_id?: string | null;
          hosting_type?: Database["public"]["Enums"]["cart_hosting_type"] | null;
          custom_ns_values?: string[] | null;
          custom_ip_value?: string | null;
          addons?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_tld_id_fkey";
            columns: ["tld_id"];
            isOneToOne: false;
            referencedRelation: "tlds";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          order_number: string;
          status: Database["public"]["Enums"]["order_status"];
          total_bdt: number;
          items: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_number: string;
          status?: Database["public"]["Enums"]["order_status"];
          total_bdt?: number;
          items: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          order_number?: string;
          status?: Database["public"]["Enums"]["order_status"];
          total_bdt?: number;
          items?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          invoice_number: string;
          amount_bdt: number;
          status: Database["public"]["Enums"]["invoice_status"];
          paid_at: string | null;
          paid_by_admin: string | null;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          invoice_number: string;
          amount_bdt: number;
          status?: Database["public"]["Enums"]["invoice_status"];
          paid_at?: string | null;
          paid_by_admin?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          user_id?: string;
          invoice_number?: string;
          amount_bdt?: number;
          status?: Database["public"]["Enums"]["invoice_status"];
          paid_at?: string | null;
          paid_by_admin?: string | null;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_paid_by_admin_fkey";
            columns: ["paid_by_admin"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          id: string;
          user_id: string;
          domain_id: string | null;
          type: Database["public"]["Enums"]["service_type"];
          plan_id: string | null;
          status_renewal: Database["public"]["Enums"]["service_status_renewal"] | null;
          status_onetime: Database["public"]["Enums"]["service_status_onetime"] | null;
          access_url: string | null;
          access_username_encrypted: string | null;
          access_password_encrypted: string | null;
          internal_notes: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          domain_id?: string | null;
          type: Database["public"]["Enums"]["service_type"];
          plan_id?: string | null;
          status_renewal?: Database["public"]["Enums"]["service_status_renewal"] | null;
          status_onetime?: Database["public"]["Enums"]["service_status_onetime"] | null;
          access_url?: string | null;
          access_username_encrypted?: string | null;
          access_password_encrypted?: string | null;
          internal_notes?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          domain_id?: string | null;
          type?: Database["public"]["Enums"]["service_type"];
          plan_id?: string | null;
          status_renewal?: Database["public"]["Enums"]["service_status_renewal"] | null;
          status_onetime?: Database["public"]["Enums"]["service_status_onetime"] | null;
          access_url?: string | null;
          access_username_encrypted?: string | null;
          access_password_encrypted?: string | null;
          internal_notes?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "services_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "domains";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          id: string;
          user_id: string;
          ticket_number: string;
          category: Database["public"]["Enums"]["ticket_category"];
          whatsapp_number: string;
          subject: string;
          status: Database["public"]["Enums"]["ticket_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ticket_number: string;
          category: Database["public"]["Enums"]["ticket_category"];
          whatsapp_number: string;
          subject: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ticket_number?: string;
          category?: Database["public"]["Enums"]["ticket_category"];
          whatsapp_number?: string;
          subject?: string;
          status?: Database["public"]["Enums"]["ticket_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_messages: {
        Row: {
          id: string;
          ticket_id: string;
          sender: Database["public"]["Enums"]["ticket_message_sender"];
          sender_id: string | null;
          body: string;
          attachments: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          sender: Database["public"]["Enums"]["ticket_message_sender"];
          sender_id?: string | null;
          body: string;
          attachments?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          ticket_id?: string;
          sender?: Database["public"]["Enums"]["ticket_message_sender"];
          sender_id?: string | null;
          body?: string;
          attachments?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      banners: {
        Row: {
          id: string;
          image_url: string;
          link_url: string | null;
          display_order: number;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          image_url: string;
          link_url?: string | null;
          display_order?: number;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          image_url?: string;
          link_url?: string | null;
          display_order?: number;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "banners_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_type: Database["public"]["Enums"]["audit_actor_type"];
          action: string;
          target_table: string | null;
          target_id: string | null;
          payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_type: Database["public"]["Enums"]["audit_actor_type"];
          action: string;
          target_table?: string | null;
          target_id?: string | null;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          actor_type?: Database["public"]["Enums"]["audit_actor_type"];
          action?: string;
          target_table?: string | null;
          target_id?: string | null;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_customer_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_admin: {
        Args: { uid: string };
        Returns: boolean;
      };
    };
    Enums: {
      profile_status:
        | "pending_otp"
        | "pre_verified"
        | "profile_verified"
        | "suspended";
      otp_purpose: "registration" | "forgot_password";
      domain_operational_status:
        | "pending"
        | "active"
        | "suspend"
        | "issue"
        | "expired";
      domain_verification_status: "waiting" | "verified";
      domain_dns_mode: "name_server" | "manual_dns";
      dns_record_type: "A" | "CNAME" | "MX" | "TXT";
      dns_record_source: "user_manual" | "auto_txt" | "admin" | "system";
      txt_review_status: "pending" | "approved" | "rejected";
      cart_hosting_type: "premium" | "free" | "custom_ns" | "custom_ip";
      order_status: "pending_payment" | "active" | "cancelled";
      invoice_status: "pending_payment" | "paid" | "cancelled";
      service_type:
        | "hosting_premium"
        | "hosting_free"
        | "hosting_custom"
        | "addon";
      service_status_renewal:
        | "pending"
        | "processing"
        | "active"
        | "expired"
        | "suspended";
      service_status_onetime:
        | "waiting"
        | "processing"
        | "complete"
        | "cancel";
      ticket_category: "technical" | "payment" | "general";
      ticket_status:
        | "open"
        | "awaiting_user"
        | "awaiting_admin"
        | "resolved"
        | "closed";
      ticket_message_sender: "user" | "admin";
      audit_actor_type: "user" | "admin" | "system";
    };
    CompositeTypes: Record<string, never>;
  };
};

// Convenience aliases re-exported so callers can do
// `import type { Tables, Enums } from "@/types/supabase"`.

export type Tables<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Row"];

export type TablesInsert<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Insert"];

export type TablesUpdate<TableName extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][TableName]["Update"];

export type Enums<EnumName extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][EnumName];
