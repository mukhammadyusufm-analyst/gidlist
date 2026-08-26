-- =============================================================================
-- Audit log.
--
-- WRITTEN BY TRIGGERS, NOT BY THE APP. An action that the application records
-- is an action the application can forget to record — a new code path, a direct
-- API call, a fix applied in the SQL editor at midnight. A trigger cannot be
-- bypassed by any of those, because it fires on the row change itself.
--
-- WHAT IS AUDITED: governance. Who was given access, whose role changed, who
-- archived a space, what a subscription did. Not routine work — a submission
-- already records who ticked what and when, and auditing every checkbox would
-- bury the twenty rows a year that actually matter under millions that do not.
--
-- The rule of thumb: log the things somebody might later deny doing.
-- =============================================================================

-- NO FOREIGN KEYS HERE, and that is deliberate on two counts.
--
-- Correctness: a log that loses its subject when the subject is deleted is not
-- a log. "Who deleted this space" is precisely the row you want afterwards, and
-- `on delete set null` would erase it at the moment it became interesting.
--
-- And it would break deletion outright. Removing a space cascades to its
-- members, which fires the audit trigger below; that insert would reference a
-- parent row Postgres is in the middle of deleting, and the constraint would
-- refuse it — so the delete fails because it tried to record itself.
create table if not exists public.audit_log (
  id          bigserial primary key,
  -- Null when the actor is a background job or a database console. Nullable on
  -- purpose: a change made outside a session must still be recorded, and NOT
  -- NULL would mean the trigger fails and the change itself is refused.
  actor_id    uuid,
  action      text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  -- Which space this concerns, when it concerns one. Platform-level entries —
  -- capability grants, billing — have none, and that absence is what routes
  -- them to a different audience in the policy below.
  board_id    uuid,
  subject_id  uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.audit_log is
  'Governance actions, written by triggers. Append-only: no update or delete policy exists.';

comment on column public.audit_log.action is
  'namespace.verb, e.g. member.role_changed. Stable — queries and future alerts match on it.';

create index if not exists audit_log_board_idx on public.audit_log (board_id, created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);

-- -----------------------------------------------------------------------------
-- Writer. SECURITY DEFINER so a trigger can insert regardless of who set it
-- off — the log must record actions by people who have no rights to the log.
-- -----------------------------------------------------------------------------
create or replace function public.write_audit(
  p_action     text,
  p_board_id   uuid,
  p_subject_id uuid,
  p_detail     jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, board_id, subject_id, detail)
  values ((select auth.uid()), p_action, p_board_id, p_subject_id, p_detail);
$$;

revoke execute on function public.write_audit(text, uuid, uuid, jsonb)
  from public, anon, authenticated;

-- =============================================================================
-- Triggers
-- =============================================================================

create or replace function public.audit_board_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit(
      'member.invited', new.board_id, new.user_id,
      jsonb_build_object('email', new.invited_email, 'role', new.role, 'status', new.status)
    );
  elsif tg_op = 'UPDATE' then
    -- Only the two transitions worth a row. Without this filter, every
    -- acceptance timestamp touch would write one.
    if new.role is distinct from old.role then
      perform public.write_audit(
        'member.role_changed', new.board_id, new.user_id,
        jsonb_build_object('from', old.role, 'to', new.role, 'email', new.invited_email)
      );
    end if;
    if new.status is distinct from old.status then
      perform public.write_audit(
        'member.status_changed', new.board_id, new.user_id,
        jsonb_build_object('from', old.status, 'to', new.status, 'email', new.invited_email)
      );
    end if;
  elsif tg_op = 'DELETE' then
    perform public.write_audit(
      'member.removed', old.board_id, old.user_id,
      jsonb_build_object('email', old.invited_email, 'role', old.role)
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists board_members_audit on public.board_members;
create trigger board_members_audit
  after insert or update or delete on public.board_members
  for each row execute function public.audit_board_members();

create or replace function public.audit_boards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('space.created', new.id, new.owner_id,
      jsonb_build_object('name', new.name));
  elsif tg_op = 'DELETE' then
    -- Filed as platform history rather than against the space, because the
    -- space no longer exists: the read policy asks `is_board_admin(board_id)`,
    -- which cannot resolve an administrator for a row that is gone, so keeping
    -- the id here would produce a record nobody on earth could read. The id and
    -- name live in the detail instead, where they stay legible.
    perform public.write_audit('space.deleted', null, old.owner_id,
      jsonb_build_object('name', old.name, 'space_id', old.id));
  elsif new.archived_at is distinct from old.archived_at then
    perform public.write_audit(
      case when new.archived_at is null then 'space.restored' else 'space.archived' end,
      new.id, new.owner_id, jsonb_build_object('name', new.name)
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists boards_audit on public.boards;
create trigger boards_audit
  after insert or update or delete on public.boards
  for each row execute function public.audit_boards();

-- Capability grants: the highest-value rows in this table. If platform access
-- is ever misused, this is the only record of who was given what, by whom, and
-- when.
create or replace function public.audit_platform_grants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('access.granted', null, new.user_id,
      jsonb_build_object('capability', new.capability));
  else
    perform public.write_audit('access.revoked', null, old.user_id,
      jsonb_build_object('capability', old.capability));
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists platform_grants_audit on public.platform_grants;
create trigger platform_grants_audit
  after insert or delete on public.platform_grants
  for each row execute function public.audit_platform_grants();

create or replace function public.audit_subscriptions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit('billing.started', null, new.owner_id,
      jsonb_build_object('plan', new.plan_code, 'status', new.status));
  elsif new.plan_code is distinct from old.plan_code
     or new.status is distinct from old.status then
    perform public.write_audit('billing.changed', null, new.owner_id,
      jsonb_build_object(
        'plan_from', old.plan_code, 'plan_to', new.plan_code,
        'status_from', old.status, 'status_to', new.status
      ));
  end if;

  return new;
end;
$$;

drop trigger if exists subscriptions_audit on public.subscriptions;
create trigger subscriptions_audit
  after insert or update on public.subscriptions
  for each row execute function public.audit_subscriptions();

-- =============================================================================
-- Row Level Security
--
-- Append-only by construction: there is a read policy and nothing else, so
-- Postgres refuses every update and delete from every API role. A log somebody
-- can edit is not a log — and the writer above is SECURITY DEFINER, so triggers
-- still insert.
-- =============================================================================

alter table public.audit_log enable row level security;

drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log
  for select to authenticated
  using (
    -- Space entries: whoever governs that space.
    (board_id is not null and public.is_board_admin(board_id))
    -- Platform entries have no space, and belong to whoever manages access.
    or (board_id is null and public.has_platform_capability('grants'))
  );

/**
 * One space's history, newest first.
 *
 * A function rather than letting the app query the table, so the shape of the
 * answer is fixed here and the actor's name can be resolved — auth.users is not
 * readable through the API, so a raw query would return uuids nobody can read.
 */
create or replace function public.board_audit_log(p_board_id uuid, p_limit integer default 100)
returns table (
  id         bigint,
  action     text,
  actor_name text,
  detail     jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_board_admin(p_board_id) then
    raise exception 'You do not have permission to view this space''s history.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select a.id, a.action,
         coalesce(p.full_name, u.email::text, 'system'),
         a.detail, a.created_at
  from public.audit_log a
  left join auth.users u on u.id = a.actor_id
  left join public.profiles p on p.id = a.actor_id
  where a.board_id = p_board_id
  order by a.created_at desc
  limit least(coalesce(p_limit, 100), 500);
end;
$$;

revoke execute on function public.board_audit_log(uuid, integer) from public, anon;
grant execute on function public.board_audit_log(uuid, integer) to authenticated;

/** Platform-level history: capability grants and billing. */
create or replace function public.platform_audit_log(p_limit integer default 200)
returns table (
  id         bigint,
  action     text,
  actor_name text,
  detail     jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('grants') then
    raise exception 'You do not have permission to view platform history.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select a.id, a.action,
         coalesce(p.full_name, u.email::text, 'system'),
         a.detail, a.created_at
  from public.audit_log a
  left join auth.users u on u.id = a.actor_id
  left join public.profiles p on p.id = a.actor_id
  where a.board_id is null
  order by a.created_at desc
  limit least(coalesce(p_limit, 200), 1000);
end;
$$;

revoke execute on function public.platform_audit_log(integer) from public, anon;
grant execute on function public.platform_audit_log(integer) to authenticated;

notify pgrst, 'reload schema';
