import type { BuiltinLocale } from '@/lib/i18n/locale';

/**
 * The page as one argument, told in six moves.
 *
 * WHY IT IS SHAPED LIKE THIS. The previous page said the same thing three
 * times — a problem section, a features section and a how-it-works section, each
 * restating the pitch in a different layout. A reader who understood it the
 * first time was asked to read it twice more.
 *
 * So this is a sequence rather than a stack. Each act moves the argument one
 * step and never re-argues the step before it:
 *
 *   1. nobody can say whether it happened
 *   2. so write it down once
 *   3. and it arrives without anybody remembering
 *   4. it comes back carrying more than a tick
 *   5. and what came back cannot quietly change
 *   6. so the pile of records will answer a question
 *
 * ONE ROOM PER SCENE. The brandbook is explicit: a sentence that serves a
 * warehouse and a finance team at once reaches for a word like "workflow" and
 * stops meaning anything. So every act names exactly one concrete place — a
 * depot, an office at 09:00, a clinic, a month-end close — and the range shows
 * across the page instead of inside any single line. Attendance is here on
 * purpose: it is the case that makes an office reader recognise themselves.
 *
 * NOT IN THE CMS, unlike the surrounding prose. These strings sit inside
 * compositions — timestamps align in columns, rows stagger against each other,
 * a chart is labelled beneath its bars. Editable copy that can break a layout is
 * worse than copy that needs a deploy.
 *
 * Every capability named is checked against the code: five levels of nesting,
 * daily/weekly/monthly recurrence, assignment to the creator or everyone or
 * named people, photo/file/location each separately optional or mandatory, a
 * note on an individual tick, published versions frozen against edits, and an
 * audit log.
 */

export type Act = { eyebrow: string; title: string; body: string };

export type Moment = { time: string; where: string; what: string };

export type TryIt = {
  hint: string;
  title: string;
  schedule: string;
  items: string[];
  counter: string;
  doneLine: string;
  reset: string;
};

/** Strings the shared demo modules need. */
export type DemoCopy = {
  railEmpty: string;
  spaceLabel: string;
  spaceChanged: string;
  ticked: string;
  unticked: string;
  hint: string;
  counter: string;
  submitted: string;
  reset: string;
};

/** Scene 4-9 module labels. */
export type ModuleCopy = {
  spaces: Act;
  depth: Act & { depth: string; maxDepth: string; expanded: string };
  enforce: Act & {
    task: string; submit: string; submitted: string; blockedPrefix: string;
    takePhoto: string; photoTaken: string; attachFile: string; fileAttached: string;
    getLocation: string; locationOn: string;
    rules: string; tryIt: string; blockedEntry: string; passedEntry: string; reset: string;
  };
  when: Act & {
    every: string; daily: string; weekly: string; monthly: string; yearly: string;
    specific: string; next: string; changedEntry: string; months: string[];
    weekdayNames: string[]; pickDays: string; pickDates: string;
  };
  people: Act & {
    assignment: string; everyone: string; specific: string; task: string;
    placeholder: string; add: string; managerView: string; empty: string;
    commentEntry: string; assignmentEntry: string;
  };
  insights: Act & {
    chart: string; weekdays: string[]; today: string; onTime: string;
    missed: string; open: string; compliance: string; insight: string; fromYourTicks: string;
  };
};

export type NarrativeCopy = {
  modules: ModuleCopy;
  demo: DemoCopy;
  /** Scene 3: the mental model, stated against something already understood. */
  frame: Act & { ends: string; returns: string; endsNote: string; returnsNote: string };
  tryIt: TryIt;
  gap: Act & { moments: Moment[]; verdict: string };
  write: Act & {
    checklistName: string;
    nodes: { label: string; depth: number }[];
    depthNote: string;
  };
  arrive: Act & {
    rows: { every: string; at: string; who: string; what: string }[];
    missedNote: string;
  };
  proof: Act & {
    task: string;
    photo: string;
    file: string;
    fileName: string;
    fileMeta: string;
    location: string;
    coords: string;
    note: string;
    noteText: string;
    requiredWord: string;
    optionalWord: string;
  };
  hold: Act & {
    versionLabel: string;
    versionNote: string;
    auditLabel: string;
    auditRows: { who: string; did: string; at: string }[];
  };
  answer: Act & {
    chartLabel: string;
    weekdays: string[];
    stats: { label: string; value: string; tone: 'done' | 'missed' | 'draft' | 'plain' }[];
    insight: string;
  };
};

