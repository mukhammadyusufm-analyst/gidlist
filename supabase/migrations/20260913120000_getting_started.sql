-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- =============================================================================
-- A guided start for new accounts (README item 56).
--
-- Somebody who signs up lands on an empty page that says "no spaces yet" and has
-- to work out alone what a space, a checklist, a schedule and a submission are.
-- Now their first visit creates a space called "Getting started" holding one
-- practice checklist, due today, that teaches by being filled in: a tick, a
-- comment, steps inside an item, a photo, a file, and where the record ends up.
--
-- THE RULES IT KEEPS
--
--   * Once per person. `profiles.getting_started_at` records that it happened,
--     and the row is locked while the space is created, so two tabs opening at
--     once cannot make two.
--   * New people only. Everyone who already has a profile is marked as done by
--     this migration, and somebody who arrives by invitation into another
--     company's space gets nothing — their employer's checklists are their
--     introduction, and a practice space of their own would be clutter.
--   * The same on every plan. The tutorial space does not count toward the space
--     limit on any plan, so a free account's one space is still free for real
--     work. That exemption cannot be claimed by anyone else: `is_tutorial` can
--     only be set from inside this function (see the guard trigger).
--   * Written in the language the person chose (`profiles.locale`).
--   * Universal features only. No location or time-of-day requirement, because
--     either one could refuse the tick depending on where and when somebody
--     happens to open it; the last item explains both instead.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Columns
-- -----------------------------------------------------------------------------
alter table public.boards
  add column if not exists is_tutorial boolean not null default false;

comment on column public.boards.is_tutorial is
  'The practice space created by ensure_getting_started(). Not counted toward the space limit. Set only by that function.';

alter table public.profiles
  add column if not exists getting_started_at timestamptz;

comment on column public.profiles.getting_started_at is
  'When this person''s guided start was created, or decided against. Null means it has not been considered yet.';

-- Everyone who exists today has already started. Without this, every current
-- user would find a tutorial space on their next visit.
update public.profiles
   set getting_started_at = now()
 where getting_started_at is null;

-- -----------------------------------------------------------------------------
-- Nobody sets is_tutorial by hand
--
-- A board flagged as a tutorial is free of the space limit, so a client that
-- could insert one with the flag set would have unlimited spaces. Only the
-- seeding function raises the transaction-local flag this checks for.
-- -----------------------------------------------------------------------------
create or replace function public.guard_board_tutorial_flag()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.is_tutorial)
     or (tg_op = 'UPDATE' and new.is_tutorial is distinct from old.is_tutorial) then
    if coalesce(current_setting('gidlist.seeding_tutorial', true), '') <> 'on' then
      raise exception 'The tutorial flag cannot be set directly.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists boards_guard_tutorial_flag on public.boards;
create trigger boards_guard_tutorial_flag
  before insert or update on public.boards
  for each row execute function public.guard_board_tutorial_flag();

-- -----------------------------------------------------------------------------
-- The space limit ignores the tutorial space
-- -----------------------------------------------------------------------------
create or replace function public.account_space_count(p_owner_id uuid)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.boards b
  where b.owner_id = p_owner_id
    and b.archived_at is null
    and not b.is_tutorial;
$$;

create or replace function public.enforce_space_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max  integer;
  v_used integer;
begin
  -- The practice space never uses up a slot, so it is never refused one.
  if new.is_tutorial then
    return new;
  end if;

  v_max := public.account_max_spaces(new.owner_id);
  if v_max is null then
    return new;
  end if;

  v_used := public.account_space_count(new.owner_id);

  if v_used >= v_max then
    -- Phrased to stay grammatical at a limit of one, which the free plan is.
    -- The app matches on 'space limit reached' and shows a translated
    -- sentence; this text is the fallback if it ever surfaces raw.
    raise exception 'Space limit reached: your plan allows %.', v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- The seeding function
