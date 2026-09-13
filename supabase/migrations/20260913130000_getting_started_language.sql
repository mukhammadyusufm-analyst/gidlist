-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- In production, run gidlist-migration-getting-started.txt FIRST, then this.
-- =============================================================================
-- The guided start is written in the language the person is looking at.
--
-- The first version read `profiles.locale`, and every new profile says English:
-- the sign-up page's language switcher sets a browser cookie and nothing more,
-- while the app shows whatever the cookie says. So somebody who signed up in
-- Uzbek saw the app in Uzbek and got a tutorial in English.
--
-- Now the app passes the language it is actually showing, the tutorial is
-- written in that, and the same language is saved on the profile so it follows
-- the person to another device. Anything other than en, uz or ru is ignored and
-- the profile's language is used, as before.
--
-- The old no-argument function is dropped rather than left beside the new one:
-- two functions of the same name make the app's call ambiguous.
-- =============================================================================

begin;

drop function if exists public.ensure_getting_started();

create or replace function public.ensure_getting_started(p_locale text default null)
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

  -- The language on the person's screen wins over the profile. A new profile
  -- always says English, because nothing at sign-up writes a language to it:
  -- choosing Uzbek on the sign-up page sets only the browser's cookie. The app
  -- passes the language it is actually showing, so the tutorial matches it.
  if p_locale in ('en', 'uz', 'ru') then
    v_locale := p_locale;
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

  -- The language is saved too, so it follows the person to their next device
  -- instead of that device opening in English.
  update public.profiles
     set getting_started_at = now(),
         locale = coalesce(v_locale, locale)
   where id = v_uid;

  return v_board;
end;
$$;

revoke execute on function public.ensure_getting_started(text) from public, anon;
grant execute on function public.ensure_getting_started(text) to authenticated;

commit;

notify pgrst, 'reload schema';

-- STATE CHECK — expect one row: t | f
--   new_function (takes a language), old_function (no argument, now gone)
select
  to_regprocedure('public.ensure_getting_started(text)') is not null as new_function,
  to_regprocedure('public.ensure_getting_started()')     is not null as old_function;
