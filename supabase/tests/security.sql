-- =============================================================================
-- Security tests.
--
-- Row Level Security is this app's entire security model. One policy written
-- slightly wrong in a future migration leaks data between customers, and
-- nothing in the product would say so — the pages would look fine, because the
-- pages are not what enforces anything.
--
-- HOW TO RUN: paste the whole file into the Supabase SQL Editor and Run. It
-- ends in ROLLBACK, so every fixture it creates disappears. Nothing here
-- touches existing data: it works only on the users and spaces it makes.
--
-- HOW TO READ IT: the last statement prints one row per check. Every row must
-- say PASS. A FAIL is a real hole, not a flaky test — these are deterministic.
--
-- WHY THE POSITIVE CONTROLS: half of these assert that somebody CANNOT see
-- something, and a test like that passes just as well when the fixture failed
-- to create anything at all. Each negative is therefore paired with a positive
-- — the same query, run as somebody who should see rows, asserting they do. If
-- a control fails, the suite is broken and its passes mean nothing.
-- =============================================================================

begin;

create temp table results (
  ord      serial,
  name     text,
  outcome  text,
  detail   text
) on commit drop;

create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default null)
returns void language sql as $$
  insert into results (name, outcome, detail)
  values (p_name, case when p_ok then 'PASS' else 'FAIL' end, p_detail);
$$;

/** Become a given user for the statements that follow. */
create or replace function pg_temp.act_as(p_user uuid)
returns void language plpgsql as $$
begin
  execute format('set local role authenticated');
  execute format(
    'set local request.jwt.claims = %L',
    json_build_object('sub', p_user, 'role', 'authenticated')::text
  );
end;
$$;

create or replace function pg_temp.act_as_postgres()
returns void language plpgsql as $$
begin
  reset role;
  set local request.jwt.claims = '';
end;
$$;