const en: NarrativeCopy = {
  modules: {
    spaces: {
      eyebrow: '04 · Structure',
      title: 'One space for each thing you actually manage',
      body: 'A company, a branch, a department, a shift, a site. Each gets a space, and everything else lives inside it — checklists, people, records. Switch the sample space above and watch the rest of this page follow it.',
    },
    depth: {
      eyebrow: '05 · Depth',
      title: 'Real procedures are nested. Flat lists lie about the work.',
      body: 'Sections hold tasks, tasks hold sub-tasks, five levels down. Open the branches — the deepest one ends at a photograph, which is where the checking actually happens.',
      depth: 'L',
      maxDepth: 'Five levels is the limit, and this branch uses all of them.',
      expanded: 'Expanded',
    },
    enforce: {
      eyebrow: '06 · Proof',
      title: 'A tick is a claim. This turns it into evidence.',
      body: 'Decide what a task must come back with, then try to submit without it. Photo and location are independent — either can be required while the other is merely recorded, or neither.',
      rules: 'What this task requires',
      task: 'Cold store temperature logged',
      submit: 'Submit',
      submitted: 'Submitted, with everything it asked for.',
      blockedPrefix: 'Cannot submit yet — still missing:',
      takePhoto: 'Take photo',
      photoTaken: 'Photo attached',
      attachFile: 'Attach document',
      fileAttached: 'Document attached',
      getLocation: 'Register location',
      locationOn: 'Location registered',
      tryIt: 'Try submitting without them.',
      blockedEntry: 'Submission refused — missing {missing}',
      passedEntry: 'Submitted with photo and location',
      reset: 'Clear',
    },
    when: {
      eyebrow: '07 · Rhythm',
      title: 'It comes back on its own',
      body: 'Daily, weekly or monthly, at the time you set. Nobody has to remember it, and nobody has to send a reminder.',
      every: 'Repeats',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly',
      specific: 'Specific dates',
      weekdayNames: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
      pickDays: 'On these days',
      pickDates: 'On these dates',
      next: 'Next five',
      changedEntry: 'Recurrence set to {every}',
      months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    },
    people: {
      eyebrow: '08 · People',
      title: 'Everyone in the space, or exactly three people',
      body: 'You choose who a checklist lands on. And the person who fills it in can leave a note on a single task, which is where an exception gets explained — next to the thing it happened to.',
      assignment: 'Goes to',
      everyone: 'Everyone in this space',
      specific: 'Specific people',
      task: 'Note on: Cold store temperature logged',
      placeholder: 'Unit 2 reading one degree high…',
      add: 'Add',
      managerView: 'What the manager sees',
      empty: 'No note on this task yet.',
      commentEntry: 'Note added to a task',
      assignmentEntry: 'Assignment set to {mode}',
    },
    insights: {
      eyebrow: '09 · Payoff',
      title: 'A month of ticks becomes a picture',
      body: 'Every tick carries a name and a time, so the reports show patterns nobody had spotted. The last bar is today — it moves when you tick something in the checklist above.',
      chart: 'Completed on time · last 14 days',
      weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F', 'S'],
      today: 'Now',
      onTime: 'Days on target',
      missed: 'Days below target',
      open: 'Still open today',
      compliance: 'Average',
      insight: 'The dip is a Monday. Nowhere else in the fortnight, and no other weekday — which is the kind of thing a pile of paper never tells you.',
      fromYourTicks: 'The last bar is counted from your ticks.',
    },
  },
  demo: {
    railEmpty: 'Nothing recorded yet. Tick something and it will appear here, with the time.',
    spaceLabel: 'Choose a sample space',
    spaceChanged: 'Switched to {space}',
    ticked: 'Ticked: {task}',
    unticked: 'Un-ticked: {task}',
    hint: 'Go on — tick one.',
    counter: '{done} of {total} done',
    submitted: 'Saved with the time of each tick',
    reset: 'Start again',
  },
  frame: {
    eyebrow: '03 · The idea',
    title: 'Trello for recurring tasks',
    body: 'If you have used a board, you already know most of this. The difference is what happens when a card is finished.',
    ends: 'A board is for work that ends',
    endsNote: 'You make a card, you move it to Done, and that is the last you think about it. Perfect for a launch, a hire, a redesign.',
    returns: 'Gidlist is for work that returns',
    returnsNote: 'Tomorrow the same list is back, empty, waiting for somebody. What you keep is not the card — it is the history of every time it was done.',
  },
  tryIt: {
    hint: 'Go on — tick one.',
    title: 'Opening check · Line 2',
    schedule: 'Every day at 06:00',
    items: ['Fridge temperature logged', 'Guards fitted on both saws', 'Waste bins emptied'],
    counter: '{done} of {total} done',
    doneLine: 'Submitted · every tick saved with its time',
    reset: 'Start again',
  },
  gap: {
    eyebrow: '01 · Monday',
    title: 'Three places, and nobody can say for sure what happened',
    body: 'Nobody here is being careless. The work was almost certainly done — it just did not leave anything behind that still answers the question a week later.',
    moments: [
      { time: '06:00', where: 'Northern Depot', what: 'The line should have been checked before the shift.' },
      { time: '09:15', where: 'Head office', what: 'Fourteen people should have signed in for the day.' },
      { time: '14:00', where: 'Ward 3', what: 'The round should have been completed and countersigned.' },
    ],
    verdict: 'By Friday, all three answers are the same one: probably.',
  },
  write: {
    eyebrow: '02 · Once',
    title: 'So somebody writes it down, once',
    body: 'You group the work into sections, and break any task into smaller ones — up to five levels, if that is what the job takes. It gets written by the person who actually knows how it should be done, and then it stays written.',
    checklistName: 'Daily attendance · Head office',
    depthNote: 'Up to five levels deep',
    nodes: [
      { label: 'Floor 2 — sign-in complete', depth: 0 },
      { label: 'Anyone absent recorded with a reason', depth: 1 },
      { label: 'Cover arranged for absences', depth: 2 },
      { label: 'Floor 3 — sign-in complete', depth: 0 },
      { label: 'Reception staffed from 09:00', depth: 0 },
    ],
  },
  arrive: {
    eyebrow: '03 · Every morning',
    title: 'After that, nobody needs to remember it',
    body: 'The list turns up on its own, daily, weekly or monthly, at the time you choose. You decide who receives it: everyone in the space, a few named people, or whoever created it.',
    rows: [
      { every: 'Every weekday', at: '09:00', who: 'Everyone in this space', what: 'Daily attendance' },
      { every: 'Every Monday', at: '06:00', who: '3 named people', what: 'Line 2 opening check' },
      { every: 'Monthly, 1st', at: '09:00', who: 'The person who created it', what: 'Month-end close' },
    ],
    missedNote: 'And if nobody does it, Gidlist marks it missed by itself — which is the part a group chat was never going to manage.',
  },
  proof: {
    eyebrow: '04 · Back',
    title: 'What comes back is more than a tick',
    body: 'Any task can ask for a photo, a document, or the place it was ticked — and you decide separately whether each one is required or simply offered. Here the photo is required, and the person on shift has added a line about what they saw.',
    task: 'Cold store temperature logged',
    photo: 'Photo',
    file: 'File',
    fileName: 'calibration-cert-4471.pdf',
    fileMeta: '188 KB',
    location: 'Location',
    coords: '40.7821, 72.3442 · ±8 m',
    note: 'Note',
    noteText: 'Unit 2 reading one degree high. Engineer called, due Thursday.',
    requiredWord: 'required',
    optionalWord: 'optional',
  },
  hold: {
    eyebrow: '05 · Later',
    title: 'And none of it changes quietly afterwards',
    body: 'When you publish a checklist, it is fixed. The database itself refuses edits to a published version, so nobody can rewrite a template underneath records already filed against it. Anything that matters is written to an audit log with a name and a time.',
    versionLabel: 'Version 4 · published',
    versionNote: 'Edits refused. Changes go into version 5.',
    auditLabel: 'Audit log',
    auditRows: [
      { who: 'D. Karimova', did: 'published version 4', at: '12 Aug 09:41' },
      { who: 'S. Toshmatov', did: 'changed assignment to 3 named people', at: '12 Aug 09:44' },
      { who: 'System', did: 'marked 2 submissions missed', at: '13 Aug 00:05' },
    ],
  },
  answer: {
    eyebrow: '06 · Ask it',
    title: 'A year of this starts answering questions',
    body: 'Every tick carries a name and a time, so once there are enough of them the reports show patterns nobody had spotted. That is the difference between keeping files and being able to answer a question about them.',
    chartLabel: 'Completed on time · last 14 days',
    weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M', 'T', 'W', 'T', 'F', 'S', 'S'],
    stats: [
      { label: 'Done on time', value: '184', tone: 'done' },
      { label: 'Missed', value: '6', tone: 'missed' },
      { label: 'Still open', value: '2', tone: 'draft' },
      { label: 'Compliance', value: '96%', tone: 'plain' },
    ],
    insight: 'Line 2 misses the 06:00 check on Mondays. Nowhere else, no other day.',
  },
};

