/**
 * Database types. **Hand-written. Do not overwrite this file with the
 * generator's output.**
 *
 * An earlier version of this comment said the opposite — that once the CLI was
 * linked, `pnpm db:types` should replace this file. Following that instruction
 * loses real type safety, which is why it now says the reverse.
 *
 * The reason: this schema has no Postgres enums. Roles, statuses and schedule
 * kinds are `text` columns with CHECK constraints, so the generator can only
 * see `string`. This file narrows them to unions — `role: BoardRole`,
 * `status: SubmissionStatus` — and that narrowing is what makes `canGovern()`,
 * the status filters and the schedule config discriminators typecheck at all.
 * Regenerating widens every one of them back to `string`, and nothing fails
 * loudly when it happens.
 *
 *   pnpm db:types      writes lib/supabase/database.generated.ts
 *
 * That output is a **reference to diff against**, never a replacement. After a
 * migration, run it, compare, and hand-apply what changed — keeping the unions.
 *
 * Converting the CHECK constraints to real Postgres enums would let the
 * generator produce this file properly and retire the whole arrangement. That
 * is the actual fix, and it is README open item 12.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BoardRole = 'owner' | 'admin' | 'editor' | 'member';
export type BoardMemberStatus = 'invited' | 'active';
export type ChecklistVersionStatus = 'draft' | 'published';
export type ScheduleKind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'specific_dates';
export type SubmissionStatus = 'upcoming' | 'draft' | 'done' | 'missed';

/**
 * Billing (phase 7).
 *
 * `past_due` still entitles, deliberately: cutting off a factory's safety
 * checklists over a failed card loses the customer rather than collecting from
 * them. Only `canceled` withdraws access.
 */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';
export type PaymentProvider = 'payme' | 'click' | 'paddle';
export type PlanCode = 'free' | 'starter' | 'team' | 'business';

/**
 * Capability keys, matched against `plan_features`.
 *
 * A union rather than `string` so a typo becomes a compile error instead of a
 * silently denied feature — `board_has_feature` returns false for a key that
 * grants nothing, which is indistinguishable from "not on your plan" at runtime.
 * Adding a module means adding its key here and inserting its rows.
 */
export type FeatureKey = 'checklists' | 'compliance' | 'okr';

/**
 * One audit row, as both log functions return it.
 *
 * `actor_id` and `actor_email` alongside the name because a display name is not
 * an identity: two people can share one, and it is editable after the fact —
 * so the name alone cannot answer "which account did this".
 */