-- -----------------------------------------------------------------------------
create or replace function public.ensure_getting_started()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_locale    text;
  v_started   timestamptz;
  v_tz        constant text := 'Asia/Tashkent';
  v_today     date;
  v_board     uuid;
  v_checklist uuid;
  v_version   uuid;
  g1 uuid; g2 uuid; g3 uuid;
  v_parent    uuid;
  v_schedule  uuid;
  -- Every string, by language. Uzbek and Russian are Claude's translations and
  -- should be read by a native speaker.
  s jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  -- Locked, so a second tab arriving at the same moment waits here and then
  -- sees the timestamp the first one wrote.
  select p.locale, p.getting_started_at
    into v_locale, v_started
    from public.profiles p
   where p.id = v_uid
     for update;

  if not found or v_started is not null then
    return null;
  end if;

  -- Invited into somebody else's space already: no practice space of their own.
  if exists (select 1 from public.board_members bm where bm.user_id = v_uid) then
    update public.profiles set getting_started_at = now() where id = v_uid;
    return null;
  end if;

  s := case v_locale
    when 'uz' then jsonb_build_object(
      'space',  'Boshlash',
      'title',  'Gidlist bilan tanishuv',
      'desc',   'Mashq uchun roʻyxat. Gidlist qanday ishlashini koʻrish uchun uni toʻldiring. Bu maydon hech bir tarifda maydonlar soniga kirmaydi, uni istalgan vaqtda arxivlashingiz mumkin.',
      'g1',     'Asosiy amallar',
      'i1',     'Ushbu bandni belgilang',
      'i1d',    'Katakchani bosing. Gidlist kim va qachon belgilaganini yozib qoʻyadi.',
      'i2',     'Ushbu bandga izoh qoldiring',
      'i2d',    'Band ostiga qisqa izoh yozing va saqlang. Izoh topshirilgan yozuv bilan birga qoladi, tekshiruvchi uni keyin koʻradi.',
      'i3',     'Vazifani bosqichlarga boʻling',
      'i3d',    'Band ichida bosqichlar boʻlishi mumkin — beshtagacha daraja. Ikkala bosqichni belgilang.',
      'i3a',    'Birinchi bosqich',
      'i3b',    'Ikkinchi bosqich',
      'g2',     'Tasdiq',
      'i4',     'Rasm qoʻshing',
      'i4d',    'Rasmga oling yoki tanlang. Oʻz roʻyxatlaringizda rasmni majburiy qilishingiz mumkin — shunda bandni rasmsiz belgilab boʻlmaydi.',
      'i5',     'Fayl biriktiring',
      'i5d',    'Hujjat biriktiring, masalan PDF yoki jadval.',
      'g3',     'Keyingi qadamlar',
      'i6',     'Ushbu roʻyxatni topshiring',
      'i6d',    'Topshirilgan yozuv qulflanadi va oʻzgartirib boʻlmaydi. Uni shu maydonning «Bajarilish» boʻlimida topasiz.',
      'i7',     'Oʻz roʻyxatingizni yarating',
      'i7d',    'Yangi maydon oching, «Nazorat roʻyxatlari» boʻlimida boʻlim va bandlar qoʻshing, eʼlon qiling, soʻng jadval va kim toʻldirishini tanlang. Bandlar joylashuv yoki kun vaqtini ham talab qilishi mumkin.'
    )
    when 'ru' then jsonb_build_object(
      'space',  'Начало работы',
      'title',  'Знакомство с Gidlist',
      'desc',   'Учебный чек-лист. Заполните его, чтобы увидеть, как работает Gidlist. Это пространство не учитывается в лимите ни на одном тарифе, и его можно архивировать в любой момент.',
      'g1',     'Основное',
      'i1',     'Отметьте этот пункт',
      'i1d',    'Нажмите на флажок. Gidlist запишет, кто отметил пункт и когда.',
      'i2',     'Оставьте комментарий к этому пункту',
      'i2d',    'Напишите короткую заметку под пунктом и сохраните её. Комментарий остаётся в записи, и проверяющий увидит его позже.',
      'i3',     'Разбейте задачу на шаги',
      'i3d',    'Внутри пункта могут быть шаги — до пяти уровней. Отметьте оба шага.',
      'i3a',    'Первый шаг',
      'i3b',    'Второй шаг',
      'g2',     'Подтверждение',
      'i4',     'Добавьте фото',
      'i4d',    'Сделайте снимок или выберите готовый. В своих чек-листах фото можно сделать обязательным — тогда пункт нельзя отметить без него.',
      'i5',     'Прикрепите файл',
      'i5d',    'Прикрепите документ, например PDF или таблицу.',
      'g3',     'Что дальше',
      'i6',     'Отправьте этот чек-лист',
      'i6d',    'После отправки запись закрывается и не может быть изменена. Её можно найти в разделе «Выполнение» этого пространства.',
      'i7',     'Создайте свой чек-лист',
      'i7d',    'Создайте новое пространство, в разделе «Чек-листы» добавьте разделы и пункты, опубликуйте, затем выберите расписание и тех, кто заполняет. Пункты также могут требовать местоположение или время суток.'
    )
    else jsonb_build_object(
      'space',  'Getting started',
      'title',  'Getting started with Gidlist',
      'desc',   'A practice checklist. Fill it in to see how Gidlist works. This space does not count toward the space limit on any plan, and you can archive it whenever you like.',
      'g1',     'The basics',
      'i1',     'Tick this item',
      'i1d',    'Tap the box. Gidlist records who ticked it and when.',
      'i2',     'Leave a comment on this item',
      'i2d',    'Write a short note under the item and save it. The comment stays with the record, so whoever reviews it later sees it.',
      'i3',     'Break a task into steps',
      'i3d',    'An item can hold steps, up to five levels deep. Tick both steps.',
      'i3a',    'First step',
      'i3b',    'Second step',
      'g2',     'Proof',
      'i4',     'Add a photo',
      'i4d',    'Take a photo or choose one. On your own checklists a photo can be required, so the item cannot be ticked without one.',
      'i5',     'Attach a file',
      'i5d',    'Attach a document, such as a PDF or a spreadsheet.',
      'g3',     'What comes next',
      'i6',     'Submit this checklist',
      'i6d',    'A submitted record is locked and cannot be changed. You will find it under Compliance in this space.',
      'i7',     'Create your own checklist',
      'i7d',    'Create a new space, add sections and items under Checklists, publish, then choose a schedule and who fills it in. Items can also require a location or a time of day.'
    )
  end;

  -- Only this transaction may set the tutorial flag; see the guard trigger.
  perform set_config('gidlist.seeding_tutorial', 'on', true);

  insert into public.boards (name, owner_id, is_tutorial)
  values (s ->> 'space', v_uid, true)
  returning id into v_board;
  -- boards_add_owner_membership has made the owner an active member.

  insert into public.checklists (board_id, title, description, created_by)
  values (v_board, s ->> 'title', s ->> 'desc', v_uid)
  returning id into v_checklist;
  -- add_initial_checklist_version has made a draft with one section.

  select cv.id into v_version
    from public.checklist_versions cv
   where cv.checklist_id = v_checklist and cv.status = 'draft';

  select g.id into g1
    from public.checklist_groups g
   where g.version_id = v_version
   order by g.position
   limit 1;

  update public.checklist_groups set title = s ->> 'g1' where id = g1;

  insert into public.checklist_groups (version_id, title, position)
  values (v_version, s ->> 'g2', 20) returning id into g2;

  insert into public.checklist_groups (version_id, title, position)
  values (v_version, s ->> 'g3', 30) returning id into g3;

  insert into public.checklist_items (version_id, group_id, title, description, position)
  values (v_version, g1, s ->> 'i1', s ->> 'i1d', 10),
         (v_version, g1, s ->> 'i2', s ->> 'i2d', 20);

  insert into public.checklist_items (version_id, group_id, title, description, position)
  values (v_version, g1, s ->> 'i3', s ->> 'i3d', 30)
  returning id into v_parent;

  insert into public.checklist_items (version_id, group_id, parent_item_id, title, position)
  values (v_version, g1, v_parent, s ->> 'i3a', 10),
         (v_version, g1, v_parent, s ->> 'i3b', 20);

  insert into public.checklist_items (version_id, group_id, title, description, position, photo_enabled)
  values (v_version, g2, s ->> 'i4', s ->> 'i4d', 10, true);

  insert into public.checklist_items (version_id, group_id, title, description, position, file_enabled)
  values (v_version, g2, s ->> 'i5', s ->> 'i5d', 20, true);

  insert into public.checklist_items (version_id, group_id, title, description, position)
  values (v_version, g3, s ->> 'i6', s ->> 'i6d', 10),
         (v_version, g3, s ->> 'i7', s ->> 'i7d', 20);

  update public.checklist_versions
     set status = 'published', published_at = now()
   where id = v_version;

  -- Due today, once, for the person themselves — so it is waiting under
  -- "Fill in" the moment they open the space.
  v_today := (now() at time zone v_tz)::date;

  insert into public.schedules (
    checklist_id, kind, config, start_date, end_date, timezone,
    assignment_mode, created_by
  )
  values (
    v_checklist, 'specific_dates',
    jsonb_build_object('dates', jsonb_build_array(to_char(v_today, 'YYYY-MM-DD'))),
    v_today, v_today, v_tz, 'creator', v_uid
  )
  returning id into v_schedule;

  perform public.materialise_one_schedule(v_schedule, 1);

  update public.profiles set getting_started_at = now() where id = v_uid;

  return v_board;
