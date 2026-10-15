// ARCHIVO GENERADO — no editar a mano.
// Regenerar con: node --env-file=.env.local scripts/gen-db-types.mjs

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string;
          court_id: string;
          start_at: string;
          end_at: string;
          status: string;
          source: string;
          kind: string;
          payment_status: string;
          paid_amount: number | null;
          payment_method: string | null;
          paid_at: string | null;
          customer_id: string | null;
          user_id: string | null;
          hold_expires_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          mp_preference_id: string | null;
          mp_payment_id: string | null;
          created_by_name: string | null;
          contact_email: string | null;
          confirmation_email_sent_at: string | null;
          reminder_sent_at: string | null;
          cancel_token: string;
          refunded_amount: number | null;
          refunded_at: string | null;
          mp_refund_id: string | null;
          cancelled_at: string | null;
          split_parts: number | null;
          split_token: string | null;
          online_paid_amount: number | null;
          is_open_match: boolean;
          match_type: string | null;
          match_gender: string | null;
          match_level_min: number | null;
          match_level_max: number | null;
        };
        Insert: {
          id?: string;
          court_id: string;
          start_at: string;
          end_at: string;
          status?: string;
          source?: string;
          kind?: string;
          payment_status?: string;
          paid_amount?: number | null;
          payment_method?: string | null;
          paid_at?: string | null;
          customer_id?: string | null;
          user_id?: string | null;
          hold_expires_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          mp_preference_id?: string | null;
          mp_payment_id?: string | null;
          created_by_name?: string | null;
          contact_email?: string | null;
          confirmation_email_sent_at?: string | null;
          reminder_sent_at?: string | null;
          cancel_token?: string;
          refunded_amount?: number | null;
          refunded_at?: string | null;
          mp_refund_id?: string | null;
          cancelled_at?: string | null;
          split_parts?: number | null;
          split_token?: string | null;
          online_paid_amount?: number | null;
          is_open_match?: boolean;
          match_type?: string | null;
          match_gender?: string | null;
          match_level_min?: number | null;
          match_level_max?: number | null;
        };
        Update: {
          id?: string;
          court_id?: string;
          start_at?: string;
          end_at?: string;
          status?: string;
          source?: string;
          kind?: string;
          payment_status?: string;
          paid_amount?: number | null;
          payment_method?: string | null;
          paid_at?: string | null;
          customer_id?: string | null;
          user_id?: string | null;
          hold_expires_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          mp_preference_id?: string | null;
          mp_payment_id?: string | null;
          created_by_name?: string | null;
          contact_email?: string | null;
          confirmation_email_sent_at?: string | null;
          reminder_sent_at?: string | null;
          cancel_token?: string;
          refunded_amount?: number | null;
          refunded_at?: string | null;
          mp_refund_id?: string | null;
          cancelled_at?: string | null;
          split_parts?: number | null;
          split_token?: string | null;
          online_paid_amount?: number | null;
          is_open_match?: boolean;
          match_type?: string | null;
          match_gender?: string | null;
          match_level_min?: number | null;
          match_level_max?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_shares: {
        Row: {
          id: string;
          booking_id: string;
          seq: number;
          amount: number;
          status: string;
          payer_name: string | null;
          payer_email: string | null;
          payment_method: string | null;
          mp_payment_id: string | null;
          paid_at: string | null;
          checkout_until: string | null;
          refunded_at: string | null;
          created_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          booking_id: string;
          seq: number;
          amount: number;
          status?: string;
          payer_name?: string | null;
          payer_email?: string | null;
          payment_method?: string | null;
          mp_payment_id?: string | null;
          paid_at?: string | null;
          checkout_until?: string | null;
          refunded_at?: string | null;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          booking_id?: string;
          seq?: number;
          amount?: number;
          status?: string;
          payer_name?: string | null;
          payer_email?: string | null;
          payment_method?: string | null;
          mp_payment_id?: string | null;
          paid_at?: string | null;
          checkout_until?: string | null;
          refunded_at?: string | null;
          created_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_shares_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      courts: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          full_name: string | null;
          phone_e164: string | null;
          email: string | null;
          notes: string | null;
          birthday: string | null;
          player_notes: string | null;
          sex: string | null;
          division: string | null;
          is_active: boolean;
          created_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          full_name?: string | null;
          phone_e164?: string | null;
          email?: string | null;
          notes?: string | null;
          birthday?: string | null;
          player_notes?: string | null;
          sex?: string | null;
          division?: string | null;
          is_active?: boolean;
          created_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone_e164?: string | null;
          email?: string | null;
          notes?: string | null;
          birthday?: string | null;
          player_notes?: string | null;
          sex?: string | null;
          division?: string | null;
          is_active?: boolean;
          created_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      match_results: {
        Row: {
          id: string;
          booking_id: string;
          team_a: string[];
          team_b: string[];
          sets: Json;
          status: string;
          submitted_by: string;
          submitted_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          level_changes: Json | null;
        };
        Insert: {
          id?: string;
          booking_id: string;
          team_a: string[];
          team_b: string[];
          sets: Json;
          status?: string;
          submitted_by: string;
          submitted_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          level_changes?: Json | null;
        };
        Update: {
          id?: string;
          booking_id?: string;
          team_a?: string[];
          team_b?: string[];
          sets?: Json;
          status?: string;
          submitted_by?: string;
          submitted_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          level_changes?: Json | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: string;
          full_name: string | null;
          phone_e164: string | null;
          birth_date: string | null;
          notes: string | null;
          sex: string | null;
          division: string | null;
          updated_at: string | null;
          level: number | null;
          level_reliability: number;
          level_matches: number;
          level_updated_at: string | null;
        };
        Insert: {
          id: string;
          role?: string;
          full_name?: string | null;
          phone_e164?: string | null;
          birth_date?: string | null;
          notes?: string | null;
          sex?: string | null;
          division?: string | null;
          updated_at?: string | null;
          level?: number | null;
          level_reliability?: number;
          level_matches?: number;
          level_updated_at?: string | null;
        };
        Update: {
          id?: string;
          role?: string;
          full_name?: string | null;
          phone_e164?: string | null;
          birth_date?: string | null;
          notes?: string | null;
          sex?: string | null;
          division?: string | null;
          updated_at?: string | null;
          level?: number | null;
          level_reliability?: number;
          level_matches?: number;
          level_updated_at?: string | null;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          key: string;
          count: number;
          reset_at: string;
        };
        Insert: {
          key: string;
          count: number;
          reset_at: string;
        };
        Update: {
          key?: string;
          count?: number;
          reset_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      rate_limit_hit: {
        Args: {
          p_key: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: { allowed: boolean; retry_after_seconds: number }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
