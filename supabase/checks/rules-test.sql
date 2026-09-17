-- RUN THIS IN: either database (gidlist-dev zffoidgzuyhojnydshkq, production ivqprkzqnoiffqlbfkkd).
-- SAFE: everything happens inside one transaction that is ROLLED BACK at the end.
-- Nothing it creates survives, and it never touches existing rows.
-- =============================================================================
-- The rules test.
--
-- Every bug we have shipped in this area was a database rule that stopped
-- holding, and each was found by hand, weeks later:
--
--   * "Edit as draft" dropped photo, file, location and window settings.
--   * Deleting a schedule deleted the submitted records it had produced.
--   * Two schedules produced two copies of one checklist for one person.
--   * A practice space could take new checklists, members and schedules.
--
-- This file asserts those rules. Run it after any migration that touches
-- checklists, schedules, submissions or the practice space — and before a
-- release. It prints one row per rule with pass/fail, and fails loudly if a
-- rule that should refuse something does not.
--
-- It needs one existing account to own the test space (any row in auth.users).
-- =============================================================================

begin;

do $$
declare
  v_owner     uuid;
  v_board     uuid;
  v_checklist uuid;
  v_version   uuid;
  v_draft     uuid;
  v_group     uuid;
  v_item      uuid;
  v_sched_a   uuid;
  v_sched_b   uuid;
  v_sub       uuid;
  v_answer    uuid;
  v_today     date := current_date;
  v_practice  uuid;
  v_count     integer;
  v_ok        boolean;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'No accounts in this database, so the test cannot create a space.';
  end if;

  create temporary table rule_results(rule text, passed boolean, detail text) on commit drop;

  -- The owner may already be at their plan's space limit, which would refuse
  -- the test space and say nothing about the rules being tested. An uncapped
  -- agreement for the length of this transaction removes that; it is rolled
  -- back with everything else.
  insert into public.account_limits (user_id, max_spaces, max_members, granted_by)
  values (v_owner, null, null, v_owner)
  on conflict (user_id) do update set max_spaces = null, max_members = null;

  -- ---------------------------------------------------------------------------
  -- A space with one published checklist, one item carrying every setting.
  -- ---------------------------------------------------------------------------
  insert into public.boards (name, owner_id) values ('Rules test', v_owner) returning id into v_board;

  insert into public.checklists (board_id, title, created_by)
  values (v_board, 'Rules test checklist', v_owner) returning id into v_checklist;

  select cv.id into v_version from public.checklist_versions cv
   where cv.checklist_id = v_checklist and cv.status = 'draft';
  select g.id into v_group from public.checklist_groups g where g.version_id = v_version limit 1;

  insert into public.checklist_items
    (version_id, group_id, title, position,
     photo_enabled, photo_required, file_enabled,
     location_enabled, location_required, location_lat, location_lng, location_radius_m,
     window_enabled, window_start, window_end)
  values (v_version, v_group, 'Item with settings', 10,
          true, true, true,
          true, false, 41.311081, 69.240562, 300,
          true, time '09:00', time '18:00')
  returning id into v_item;

  update public.checklist_versions set status = 'published', published_at = now() where id = v_version;

  -- 1. A new draft carries every setting (the 4 Aug bug).
  v_draft := public.create_checklist_draft(v_checklist);
  select count(*) into v_count from public.checklist_items ci
   where ci.version_id = v_draft
     and ci.photo_required and ci.file_enabled and ci.location_enabled
     and ci.location_radius_m = 300 and ci.window_enabled and ci.window_start = time '09:00';
  insert into rule_results values
    ('draft copy keeps item settings', v_count = 1, v_count || ' of 1 items kept their settings');

  -- ---------------------------------------------------------------------------
  -- Two schedules, one person, one day.
  -- ---------------------------------------------------------------------------
  -- Both cover today and tomorrow, so the second has a day of its own to refill
  -- once the first is deleted.
  insert into public.schedules (checklist_id, kind, config, start_date, timezone, assignment_mode, created_by)
  values (v_checklist, 'specific_dates',
          jsonb_build_object('dates', jsonb_build_array(to_char(v_today, 'YYYY-MM-DD'),
                                                        to_char(v_today + 1, 'YYYY-MM-DD'))),
          v_today, 'Asia/Tashkent', 'creator', v_owner)
  returning id into v_sched_a;

  insert into public.schedules (checklist_id, kind, config, start_date, timezone, assignment_mode, created_by)
  values (v_checklist, 'specific_dates',
          jsonb_build_object('dates', jsonb_build_array(to_char(v_today, 'YYYY-MM-DD'),
                                                        to_char(v_today + 1, 'YYYY-MM-DD'))),
          v_today, 'Asia/Tashkent', 'creator', v_owner)
  returning id into v_sched_b;

  insert into public.submissions (schedule_id, checklist_id, checklist_version_id, due_date, assignee_id, status)
  values (v_sched_a, v_checklist, v_version, v_today, v_owner, 'upcoming') returning id into v_sub;

  -- 2. The second schedule's copy for the same person and day is not created.
  insert into public.submissions (schedule_id, checklist_id, checklist_version_id, due_date, assignee_id, status)
  values (v_sched_b, v_checklist, v_version, v_today, v_owner, 'upcoming');

  select count(*) into v_count from public.submissions s
   where s.checklist_id = v_checklist and s.due_date = v_today and s.assignee_id = v_owner;
  insert into rule_results values
    ('one copy per person per day', v_count = 1, v_count || ' copies exist');

  -- 3. An attempt on an outdated version cannot be ticked.
  insert into public.submission_items (submission_id, item_id) values (v_sub, v_item) returning id into v_answer;
  update public.submissions set status = 'draft' where id = v_sub;
  update public.checklist_versions set status = 'published', published_at = now() where id = v_draft;

  v_ok := false;
  begin
    update public.submission_items set checked = true where id = v_answer;
  exception when others then
    v_ok := true;
  end;
  insert into rule_results values
    ('outdated attempt cannot be ticked', v_ok, case when v_ok then 'refused' else 'the tick was accepted' end);

  -- 4. Deleting a schedule keeps a submitted record and removes only unopened days.
  update public.submissions set status = 'done', submitted_at = now() where id = v_sub;
  insert into public.submissions (schedule_id, checklist_id, checklist_version_id, due_date, assignee_id, status)
  values (v_sched_a, v_checklist, v_draft, v_today + 1, v_owner, 'upcoming');

  delete from public.schedules where id = v_sched_a;

  select count(*) into v_count from public.submissions where id = v_sub and status = 'done';
  insert into rule_results values
    ('schedule deletion keeps submitted records', v_count = 1, v_count || ' of 1 kept');

  select count(*) into v_count from public.submissions
   where checklist_id = v_checklist and due_date = v_today + 1 and status = 'upcoming';
  insert into rule_results values
    -- The other schedule refills the day it was skipping, so one is expected.
    ('schedule deletion refills other schedules', v_count = 1, v_count || ' day(s) for tomorrow');

  -- ---------------------------------------------------------------------------
  -- The practice space refuses everything but its own seeding.
  -- ---------------------------------------------------------------------------
  perform set_config('gidlist.seeding_tutorial', 'on', true);
  insert into public.boards (name, owner_id, is_tutorial) values ('Rules test practice', v_owner, true)
  returning id into v_practice;
  perform set_config('gidlist.seeding_tutorial', 'off', true);

  -- 5. No new checklists in it.
  v_ok := false;
  begin
    insert into public.checklists (board_id, title, created_by) values (v_practice, 'Should be refused', v_owner);
  exception when others then v_ok := true;
  end;
  insert into rule_results values
    ('practice space refuses new checklists', v_ok, case when v_ok then 'refused' else 'it was created' end);

  -- 6. No new members.
  v_ok := false;
  begin
    insert into public.board_members (board_id, invited_email, role, status)
    values (v_practice, 'someone@example.com', 'member', 'invited');
  exception when others then v_ok := true;
  end;
  insert into rule_results values
    ('practice space refuses new members', v_ok, case when v_ok then 'refused' else 'the member was added' end);

  -- 7. Nobody can claim the tutorial exemption for an ordinary space.
  v_ok := false;
  begin
    insert into public.boards (name, owner_id, is_tutorial) values ('Fake practice', v_owner, true);
  exception when others then v_ok := true;
  end;
  insert into rule_results values
    ('tutorial flag cannot be set by hand', v_ok, case when v_ok then 'refused' else 'the flag was accepted' end);
end;
$$;

select rule,
       case when passed then 'PASS' else 'FAIL' end as result,
       detail
  from rule_results
 order by passed, rule;

-- Nothing above is kept.
rollback;