const uz: NarrativeCopy = {
  modules: {
    spaces: {
      eyebrow: '04 · Tuzilma',
      title: 'Siz boshqaradigan har bir narsa uchun alohida maydon',
      body: 'Kompaniya, filial, boʻlim, smena yoki obyekt. Har biriga maydon beriladi va qolgan hamma narsa — roʻyxatlar, odamlar, yozuvlar — shu maydon ichida yashaydi. Yuqoridagi namuna maydonini almashtiring va sahifaning qolgan qismi ham oʻzgarishini koʻring.',
    },
    depth: {
      eyebrow: '05 · Chuqurlik',
      title: 'Haqiqiy tartiblar ichma-ich. Tekis roʻyxat ish haqida yolgʻon gapiradi.',
      body: 'Boʻlimlar vazifalarni, vazifalar kichik vazifalarni saqlaydi — besh darajagacha. Shoxlarni oching: eng chuquri surat bilan tugaydi, chunki tekshiruv aynan oʻsha yerda boʻladi.',
      depth: 'D',
      maxDepth: 'Chegara — besh daraja, va bu shox hammasini ishlatadi.',
      expanded: 'Ochilgan',
    },
    enforce: {
      eyebrow: '06 · Isbot',
      title: 'Belgi — bu daʼvo. Bu esa uni dalilga aylantiradi.',
      body: 'Vazifa nima bilan qaytishini belgilang, soʻng usiz yuborishga urinib koʻring. Surat va joylashuv bir-biridan mustaqil — biri majburiy, ikkinchisi shunchaki qayd etilishi mumkin.',
      rules: 'Bu vazifa nimani talab qiladi',
      task: 'Sovuq ombor harorati qayd etildi',
      submit: 'Yuborish',
      submitted: 'Yuborildi — soʻralgan hamma narsa bilan.',
      blockedPrefix: 'Hozircha yuborib boʻlmaydi — yetishmayapti:',
      takePhoto: 'Surat olish',
      photoTaken: 'Surat biriktirildi',
      attachFile: 'Hujjat biriktirish',
      fileAttached: 'Hujjat biriktirildi',
      getLocation: 'Joylashuvni qayd etish',
      locationOn: 'Joylashuv qayd etildi',
      tryIt: 'Ularsiz yuborib koʻring.',
      blockedEntry: 'Yuborish rad etildi — {missing} yetishmaydi',
      passedEntry: 'Surat va joylashuv bilan yuborildi',
      reset: 'Tozalash',
    },
    when: {
      eyebrow: '07 · Ritm',
      title: 'U oʻzi qaytib keladi',
      body: 'Kunlik, haftalik yoki oylik — siz belgilagan vaqtda. Hech kim eslashi ham, eslatma yuborishi ham shart emas.',
      every: 'Takrorlanadi',
      daily: 'Kunlik',
      weekly: 'Haftalik',
      monthly: 'Oylik',
      yearly: 'Yillik',
      specific: 'Aniq sanalar',
      weekdayNames: ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
      pickDays: 'Shu kunlarda',
      pickDates: 'Shu sanalarda',
      next: 'Keyingi beshtasi',
      changedEntry: 'Takrorlanish {every} qilib belgilandi',
      months: ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'],
    },
    people: {
      eyebrow: '08 · Odamlar',
      title: 'Maydondagi hamma yoki aynan uch kishi',
      body: 'Roʻyxat kimga tushishini siz tanlaysiz. Toʻldirgan odam esa bitta vazifaga izoh qoldirishi mumkin — istisno aynan oʻzi sodir boʻlgan joyda tushuntiriladi.',
      assignment: 'Kimga boradi',
      everyone: 'Bu maydondagi hamma',
      specific: 'Tanlangan kishilar',
      task: 'Izoh: Sovuq ombor harorati qayd etildi',
      placeholder: '2-qurilma bir daraja yuqori koʻrsatmoqda…',
      add: 'Qoʻshish',
      managerView: 'Rahbar nimani koʻradi',
      empty: 'Bu vazifada hali izoh yoʻq.',
      commentEntry: 'Vazifaga izoh qoʻshildi',
      assignmentEntry: 'Biriktirish {mode} qilib belgilandi',
    },
    insights: {
      eyebrow: '09 · Natija',
      title: 'Bir oylik belgilar manzaraga aylanadi',
      body: 'Har bir belgi ism va vaqtni saqlaydi, shuning uchun hisobotlar hech kim sezmagan qonuniyatlarni koʻrsatadi. Oxirgi ustun — bugun; yuqoridagi roʻyxatda biror narsani belgilasangiz, u oʻzgaradi.',
      chart: 'Oʻz vaqtida bajarilgan · soʻnggi 14 kun',
      weekdays: ['D', 'S', 'C', 'P', 'J', 'S', 'Y', 'D', 'S', 'C', 'P', 'J', 'S'],
      today: 'Hozir',
      onTime: 'Meʼyordagi kunlar',
      missed: 'Meʼyordan past kunlar',
      open: 'Bugun ochiq',
      compliance: 'Oʻrtacha',
      insight: 'Pasayish — dushanba kuni. Ikki haftada boshqa hech qayerda va boshqa hech qaysi kunda emas — qogʻoz uyumi buni hech qachon aytmaydi.',
      fromYourTicks: 'Oxirgi ustun sizning belgilaringizdan hisoblangan.',
    },
  },
  demo: {
    railEmpty: 'Hozircha hech narsa qayd etilmagan. Birortasini belgilang — u vaqti bilan shu yerda paydo boʻladi.',
    spaceLabel: 'Namuna maydonini tanlang',
    spaceChanged: '{space} ga oʻtildi',
    ticked: 'Belgilandi: {task}',
    unticked: 'Belgi olindi: {task}',
    hint: 'Sinab koʻring — bittasini belgilang.',
    counter: '{total} tadan {done} tasi bajarildi',
    submitted: 'Har bir belgi vaqti bilan saqlandi',
    reset: 'Qaytadan boshlash',
  },
  frame: {
    eyebrow: '03 · Gʻoya',
    title: 'Takrorlanuvchi ishlar uchun Trello',
    body: 'Agar doskadan foydalanganingiz boʻlsa, buning koʻp qismini bilasiz. Farq — karta tugagandan keyin nima boʻlishida.',
    ends: 'Doska tugaydigan ishlar uchun',
    endsNote: 'Karta yaratasiz, uni Bajarildi ga koʻchirasiz va boshqa oʻylamaysiz. Ishga tushirish, xodim yollash yoki qayta dizayn uchun juda mos.',
    returns: 'Gidlist qaytadigan ishlar uchun',
    returnsNote: 'Ertaga oʻsha roʻyxat yana boʻsh holda qaytadi va kimnidir kutadi. Sizda qoladigan narsa karta emas — u har safar qanday bajarilgani tarixi.',
  },
  tryIt: {
    hint: 'Sinab koʻring — bittasini belgilang.',
    title: 'Ochilish tekshiruvi · 2-liniya',
    schedule: 'Har kuni soat 06:00 da',
    items: [
      'Muzlatgich harorati qayd etildi',
      'Ikkala arrada himoya oʻrnatilgan',
      'Chiqindi idishlari boʻshatildi',
    ],
    counter: '{total} tadan {done} tasi bajarildi',
    doneLine: 'Yuborildi · har bir belgi vaqti bilan saqlandi',
    reset: 'Qaytadan boshlash',
  },
  gap: {
    eyebrow: '01 · Dushanba',
    title: 'Uch joy, va nima boʻlganini hech kim aniq ayta olmaydi',
    body: 'Bu yerda hech kim beparvolik qilgani yoʻq. Ish deyarli aniq bajarilgan — faqat bir hafta oʻtib berilgan savolga javob beradigan hech narsa qolmagan.',
    moments: [
      { time: '06:00', where: 'Shimoliy ombor', what: 'Smenadan oldin liniya tekshirilishi kerak edi.' },
      { time: '09:15', where: 'Bosh ofis', what: 'Oʻn toʻrt kishi ish kunini qayd etishi kerak edi.' },
      { time: '14:00', where: '3-boʻlim', what: 'Aylanma yakunlanib, imzolanishi kerak edi.' },
    ],
    verdict: 'Juma kuniga borib uchala savolga ham bitta javob qoladi: ehtimol.',
  },
  write: {
    eyebrow: '02 · Bir marta',
    title: 'Shuning uchun kimdir buni bir marta yozib qoʻyadi',
    body: 'Ishni boʻlimlarga ajrating va kerak boʻlsa har bir vazifani besh daraja chuqurlikda kichik vazifalarga boʻling. Buni qanday bajarilishini biladigan odam bir marta yozadi.',
    checklistName: 'Kunlik davomat · Bosh ofis',
    depthNote: 'Besh darajagacha',
    nodes: [
      { label: '2-qavat — qayd etish tugadi', depth: 0 },
      { label: 'Kelmaganlar sababi bilan qayd etildi', depth: 1 },
      { label: 'Oʻrniga xodim tayinlandi', depth: 2 },
      { label: '3-qavat — qayd etish tugadi', depth: 0 },
      { label: 'Qabulxona 09:00 dan ishlaydi', depth: 0 },
    ],
  },
  arrive: {
    eyebrow: '03 · Har tongda',
    title: 'Shundan keyin buni hech kim eslab yurishi shart emas',
    body: 'U kerakli odamlarga kerakli vaqtda oʻzi keladi — kunlik, haftalik yoki oylik — va kim bajarishi kerak boʻlsa oʻshanga boradi: maydondagi hammaga, tanlangan kishilarga yoki uni yozgan odamga.',
    rows: [
      { every: 'Har ish kuni', at: '09:00', who: 'Bu maydondagi hamma', what: 'Kunlik davomat' },
      { every: 'Har dushanba', at: '06:00', who: '3 ta tanlangan kishi', what: '2-liniya ochilish tekshiruvi' },
      { every: 'Oylik, 1-sana', at: '09:00', who: 'Uni yaratgan kishi', what: 'Oy yakuni' },
    ],
    missedNote: 'Hech kim bajarmagani tizimning oʻzi tomonidan oʻtkazib yuborilgan deb belgilanadi. Guruh chatining qoʻlidan kelmaydigan narsa shu.',
  },
  proof: {
    eyebrow: '04 · Qaytadi',
    title: 'Qaytadigan narsa shunchaki belgi emas',
    body: 'Vazifa surat, hujjat yoki belgilangan joyni soʻrashi mumkin — va ularning har biri alohida ixtiyoriy yoki majburiy. Muzlatgichga surat kerak; qayd etayotgan odam koʻrganini bir qatorda yozib qoʻyishi mumkin.',
    task: 'Sovuq ombor harorati qayd etildi',
    photo: 'Surat',
    file: 'Fayl',
    fileName: 'kalibrlash-sert-4471.pdf',
    fileMeta: '188 KB',
    location: 'Joylashuv',
    coords: '40.7821, 72.3442 · ±8 m',
    note: 'Izoh',
    noteText: '2-qurilma bir daraja yuqori koʻrsatmoqda. Muhandis chaqirildi, payshanbaga.',
    requiredWord: 'majburiy',
    optionalWord: 'ixtiyoriy',
  },
  hold: {
    eyebrow: '05 · Keyinroq',
    title: 'Va keyin ularning hech biri jimgina oʻzgarmaydi',
    body: 'Nazorat roʻyxatini eʼlon qilish uni qotiradi — maʼlumotlar bazasi eʼlon qilingan versiyaga tahrirni rad etadi, shuning uchun unga asoslangan yozuvlar ostidan shablonni qayta yozib boʻlmaydi. Muhim hamma narsa audit jurnaliga yoziladi.',
    versionLabel: '4-versiya · eʼlon qilingan',
    versionNote: 'Tahrir rad etiladi. Oʻzgarishlar 5-versiyaga tushadi.',
    auditLabel: 'Audit jurnali',
    auditRows: [
      { who: 'D. Karimova', did: '4-versiyani eʼlon qildi', at: '12-avg 09:41' },
      { who: 'S. Toshmatov', did: 'biriktirishni 3 kishiga oʻzgartirdi', at: '12-avg 09:44' },
      { who: 'Tizim', did: '2 ta topshiriqni oʻtkazib yuborilgan deb belgiladi', at: '13-avg 00:05' },
    ],
  },
  answer: {
    eyebrow: '06 · Soʻrang',
    title: 'Bir yillik shunday yozuv savollarga javob bera boshlaydi',
    body: 'Har bir belgi kim va qachon ekanini saqlaydi. Sanab chiqilganda yozuvlar hech kim sezmagan qonuniyatni koʻrsatadi — fayllarga ega boʻlish bilan javob bera olish orasidagi farq shu.',
    chartLabel: 'Oʻz vaqtida bajarilgan · soʻnggi 14 kun',
    weekdays: ['D', 'S', 'C', 'P', 'J', 'S', 'Y', 'D', 'S', 'C', 'P', 'J', 'S', 'Y'],
    stats: [
      { label: 'Oʻz vaqtida', value: '184', tone: 'done' },
      { label: 'Oʻtkazib yuborilgan', value: '6', tone: 'missed' },
      { label: 'Ochiq', value: '2', tone: 'draft' },
      { label: 'Muvofiqlik', value: '96%', tone: 'plain' },
    ],
    insight: '2-liniya dushanba kunlari 06:00 tekshiruvini oʻtkazib yuboradi. Boshqa joyda ham, boshqa kunda ham emas.',
  },
};