export type AuditRow = {
  id: number;
  action: string;
  actor_id: string | null;
  actor_name: string;
  actor_email: string | null;
  detail: Record<string, string | null>;
  created_at: string;
  total_count: number;
};

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
          /** Archived spaces are hidden, generate nothing, and keep all history. */
          archived_at: string | null;
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
      // ---- billing (phase 7) -------------------------------------------------
      // All read-only to the app. Subscriptions change because a payment
      // provider says money moved, through a webhook using the service role;
      // there are deliberately no write policies, so `never` here matches what
      // the database would do anyway.
      //
      // Capacity lives in columns on `plans`; capability lives in rows of
      // plan_features and addon_features. Keeping numbers and sets apart is
      // what stops a future module needing its own member limit.
      plans: {
        Row: {
          code: PlanCode;
          name: string;
          /** Flat monthly price in minor units — not per seat. */
          price_minor: number;
          currency: string;
          /** Distinct people pooled across every space. Null = unlimited. */
          max_members: number | null;
          max_spaces: number | null;
          is_free: boolean;
          is_offerable: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      plan_features: {
        // No row means not granted. Absence is the denial.
        Row: { plan_code: PlanCode; feature_key: FeatureKey };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      addons: {
        Row: { code: string; name: string; is_offerable: boolean; sort_order: number; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      addon_prices: {
        Row: { addon_code: string; plan_code: PlanCode; price_minor: number; currency: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      addon_features: {
        Row: { addon_code: string; feature_key: FeatureKey };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          owner_id: string;
          plan_code: PlanCode;
          status: SubscriptionStatus;
          current_period_start: string;
          /** Prepaid: a genuine paid-through date, not a usage window. */
          current_period_end: string | null;
          provider: PaymentProvider | null;
          provider_ref: string | null;
          canceled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // ---- platform access ---------------------------------------------------
      platform_capabilities: {
        Row: {
          code: string;
          name: string;
          description: string | null;
          /** True only for `grants`, which is settable by SQL alone. */
          is_root: boolean;
          sort_order: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      platform_grants: {
        // Written only through set_platform_grant(), which refuses the root.
        Row: {
          user_id: string;
          capability: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      subscription_addons: {
        Row: {
          owner_id: string;
          addon_code: string;
          status: SubscriptionStatus;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      // Now means "holds the root `grants` capability" rather than "can do
      // anything administrative". Prefer has_platform_capability for narrower
      // questions — widening this would give a translator reach it should not
      // have.
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      has_platform_capability: { Args: { p_capability: string }; Returns: boolean };
      my_platform_capabilities: { Args: Record<string, never>; Returns: string[] };
      // Refuses the root capability: granting that stays a database-console act,
      // so the set of people who can hand out power changes only deliberately.
      set_platform_grant: {
        Args: { p_user_id: string; p_capability: string; p_granted: boolean };
        Returns: undefined;
      };
      // ---- platform admin views ----------------------------------------------
      // These read across every customer, so the gate is inside each function
      // rather than on a table: RLS answers "your rows", and the answer needed
      // here is "everyone's". Each raises before producing a single row.
      platform_accounts: {
        Args: Record<string, never>;
        Returns: {
          owner_id: string;
          email: string;
          full_name: string | null;
          plan_code: PlanCode;
          plan_name: string;
          price_minor: number;
          currency: string;
          used_members: number;
          max_members: number | null;
          used_spaces: number;
          max_spaces: number | null;
          status: SubscriptionStatus;
          period_end: string | null;
          joined_at: string;
        }[];
      };
      platform_revenue: {
        Args: Record<string, never>;
        Returns: {
          currency: string;
          mrr_minor: number;
          paying_accounts: number;
          free_accounts: number;
          past_due: number;
          near_limit: number;
          /** Everyone with a login, whether or not they own a space. */
          registered_people: number;
        }[];
      };
      // ---- audit -------------------------------------------------------------
      // Functions rather than direct table reads: auth.users is not readable
      // through the API, so a raw query would return actor uuids nobody can
      // read. These resolve the name.
      // `total_count` repeats on every row — it is a window function over the
      // filtered set, so paging can report "1–25 of 340" without a second query.
      board_audit_log: {
        Args: {
          p_board_id: string;
          p_search?: string;
          p_action?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: AuditRow[];
      };
      platform_audit_log: {
        Args: { p_search?: string; p_action?: string; p_limit?: number; p_offset?: number };
        Returns: AuditRow[];
      };
      /** Which actions actually occur, so a filter offers only real choices. */
      audit_actions: {
        Args: { p_board_id?: string };
        Returns: { action: string; uses: number }[];
      };
      platform_people: {
        Args: {
          p_search?: string;
          /** A capability code. Filters to its holders. */
          p_capability?: string;
          /** Holds at least one capability. Separate from the above rather than
           *  a magic value, which would break the day a capability is named
           *  `any` and read as a bug until then. */
          p_with_access?: boolean;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          user_id: string;
          email: string;
          full_name: string | null;
          capabilities: string[];
          total_count: number;
        }[];
      };
      platform_capability_counts: {
        Args: Record<string, never>;
        Returns: { capability: string; holders: number }[];
      };
      /**
       * Whether the scheduled work is running. Reads pg_cron's own run history
       * rather than a record the jobs keep themselves — a log written by the
       * job goes quiet exactly when the job does.
       */
      platform_job_health: {
        Args: Record<string, never>;
        Returns: {
          jobname: string;
          last_success: string | null;
          last_status: string | null;
          last_message: string | null;
          max_silence: string;
          is_stale: boolean;
        }[];
      };
      // Returns null when the caller is not an active member of the board.
      my_role: { Args: { p_board_id: string }; Returns: BoardRole | null };
      // ---- billing (phase 7) -------------------------------------------------
      // account_member_count, account_space_count and account_plan are absent on
      // purpose: all three are revoked from every API role, because each takes
      // an id and would otherwise report how large any account is to anyone
      // holding it. Listing them here would invite a call the database refuses.
      account_has_feature: {
        Args: { p_owner_id: string; p_feature_key: FeatureKey };
        Returns: boolean;
      };
      // ---- archiving ---------------------------------------------------------
      // Archive rather than delete: a space's submissions are its compliance
      // record, and deletion cascades to them.
      set_board_archived: { Args: { p_board_id: string; p_archived: boolean }; Returns: undefined };
      set_checklist_archived: {
        Args: { p_checklist_id: string; p_archived: boolean };
        Returns: undefined;
      };
      // Refuses once any submission exists. For "I made this by mistake" only.
      delete_board_if_unused: { Args: { p_board_id: string }; Returns: undefined };
      /** Resolves a space to whoever pays for it. Safe inside RLS policies. */
      board_has_feature: {
        Args: { p_board_id: string; p_feature_key: FeatureKey };
        Returns: boolean;
      };
      /** Everything the billing page needs, about the caller's own account only. */
      my_account_usage: {
        Args: Record<string, never>;
        Returns: {
          plan_code: PlanCode;
          plan_name: string;
          price_minor: number;
          currency: string;
          max_members: number | null;
          max_spaces: number | null;
          used_members: number;
          used_spaces: number;
          period_end: string | null;
          status: SubscriptionStatus;
        }[];
      };
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
export type Plan = Database['public']['Tables']['plans']['Row'];
export type PlanFeature = Database['public']['Tables']['plan_features']['Row'];
export type Addon = Database['public']['Tables']['addons']['Row'];
export type AddonPrice = Database['public']['Tables']['addon_prices']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type AccountUsage = Database['public']['Functions']['my_account_usage']['Returns'][number];
