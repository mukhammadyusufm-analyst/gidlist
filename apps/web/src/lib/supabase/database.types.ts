/**
 * Database types.
 *
 * Hand-written to match the applied migrations. Once the Supabase CLI is linked
 * to the project this file is regenerated from the live schema and should not
 * be edited by hand again:
 *
 *   pnpm db:types
 *
 * The shape mirrors the generator's output so that switch is a drop-in swap.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BoardRole = 'owner' | 'admin' | 'editor' | 'member';
export type BoardMemberStatus = 'invited' | 'active';
export type ChecklistVersionStatus = 'draft' | 'published';
export type ScheduleKind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'specific_dates';
export type SubmissionStatus = 'upcoming' | 'draft' | 'done' | 'missed';

export type Database = {
  public: {
    Tables: {
      app_locales: {
        Row: {
          code: string;
          name: string;
          enabled: boolean;
          is_builtin: boolean;
          created_at: string;
        };
        Insert: { code: string; name: string; enabled?: boolean; is_builtin?: boolean };
        Update: { name?: string; enabled?: boolean };
        Relationships: [];
      };
      translations: {
        Row: {
          id: string;
          locale: string;
          key: string;
          value: string;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: { id?: string; locale: string; key: string; value: string; updated_by?: string | null };
        Update: { value?: string; updated_by?: string | null };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          locale: string;
          is_platform_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          avatar_url?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      boards: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          logo_url: string | null;
          banner_url: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        // `slug` is omitted on insert on purpose — a database trigger derives it
        // from the name, so that concurrent creations cannot both claim it.
        Insert: {
          id?: string;
          name: string;
          slug?: string;
          logo_url?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          logo_url?: string | null;
          banner_url?: string | null;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      board_members: {
        Row: {
          id: string;
          board_id: string;
          user_id: string | null;
          invited_email: string | null;
          role: BoardRole;
          status: BoardMemberStatus;
          invited_by: string | null;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          board_id: string;
          user_id?: string | null;
          invited_email?: string | null;
          role?: BoardRole;
          status?: BoardMemberStatus;
          invited_by?: string | null;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          user_id?: string | null;
          invited_email?: string | null;
          role?: BoardRole;
          status?: BoardMemberStatus;
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      checklists: {
        Row: {
          id: string;
          board_id: string;
          title: string;
          description: string | null;
          banner_url: string | null;
          avatar_url: string | null;
          created_by: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          title: string;
          description?: string | null;
          banner_url?: string | null;
          created_by?: string | null;
          archived_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          banner_url?: string | null;
          avatar_url?: string | null;
          archived_at?: string | null;
        };
        Relationships: [];
      };
      checklist_versions: {
        Row: {
          id: string;
          checklist_id: string;
          version_number: number;
          status: ChecklistVersionStatus;
          published_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          checklist_id: string;
          version_number: number;
          status?: ChecklistVersionStatus;
          published_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          status?: ChecklistVersionStatus;
          published_at?: string | null;
        };
        Relationships: [];
      };
      checklist_groups: {
        Row: {
          id: string;
          version_id: string;
          title: string;
          position: number;
          created_at: string;
        };
        Insert: { id?: string; version_id: string; title: string; position?: number };
        Update: { title?: string; position?: number };
        Relationships: [];
      };
      checklist_items: {
        Row: {
          id: string;
          version_id: string;
          // Not nullable: every item belongs to a section. An unfiled item
          // would render nowhere, which for a checklist means an unnoticed
          // missing task.
          group_id: string;
          parent_item_id: string | null;
          title: string;
          description: string | null;
          position: number;
          depth: number;
          created_at: string;
        };
        // `depth` is absent from Insert and Update on purpose — a database
        // trigger derives it from the parent, and a client-supplied value would
        // be ignored at best and misleading at worst.
        Insert: {
          id?: string;
          version_id: string;
          group_id: string;
          parent_item_id?: string | null;
          title: string;
          description?: string | null;
          position?: number;
        };
        Update: {
          title?: string;
          description?: string | null;
          position?: number;
          parent_item_id?: string | null;
          group_id?: string;
        };
        Relationships: [];
      };
      schedules: {
        Row: {
          id: string;
          checklist_id: string;
          kind: ScheduleKind;
          config: Json;
          start_date: string;
          end_date: string | null;
          timezone: string;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          checklist_id: string;
          kind: ScheduleKind;
          config: Json;
          start_date: string;
          end_date?: string | null;
          timezone: string;
          active?: boolean;
          created_by?: string | null;
        };
        Update: {
          kind?: ScheduleKind;
          config?: Json;
          start_date?: string;
          end_date?: string | null;
          timezone?: string;
          active?: boolean;
        };
        Relationships: [];
      };
      schedule_assignees: {
        Row: {
          id: string;
          schedule_id: string;
          user_id: string | null;
          email: string;
          created_at: string;
        };
        Insert: { id?: string; schedule_id: string; user_id?: string | null; email: string };
        Update: { email?: string; user_id?: string | null };
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          schedule_id: string;
          checklist_id: string;
          checklist_version_id: string | null;
          due_date: string;
          assignee_id: string | null;
          assignee_email: string | null;
          status: SubmissionStatus;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        // No Insert type by design: submissions are created only by the
        // materialisation job, so the set of obligations always matches the
        // schedules that produced them.
        Insert: never;
        Update: {
          status?: SubmissionStatus;
          submitted_at?: string | null;
          checklist_version_id?: string | null;
          assignee_id?: string | null;
        };
        Relationships: [];
      };
      submission_items: {
        Row: {
          id: string;
          submission_id: string;
          item_id: string;
          checked: boolean;
          comment: string | null;
          checked_at: string | null;
          checked_by: string | null;
          created_at: string;
          updated_at: string;
        };
        // Created only by start_submission(), so the answer sheet always
        // matches the version it was pinned to.
        Insert: never;
        Update: { checked?: boolean; comment?: string | null; checked_by?: string | null };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      compliance_counts: {
        Args: {
          p_board_id: string;
          p_from: string;
          p_to: string;
          p_checklist?: string | null;
          p_assignee?: string | null;
        };
        Returns: { status: string; total: number }[];
      };
      compliance_trend: {
        Args: {
          p_board_id: string;
          p_from: string;
          p_to: string;
          p_checklist?: string | null;
          p_status?: string | null;
          p_assignee?: string | null;
        };
        Returns: { day: string; done: number; total: number }[];
      };
      compliance_assignees: {
        Args: { p_board_id: string; p_from: string; p_to: string };
        Returns: { email: string }[];
      };
      accept_invitation: { Args: { p_membership_id: string }; Returns: undefined };
      decline_invitation: { Args: { p_membership_id: string }; Returns: undefined };
      invited_board_names: {
        Args: { p_board_ids: string[] };
        Returns: { board_id: string; name: string }[];
      };
      is_board_member: { Args: { p_board_id: string }; Returns: boolean };
      is_board_admin: { Args: { p_board_id: string }; Returns: boolean };
      is_board_owner: { Args: { p_board_id: string }; Returns: boolean };
      create_checklist_draft: { Args: { p_checklist_id: string }; Returns: string };
      publish_checklist_version: { Args: { p_version_id: string }; Returns: undefined };
      materialise_schedule: {
        Args: { p_schedule_id: string; p_horizon_days?: number };
        Returns: number;
      };
      start_submission: { Args: { p_submission_id: string }; Returns: string };
      submit_submission: { Args: { p_submission_id: string }; Returns: undefined };
      generate_occurrences: {
        Args: {
          p_kind: string;
          p_config: Json;
          p_start_date: string;
          p_end_date: string | null;
          p_from: string;
          p_to: string;
        };
        Returns: string[];
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Board = Database['public']['Tables']['boards']['Row'];
export type BoardMember = Database['public']['Tables']['board_members']['Row'];
export type Checklist = Database['public']['Tables']['checklists']['Row'];
export type ChecklistVersion = Database['public']['Tables']['checklist_versions']['Row'];
export type ChecklistGroup = Database['public']['Tables']['checklist_groups']['Row'];
export type ChecklistItem = Database['public']['Tables']['checklist_items']['Row'];
export type Schedule = Database['public']['Tables']['schedules']['Row'];
export type ScheduleAssignee = Database['public']['Tables']['schedule_assignees']['Row'];
export type Submission = Database['public']['Tables']['submissions']['Row'];
export type SubmissionItem = Database['public']['Tables']['submission_items']['Row'];
