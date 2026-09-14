-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- In production, run in order: gidlist-migration-getting-started.txt,
-- gidlist-migration-getting-started-language.txt, then this.
-- =============================================================================
-- The guided start shows what an item can be set to do, and looks like Gidlist.
--
-- Feedback on the first version: it never showed that an item's photo, file,
-- location and time window can each be turned on, and that each can also be made
-- REQUIRED so the tick is refused without it. Those settings are the product's
-- whole point — a checklist that proves the work — so the tutorial now shows
-- both states side by side:
--
--   * a photo that is required (the tick is refused until one is attached),
--   * a file that is only offered,
--   * a location that is only recorded, and
--   * a time window (09:00–18:00) that is only recorded,
--
-- each with a line saying how to make it required on your own items. Location
-- and time stay "recorded only" on purpose: enforced, they would refuse the tick
-- depending on where and when somebody happens to open the tutorial. The pinned
-- place is central Tashkent with a 300 m radius; since it is only recorded, the
-- tick works anywhere.
--
-- It also gets the Gidlist mark as the space's logo and the checklist's picture
-- (`/icon-512.png`, which the app already serves), and the Harbour banner, a
-- built-in gradient that needs no uploaded file.
--
-- Only accounts created after this runs get the new version. Existing practice
-- spaces are left as they are — they belong to the people who have them.
-- =============================================================================