-- -----------------------------------------------------------------------------
-- Fixtures: two unrelated companies, and one outsider.
-- -----------------------------------------------------------------------------
do $$
declare
  v_alice uuid := gen_random_uuid();  -- owns Acme
  v_bob   uuid := gen_random_uuid();  -- owns Globex, unrelated to Alice
  v_carol uuid := gen_random_uuid();  -- a member of Acme only
  v_acme  uuid;
  v_globex uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_alice, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.invalid', now(), now()),
    (v_bob,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.invalid',   now(), now()),
    (v_carol, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@test.invalid', now(), now());

  -- profiles are normally created by a trigger on signup; insert directly in
  -- case that trigger did not fire for a hand-made row.
  insert into public.profiles (id, full_name)
  values (v_alice, 'Alice'), (v_bob, 'Bob'), (v_carol, 'Carol')
  on conflict (id) do nothing;

  insert into public.boards (name, owner_id) values ('Acme', v_alice) returning id into v_acme;
  insert into public.boards (name, owner_id) values ('Globex', v_bob) returning id into v_globex;

  insert into public.board_members (board_id, user_id, invited_email, role, status, accepted_at)
  values (v_acme, v_carol, 'carol@test.invalid', 'member', 'active', now())
  on conflict do nothing;

  -- Stash the ids where the checks below can read them.
  create temp table fixture on commit drop as
  select v_alice as alice, v_bob as bob, v_carol as carol, v_acme as acme, v_globex as globex;
end;
$$;

-- =============================================================================
-- Tenant isolation
-- =============================================================================
do $$
declare
  f record;
  n integer;
begin
  select * into f from fixture;

  -- CONTROL: Alice must see her own space. If this fails the fixture is broken
  -- and every "cannot see" result below is meaningless.
  perform pg_temp.act_as(f.alice);
  select count(*) into n from public.boards where id = f.acme;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('control: owner sees own space', n = 1, format('saw %s', n));

  -- Alice must not see Bob's company at all.
  perform pg_temp.act_as(f.alice);
  select count(*) into n from public.boards where id = f.globex;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('owner cannot see another company''s space', n = 0, format('saw %s', n));

  -- CONTROL: Carol is a member of Acme and must see it.
  perform pg_temp.act_as(f.carol);
  select count(*) into n from public.boards where id = f.acme;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('control: member sees their space', n = 1, format('saw %s', n));

  -- Carol must not see Globex, which she has no relationship with.
  perform pg_temp.act_as(f.carol);
  select count(*) into n from public.boards where id = f.globex;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('member cannot see an unrelated space', n = 0, format('saw %s', n));

  -- Bob must not see who works at Acme.
  perform pg_temp.act_as(f.bob);
  select count(*) into n from public.board_members where board_id = f.acme;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('outsider cannot list another space''s members', n = 0, format('saw %s', n));
end;
$$;

-- =============================================================================
-- Platform capabilities
-- =============================================================================
do $$
declare
  f record;
  n integer;
  ok boolean;
begin
  select * into f from fixture;

  -- Nobody in this fixture holds any capability.
  perform pg_temp.act_as(f.alice);
  begin
    perform 1 from public.platform_accounts();
    ok := false;  -- reaching here means it answered, which is the hole
  exception when insufficient_privilege then
    ok := true;
  end;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('no capability: platform_accounts refuses', ok);

  perform pg_temp.act_as(f.alice);
  begin
    perform 1 from public.platform_people();
    ok := false;
  exception when insufficient_privilege then
    ok := true;
  end;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('no capability: platform_people refuses', ok);

  -- Grant Alice translations only. She must still not reach accounts — this is
  -- the reason capabilities replaced a single admin flag.
  insert into public.platform_grants (user_id, capability) values (f.alice, 'translations');

  perform pg_temp.act_as(f.alice);
  begin
    perform 1 from public.platform_accounts();
    ok := false;
  exception when insufficient_privilege then
    ok := true;
  end;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('translations does not grant accounts', ok);

  -- CONTROL: with the accounts capability she must succeed, proving the checks
  -- above fail for the right reason rather than because the function is broken.
  insert into public.platform_grants (user_id, capability) values (f.alice, 'accounts');
  perform pg_temp.act_as(f.alice);
  select count(*) into n from public.platform_accounts();
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('control: accounts capability grants accounts', n >= 1, format('saw %s', n));

  -- Escalation: holding `grants` must not let anyone hand out `grants`.
  insert into public.platform_grants (user_id, capability) values (f.alice, 'grants');
  perform pg_temp.act_as(f.alice);
  begin
    perform public.set_platform_grant(f.bob, 'grants', true);
    ok := false;
  exception when insufficient_privilege then
    ok := true;
  end;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('root capability cannot be granted from the app', ok);

  -- CONTROL: a non-root capability must be grantable, or the test above would
  -- pass simply because the function never works.
  perform pg_temp.act_as(f.alice);
  perform public.set_platform_grant(f.bob, 'translations', true);
  perform pg_temp.act_as_postgres();
  select count(*) into n from public.platform_grants
   where user_id = f.bob and capability = 'translations';
  perform pg_temp.check('control: non-root capability can be granted', n = 1, format('rows %s', n));

  -- Someone with no `grants` capability must not be able to hand anything out.
  perform pg_temp.act_as(f.carol);
  begin
    perform public.set_platform_grant(f.carol, 'accounts', true);
    ok := false;
  exception when insufficient_privilege then
    ok := true;
  end;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('cannot grant yourself a capability', ok);
end;
$$;

-- =============================================================================
-- Billing counts and limits
-- =============================================================================
do $$
declare
  f record;
  n integer;
  ok boolean;
begin
  select * into f from fixture;

  -- Alice owns Acme and Carol is active in it, so two distinct people.
  select public.account_member_count(f.alice) into n;
  perform pg_temp.check('members counted across the account', n = 2, format('counted %s', n));

  -- Archiving must remove a space from the counts, which is what makes
  -- archiving a legitimate way back under a plan.
  update public.boards set archived_at = now() where id = f.acme;
  select public.account_space_count(f.alice) into n;
  perform pg_temp.check('archived space stops counting', n = 0, format('counted %s', n));

  select public.account_member_count(f.alice) into n;
  perform pg_temp.check('archived space stops counting members', n = 0, format('counted %s', n));

  update public.boards set archived_at = null where id = f.acme;

  -- The free plan allows one space. Alice has one, so a second must be refused.
  begin
    insert into public.boards (name, owner_id) values ('Second', f.alice);
    ok := false;
  exception when check_violation then
    ok := true;
  end;
  perform pg_temp.check('free plan refuses a second space', ok);

  -- CONTROL: Bob owns one space too, so his first extra is refused for the same
  -- reason — but archiving his existing one must let it through, proving the
  -- limit reads live state rather than blocking unconditionally.
  update public.boards set archived_at = now() where id = f.globex;
  begin
    insert into public.boards (name, owner_id) values ('Replacement', f.bob);
    ok := true;
  exception when check_violation then
    ok := false;
  end;
  perform pg_temp.check('control: archiving frees a space slot', ok);
end;
$$;

-- =============================================================================
-- Audit log
--
-- The log records who did what. If the wrong people can read it, it becomes a
-- way to learn about companies you have no relationship with — who they hired,
-- when they lost someone. So it needs the same isolation as everything else,
-- and rows written by earlier fixtures in this run are the material to test on.
-- =============================================================================
do $$
declare
  f record;
  n integer;
  ok boolean;
begin
  select * into f from fixture;

  -- CONTROL: Alice governs Acme, so she must see its entries. The fixtures
  -- above created members and archived spaces, so there are rows to find.
  perform pg_temp.act_as(f.alice);
  select count(*) into n from public.audit_log where board_id = f.acme;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('control: space admin reads their audit log', n > 0, format('saw %s', n));

  -- Bob has no relationship with Acme.
  perform pg_temp.act_as(f.bob);
  select count(*) into n from public.audit_log where board_id = f.acme;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('outsider cannot read another space''s audit log', n = 0, format('saw %s', n));

  -- Carol is a member, not an admin. Staffing history is not hers to read.
  perform pg_temp.act_as(f.carol);
  select count(*) into n from public.audit_log where board_id = f.acme;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('ordinary member cannot read the audit log', n = 0, format('saw %s', n));

  -- Platform entries — capability grants — belong to whoever manages access.
  -- Carol holds nothing.
  perform pg_temp.act_as(f.carol);
  select count(*) into n from public.audit_log where board_id is null;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('no capability: cannot read platform audit', n = 0, format('saw %s', n));

  -- CONTROL: Alice was given `grants` earlier, so she must see them — and the
  -- grants themselves were audited, so rows exist.
  perform pg_temp.act_as(f.alice);
  select count(*) into n from public.audit_log where board_id is null;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('control: grants holder reads platform audit', n > 0, format('saw %s', n));

  -- Append-only. A log somebody can edit is not a log.
  perform pg_temp.act_as(f.alice);
  begin
    delete from public.audit_log where board_id = f.acme;
    -- No policy permits delete, so this removes nothing rather than raising.
    ok := not found;
  exception when insufficient_privilege or others then
    ok := true;
  end;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('audit log cannot be deleted from', ok);
end;
$$;

-- =============================================================================
-- Member hierarchy visibility (phase B)
--
-- The riskiest change in the schema, because it is the first time anything
-- other than "your own" or "everything" decides who reads a submission. The
-- shape being tested:
--
--   Alice   owner of Acme, sees everything
--   Carol   plain member, manages Dave
--   Dave    plain member, reports to Carol
--   Erin    plain member, reports to nobody — the control that proves Carol's
--           new sight is bounded rather than blanket
--
-- Each negative is paired with the positive that proves the fixture exists, per
-- the note at the top of this file.
-- =============================================================================
do $$
declare
  f          record;
  v_dave     uuid := gen_random_uuid();
  v_erin     uuid := gen_random_uuid();
  v_carol_bm uuid;
  v_dave_bm  uuid;
  v_list     uuid;
  v_sched    uuid;
  v_sub_dave uuid;
  v_sub_erin uuid;
  n          integer;
  ok         boolean;
begin
  select * into f from fixture;

  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values
    (v_dave, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave@test.invalid', now(), now()),
    (v_erin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'erin@test.invalid', now(), now());

  insert into public.profiles (id, full_name)
  values (v_dave, 'Dave'), (v_erin, 'Erin')
  on conflict (id) do nothing;

  insert into public.board_members (board_id, user_id, invited_email, role, status, accepted_at)
  values
    (f.acme, v_dave, 'dave@test.invalid', 'member', 'active', now()),
    (f.acme, v_erin, 'erin@test.invalid', 'member', 'active', now());

  select id into v_carol_bm from public.board_members where board_id = f.acme and user_id = f.carol;
  select id into v_dave_bm  from public.board_members where board_id = f.acme and user_id = v_dave;

  -- The reporting line under test. Erin deliberately gets none.
  update public.board_members set manager_id = v_carol_bm where id = v_dave_bm;

  insert into public.checklists (board_id, title, created_by)
  values (f.acme, 'Opening checks', f.alice) returning id into v_list;

  insert into public.schedules (checklist_id, kind, config, created_by)
  values (v_list, 'daily', '{}'::jsonb, f.alice) returning id into v_sched;

  insert into public.submissions (schedule_id, checklist_id, due_date, assignee_id, assignee_email, status)
  values
    (v_sched, v_list, current_date, v_dave, 'dave@test.invalid', 'missed'),
    (v_sched, v_list, current_date, v_erin, 'erin@test.invalid', 'missed');

  select id into v_sub_dave from public.submissions where assignee_id = v_dave;
  select id into v_sub_erin from public.submissions where assignee_id = v_erin;

  -- CONTROL: Dave sees his own record. If this fails nothing below means much.
  perform pg_temp.act_as(v_dave);
  select count(*) into n from public.submissions where id = v_sub_dave;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('control: assignee sees their own record', n = 1, format('saw %s', n));

  -- THE FEATURE: Carol manages Dave, so she sees his record.
  perform pg_temp.act_as(f.carol);
  select count(*) into n from public.submissions where id = v_sub_dave;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('manager sees a report''s record', n = 1, format('saw %s', n));

  -- THE BOUND: Erin reports to nobody, so Carol must not see hers. This is the
  -- check that separates "my team" from "everybody", and the one that would
  -- catch a policy accidentally widened to every member.
  perform pg_temp.act_as(f.carol);
  select count(*) into n from public.submissions where id = v_sub_erin;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('manager cannot see a non-report''s record', n = 0, format('saw %s', n));

  -- Sideways, not upward: a report must not gain sight of their manager's peers.
  perform pg_temp.act_as(v_dave);
  select count(*) into n from public.submissions where id = v_sub_erin;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('a report cannot see a colleague''s record', n = 0, format('saw %s', n));

  -- And none of it crosses the tenant boundary.
  perform pg_temp.act_as(f.bob);
  select count(*) into n from public.submissions where id in (v_sub_dave, v_sub_erin);
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('outsider sees no records at all', n = 0, format('saw %s', n));

  -- manages_member itself, both directions.
  perform pg_temp.act_as(f.carol);
  select public.manages_member(f.acme, v_dave) into ok;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('manages_member: true for a report', ok, format('got %s', ok));

  perform pg_temp.act_as(f.carol);
  select public.manages_member(f.acme, v_erin) into ok;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('manages_member: false for a non-report', not ok, format('got %s', ok));

  -- Voiding: permitted for a report, refused for a stranger's record. Both
  -- asserted by outcome rather than by reading the error text, so a reworded
  -- message does not fail the suite.
  perform pg_temp.act_as(f.carol);
  begin
    perform public.set_submission_void(v_sub_dave, 'covered by the deep clean');
    ok := true;
  exception when others then
    ok := false;
  end;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('manager may void a report''s record', ok, format('allowed = %s', ok));

  perform pg_temp.act_as(f.carol);
  begin
    perform public.set_submission_void(v_sub_erin, 'should not be allowed');
    ok := true;
  exception when others then
    ok := false;
  end;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('manager may NOT void a non-report''s record', not ok, format('allowed = %s', ok));

  -- CONTROL: the owner can still void anything. Widening the check must not
  -- have replaced the admin case with the manager one.
  perform pg_temp.act_as(f.alice);
  begin
    perform public.set_submission_void(v_sub_erin, 'admin still governs');
    ok := true;
  exception when others then
    ok := false;
  end;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('control: admin may still void any record', ok, format('allowed = %s', ok));

  -- The reporting line is the only thing granting this, so removing it removes
  -- the access — decision 3, that visibility follows the current chart.
  update public.board_members set manager_id = null where id = v_dave_bm;
  perform pg_temp.act_as(f.carol);
  select count(*) into n from public.submissions where id = v_sub_dave;
  perform pg_temp.act_as_postgres();
  perform pg_temp.check('access ends when the reporting line does', n = 0, format('saw %s', n));
end;
$$;

-- =============================================================================
-- Results
-- =============================================================================
-- One result set, with the verdict as its last row. The SQL Editor shows a
-- single result, so a separate summary query would simply not be displayed —
-- and a suite whose verdict you cannot see is a suite you will stop running.
--
-- Failures are ordered first: with twenty passing rows, one FAIL in the middle
-- is easy to scroll past.
select outcome, name, coalesce(detail, '') as detail
from (
  select ord, outcome, name, detail,
         case when outcome = 'FAIL' then 0 else 1 end as priority
  from results
  union all
  select
    9999,
    case when count(*) filter (where outcome = 'FAIL') = 0 then 'PASS' else 'FAIL' end,
    case when count(*) filter (where outcome = 'FAIL') = 0
         then '=== ALL CHECKS PASSED ==='
         else '=== FAILURES PRESENT — see the rows above ==='
    end,
    format('%s passed, %s failed',
           count(*) filter (where outcome = 'PASS'),
           count(*) filter (where outcome = 'FAIL')),
    2
  from results
) rows
order by priority, ord;

-- Nothing above is kept. Every user, space and grant this created disappears.
rollback;