const ru: NarrativeCopy = {
  modules: {
    spaces: {
      eyebrow: '04 · Структура',
      title: 'Отдельное пространство для каждого, чем вы управляете',
      body: 'Компания, филиал, отдел, смена или объект. У каждого своё пространство, а всё остальное — чек-листы, люди, записи — живёт внутри него. Переключите демо-пространство выше и посмотрите, как за ним пойдёт вся страница.',
    },
    depth: {
      eyebrow: '05 · Глубина',
      title: 'Реальные процедуры вложены. Плоские списки врут о работе.',
      body: 'Разделы содержат задачи, задачи — подзадачи, до пяти уровней. Откройте ветки: самая глубокая заканчивается фотографией — именно там и происходит проверка.',
      depth: 'У',
      maxDepth: 'Предел — пять уровней, и эта ветка использует все.',
      expanded: 'Раскрыто',
    },
    enforce: {
      eyebrow: '06 · Подтверждение',
      title: 'Отметка — это утверждение. Здесь она становится доказательством.',
      body: 'Укажите, с чем задача должна вернуться, а потом попробуйте отправить без этого. Фото и локация независимы — любое может быть обязательным, пока второе просто записывается.',
      rules: 'Что требует эта задача',
      task: 'Температура холодного склада записана',
      submit: 'Отправить',
      submitted: 'Отправлено — со всем, что требовалось.',
      blockedPrefix: 'Пока нельзя отправить — не хватает:',
      takePhoto: 'Сделать фото',
      photoTaken: 'Фото приложено',
      attachFile: 'Приложить документ',
      fileAttached: 'Документ приложен',
      getLocation: 'Зафиксировать локацию',
      locationOn: 'Локация зафиксирована',
      tryIt: 'Попробуйте отправить без них.',
      blockedEntry: 'Отправка отклонена — нет {missing}',
      passedEntry: 'Отправлено с фото и локацией',
      reset: 'Очистить',
    },
    when: {
      eyebrow: '07 · Ритм',
      title: 'Он возвращается сам',
      body: 'Ежедневно, еженедельно или ежемесячно — в заданное время. Никому не нужно помнить и никому не нужно напоминать.',
      every: 'Повторяется',
      daily: 'Ежедневно',
      weekly: 'Еженедельно',
      monthly: 'Ежемесячно',
      yearly: 'Ежегодно',
      specific: 'Конкретные даты',
      weekdayNames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      pickDays: 'В эти дни',
      pickDates: 'В эти числа',
      next: 'Следующие пять',
      changedEntry: 'Повтор установлен: {every}',
      months: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    },
    people: {
      eyebrow: '08 · Люди',
      title: 'Все в пространстве или ровно три человека',
      body: 'Вы выбираете, кому попадёт чек-лист. А тот, кто его заполняет, может оставить примечание к одной задаче — исключение объясняется рядом с тем, где оно случилось.',
      assignment: 'Кому уходит',
      everyone: 'Все в этом пространстве',
      specific: 'Названные люди',
      task: 'Примечание к: Температура холодного склада записана',
      placeholder: 'Установка 2 показывает на градус выше…',
      add: 'Добавить',
      managerView: 'Что видит руководитель',
      empty: 'Примечаний к этой задаче пока нет.',
      commentEntry: 'К задаче добавлено примечание',
      assignmentEntry: 'Назначение: {mode}',
    },
    insights: {
      eyebrow: '09 · Результат',
      title: 'Месяц отметок складывается в картину',
      body: 'Каждая отметка хранит имя и время, поэтому отчёты показывают закономерности, которых никто не замечал. Последний столбец — сегодня; он двигается, когда вы отмечаете задачу выше.',
      chart: 'Выполнено вовремя · последние 14 дней',
      weekdays: ['П', 'В', 'С', 'Ч', 'П', 'С', 'В', 'П', 'В', 'С', 'Ч', 'П', 'С'],
      today: 'Сейчас',
      onTime: 'Дней в норме',
      missed: 'Дней ниже нормы',
      open: 'Открыто сегодня',
      compliance: 'Среднее',
      insight: 'Провал — это понедельник. Больше нигде за две недели и ни в какой другой день — стопка бумаг такого не скажет.',
      fromYourTicks: 'Последний столбец посчитан по вашим отметкам.',
    },
  },
  demo: {
    railEmpty: 'Пока ничего не записано. Отметьте что-нибудь — и это появится здесь со временем.',
    spaceLabel: 'Выберите демо-пространство',
    spaceChanged: 'Переключено на: {space}',
    ticked: 'Отмечено: {task}',
    unticked: 'Отметка снята: {task}',
    hint: 'Попробуйте — отметьте одну.',
    counter: 'Выполнено {done} из {total}',
    submitted: 'Сохранено со временем каждой отметки',
    reset: 'Начать заново',
  },
  frame: {
    eyebrow: '03 · Идея',
    title: 'Trello для повторяющихся задач',
    body: 'Если вы работали с доской, большая часть вам знакома. Разница — в том, что происходит после завершения карточки.',
    ends: 'Доска — для работы, которая заканчивается',
    endsNote: 'Вы создаёте карточку, переносите её в «Готово» и больше о ней не думаете. Отлично для запуска, найма или редизайна.',
    returns: 'Gidlist — для работы, которая возвращается',
    returnsNote: 'Завтра тот же список вернётся пустым и будет ждать. У вас остаётся не карточка, а история каждого раза, когда это было сделано.',
  },
  tryIt: {
    hint: 'Попробуйте — отметьте одну.',
    title: 'Проверка при открытии · Линия 2',
    schedule: 'Каждый день в 06:00',
    items: [
      'Температура холодильника записана',
      'Защита установлена на обеих пилах',
      'Мусорные баки опорожнены',
    ],
    counter: 'Выполнено {done} из {total}',
    doneLine: 'Отправлено · каждая отметка сохранена со временем',
    reset: 'Начать заново',
  },
  gap: {
    eyebrow: '01 · Понедельник',
    title: 'Три места, и никто не может точно сказать, что произошло',
    body: 'Никто здесь не халтурит. Работу почти наверняка сделали — просто после неё не осталось ничего, что через неделю ответит на вопрос.',
    moments: [
      { time: '06:00', where: 'Северный склад', what: 'Линию должны были проверить до смены.' },
      { time: '09:15', where: 'Головной офис', what: 'Четырнадцать человек должны были отметиться.' },
      { time: '14:00', where: 'Отделение 3', what: 'Обход должен был быть завершён и подписан.' },
    ],
    verdict: 'К пятнице все три ответа сводятся к одному: наверное.',
  },
  write: {
    eyebrow: '02 · Один раз',
    title: 'Поэтому кто-то записывает это — один раз',
    body: 'Вы группируете работу по разделам и дробите любую задачу на более мелкие — до пяти уровней, если этого требует дело. Записывает тот, кто действительно знает, как должно быть сделано, и дальше это остаётся записанным.',
    checklistName: 'Ежедневная явка · Головной офис',
    depthNote: 'До пяти уровней',
    nodes: [
      { label: 'Этаж 2 — отметки собраны', depth: 0 },
      { label: 'Отсутствующие записаны с причиной', depth: 1 },
      { label: 'Замена организована', depth: 2 },
      { label: 'Этаж 3 — отметки собраны', depth: 0 },
      { label: 'Ресепшн работает с 09:00', depth: 0 },
    ],
  },
  arrive: {
    eyebrow: '03 · Каждое утро',
    title: 'Дальше об этом никому не нужно помнить',
    body: 'Список приходит сам — ежедневно, еженедельно или ежемесячно, в выбранное вами время. Вы решаете, кто его получит: все в пространстве, несколько названных человек или тот, кто его создал.',
    rows: [
      { every: 'По будням', at: '09:00', who: 'Все в этом пространстве', what: 'Ежедневная явка' },
      { every: 'По понедельникам', at: '06:00', who: '3 названных человека', what: 'Проверка линии 2' },
      { every: 'Ежемесячно, 1-го', at: '09:00', who: 'Тот, кто создал', what: 'Закрытие месяца' },
    ],
    missedNote: 'А если никто не сделает, Gidlist сам отметит это как пропущенное — именно с этим групповой чат никогда не справлялся.',
  },
  proof: {
    eyebrow: '04 · Возвращается',
    title: 'Возвращается не просто отметка',
    body: 'Любая задача может запросить фото, документ или место отметки — и вы отдельно решаете, что обязательно, а что просто предлагается. Здесь фото обязательно, а сотрудник на смене добавил строку о том, что увидел.',
    task: 'Температура холодного склада записана',
    photo: 'Фото',
    file: 'Файл',
    fileName: 'sertifikat-poverki-4471.pdf',
    fileMeta: '188 КБ',
    location: 'Локация',
    coords: '40.7821, 72.3442 · ±8 м',
    note: 'Примечание',
    noteText: 'Установка 2 показывает на градус выше. Инженер вызван, приедет в четверг.',
    requiredWord: 'обязательно',
    optionalWord: 'по желанию',
  },
  hold: {
    eyebrow: '05 · Потом',
    title: 'И потом ничто из этого не меняется незаметно',
    body: 'После публикации чек-лист зафиксирован. Сама база данных отклоняет правки опубликованной версии, поэтому шаблон нельзя переписать под уже поданными записями. Всё важное попадает в журнал аудита — с именем и временем.',
    versionLabel: 'Версия 4 · опубликована',
    versionNote: 'Правки отклоняются. Изменения уходят в версию 5.',
    auditLabel: 'Журнал аудита',
    auditRows: [
      { who: 'Д. Каримова', did: 'опубликовала версию 4', at: '12 авг 09:41' },
      { who: 'С. Тошматов', did: 'сменил назначение на 3 человек', at: '12 авг 09:44' },
      { who: 'Система', did: 'отметила 2 отчёта пропущенными', at: '13 авг 00:05' },
    ],
  },
  answer: {
    eyebrow: '06 · Спросите',
    title: 'Год таких записей начинает отвечать на вопросы',
    body: 'Каждая отметка хранит, кто и когда. Посчитанные записи показывают закономерность, которой никто не замечал, — в этом разница между «есть файлы» и «можем ответить».',
    chartLabel: 'Выполнено вовремя · последние 14 дней',
    weekdays: ['П', 'В', 'С', 'Ч', 'П', 'С', 'В', 'П', 'В', 'С', 'Ч', 'П', 'С', 'В'],
    stats: [
      { label: 'Вовремя', value: '184', tone: 'done' },
      { label: 'Пропущено', value: '6', tone: 'missed' },
      { label: 'Открыто', value: '2', tone: 'draft' },
      { label: 'Соответствие', value: '96%', tone: 'plain' },
    ],
    insight: 'Линия 2 пропускает проверку в 06:00 по понедельникам. Больше нигде и ни в один другой день.',
  },
};

export const NARRATIVE: Record<BuiltinLocale, NarrativeCopy> = { en, uz, ru };

/**
 * Completion per day for the chart, as percentages.
 *
 * One copy, shared by every language: the numbers do not change with the label,
 * and three copies would be three chances to drift. The single trough is the
 * Monday the insight sentence names, so the picture and the claim agree.
 */
export const COMPLETION_BY_DAY = [96, 98, 94, 97, 99, 92, 95, 61, 97, 96, 98, 94, 93, 97];

/** Index of the bar the insight calls out. */
export const FAILING_BAR = 7;