begin;

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
  v_logo      constant text := '/icon-512.png';
  v_banner    constant text := 'preset:harbour';
  v_today     date;
  v_board     uuid;
  v_checklist uuid;
  v_version   uuid;
  g1 uuid; g2 uuid; g3 uuid; g4 uuid;
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

  -- The language on the person's screen wins over the profile's, which says
  -- English for every new account.
  if p_locale in ('en', 'uz', 'ru') then
    v_locale := p_locale;
  end if;

  -- Invited into somebody else's space already: no practice space of their own.
  if exists (select 1 from public.board_members bm where bm.user_id = v_uid) then
    update public.profiles
       set getting_started_at = now(),
           locale = coalesce(v_locale, locale)
     where id = v_uid;
    return null;
  end if;

  s := case v_locale
    when 'uz' then jsonb_build_object(
      'space', 'Boshlash',
      'title', 'Gidlist bilan tanishuv',
      'desc',  'Mashq uchun roʻyxat. Gidlist qanday ishlashini koʻrish uchun uni toʻldiring. Bu maydon hech bir tarifda maydonlar soniga kirmaydi, uni istalgan vaqtda arxivlashingiz mumkin.',
      'g1',  'Asosiy amallar',
      'i1',  'Ushbu bandni belgilang',
      'i1d', 'Katakchani bosing. Gidlist kim va qachon belgilaganini yozib qoʻyadi.',
      'i2',  'Ushbu bandga izoh qoldiring',
      'i2d', 'Band ostiga qisqa izoh yozing va saqlang. Izoh topshirilgan yozuv bilan birga qoladi, tekshiruvchi uni keyin koʻradi.',
      'i3',  'Vazifani bosqichlarga boʻling',
      'i3d', 'Band ichida bosqichlar boʻlishi mumkin — beshtagacha daraja. Ikkala bosqichni belgilang.',
      'i3a', 'Birinchi bosqich',
      'i3b', 'Ikkinchi bosqich',
      'g2',  'Tasdiq',
      'i4',  'Rasm qoʻshing — bu band uchun majburiy',
      'i4d', 'Avval belgilab koʻring: rasm biriktirilmaguncha belgi qabul qilinmaydi. Oʻz roʻyxatlaringizda har bir bandda rasm sozlamasi bor — rasm soʻrash uchun uni yoqing, talab qilish uchun majburiy qiling.',
      'i5',  'Fayl biriktiring — bu yerda ixtiyoriy',
      'i5d', 'Fayl biriktirish yoqilgan, lekin majburiy emas, shuning uchun bandni faylsiz ham belgilash mumkin. Fayllar rasm kabi ishlaydi: yoqilgan yoki yoqilgan va majburiy.',
      'g4',  'Qayerda va qachon',
      'i8',  'Qayerda bajarilganini yozib qoʻying',
      'i8d', 'Belgilaganingizda, qurilmangiz ruxsat bersa, joylashuvingiz saqlanadi. Bu yerda u faqat yozib olinadi. Oʻz bandlaringizda xaritada joy va radiusni belgilab, uni majburiy qilishingiz mumkin — shunda radiusdan tashqarida belgi qabul qilinmaydi.',
      'i9',  '09:00 dan 18:00 gacha bajaring',
      'i9d', 'Bu bandda faqat yozib olinadigan vaqt oraligʻi bor: yozuvda band shu oraliq ichida belgilangan-belgilanmagani koʻrinadi. Oraliqni majburiy qilsangiz, undan tashqarida belgi qabul qilinmaydi.',
      'g3',  'Keyingi qadamlar',
      'i6',  'Ushbu roʻyxatni topshiring',
      'i6d', 'Topshirilgan yozuv qulflanadi va oʻzgartirib boʻlmaydi. Uni shu maydonning «Bajarilish» boʻlimida topasiz.',
      'i7',  'Oʻz roʻyxatingizni yarating',
      'i7d', 'Yangi maydon oching, «Nazorat roʻyxatlari» boʻlimida boʻlim va bandlar qoʻshing, eʼlon qiling, soʻng jadval va kim toʻldirishini tanlang. Istalgan bandni ochib, rasm, fayl, joylashuv yoki vaqt oraligʻini yoqishingiz va har birini majburiy qilishingiz mumkin.'
    )
    when 'ru' then jsonb_build_object(
      'space', 'Начало работы',
      'title', 'Знакомство с Gidlist',
      'desc',  'Учебный чек-лист. Заполните его, чтобы увидеть, как работает Gidlist. Это пространство не учитывается в лимите ни на одном тарифе, и его можно архивировать в любой момент.',
      'g1',  'Основное',
      'i1',  'Отметьте этот пункт',
      'i1d', 'Нажмите на флажок. Gidlist запишет, кто отметил пункт и когда.',
      'i2',  'Оставьте комментарий к этому пункту',
      'i2d', 'Напишите короткую заметку под пунктом и сохраните её. Комментарий остаётся в записи, и проверяющий увидит его позже.',
      'i3',  'Разбейте задачу на шаги',
      'i3d', 'Внутри пункта могут быть шаги — до пяти уровней. Отметьте оба шага.',
      'i3a', 'Первый шаг',
      'i3b', 'Второй шаг',
      'g2',  'Подтверждение',
      'i4',  'Добавьте фото — здесь оно обязательно',
      'i4d', 'Сначала попробуйте отметить пункт: отметка не принимается, пока не прикреплено фото. В своих чек-листах у каждого пункта есть настройка фото — включите её, чтобы предложить фото, и сделайте обязательной, чтобы его требовать.',
      'i5',  'Прикрепите файл — здесь по желанию',
      'i5d', 'Прикрепление файла включено, но не обязательно, поэтому пункт можно отметить и без файла. Файлы работают так же, как фото: включено или включено и обязательно.',
      'g4',  'Где и когда',
      'i8',  'Запишите, где это выполнено',
      'i8d', 'При отметке сохраняется ваше местоположение, если устройство это разрешает. Здесь оно только записывается. В своих пунктах можно указать место на карте с радиусом и сделать его обязательным — тогда отметка за пределами радиуса не принимается.',
      'i9',  'Выполните с 09:00 до 18:00',
      'i9d', 'У этого пункта есть временное окно, которое только записывается: в записи видно, отмечен ли пункт внутри него. Сделайте окно обязательным — и отметка вне его не принимается.',
      'g3',  'Что дальше',
      'i6',  'Отправьте этот чек-лист',
      'i6d', 'После отправки запись закрывается и не может быть изменена. Её можно найти в разделе «Выполнение» этого пространства.',
      'i7',  'Создайте свой чек-лист',
      'i7d', 'Создайте новое пространство, в разделе «Чек-листы» добавьте разделы и пункты, опубликуйте, затем выберите расписание и тех, кто заполняет. Откройте любой пункт, чтобы включить фото, файл, местоположение или временное окно и сделать каждое из них обязательным.'
    )
    else jsonb_build_object(
      'space', 'Getting started',
      'title', 'Getting started with Gidlist',
      'desc',  'A practice checklist. Fill it in to see how Gidlist works. This space does not count toward the space limit on any plan, and you can archive it whenever you like.',
      'g1',  'The basics',
      'i1',  'Tick this item',
      'i1d', 'Tap the box. Gidlist records who ticked it and when.',
      'i2',  'Leave a comment on this item',
      'i2d', 'Write a short note under the item and save it. The comment stays with the record, so whoever reviews it later sees it.',
      'i3',  'Break a task into steps',
      'i3d', 'An item can hold steps, up to five levels deep. Tick both steps.',
      'i3a', 'First step',
      'i3b', 'Second step',
      'g2',  'Proof',
      'i4',  'Add a photo — required here',
      'i4d', 'Try ticking it first: the tick is refused until a photo is attached. In your own checklists every item has a photo setting — turn it on to offer a photo, and make it required to demand one.',
      'i5',  'Attach a file — optional here',
      'i5d', 'Attaching a file is turned on but not required, so you can tick this without one. Files work the same way as photos: on, or on and required.',
      'g4',  'Where and when',
      'i8',  'Record where this was done',
      'i8d', 'Ticking this saves your location, if your device allows it. Here it is only recorded. On your own items you can pin a place on the map with a radius and make it required — then a tick outside that radius is refused.',
      'i9',  'Do this between 09:00 and 18:00',
      'i9d', 'This item has a time window that is only recorded: the record shows whether it was ticked inside it. Make a window required and a tick outside it is refused.',
      'g3',  'What comes next',
      'i6',  'Submit this checklist',
      'i6d', 'A submitted record is locked and cannot be changed. You will find it under Compliance in this space.',
      'i7',  'Create your own checklist',
      'i7d', 'Create a new space, add sections and items under Checklists, publish, then choose a schedule and who fills it in. Open any item to turn on a photo, a file, a location or a time window, and to make each one required.'
    )
  end;

  -- Only this transaction may set the tutorial flag; see the guard trigger.
  perform set_config('gidlist.seeding_tutorial', 'on', true);

  insert into public.boards (name, owner_id, is_tutorial, logo_url, banner_url)
  values (s ->> 'space', v_uid, true, v_logo, v_banner)
  returning id into v_board;
  -- boards_add_owner_membership has made the owner an active member.

  insert into public.checklists (board_id, title, description, created_by, avatar_url, banner_url)
  values (v_board, s ->> 'title', s ->> 'desc', v_uid, v_logo, v_banner)
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
  values (v_version, s ->> 'g4', 30) returning id into g4;

  insert into public.checklist_groups (version_id, title, position)
  values (v_version, s ->> 'g3', 40) returning id into g3;

  -- The basics
  insert into public.checklist_items (version_id, group_id, title, description, position)
  values (v_version, g1, s ->> 'i1', s ->> 'i1d', 10),
         (v_version, g1, s ->> 'i2', s ->> 'i2d', 20);

  insert into public.checklist_items (version_id, group_id, title, description, position)
  values (v_version, g1, s ->> 'i3', s ->> 'i3d', 30)
  returning id into v_parent;

  insert into public.checklist_items (version_id, group_id, parent_item_id, title, position)
  values (v_version, g1, v_parent, s ->> 'i3a', 10),
         (v_version, g1, v_parent, s ->> 'i3b', 20);

  -- Proof: one required, one only offered.
  insert into public.checklist_items
    (version_id, group_id, title, description, position, photo_enabled, photo_required)
  values (v_version, g2, s ->> 'i4', s ->> 'i4d', 10, true, true);

  insert into public.checklist_items
    (version_id, group_id, title, description, position, file_enabled, file_required)
  values (v_version, g2, s ->> 'i5', s ->> 'i5d', 20, true, false);

  -- Where and when: both recorded, neither enforced.
  insert into public.checklist_items
    (version_id, group_id, title, description, position,
     location_enabled, location_required, location_lat, location_lng, location_radius_m)
  values (v_version, g4, s ->> 'i8', s ->> 'i8d', 10,
          true, false, 41.311081, 69.240562, 300);

  insert into public.checklist_items
    (version_id, group_id, title, description, position,
     window_enabled, window_required, window_start, window_end)
  values (v_version, g4, s ->> 'i9', s ->> 'i9d', 20,
          true, false, time '09:00', time '18:00');

  -- What comes next
  insert into public.checklist_items (version_id, group_id, title, description, position)
  values (v_version, g3, s ->> 'i6', s ->> 'i6d', 10),
         (v_version, g3, s ->> 'i7', s ->> 'i7d', 20);

  update public.checklist_versions
     set status = 'published', published_at = now()
   where id = v_version;

  -- Due today, once, for the person themselves.
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

  -- The language is saved too, so it follows the person to their next device.
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

-- STATE CHECK — expect one row: t | t
--   has_function, shows_settings (the new function body pins a location)
select
  to_regprocedure('public.ensure_getting_started(text)') is not null as has_function,
  pg_get_functiondef('public.ensure_getting_started(text)'::regprocedure) like '%location_radius_m%' as shows_settings;