end;
$$;

revoke execute on function public.ensure_getting_started() from public, anon;
grant execute on function public.ensure_getting_started() to authenticated;

-- -----------------------------------------------------------------------------
-- Deleting an account is not blocked by its practice space
--
-- delete_account() refuses any account that owns a space, because a space holds
-- compliance history. Every new person now owns one, so without this change no
-- new registration — a bot included — could ever be deleted. The practice
-- space holds nothing anybody needs to keep, so it goes with the account. A
-- real space still refuses, exactly as before.
-- -----------------------------------------------------------------------------
create or replace function public.delete_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('accounts') then
    raise exception 'You do not have permission to delete accounts.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot delete the account you are signed in with.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.boards b where b.owner_id = p_user_id and not b.is_tutorial) then
    raise exception 'This account owns a space, which holds compliance history. Remove or transfer the space first.'
      using errcode = 'restrict_violation';
  end if;

  if exists (select 1 from public.platform_grants g where g.user_id = p_user_id) then
    raise exception 'This account holds platform access. Remove that first if you really mean to delete it.'
      using errcode = 'restrict_violation';
  end if;

  -- `boards.owner_id` is `on delete restrict`, so the practice space has to go
  -- first or the delete below is refused.
  delete from public.boards b where b.owner_id = p_user_id and b.is_tutorial;

  delete from auth.users where id = p_user_id;
end;
$$;

comment on function public.delete_account(uuid) is
  'Remove an account that should not exist. Refuses your own account, any account owning a real space, and any account holding platform access. A practice space is removed with the account.';

revoke execute on function public.delete_account(uuid) from public, anon;
grant execute on function public.delete_account(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- STATE CHECK — expect one row: t | t | t | 0
--   has_tutorial_column, has_started_column, has_function,
--   profiles_not_yet_marked (0: every existing person is marked as started)
-- -----------------------------------------------------------------------------
select
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'boards' and column_name = 'is_tutorial')        as has_tutorial_column,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'profiles' and column_name = 'getting_started_at') as has_started_column,
  to_regprocedure('public.ensure_getting_started()') is not null                                         as has_function,
  (select count(*) from public.profiles where getting_started_at is null)                                 as profiles_not_yet_marked;
