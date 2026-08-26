-- =============================================================================
-- Rate limits.
--
-- Row Level Security governs WHOSE data someone may touch. It says nothing
-- about HOW OFTEN, and some actions are expensive in ways that have nothing to
-- do with the database:
--
--   inviting someone      sends mail through Resend, on gidlist.com's
--                         reputation. A few thousand invitations to addresses
--                         that bounce is how a domain stops reaching inboxes,
--                         and reputation is slow to rebuild.
--
--   materialising         generates up to 45 days of obligations per call, on
--                         demand, as many times as anyone asks.
--
-- ENFORCED HERE, NOT IN THE APP. A limit in a server action is bypassed by
-- calling PostgREST directly with the publishable key — which is exactly what
-- an abusive client does, because it is easier than driving the interface.
--
-- LIMITED BY ACTOR, NOT BY ADDRESS. Postgres cannot see the caller's IP, and
-- the risk that matters is a signed-in account behaving badly rather than an
-- anonymous flood — everything expensive here already requires a session.
--
-- ROLLING WINDOW, NOT A FIXED BUCKET. "30 in the last hour" counted from now
-- has no boundary to game; a bucket that resets on the hour allows 60 in two
-- minutes across the reset.
-- =============================================================================

create table if not exists public.rate_limit_events (
  id         bigserial primary key,
  actor_id   uuid not null,
  action     text not null,
  created_at timestamptz not null default now()
);

comment on table public.rate_limit_events is
  'One row per rate-limited action. Trimmed opportunistically; never read by the app.';

-- The only query this table serves: count one actor's recent rows for one
-- action. Descending time so the window scan stops early.
create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (actor_id, action, created_at desc);

alter table public.rate_limit_events enable row level security;

-- No policies at all. Nobody reads or writes this through the API; only the
-- SECURITY DEFINER function below touches it. A client that could delete its
-- own rows would have no rate limit.

/**
 * Record an action, or refuse it.
 *
 * Both halves in one function, and one statement apart, so two requests
 * arriving together cannot both read "29 so far" and both proceed.
 *
 * Trims as it goes rather than needing its own scheduled job: anything outside
 * the window is unreachable by definition, so deleting it costs nothing and the
 * table never grows. A cron job for this would be one more thing to notice had
 * stopped.
 */
create or replace function public.enforce_rate_limit(
  p_action text,
  p_limit  integer,
  p_window interval
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_count integer;
begin
  -- No session means a background job or the SQL console. Neither is the thing
  -- this defends against, and blocking the nightly job would be worse than
  -- anything it prevents.
  if v_actor is null then
    return;
  end if;

  delete from public.rate_limit_events
  where actor_id = v_actor
    and action = p_action
    and created_at < now() - (p_window * 4);

  select count(*) into v_count
  from public.rate_limit_events
  where actor_id = v_actor
    and action = p_action
    and created_at > now() - p_window;

  if v_count >= p_limit then
    -- PT429 rather than a stock Postgres code: PostgREST reads a SQLSTATE of
    -- the form PTnnn and answers with HTTP nnn, so this surfaces as a real 429
    -- Too Many Requests. A client — or a bot — then sees the standard signal
    -- instead of a 500 that looks like the server broke.
    --
    -- The message says what to do rather than only that something was refused:
    -- somebody who has just invited thirty colleagues has done nothing wrong
    -- and should be told to wait, not told off.
    raise exception 'Rate limit reached for %. Try again shortly.', p_action
      using errcode = 'PT429';
  end if;

  insert into public.rate_limit_events (actor_id, action) values (v_actor, p_action);
end;
$$;

revoke execute on function public.enforce_rate_limit(text, integer, interval)
  from public, anon, authenticated;

-- =============================================================================
-- Where the limits apply
-- =============================================================================

/**
 * Invitations.
 *
 * Thirty an hour, a hundred a day. Chosen against the real case rather than a
 * round number: an administrator onboarding a shift may legitimately add twenty
 * or thirty people in one sitting, and a limit that interrupts that is a limit
 * that gets reported as a bug. Two windows because the hourly figure alone
 * would permit seven hundred a day.
 *
 * Only pending invitations count. Someone who has accepted is already bounded
 * by the plan's member limit; it is invitations to addresses that never accept
 * that are unbounded, and those are the ones that cost sending reputation.
 */
create or replace function public.limit_invitations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'invited' then
    perform public.enforce_rate_limit('invitations', 30, interval '1 hour');
    perform public.enforce_rate_limit('invitations_daily', 100, interval '1 day');
  end if;

  return new;
end;
$$;

drop trigger if exists board_members_rate_limit on public.board_members;
create trigger board_members_rate_limit
  before insert on public.board_members
  for each row execute function public.limit_invitations();

/**
 * Materialisation.
 *
 * Called whenever a schedule is created or edited, so the ceiling has to clear
 * ordinary editing comfortably — sixty an hour is far more schedule changes
 * than anyone makes, and far fewer than a loop would attempt.
 *
 * Wrapped rather than edited into `materialise_schedule` so the nightly job,
 * which calls `materialise_submissions` and has no session, is untouched.
 */
create or replace function public.materialise_schedule(
  p_schedule_id  uuid,
  p_horizon_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SECURITY DEFINER bypasses RLS, so the permission check that RLS would
  -- normally provide has to be made explicitly. Without this, any signed-in
  -- user could materialise any schedule whose id they could guess.
  if not public.is_board_admin(public.schedule_board_id(p_schedule_id)) then
    raise exception 'You do not have permission to schedule this checklist.'
      using errcode = 'insufficient_privilege';
  end if;

  perform public.enforce_rate_limit('materialise', 60, interval '1 hour');

  -- Clamped, carried over from the original definition. Rate limiting caps how
  -- OFTEN this is called; the clamp caps how much each call can ask for, and
  -- dropping it while adding the other would have been a poor trade — sixty
  -- unbounded horizons an hour is worse than the unlimited calls it replaced.
  return public.materialise_one_schedule(p_schedule_id, least(greatest(p_horizon_days, 1), 365));
end;
$$;

grant execute on function public.materialise_schedule(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
