import type { BuiltinLocale } from './i18n';

/**
 * Site copy, in the three languages the product ships in.
 *
 * WHY THIS IS IN `core` RATHER THAN IN `apps/site`: the marketing site renders
 * it, but the product's admin screen has to edit it, and an editor that cannot
 * show the string it is overriding is not much of an editor. Two copies of this
 * catalogue would drift the first time either was touched. It is plain data
 * with no React and no Next import, so it meets the bar for this package.
 *
 * Kept in the bundle rather than the database on purpose, and only for now:
 * Phase C moves editable content into Supabase so it can be changed without a
 * deploy. What stays here afterwards is the structural furniture — navigation,
 * button labels, the footer — which changes when the site is rebuilt, not when
 * somebody writes a blog post.
 *
 * The three taglines are not translations of each other. English gives an
 * instruction; Uzbek and Russian give a promise, because the imperative does
 * not carry the same weight in either. Each is built from the word its own
 * language already uses for a finished record — `Done`, `Bajarilgan`,
 * `Выполнено` — so the site and the product say the same thing in the same
 * words. See the brandbook before changing any of them.
 *
 * Two brandbook rules shape the rest of the copy:
 *
 *   - **Name one room, not both.** The product serves a warehouse and a finance
 *     team. Any single sentence picks one and says `opening check` or
 *     `month-end close`; the range shows across the page, never inside a line
 *     hedged into meaninglessness.
 *   - **Say the number.** `5 members` beats `small teams`.
 */

/** A step in the attendance walkthrough: narration plus the phone's caption. */
type WalkStep = { title: string; body: string; caption: string };

/** A use case, and the one line that says what it enforces. */
type UseCase = { name: string; what: string; enforced: string };

/**
 * One question and its answer.
 *
 * `visible` lets an administrator hide a single item with one tick, without
 * losing the text they wrote — which is the difference between hiding something
 * and deleting it. A blank question also drops the item, which is how an unused
 * slot stays out of the way.
 */
type Faq = { q: string; a: string; visible: Visible };

/**
 * Whether something optional is drawn: `yes` or `no`.
 *
 * A string, not a boolean, because the CMS stores string overrides — but the
 * editor renders any key ending in `visible` as a checkbox, so nobody has to
 * type the word. `no` hides; anything else shows, which means a typo fails
 * safe by leaving the content on the page rather than silently removing it.
 */
type Visible = string;

/**
 * Russian noun forms after a numeral.
 *
 * Russian has three: 1 takes one form, 2–4 another, 5 and above a third — and
 * it is not a matter of size, since 21 behaves like 1 and 15 like 5. Writing
 * `n === 1 ? a : b` produced "2 пространств", which is simply wrong.
 *
 * `Intl.PluralRules` already encodes the rule, so it is used rather than
 * reimplemented. Uzbek and English do not need this: Uzbek does not inflect the
 * noun after a numeral at all, and English has the two forms everyone expects.
 */
const ruPlural = new Intl.PluralRules('ru');

function ru(n: number, one: string, few: string, many: string): string {
  const form = ruPlural.select(n);
  if (form === 'one') return `${n} ${one}`;
  if (form === 'few') return `${n} ${few}`;
  return `${n} ${many}`;
}

export type SiteMessages = {
  /** Used as the `<html lang>` value and in hreflang alternates. */
  htmlLang: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;

  // Navigation
  navHow: string;
  navPricing: string;
  navFaq: string;
  navSignIn: string;
  navMenu: string;
  skipToContent: string;

  // Hero
  headline: string;
  subhead: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaNote: string;




  // Pricing
  pricingEyebrow: string;
  pricingTitle: string;
  pricingLead: string;
  pricingPerMonth: string;
  pricingFree: string;
  pricingMembers: (n: number) => string;
  pricingSpaces: (n: number) => string;
  pricingIncluded: string;
  pricingCta: string;
  pricingCtaFree: string;
  pricingPopular: string;
  pricingNote: string;


  // Scene 3 — the mental model
  frameEyebrow: string;
  frameTitle: string;
  frameLead: string;
  frameEndsTitle: string;
  frameEndsBody: string;
  frameReturnsTitle: string;
  frameReturnsBody: string;

  // Scenes 4-9 — one capability each
  spacesEyebrow: string;
  spacesTitle: string;
  spacesLead: string;
  depthEyebrow: string;
  depthTitle: string;
  depthLead: string;
  depthNote: string;
  proofEyebrow: string;
  proofTitle: string;
  proofLead: string;
  rhythmEyebrow: string;
  rhythmTitle: string;
  rhythmLead: string;
  peopleEyebrow: string;
  peopleTitle: string;
  peopleLead: string;
  insightsEyebrow: string;
  insightsTitle: string;
  insightsLead: string;
  insightsCaption: string;

  // Scene 10 — the flagship walkthrough
  walkEyebrow: string;
  walkTitle: string;
  walkLead: string;
  walkSteps: [WalkStep, WalkStep, WalkStep, WalkStep, WalkStep];

  // Scene 11 — the other rooms
  casesEyebrow: string;
  casesTitle: string;
  casesLead: string;
  casesEnforced: string;
  cases: [UseCase, UseCase, UseCase, UseCase];

  // Traction. Editable figures, and hideable until there are any.
  tractionVisible: Visible;
  tractionLabel: string;
  tractionNote: string;
  tractionSpacesLabel: string;
  tractionSpacesValue: string;
  tractionSubmissionsLabel: string;
  tractionSubmissionsValue: string;
  tractionMembersLabel: string;
  tractionMembersValue: string;

  // Scene 13 — objections. Eight slots; blank a question to drop that item.
  faqVisible: Visible;
  faqEyebrow: string;
  faqTitle: string;
  faqLead: string;
  faqItems: [Faq, Faq, Faq, Faq, Faq, Faq, Faq, Faq];

  // Scene 14 — the close
  closeTitle: string;
  closeBody: string;

  // Footer
  footerProduct: string;
  footerAccount: string;
  footerLegal: string;
  footerCompany: string;
  footerNote: string;
  footerRights: string;
  footerLanguage: string;
};

export const MESSAGES: Record<BuiltinLocale, SiteMessages> = {
  en: {
    htmlLang: 'en',
    tagline: 'Get it done.',
    metaTitle: 'Gidlist — checklists to help you get things done',
    metaDescription:
      'Recurring checklists for work that has to be done and shown — attendance, opening checks, safety rounds. Gidlist schedules them, sends them to the right people, and keeps a clear record with photos, files and times.',

    navHow: 'How it works',
    navPricing: 'Pricing',
    navFaq: 'Questions',
    navSignIn: 'Sign in',
    navMenu: 'Menu',
    skipToContent: 'Skip to content',

    headline: 'Checklists to help you get things done',
    subhead:
      'The morning sign-in at the office. The opening check on a shop floor. The month-end close in finance. Gidlist sends the right list to the right person at the right time, and keeps a clear record of what was done.',
    ctaPrimary: 'Start free',
    ctaSecondary: 'See how it works',
    ctaNote: 'Free for 5 people. No card required.',

    pricingEyebrow: 'Pricing',
    pricingTitle: 'You pay for the people who actually do the work',
    pricingLead:
      'You pay for the people who actually need access to do the work. Each person counts once no matter how many of your spaces they belong to, and only while their access is active \u2014 remove somebody and they stop counting.',
    pricingPerMonth: '/month',
    pricingFree: 'Free',
    pricingMembers: (n) => `Up to ${n} people`,
    pricingSpaces: (n) => (n === 1 ? '1 space' : `${n} spaces`),
    pricingIncluded: 'Checklists and compliance reporting included on every plan.',
    pricingCta: 'Choose plan',
    pricingCtaFree: 'Start free',
    pricingPopular: 'Most chosen',
    pricingNote:
      'Prices in US dollars. Local payment in Uzbek som through Payme and Click is coming.',

    footerNote: 'Built in Uzbekistan.',
    footerRights: 'All rights reserved.',
    frameEyebrow: '01 \u00b7 The idea',
    frameTitle: 'Trello for recurring tasks',
    frameLead:
      'For running a team, the two feel much the same \u2014 lists, tasks, who is doing what, and a clear view of where things stand. The difference shows up with work that comes back.',
    frameEndsTitle: 'A Kanban style board is for work that ends',
    frameEndsBody:
      'You make a card, it moves across, and once it reaches Done you stop thinking about it. That is exactly right for a launch, a hire or a redesign.',
    frameReturnsTitle: 'Gidlist is for work that returns',
    frameReturnsBody:
      'Tomorrow the same list is back, empty, waiting for whoever is on shift. What builds up is not a column of finished cards but a history of every time it was done, and by whom.',

    spacesEyebrow: '02 \u00b7 Structure',
    spacesTitle: 'A space for the team, checklists for the work',
    spacesLead:
      'Most companies need one space, or a handful \u2014 a branch, a site, a department. Inside it you can write as many checklists as the work has kinds: opening and closing, weekly cleaning, monthly counts, daily attendance. Grouping by task rather than by unit is what keeps it manageable as you grow.',

    depthEyebrow: '03 \u00b7 Depth',
    depthTitle: 'Real procedures are nested, and flat lists hide that',
    depthLead:
      'Sections hold tasks, and any task can hold its own sub-tasks, five levels down. Open the branches below \u2014 the deepest one ends at a photograph, which is where the checking actually happens.',
    depthNote: 'Five levels is the limit, and this branch uses all of them.',

    proofEyebrow: '04 \u00b7 Proof',
    proofTitle: 'A tick is a claim. This turns it into evidence.',
    proofLead:
      'Decide what a task has to come back with \u2014 a photo, a document, the place it was ticked \u2014 then try to submit without it. Each of the three is set separately, so a photo can be required while a file is merely offered.',

    rhythmEyebrow: '05 \u00b7 Rhythm',
    rhythmTitle: 'It comes back on its own',
    rhythmLead:
      'Every day, on the weekdays you pick, on chosen days of the month, once a year, or on a list of specific dates. Set it once and nobody has to remember it again.',

    peopleEyebrow: '06 \u00b7 People',
    peopleTitle: 'Everyone in the space, or exactly the people who should',
    peopleLead:
      'You choose who a checklist lands on. And whoever fills it in can leave a note on a single task, so an exception gets explained next to the thing it happened to \u2014 not in a message somebody has to go looking for.',

    insightsEyebrow: '07 \u00b7 Payoff',
    insightsTitle: 'A month of ticks becomes a picture',
    insightsLead:
      'Every tick carries a name and a time, so the reports show patterns nobody had spotted. The last bar is today, and it moves when you tick something in the checklist at the top of this page.',
    insightsCaption: 'The last bar is counted from your ticks.',

    walkEyebrow: '08 \u00b7 One morning',
    walkTitle: 'Clock-in, verified',
    walkLead:
      'Attendance is where a signature on paper has always been worth least. Follow one employee through one morning \u2014 the whole flow, in five steps.',
    walkSteps: [
      {
        title: 'She opens the space',
        body: 'Head office, on her phone. Everything her branch runs lives in that one space, so there is nothing to search for.',
        caption: 'Head office',
      },
      {
        title: "Today's list is already waiting",
        body: 'Daily attendance is there without anybody sending it. It repeats on weekdays at 09:00, and it will keep arriving whether or not anyone remembers.',
        caption: 'Daily attendance \u00b7 09:00',
      },
      {
        title: 'She ticks the task and gives what it asks for',
        body: 'This one wants a photo, the shift sheet as a file, and the place it was ticked. The camera opens from the task itself, the file is picked in the same step, and the location is read at that moment \u2014 all before the tick counts.',
        caption: 'Photo \u00b7 File \u00b7 Location',
      },
      {
        title: 'Submit, with the time it happened',
        body: 'The tick is saved against 09:04 \u2014 when she ticked it, not when it uploaded and not when somebody typed it up afterwards.',
        caption: 'Submitted 09:04',
      },
      {
        title: "The manager's view updates",
        body: 'Fourteen people, thirteen in, one still open \u2014 visible without asking anybody, and countable at the end of the month.',
        caption: '13/14 signed in',
      },
    ],

    casesEyebrow: '09 \u00b7 Elsewhere',
    casesTitle: 'Same shape, different room',
    casesLead: 'Anywhere work repeats and somebody has to show it happened.',
    casesEnforced: 'What gets enforced',
    cases: [
      {
        name: 'Retail opening and closing',
        what: 'The routine that decides whether the doors open on time.',
        enforced: 'Photo of the floor, location at the branch',
      },
      {
        name: 'Food safety and hygiene',
        what: 'Temperature logs and cleaning schedules an inspector will ask for.',
        enforced: 'Photo of every reading, certificates as files',
      },
      {
        name: 'Equipment maintenance rounds',
        what: 'Scheduled checks on machinery, with the detail nested under each machine.',
        enforced: 'Photo, service sheet as a file, note on anything out of range',
      },
      {
        name: 'Security patrol rounds',
        what: 'The round nobody can prove was walked.',
        enforced: 'Location at each point',
      },
    ],

    tractionVisible: 'no',
    tractionLabel: 'Gidlist so far',
    tractionNote: 'Set these figures in the site content editor, then make the section visible.',
    tractionSpacesLabel: 'Spaces created',
    tractionSpacesValue: '\u2014',
    tractionSubmissionsLabel: 'Checklists submitted',
    tractionSubmissionsValue: '\u2014',
    tractionMembersLabel: 'People using it',
    tractionMembersValue: '\u2014',

    faqVisible: 'yes',
    faqEyebrow: '10 \u00b7 Before you ask',
    faqTitle: 'The questions worth asking us',
    faqLead: 'The ones that decide whether this works where you work.',
    faqItems: [
      { q: 'Where do the photos, files and locations end up?', a: 'In your space, visible to the people you have put there and to nobody else. Files and photos sit in private storage reachable only through short-lived links, and access is enforced by the database itself rather than only by the app \u2014 so a fault on one screen cannot expose another company\u2019s records. Our infrastructure providers operate outside Uzbekistan, so your data may be stored abroad. If that matters for your obligations, talk to us before you put regulated records in.', visible: 'yes' },
      { q: 'Is it lawful to record where an employee ticked something?', a: 'That depends on where you are and what you have told your staff, and we are not the right people to advise you on it. What we can tell you is what the product does: location is captured only on tasks where you switched it on, only at the moment of the tick, and never in the background \u2014 the app cannot read a position while it is closed. Tell your team what is being collected before you turn it on.', visible: 'yes' },
      { q: 'What happens when there is no signal?', a: 'Right now ticking needs a connection, so a basement or a cold store will stop somebody mid-list. Offline filling with a queue of pending writes is being built and is not finished. We would rather tell you that than have you find out on a shift.', visible: 'yes' },
      { q: 'Does it need an app from the store?', a: 'No. It runs in the browser on any modern phone and can be added to the home screen, so there is nothing to install and nothing for IT to approve. The camera, the file picker and location all work from there.', visible: 'yes' },
      { q: 'How long does it take to set up?', a: 'A first checklist takes a few minutes. Moving a paper or spreadsheet routine across takes about as long as typing it once \u2014 there is no import, and for most routines retyping is quicker than mapping a spreadsheet would have been.', visible: 'yes' },
      { q: 'Which languages, and how many people?', a: 'English, Uzbek and Russian, and an administrator can add another language and translate it without waiting for a release. The free plan covers five people; larger teams and longer storage of photos and files are what the paid plans buy.', visible: 'yes' },
      { q: '', a: '', visible: 'yes' },
      { q: '', a: '', visible: 'yes' },
    ],

    closeTitle: 'Start with one checklist',
    closeBody:
      'Pick the routine you most often have to vouch for, and write it down once. Free for five people, and no card.',

    footerProduct: 'Product',
    footerAccount: 'Account',
    footerLegal: 'Legal',
    footerCompany: 'Gidlist is a product of UNUMIS LTD.',
    footerLanguage: 'Language',
  },

  uz: {
    htmlLang: 'uz',
    tagline: 'Hammasi bajariladi!',
    metaTitle: 'Gidlist — ishlaringizni oxiriga yetkazadigan roʻyxatlar',
    metaDescription:
      'Bajarilishi va koʻrsatilishi kerak boʻlgan takrorlanuvchi ishlar uchun roʻyxatlar — davomat, ochilish tekshiruvlari, xavfsizlik aylanishlari. Gidlist ularni rejalashtiradi, kerakli odamlarga yuboradi va surat, fayl hamda vaqt bilan aniq yozuv saqlaydi.',

    navHow: 'Qanday ishlaydi',
    navPricing: 'Narxlar',
    navFaq: 'Savollar',
    navSignIn: 'Kirish',
    navMenu: 'Menyu',
    skipToContent: 'Asosiy qismga oʻtish',

    headline: 'Ishlaringizni oxiriga yetkazadigan roʻyxatlar',
    subhead:
      'Ofisdagi ertalabki davomat. Sexdagi ochilish tekshiruvi. Moliyadagi oy yakuni. Gidlist kerakli roʻyxatni kerakli odamga kerakli vaqtda yuboradi va nima bajarilganini aniq yozib boradi.',
    ctaPrimary: 'Bepul boshlash',
    ctaSecondary: 'Qanday ishlashini koʻrish',
    ctaNote: '5 kishi uchun bepul. Karta talab qilinmaydi.',

    pricingEyebrow: 'Narxlar',
    pricingTitle: 'Ishni haqiqatan bajaradigan odamlar uchun to\u02bblaysiz',
    pricingLead:
      'Siz ishni bajarish uchun haqiqatan kirish huquqi kerak boʻlgan odamlar uchun toʻlaysiz. Har bir odam nechta maydoningizda boʻlishidan qatʼiy nazar bir marta sanaladi va faqat kirish huquqi faol boʻlgan vaqtda — kimnidir oʻchirsangiz, u sanalmay qoʻyadi.',
    pricingPerMonth: '/oyiga',
    pricingFree: 'Bepul',
    pricingMembers: (n) => `${n} kishigacha`,
    pricingSpaces: (n) => `${n} ta makon`,
    pricingIncluded: 'Roʻyxatlar va hisobotlar barcha tariflarga kiradi.',
    pricingCta: 'Tarifni tanlash',
    pricingCtaFree: 'Bepul boshlash',
    pricingPopular: 'Koʻp tanlanadi',
    pricingNote:
      'Narxlar AQSh dollarida. Payme va Click orqali soʻmda toʻlov tez orada.',

    footerNote: 'Oʻzbekistonda yaratilgan.',
    footerRights: 'Barcha huquqlar himoyalangan.',
    frameEyebrow: '01 \u00b7 G\u02bboya',
    frameTitle: 'Takrorlanuvchi ishlar uchun Trello',
    frameLead:
      'Jamoani boshqarish nuqtai nazaridan ikkisi bir-biriga juda o\u02bbxshaydi \u2014 ro\u02bbyxatlar, vazifalar, kim nima qilayotgani va ishlar qay ahvolda ekani. Farq esa qaytib keladigan ishlarda ko\u02bbrinadi.',
    frameEndsTitle: 'Kanban uslubidagi doska tugaydigan ishlar uchun',
    frameEndsBody:
      'Karta yaratasiz, u ustunlar bo\u02bbylab siljiydi va \u201cBajarildi\u201dga yetgach, siz u haqda o\u02bbylashni bas qilasiz. Ishga tushirish, xodim yollash yoki qayta dizayn uchun bu aynan to\u02bbg\u02bbri yondashuv.',
    frameReturnsTitle: 'Gidlist qaytib keladigan ishlar uchun',
    frameReturnsBody:
      'Ertaga o\u02bbsha ro\u02bbyxat yana bo\u02bbsh holda qaytadi va smenadagi odamni kutadi. To\u02bbplanadigan narsa tugallangan kartalar ustuni emas \u2014 u har safar kim va qanday bajargani tarixi.',

    spacesEyebrow: '02 \u00b7 Tuzilma',
    spacesTitle: 'Jamoa uchun maydon, ish uchun ro\u02bbyxatlar',
    spacesLead:
      'Ko\u02bbpchilik kompaniyaga bitta maydon yoki bir nechtasi yetadi \u2014 filial, obyekt yoki bo\u02bblim. Uning ichida esa ish qancha turga bo\u02bblinsa, shuncha ro\u02bbyxat yozishingiz mumkin: ochilish va yopilish, haftalik tozalash, oylik sanoq, kunlik davomat. Bo\u02bblinmalar bo\u02bbyicha emas, vazifa turlari bo\u02bbyicha guruhlash o\u02bbsganda ham boshqaruvni yengil saqlaydi.',

    depthEyebrow: '03 \u00b7 Chuqurlik',
    depthTitle: 'Haqiqiy tartiblar ichma-ich, tekis ro\u02bbyxat esa buni yashiradi',
    depthLead:
      'Bo\u02bblimlar vazifalarni saqlaydi, har bir vazifa esa o\u02bbz kichik vazifalariga ega bo\u02bblishi mumkin \u2014 besh darajagacha. Quyidagi shoxlarni oching: eng chuquri surat bilan tugaydi, chunki tekshiruv aynan o\u02bbsha yerda bo\u02bbladi.',
    depthNote: 'Chegara \u2014 besh daraja, va bu shox hammasini ishlatadi.',

    proofEyebrow: '04 \u00b7 Isbot',
    proofTitle: 'Belgi \u2014 bu da\u02bcvo. Bu esa uni dalilga aylantiradi.',
    proofLead:
      'Vazifa nima bilan qaytishini belgilang \u2014 surat, hujjat yoki belgilangan joy \u2014 so\u02bbng usiz yuborishga urinib ko\u02bbring. Uchalasi alohida sozlanadi: surat majburiy bo\u02bblib, fayl shunchaki taklif etilishi mumkin.',

    rhythmEyebrow: '05 \u00b7 Ritm',
    rhythmTitle: 'U o\u02bbzi qaytib keladi',
    rhythmLead:
      'Har kuni, siz tanlagan hafta kunlarida, oyning belgilangan sanalarida, yiliga bir marta yoki aniq sanalar ro\u02bbyxati bo\u02bbyicha. Bir marta sozlaysiz \u2014 keyin hech kim eslab yurishi shart emas.',

    peopleEyebrow: '06 \u00b7 Odamlar',
    peopleTitle: 'Maydondagi hamma yoki aynan kerakli odamlar',
    peopleLead:
      'Ro\u02bbyxat kimga tushishini siz tanlaysiz. To\u02bbldirgan odam esa bitta vazifaga izoh qoldirishi mumkin \u2014 shunda istisno kimdir izlab yuradigan xabarda emas, aynan o\u02bbzi sodir bo\u02bblgan joyda tushuntiriladi.',

    insightsEyebrow: '07 \u00b7 Natija',
    insightsTitle: 'Bir oylik belgilar manzaraga aylanadi',
    insightsLead:
      'Har bir belgi ism va vaqtni saqlaydi, shuning uchun hisobotlar hech kim sezmagan qonuniyatlarni ko\u02bbrsatadi. Oxirgi ustun \u2014 bugun; sahifaning yuqorisidagi ro\u02bbyxatda biror narsani belgilasangiz, u o\u02bbzgaradi.',
    insightsCaption: 'Oxirgi ustun sizning belgilaringizdan hisoblangan.',

    walkEyebrow: '08 \u00b7 Bir tong',
    walkTitle: 'Tasdiqlangan davomat',
    walkLead:
      'Davomat \u2014 qog\u02bbozdagi imzo eng kam qiymatga ega bo\u02bblgan holat. Bitta xodimning bitta tongini kuzating: butun jarayon besh qadamda.',
    walkSteps: [
      {
        title: 'U maydonni ochadi',
        body: 'Telefonida Bosh ofisni ochadi. Filiali bajaradigan hamma narsa shu bitta maydonda, shuning uchun hech narsa qidirish kerak emas.',
        caption: 'Bosh ofis',
      },
      {
        title: 'Bugungi ro\u02bbyxat allaqachon kutmoqda',
        body: 'Kunlik davomat hech kim yubormasdan joyida turadi. U ish kunlari 09:00 da takrorlanadi va kimdir eslaydimi yo\u02bbqmi \u2014 baribir keladi.',
        caption: 'Kunlik davomat \u00b7 09:00',
      },
      {
        title: 'Vazifani belgilaydi va so\u02bbralganini beradi',
        body: 'Bu vazifa surat, fayl ko\u02bbrinishidagi smena varaqasi va belgilangan joyni so\u02bbraydi. Kamera vazifaning o\u02bbzidan ochiladi, fayl o\u02bbsha qadamda tanlanadi, joylashuv esa o\u02bbsha payt o\u02bbqiladi \u2014 hammasi belgi hisobga o\u02bbtishidan oldin.',
        caption: 'Surat \u00b7 Fayl \u00b7 Joylashuv',
      },
      {
        title: 'Sodir bo\u02bblgan vaqti bilan yuboradi',
        body: 'Belgi 09:04 ga yoziladi \u2014 u belgilagan payt, yuklangan vaqt emas va keyinroq kimdir kiritgan vaqt ham emas.',
        caption: 'Yuborildi 09:04',
      },
      {
        title: 'Rahbar ko\u02bbrinishi yangilanadi',
        body: 'O\u02bbn to\u02bbrt kishi, o\u02bbn uchtasi keldi, bittasi ochiq \u2014 hech kimdan so\u02bbramasdan ko\u02bbrinadi va oy oxirida sanab chiqiladi.',
        caption: '13/14 qayd etdi',
      },
    ],

    casesEyebrow: '09 \u00b7 Boshqa joylarda',
    casesTitle: 'O\u02bbsha shakl, boshqa xona',
    casesLead: 'Ish takrorlanadigan va uni bajarilganini ko\u02bbrsatish kerak bo\u02bblgan har qanday joyda.',
    casesEnforced: 'Nima talab qilinadi',
    cases: [
      {
        name: 'Do\u02bbkon ochilishi va yopilishi',
        what: 'Eshiklar o\u02bbz vaqtida ochilishini hal qiladigan tartib.',
        enforced: 'Zal surati, filialdagi joylashuv',
      },
      {
        name: 'Oziq-ovqat xavfsizligi va gigiyena',
        what: 'Nazoratchi so\u02bbraydigan harorat jurnallari va tozalash jadvallari.',
        enforced: 'Har bir ko\u02bbrsatkich surati, sertifikatlar fayl sifatida',
      },
      {
        name: 'Uskunalarga texnik xizmat',
        what: 'Rejali ko\u02bbriklar, har bir mashina ostida batafsil tartib bilan.',
        enforced: 'Surat, xizmat varaqasi fayli, chetlashishga izoh',
      },
      {
        name: 'Qorovul aylanishlari',
        what: 'Hech kim bajarilganini isbotlay olmaydigan aylanish.',
        enforced: 'Har bir nuqtadagi joylashuv',
      },
    ],

    tractionVisible: 'no',
    tractionLabel: 'Gidlist bugungi kunda',
    tractionNote: 'Bu raqamlarni sayt kontenti tahririda kiriting, so\u02bbng bo\u02bblimni ko\u02bbrinadigan qiling.',
    tractionSpacesLabel: 'Yaratilgan maydonlar',
    tractionSpacesValue: '\u2014',
    tractionSubmissionsLabel: 'Yuborilgan ro\u02bbyxatlar',
    tractionSubmissionsValue: '\u2014',
    tractionMembersLabel: 'Foydalanayotgan odamlar',
    tractionMembersValue: '\u2014',

    faqVisible: 'yes',
    faqEyebrow: '10 \u00b7 Savol berishdan oldin',
    faqTitle: 'Bizga berishga arziydigan savollar',
    faqLead: 'Bu sizning ish joyingizda ishlaydimi \u2014 shuni hal qiladigan savollar.',
    faqItems: [
      { q: 'Suratlar, fayllar va joylashuv qayerga tushadi?', a: 'Sizning maydoningizga \u2014 siz kiritgan odamlarga ko\u02bbrinadi, boshqa hech kimga emas. Fayllar va suratlar yopiq xotirada saqlanadi va faqat qisqa muddatli havolalar orqali ochiladi; kirish esa faqat ilova darajasida emas, ma\u02bclumotlar bazasining o\u02bbzida cheklanadi \u2014 shuning uchun bitta ekrandagi xato boshqa kompaniyaning yozuvlarini ocha olmaydi. Provayderlarimiz infratuzilmasi O\u02bbzbekistondan tashqarida ishlaydi, ya\u02bcni ma\u02bclumot chet elda saqlanishi mumkin. Bu sizning majburiyatlaringizga ta\u02bcsir qilsa, tartibga solinadigan yozuvlarni joylashdan oldin biz bilan gaplashing.', visible: 'yes' },
      { q: 'Xodim qayerda belgilaganini yozib olish qonuniymi?', a: 'Bu siz qayerda ekanligingizga va xodimlaringizga nima deganingizga bog\u02bbliq, va bu bo\u02bbyicha maslahat beradigan odam biz emasmiz. Mahsulot nima qilishini aytishimiz mumkin: joylashuv faqat siz yoqqan vazifalarda, faqat belgilangan payt olinadi va hech qachon fonda emas \u2014 ilova yopiq bo\u02bblganda o\u02bbrningizni o\u02bbqiy olmaydi. Yoqishdan oldin jamoangizga nima to\u02bbplanishini ayting.', visible: 'yes' },
      { q: 'Aloqa bo\u02bblmasa nima bo\u02bbladi?', a: 'Hozircha belgilash uchun aloqa kerak, shuning uchun yerto\u02bbla yoki sovuq ombor odamni ro\u02bbyxat o\u02bbrtasida to\u02bbxtatadi. Oflayn to\u02bbldirish va kutilayotgan yozuvlar navbati ishlab chiqilmoqda, hali tugallanmagan. Buni smena paytida bilib olishingizdan ko\u02bbra, aytganimiz ma\u02bcqul.', visible: 'yes' },
      { q: 'Do\u02bbkondan ilova yuklash kerakmi?', a: 'Yo\u02bbq. U har qanday zamonaviy telefonning brauzerida ishlaydi va bosh ekranga qo\u02bbshiladi \u2014 o\u02bbrnatadigan ham, IT bo\u02bblimidan tasdiqlatadigan ham narsa yo\u02bbq. Kamera, fayl tanlash va joylashuv o\u02bbsha yerdan ishlaydi.', visible: 'yes' },
      { q: 'Sozlash qancha vaqt oladi?', a: 'Birinchi ro\u02bbyxat bir necha daqiqa. Qog\u02bboz yoki jadvaldagi tartibni ko\u02bbchirish uni bir marta yozib chiqish qancha vaqt olsa, shuncha vaqt oladi \u2014 import yo\u02bbq, va ko\u02bbpchilik tartiblar uchun qayta yozish jadvalni moslashtirishdan tezroq.', visible: 'yes' },
      { q: 'Qaysi tillar va necha kishi?', a: 'Ingliz, o\u02bbzbek va rus tillari, administrator esa yangi relizni kutmasdan boshqa til qo\u02bbshib, uni tarjima qilishi mumkin. Bepul tarif besh kishini qamrab oladi; kattaroq jamoalar hamda suratlar va fayllarning uzoqroq saqlanishi \u2014 pullik tariflar beradigan narsa.', visible: 'yes' },
      { q: '', a: '', visible: 'yes' },
      { q: '', a: '', visible: 'yes' },
    ],

    closeTitle: 'Bitta ro\u02bbyxatdan boshlang',
    closeBody:
      'Ko\u02bbpincha javob berishingizga to\u02bbg\u02bbri keladigan tartibni tanlang va uni bir marta yozib qo\u02bbying. Besh kishi uchun bepul, karta kerak emas.',

    footerProduct: 'Mahsulot',
    footerAccount: 'Hisob',
    footerLegal: 'Huquqiy',
    footerCompany: 'Gidlist — UNUMIS LTD mahsuloti.',
    footerLanguage: 'Til',
  },

  ru: {
    htmlLang: 'ru',
    tagline: 'Всё будет выполнено!',
    metaTitle: 'Gidlist — чек-листы, которые помогают доводить дела до конца',
    metaDescription:
      'Чек-листы для повторяющейся работы, которую нужно сделать и показать — явка, проверки при открытии, обходы по безопасности. Gidlist планирует их, отправляет нужным людям и ведёт понятную запись с фото, файлами и временем.',

    navHow: 'Как это работает',
    navPricing: 'Цены',
    navFaq: 'Вопросы',
    navSignIn: 'Войти',
    navMenu: 'Меню',
    skipToContent: 'Перейти к содержанию',

    headline: 'Чек-листы, которые помогают доводить дела до конца',
    subhead:
      'Утренняя отметка в офисе. Проверка при открытии цеха. Закрытие месяца в финансах. Gidlist отправляет нужный список нужному человеку в нужное время и ведёт понятную запись сделанного.',
    ctaPrimary: 'Начать бесплатно',
    ctaSecondary: 'Как это работает',
    ctaNote: 'Бесплатно для 5 человек. Карта не нужна.',

    pricingEyebrow: 'Цены',
    pricingTitle: 'Вы платите за тех, кто действительно делает работу',
    pricingLead:
      'Вы платите за тех, кому действительно нужен доступ к работе. Каждый человек считается один раз, в скольких бы ваших пространствах он ни состоял, и только пока его доступ активен — уберите человека, и он перестанет считаться.',

    pricingPerMonth: '/месяц',
    pricingFree: 'Бесплатно',
    // "До" governs the genitive, and after it `человек` is the correct form for
    // every plan size here — so this one does not need the plural helper.
    pricingMembers: (n) => `До ${n} человек`,
    pricingSpaces: (n) => ru(n, 'пространство', 'пространства', 'пространств'),
    pricingIncluded: 'Чек-листы и отчётность входят во все тарифы.',
    pricingCta: 'Выбрать тариф',
    pricingCtaFree: 'Начать бесплатно',
    pricingPopular: 'Выбирают чаще',
    pricingNote:
      'Цены в долларах США. Оплата в сумах через Payme и Click появится позже.',

    footerNote: 'Сделано в Узбекистане.',
    footerRights: 'Все права защищены.',
    frameEyebrow: '01 \u00b7 \u0418\u0434\u0435\u044f',
    frameTitle: 'Trello \u0434\u043b\u044f \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u044e\u0449\u0438\u0445\u0441\u044f \u0437\u0430\u0434\u0430\u0447',
    frameLead:
      '\u0414\u043b\u044f \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u043a\u043e\u043c\u0430\u043d\u0434\u043e\u0439 \u044d\u0442\u043e \u043e\u0447\u0435\u043d\u044c \u043f\u043e\u0445\u043e\u0436\u0438\u0435 \u0432\u0435\u0449\u0438 \u2014 \u0441\u043f\u0438\u0441\u043a\u0438, \u0437\u0430\u0434\u0430\u0447\u0438, \u043a\u0442\u043e \u0447\u0435\u043c \u0437\u0430\u043d\u044f\u0442 \u0438 \u043f\u043e\u043d\u044f\u0442\u043d\u0430\u044f \u043a\u0430\u0440\u0442\u0438\u043d\u0430 \u0441\u043e\u0441\u0442\u043e\u044f\u043d\u0438\u044f \u0434\u0435\u043b. \u0420\u0430\u0437\u043d\u0438\u0446\u0430 \u043f\u043e\u044f\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u0442\u0430\u043c, \u0433\u0434\u0435 \u0440\u0430\u0431\u043e\u0442\u0430 \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044f.',
    frameEndsTitle: '\u0414\u043e\u0441\u043a\u0430 \u0432 \u0441\u0442\u0438\u043b\u0435 Kanban \u2014 \u0434\u043b\u044f \u0440\u0430\u0431\u043e\u0442\u044b, \u043a\u043e\u0442\u043e\u0440\u0430\u044f \u0437\u0430\u043a\u0430\u043d\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044f',
    frameEndsBody:
      '\u0412\u044b \u0441\u043e\u0437\u0434\u0430\u0451\u0442\u0435 \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0443, \u043e\u043d\u0430 \u0434\u0432\u0438\u0436\u0435\u0442\u0441\u044f \u043f\u043e \u043a\u043e\u043b\u043e\u043d\u043a\u0430\u043c, \u0430 \u0434\u043e\u0439\u0434\u044f \u0434\u043e \u00ab\u0413\u043e\u0442\u043e\u0432\u043e\u00bb \u043f\u0435\u0440\u0435\u0441\u0442\u0430\u0451\u0442 \u0432\u0430\u0441 \u0437\u0430\u043d\u0438\u043c\u0430\u0442\u044c. \u0414\u043b\u044f \u0437\u0430\u043f\u0443\u0441\u043a\u0430, \u043d\u0430\u0439\u043c\u0430 \u0438\u043b\u0438 \u0440\u0435\u0434\u0438\u0437\u0430\u0439\u043d\u0430 \u044d\u0442\u043e \u0440\u043e\u0432\u043d\u043e \u0442\u043e, \u0447\u0442\u043e \u043d\u0443\u0436\u043d\u043e.',
    frameReturnsTitle: 'Gidlist \u2014 \u0434\u043b\u044f \u0440\u0430\u0431\u043e\u0442\u044b, \u043a\u043e\u0442\u043e\u0440\u0430\u044f \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044f',
    frameReturnsBody:
      '\u0417\u0430\u0432\u0442\u0440\u0430 \u0442\u043e\u0442 \u0436\u0435 \u0441\u043f\u0438\u0441\u043e\u043a \u0432\u0435\u0440\u043d\u0451\u0442\u0441\u044f \u043f\u0443\u0441\u0442\u044b\u043c \u0438 \u0431\u0443\u0434\u0435\u0442 \u0436\u0434\u0430\u0442\u044c \u0442\u043e\u0433\u043e, \u043a\u0442\u043e \u043d\u0430 \u0441\u043c\u0435\u043d\u0435. \u041d\u0430\u043a\u0430\u043f\u043b\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u043d\u0435 \u043a\u043e\u043b\u043e\u043d\u043a\u0430 \u0433\u043e\u0442\u043e\u0432\u044b\u0445 \u043a\u0430\u0440\u0442\u043e\u0447\u0435\u043a, \u0430 \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u043a\u0430\u0436\u0434\u043e\u0433\u043e \u0440\u0430\u0437\u0430, \u043a\u043e\u0433\u0434\u0430 \u044d\u0442\u043e \u0431\u044b\u043b\u043e \u0441\u0434\u0435\u043b\u0430\u043d\u043e, \u0438 \u043a\u0435\u043c.',

    spacesEyebrow: '02 \u00b7 \u0421\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430',
    spacesTitle: '\u041f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u043e \u0434\u043b\u044f \u043a\u043e\u043c\u0430\u043d\u0434\u044b, \u0447\u0435\u043a-\u043b\u0438\u0441\u0442\u044b \u0434\u043b\u044f \u0440\u0430\u0431\u043e\u0442\u044b',
    spacesLead:
      '\u0411\u043e\u043b\u044c\u0448\u0438\u043d\u0441\u0442\u0432\u0443 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0439 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 \u043e\u0434\u043d\u043e\u0433\u043e \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u0430 \u0438\u043b\u0438 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u0438\u0445 \u2014 \u0444\u0438\u043b\u0438\u0430\u043b, \u043e\u0431\u044a\u0435\u043a\u0442, \u043e\u0442\u0434\u0435\u043b. \u0410 \u0432\u043d\u0443\u0442\u0440\u0438 \u043c\u043e\u0436\u043d\u043e \u0437\u0430\u0432\u0435\u0441\u0442\u0438 \u0441\u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0435\u043a-\u043b\u0438\u0441\u0442\u043e\u0432, \u0441\u043a\u043e\u043b\u044c\u043a\u043e \u0443 \u0440\u0430\u0431\u043e\u0442\u044b \u0432\u0438\u0434\u043e\u0432: \u043e\u0442\u043a\u0440\u044b\u0442\u0438\u0435 \u0438 \u0437\u0430\u043a\u0440\u044b\u0442\u0438\u0435, \u0435\u0436\u0435\u043d\u0435\u0434\u0435\u043b\u044c\u043d\u0430\u044f \u0443\u0431\u043e\u0440\u043a\u0430, \u043c\u0435\u0441\u044f\u0447\u043d\u044b\u0439 \u043f\u0435\u0440\u0435\u0441\u0447\u0451\u0442, \u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u0430\u044f \u044f\u0432\u043a\u0430. \u0413\u0440\u0443\u043f\u043f\u0438\u0440\u043e\u0432\u043a\u0430 \u043f\u043e \u0442\u0438\u043f\u0430\u043c \u0437\u0430\u0434\u0430\u0447, \u0430 \u043d\u0435 \u043f\u043e \u043f\u043e\u0434\u0440\u0430\u0437\u0434\u0435\u043b\u0435\u043d\u0438\u044f\u043c, \u0438 \u0434\u0435\u0440\u0436\u0438\u0442 \u0432\u0441\u0451 \u0443\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u043c\u044b\u043c \u043f\u043e \u043c\u0435\u0440\u0435 \u0440\u043e\u0441\u0442\u0430.',

    depthEyebrow: '03 \u00b7 \u0413\u043b\u0443\u0431\u0438\u043d\u0430',
    depthTitle: '\u0420\u0435\u0430\u043b\u044c\u043d\u044b\u0435 \u043f\u0440\u043e\u0446\u0435\u0434\u0443\u0440\u044b \u0432\u043b\u043e\u0436\u0435\u043d\u044b, \u0430 \u043f\u043b\u043e\u0441\u043a\u0438\u0439 \u0441\u043f\u0438\u0441\u043e\u043a \u044d\u0442\u043e \u0441\u043a\u0440\u044b\u0432\u0430\u0435\u0442',
    depthLead:
      '\u0420\u0430\u0437\u0434\u0435\u043b\u044b \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442 \u0437\u0430\u0434\u0430\u0447\u0438, \u0430 \u043b\u044e\u0431\u0430\u044f \u0437\u0430\u0434\u0430\u0447\u0430 \u043c\u043e\u0436\u0435\u0442 \u0438\u043c\u0435\u0442\u044c \u0441\u0432\u043e\u0438 \u043f\u043e\u0434\u0437\u0430\u0434\u0430\u0447\u0438 \u2014 \u0434\u043e \u043f\u044f\u0442\u0438 \u0443\u0440\u043e\u0432\u043d\u0435\u0439. \u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u0432\u0435\u0442\u043a\u0438 \u043d\u0438\u0436\u0435: \u0441\u0430\u043c\u0430\u044f \u0433\u043b\u0443\u0431\u043e\u043a\u0430\u044f \u0437\u0430\u043a\u0430\u043d\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0444\u043e\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0435\u0439 \u2014 \u0438\u043c\u0435\u043d\u043d\u043e \u0442\u0430\u043c \u0438 \u043f\u0440\u043e\u0438\u0441\u0445\u043e\u0434\u0438\u0442 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430.',
    depthNote: '\u041f\u0440\u0435\u0434\u0435\u043b \u2014 \u043f\u044f\u0442\u044c \u0443\u0440\u043e\u0432\u043d\u0435\u0439, \u0438 \u044d\u0442\u0430 \u0432\u0435\u0442\u043a\u0430 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442 \u0432\u0441\u0435.',

    proofEyebrow: '04 \u00b7 \u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435',
    proofTitle: '\u041e\u0442\u043c\u0435\u0442\u043a\u0430 \u2014 \u044d\u0442\u043e \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435. \u0417\u0434\u0435\u0441\u044c \u043e\u043d\u0430 \u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u0441\u044f \u0434\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b\u044c\u0441\u0442\u0432\u043e\u043c.',
    proofLead:
      '\u0423\u043a\u0430\u0436\u0438\u0442\u0435, \u0441 \u0447\u0435\u043c \u0437\u0430\u0434\u0430\u0447\u0430 \u0434\u043e\u043b\u0436\u043d\u0430 \u0432\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f \u2014 \u0444\u043e\u0442\u043e, \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442 \u0438\u043b\u0438 \u043c\u0435\u0441\u0442\u043e \u043e\u0442\u043c\u0435\u0442\u043a\u0438 \u2014 \u0430 \u043f\u043e\u0442\u043e\u043c \u043f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0431\u0435\u0437 \u044d\u0442\u043e\u0433\u043e. \u041a\u0430\u0436\u0434\u043e\u0435 \u0438\u0437 \u0442\u0440\u0451\u0445 \u043d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e: \u0444\u043e\u0442\u043e \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u043c, \u0430 \u0444\u0430\u0439\u043b \u2014 \u043f\u0440\u043e\u0441\u0442\u043e \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u043d\u044b\u043c.',

    rhythmEyebrow: '05 \u00b7 \u0420\u0438\u0442\u043c',
    rhythmTitle: '\u041e\u043d \u0432\u043e\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442\u0441\u044f \u0441\u0430\u043c',
    rhythmLead:
      '\u041a\u0430\u0436\u0434\u044b\u0439 \u0434\u0435\u043d\u044c, \u043f\u043e \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u043c \u0434\u043d\u044f\u043c \u043d\u0435\u0434\u0435\u043b\u0438, \u043f\u043e \u0443\u043a\u0430\u0437\u0430\u043d\u043d\u044b\u043c \u0447\u0438\u0441\u043b\u0430\u043c \u043c\u0435\u0441\u044f\u0446\u0430, \u0440\u0430\u0437 \u0432 \u0433\u043e\u0434 \u0438\u043b\u0438 \u043f\u043e \u0441\u043f\u0438\u0441\u043a\u0443 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u044b\u0445 \u0434\u0430\u0442. \u041d\u0430\u0441\u0442\u0440\u043e\u0438\u043b\u0438 \u043e\u0434\u0438\u043d \u0440\u0430\u0437 \u2014 \u0438 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0438\u043a\u043e\u043c\u0443 \u043d\u0435 \u043d\u0443\u0436\u043d\u043e \u043e\u0431 \u044d\u0442\u043e\u043c \u043f\u043e\u043c\u043d\u0438\u0442\u044c.',

    peopleEyebrow: '06 \u00b7 \u041b\u044e\u0434\u0438',
    peopleTitle: '\u0412\u0441\u0435 \u0432 \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u0435 \u0438\u043b\u0438 \u0438\u043c\u0435\u043d\u043d\u043e \u0442\u0435, \u043a\u043e\u043c\u0443 \u043d\u0443\u0436\u043d\u043e',
    peopleLead:
      '\u0412\u044b \u0432\u044b\u0431\u0438\u0440\u0430\u0435\u0442\u0435, \u043a\u043e\u043c\u0443 \u043f\u043e\u043f\u0430\u0434\u0451\u0442 \u0447\u0435\u043a-\u043b\u0438\u0441\u0442. \u0410 \u0442\u043e\u0442, \u043a\u0442\u043e \u0435\u0433\u043e \u0437\u0430\u043f\u043e\u043b\u043d\u044f\u0435\u0442, \u043c\u043e\u0436\u0435\u0442 \u043e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435 \u043a \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e\u0439 \u0437\u0430\u0434\u0430\u0447\u0435 \u2014 \u0438\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u043e\u0431\u044a\u044f\u0441\u043d\u044f\u0435\u0442\u0441\u044f \u0440\u044f\u0434\u043e\u043c \u0441 \u0442\u0435\u043c, \u0433\u0434\u0435 \u043e\u043d\u043e \u0441\u043b\u0443\u0447\u0438\u043b\u043e\u0441\u044c, \u0430 \u043d\u0435 \u0432 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0438, \u043a\u043e\u0442\u043e\u0440\u043e\u0435 \u043d\u0430\u0434\u043e \u0438\u0441\u043a\u0430\u0442\u044c.',

    insightsEyebrow: '07 \u00b7 \u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442',
    insightsTitle: '\u041c\u0435\u0441\u044f\u0446 \u043e\u0442\u043c\u0435\u0442\u043e\u043a \u0441\u043a\u043b\u0430\u0434\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0432 \u043a\u0430\u0440\u0442\u0438\u043d\u0443',
    insightsLead:
      '\u041a\u0430\u0436\u0434\u0430\u044f \u043e\u0442\u043c\u0435\u0442\u043a\u0430 \u0445\u0440\u0430\u043d\u0438\u0442 \u0438\u043c\u044f \u0438 \u0432\u0440\u0435\u043c\u044f, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u043e\u0442\u0447\u0451\u0442\u044b \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442 \u0437\u0430\u043a\u043e\u043d\u043e\u043c\u0435\u0440\u043d\u043e\u0441\u0442\u0438, \u043a\u043e\u0442\u043e\u0440\u044b\u0445 \u043d\u0438\u043a\u0442\u043e \u043d\u0435 \u0437\u0430\u043c\u0435\u0447\u0430\u043b. \u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0441\u0442\u043e\u043b\u0431\u0435\u0446 \u2014 \u0441\u0435\u0433\u043e\u0434\u043d\u044f, \u0438 \u043e\u043d \u0434\u0432\u0438\u0433\u0430\u0435\u0442\u0441\u044f, \u043a\u043e\u0433\u0434\u0430 \u0432\u044b \u043e\u0442\u043c\u0435\u0447\u0430\u0435\u0442\u0435 \u0437\u0430\u0434\u0430\u0447\u0443 \u0432 \u0447\u0435\u043a-\u043b\u0438\u0441\u0442\u0435 \u0432\u0432\u0435\u0440\u0445\u0443 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b.',
    insightsCaption: '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439 \u0441\u0442\u043e\u043b\u0431\u0435\u0446 \u043f\u043e\u0441\u0447\u0438\u0442\u0430\u043d \u043f\u043e \u0432\u0430\u0448\u0438\u043c \u043e\u0442\u043c\u0435\u0442\u043a\u0430\u043c.',

    walkEyebrow: '08 \u00b7 \u041e\u0434\u043d\u043e \u0443\u0442\u0440\u043e',
    walkTitle: '\u041e\u0442\u043c\u0435\u0442\u043a\u0430 \u043e \u043f\u0440\u0438\u0445\u043e\u0434\u0435, \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043d\u043d\u0430\u044f',
    walkLead:
      '\u042f\u0432\u043a\u0430 \u2014 \u0442\u043e\u0442 \u0441\u043b\u0443\u0447\u0430\u0439, \u0433\u0434\u0435 \u043f\u043e\u0434\u043f\u0438\u0441\u044c \u043d\u0430 \u0431\u0443\u043c\u0430\u0433\u0435 \u0432\u0441\u0435\u0433\u0434\u0430 \u0441\u0442\u043e\u0438\u043b\u0430 \u043c\u0435\u043d\u044c\u0448\u0435 \u0432\u0441\u0435\u0433\u043e. \u041f\u0440\u043e\u0439\u0434\u0438\u0442\u0435 \u043e\u0434\u043d\u043e \u0443\u0442\u0440\u043e \u043e\u0434\u043d\u043e\u0433\u043e \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430 \u2014 \u0432\u0435\u0441\u044c \u043f\u0440\u043e\u0446\u0435\u0441\u0441 \u0437\u0430 \u043f\u044f\u0442\u044c \u0448\u0430\u0433\u043e\u0432.',
    walkSteps: [
      {
        title: '\u041e\u043d\u0430 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0442 \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u043e',
        body: '\u0413\u043e\u043b\u043e\u0432\u043d\u043e\u0439 \u043e\u0444\u0438\u0441, \u0432 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0435. \u0412\u0441\u0451, \u0447\u0442\u043e \u0434\u0435\u043b\u0430\u0435\u0442 \u0435\u0451 \u0444\u0438\u043b\u0438\u0430\u043b, \u0436\u0438\u0432\u0451\u0442 \u0432 \u044d\u0442\u043e\u043c \u043e\u0434\u043d\u043e\u043c \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u0435, \u0438\u0441\u043a\u0430\u0442\u044c \u043d\u0438\u0447\u0435\u0433\u043e \u043d\u0435 \u043d\u0443\u0436\u043d\u043e.',
        caption: '\u0413\u043e\u043b\u043e\u0432\u043d\u043e\u0439 \u043e\u0444\u0438\u0441',
      },
      {
        title: '\u0421\u0435\u0433\u043e\u0434\u043d\u044f\u0448\u043d\u0438\u0439 \u0441\u043f\u0438\u0441\u043e\u043a \u0443\u0436\u0435 \u0436\u0434\u0451\u0442',
        body: '\u0415\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u0430\u044f \u044f\u0432\u043a\u0430 \u043d\u0430 \u043c\u0435\u0441\u0442\u0435, \u0435\u0451 \u043d\u0438\u043a\u0442\u043e \u043d\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u043b. \u041e\u043d\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0435\u0442\u0441\u044f \u043f\u043e \u0431\u0443\u0434\u043d\u044f\u043c \u0432 09:00 \u0438 \u043f\u0440\u0438\u0434\u0451\u0442 \u043d\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043c\u043e \u043e\u0442 \u0442\u043e\u0433\u043e, \u0432\u0441\u043f\u043e\u043c\u043d\u0438\u0442 \u043b\u0438 \u043a\u0442\u043e-\u0442\u043e.',
        caption: '\u0415\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u0430\u044f \u044f\u0432\u043a\u0430 \u00b7 09:00',
      },
      {
        title: '\u041e\u043d\u0430 \u043e\u0442\u043c\u0435\u0447\u0430\u0435\u0442 \u0437\u0430\u0434\u0430\u0447\u0443 \u0438 \u0434\u0430\u0451\u0442 \u0442\u043e, \u0447\u0442\u043e \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f',
        body: '\u042d\u0442\u0430 \u0437\u0430\u0434\u0430\u0447\u0430 \u0436\u0434\u0451\u0442 \u0444\u043e\u0442\u043e, \u0441\u043c\u0435\u043d\u043d\u044b\u0439 \u043b\u0438\u0441\u0442 \u0444\u0430\u0439\u043b\u043e\u043c \u0438 \u043c\u0435\u0441\u0442\u043e \u043e\u0442\u043c\u0435\u0442\u043a\u0438. \u041a\u0430\u043c\u0435\u0440\u0430 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0438\u0437 \u0441\u0430\u043c\u043e\u0439 \u0437\u0430\u0434\u0430\u0447\u0438, \u0444\u0430\u0439\u043b \u0432\u044b\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044f \u0442\u0430\u043c \u0436\u0435, \u0430 \u043b\u043e\u043a\u0430\u0446\u0438\u044f \u0441\u0447\u0438\u0442\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0432 \u044d\u0442\u043e\u0442 \u0436\u0435 \u043c\u043e\u043c\u0435\u043d\u0442 \u2014 \u0432\u0441\u0451 \u0434\u043e \u0442\u043e\u0433\u043e, \u043a\u0430\u043a \u043e\u0442\u043c\u0435\u0442\u043a\u0430 \u0437\u0430\u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f.',
        caption: '\u0424\u043e\u0442\u043e \u00b7 \u0424\u0430\u0439\u043b \u00b7 \u041b\u043e\u043a\u0430\u0446\u0438\u044f',
      },
      {
        title: '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u0442 \u0441\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0435\u043c, \u043a\u043e\u0433\u0434\u0430 \u044d\u0442\u043e \u043f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u043e',
        body: '\u041e\u0442\u043c\u0435\u0442\u043a\u0430 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442\u0441\u044f \u043d\u0430 09:04 \u2014 \u043a\u043e\u0433\u0434\u0430 \u043e\u043d\u0430 \u0435\u0451 \u043f\u043e\u0441\u0442\u0430\u0432\u0438\u043b\u0430, \u0430 \u043d\u0435 \u043a\u043e\u0433\u0434\u0430 \u0432\u0441\u1ea3\u0451 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b\u043e\u0441\u044c \u0438 \u043d\u0435 \u043a\u043e\u0433\u0434\u0430 \u043a\u0442\u043e-\u0442\u043e \u0432\u043f\u0438\u0441\u0430\u043b \u044d\u0442\u043e \u043f\u043e\u0437\u0436\u0435.',
        caption: '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e 09:04',
      },
      {
        title: '\u0412\u0438\u0434 \u0440\u0443\u043a\u043e\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044f \u043e\u0431\u043d\u043e\u0432\u043b\u044f\u0435\u0442\u0441\u044f',
        body: '\u0427\u0435\u0442\u044b\u0440\u043d\u0430\u0434\u0446\u0430\u0442\u044c \u0447\u0435\u043b\u043e\u0432\u0435\u043a, \u0442\u0440\u0438\u043d\u0430\u0434\u0446\u0430\u0442\u044c \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438\u0441\u044c, \u043e\u0434\u0438\u043d \u043e\u0442\u043a\u0440\u044b\u0442 \u2014 \u0432\u0438\u0434\u043d\u043e, \u043d\u0438\u0447\u0435\u0433\u043e \u043d\u0438 \u0443 \u043a\u043e\u0433\u043e \u043d\u0435 \u0441\u043f\u0440\u0430\u0448\u0438\u0432\u0430\u044f, \u0438 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u0432 \u043a\u043e\u043d\u0446\u0435 \u043c\u0435\u0441\u044f\u0446\u0430.',
        caption: '13/14 \u043e\u0442\u043c\u0435\u0442\u0438\u043b\u0438\u0441\u044c',
      },
    ],

    casesEyebrow: '09 \u00b7 \u0412 \u0434\u0440\u0443\u0433\u0438\u0445 \u043c\u0435\u0441\u0442\u0430\u0445',
    casesTitle: '\u0422\u0430 \u0436\u0435 \u0444\u043e\u0440\u043c\u0430, \u0434\u0440\u0443\u0433\u0430\u044f \u043a\u043e\u043c\u043d\u0430\u0442\u0430',
    casesLead: '\u0412\u0435\u0437\u0434\u0435, \u0433\u0434\u0435 \u0440\u0430\u0431\u043e\u0442\u0430 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0435\u0442\u0441\u044f \u0438 \u043a\u0442\u043e-\u0442\u043e \u0434\u043e\u043b\u0436\u0435\u043d \u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c, \u0447\u0442\u043e \u043e\u043d\u0430 \u0441\u0434\u0435\u043b\u0430\u043d\u0430.',
    casesEnforced: '\u0427\u0442\u043e \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f',
    cases: [
      {
        name: '\u041e\u0442\u043a\u0440\u044b\u0442\u0438\u0435 \u0438 \u0437\u0430\u043a\u0440\u044b\u0442\u0438\u0435 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430',
        what: '\u041f\u043e\u0440\u044f\u0434\u043e\u043a, \u043e\u0442 \u043a\u043e\u0442\u043e\u0440\u043e\u0433\u043e \u0437\u0430\u0432\u0438\u0441\u0438\u0442, \u043e\u0442\u043a\u0440\u043e\u044e\u0442\u0441\u044f \u043b\u0438 \u0434\u0432\u0435\u0440\u0438 \u0432\u043e\u0432\u0440\u0435\u043c\u044f.',
        enforced: '\u0424\u043e\u0442\u043e \u0437\u0430\u043b\u0430, \u043b\u043e\u043a\u0430\u0446\u0438\u044f \u043d\u0430 \u0442\u043e\u0447\u043a\u0435',
      },
      {
        name: '\u041f\u0438\u0449\u0435\u0432\u0430\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c \u0438 \u0433\u0438\u0433\u0438\u0435\u043d\u0430',
        what: '\u0416\u0443\u0440\u043d\u0430\u043b\u044b \u0442\u0435\u043c\u043f\u0435\u0440\u0430\u0442\u0443\u0440 \u0438 \u0433\u0440\u0430\u0444\u0438\u043a\u0438 \u0443\u0431\u043e\u0440\u043a\u0438, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0441\u043f\u0440\u043e\u0441\u0438\u0442 \u043f\u0440\u043e\u0432\u0435\u0440\u044f\u044e\u0449\u0438\u0439.',
        enforced: '\u0424\u043e\u0442\u043e \u043a\u0430\u0436\u0434\u043e\u0433\u043e \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u0438\u044f, \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u044b \u0444\u0430\u0439\u043b\u0430\u043c\u0438',
      },
      {
        name: '\u041e\u0431\u0441\u043b\u0443\u0436\u0438\u0432\u0430\u043d\u0438\u0435 \u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u044f',
        what: '\u041f\u043b\u0430\u043d\u043e\u0432\u044b\u0435 \u043e\u0441\u043c\u043e\u0442\u0440\u044b \u0441 \u0434\u0435\u0442\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u0435\u0439 \u043f\u043e\u0434 \u043a\u0430\u0436\u0434\u043e\u0439 \u043c\u0430\u0448\u0438\u043d\u043e\u0439.',
        enforced: '\u0424\u043e\u0442\u043e, \u0441\u0435\u0440\u0432\u0438\u0441\u043d\u044b\u0439 \u043b\u0438\u0441\u0442 \u0444\u0430\u0439\u043b\u043e\u043c, \u043f\u0440\u0438\u043c\u0435\u0447\u0430\u043d\u0438\u0435 \u043a \u043e\u0442\u043a\u043b\u043e\u043d\u0435\u043d\u0438\u044f\u043c',
      },
      {
        name: '\u041e\u0431\u0445\u043e\u0434\u044b \u043e\u0445\u0440\u0430\u043d\u044b',
        what: '\u041e\u0431\u0445\u043e\u0434, \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u043d\u0438\u043a\u0442\u043e \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0434\u043e\u043a\u0430\u0437\u0430\u0442\u044c.',
        enforced: '\u041b\u043e\u043a\u0430\u0446\u0438\u044f \u0432 \u043a\u0430\u0436\u0434\u043e\u0439 \u0442\u043e\u0447\u043a\u0435',
      },
    ],

    tractionVisible: 'no',
    tractionLabel: 'Gidlist \u0441\u0435\u0433\u043e\u0434\u043d\u044f',
    tractionNote: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u044d\u0442\u0438 \u0446\u0438\u0444\u0440\u044b \u0432 \u0440\u0435\u0434\u0430\u043a\u0442\u043e\u0440\u0435 \u043a\u043e\u043d\u0442\u0435\u043d\u0442\u0430 \u0441\u0430\u0439\u0442\u0430, \u0430 \u0437\u0430\u0442\u0435\u043c \u0441\u0434\u0435\u043b\u0430\u0439\u0442\u0435 \u0440\u0430\u0437\u0434\u0435\u043b \u0432\u0438\u0434\u0438\u043c\u044b\u043c.',
    tractionSpacesLabel: '\u0421\u043e\u0437\u0434\u0430\u043d\u043e \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432',
    tractionSpacesValue: '\u2014',
    tractionSubmissionsLabel: '\u041e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u043e \u0447\u0435\u043a-\u043b\u0438\u0441\u0442\u043e\u0432',
    tractionSubmissionsValue: '\u2014',
    tractionMembersLabel: '\u041b\u044e\u0434\u0435\u0439 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442',
    tractionMembersValue: '\u2014',

    faqVisible: 'yes',
    faqEyebrow: '10 \u00b7 \u041f\u0440\u0435\u0436\u0434\u0435 \u0447\u0435\u043c \u0441\u043f\u0440\u043e\u0441\u0438\u0442\u044c',
    faqTitle: '\u0412\u043e\u043f\u0440\u043e\u0441\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0441\u0442\u043e\u0438\u0442 \u043d\u0430\u043c \u0437\u0430\u0434\u0430\u0442\u044c',
    faqLead: '\u0422\u0435, \u0447\u0442\u043e \u0440\u0435\u0448\u0430\u044e\u0442, \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u043b\u0438 \u044d\u0442\u043e \u0442\u0430\u043c, \u0433\u0434\u0435 \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442\u0435 \u0432\u044b.',
    faqItems: [
      { q: '\u0413\u0434\u0435 \u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442\u0441\u044f \u0444\u043e\u0442\u043e, \u0444\u0430\u0439\u043b\u044b \u0438 \u043b\u043e\u043a\u0430\u0446\u0438\u0438?', a: '\u0412 \u0432\u0430\u0448\u0435\u043c \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u0435, \u0432\u0438\u0434\u0438\u043c\u044b\u0435 \u0442\u0435\u043c, \u043a\u043e\u0433\u043e \u0432\u044b \u0442\u0443\u0434\u0430 \u0434\u043e\u0431\u0430\u0432\u0438\u043b\u0438, \u0438 \u0431\u043e\u043b\u044c\u0448\u0435 \u043d\u0438\u043a\u043e\u043c\u0443. \u0424\u0430\u0439\u043b\u044b \u0438 \u0444\u043e\u0442\u043e \u043b\u0435\u0436\u0430\u0442 \u0432 \u0437\u0430\u043a\u0440\u044b\u0442\u043e\u043c \u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435, \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u043c \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u043e \u043a\u0440\u0430\u0442\u043a\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u044b\u043c \u0441\u0441\u044b\u043b\u043a\u0430\u043c, \u0430 \u0434\u043e\u0441\u0442\u0443\u043f \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0438\u0432\u0430\u0435\u0442 \u0441\u0430\u043c\u0430 \u0431\u0430\u0437\u0430 \u0434\u0430\u043d\u043d\u044b\u0445, \u0430 \u043d\u0435 \u0442\u043e\u043b\u044c\u043a\u043e \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u2014 \u043e\u0448\u0438\u0431\u043a\u0430 \u043d\u0430 \u043e\u0434\u043d\u043e\u043c \u044d\u043a\u0440\u0430\u043d\u0435 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u0438 \u0434\u0440\u0443\u0433\u043e\u0439 \u043a\u043e\u043c\u043f\u0430\u043d\u0438\u0438. \u0418\u043d\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043a\u0442\u0443\u0440\u0430 \u043d\u0430\u0448\u0438\u0445 \u043f\u043e\u0441\u0442\u0430\u0432\u0449\u0438\u043a\u043e\u0432 \u0440\u0430\u0441\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0430 \u0437\u0430 \u043f\u0440\u0435\u0434\u0435\u043b\u0430\u043c\u0438 \u0423\u0437\u0431\u0435\u043a\u0438\u0441\u0442\u0430\u043d\u0430, \u0442\u043e \u0435\u0441\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435 \u043c\u043e\u0433\u0443\u0442 \u0445\u0440\u0430\u043d\u0438\u0442\u044c\u0441\u044f \u0437\u0430 \u0440\u0443\u0431\u0435\u0436\u043e\u043c. \u0415\u0441\u043b\u0438 \u044d\u0442\u043e \u0432\u0430\u0436\u043d\u043e \u0434\u043b\u044f \u0432\u0430\u0448\u0438\u0445 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u0441\u0442\u0432, \u043f\u043e\u0433\u043e\u0432\u043e\u0440\u0438\u0442\u0435 \u0441 \u043d\u0430\u043c\u0438 \u0434\u043e \u0442\u043e\u0433\u043e, \u043a\u0430\u043a \u0440\u0430\u0437\u043c\u0435\u0449\u0430\u0442\u044c \u0440\u0435\u0433\u0443\u043b\u0438\u0440\u0443\u0435\u043c\u044b\u0435 \u0437\u0430\u043f\u0438\u0441\u0438.', visible: 'yes' },
      { q: '\u0417\u0430\u043a\u043e\u043d\u043d\u043e \u043b\u0438 \u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u0442\u044c, \u0433\u0434\u0435 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u043f\u043e\u0441\u0442\u0430\u0432\u0438\u043b \u043e\u0442\u043c\u0435\u0442\u043a\u0443?', a: '\u042d\u0442\u043e \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043e\u0442 \u0432\u0430\u0448\u0435\u0439 \u044e\u0440\u0438\u0441\u0434\u0438\u043a\u0446\u0438\u0438 \u0438 \u043e\u0442 \u0442\u043e\u0433\u043e, \u0447\u0442\u043e \u0432\u044b \u0441\u043a\u0430\u0437\u0430\u043b\u0438 \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u0430\u043c, \u0438 \u0441\u043e\u0432\u0435\u0442\u043e\u0432\u0430\u0442\u044c \u0437\u0434\u0435\u0441\u044c \u0434\u043e\u043b\u0436\u043d\u044b \u043d\u0435 \u043c\u044b. \u041c\u044b \u043c\u043e\u0436\u0435\u043c \u0441\u043a\u0430\u0437\u0430\u0442\u044c, \u0447\u0442\u043e \u0434\u0435\u043b\u0430\u0435\u0442 \u043f\u0440\u043e\u0434\u0443\u043a\u0442: \u043b\u043e\u043a\u0430\u0446\u0438\u044f \u0441\u043d\u0438\u043c\u0430\u0435\u0442\u0441\u044f \u0442\u043e\u043b\u044c\u043a\u043e \u0432 \u0437\u0430\u0434\u0430\u0447\u0430\u0445, \u0433\u0434\u0435 \u0432\u044b \u0435\u0451 \u0432\u043a\u043b\u044e\u0447\u0438\u043b\u0438, \u0442\u043e\u043b\u044c\u043a\u043e \u0432 \u043c\u043e\u043c\u0435\u043d\u0442 \u043e\u0442\u043c\u0435\u0442\u043a\u0438 \u0438 \u043d\u0438\u043a\u043e\u0433\u0434\u0430 \u0432 \u0444\u043e\u043d\u0435 \u2014 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c \u043f\u043e\u0437\u0438\u0446\u0438\u044e, \u043f\u043e\u043a\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u043e. \u041f\u0440\u0435\u0434\u0443\u043f\u0440\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u0443 \u0434\u043e \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f.', visible: 'yes' },
      { q: '\u0427\u0442\u043e \u0431\u0443\u0434\u0435\u0442, \u0435\u0441\u043b\u0438 \u043d\u0435\u0442 \u0441\u0432\u044f\u0437\u0438?', a: '\u0421\u0435\u0439\u0447\u0430\u0441 \u0434\u043b\u044f \u043e\u0442\u043c\u0435\u0442\u043a\u0438 \u043d\u0443\u0436\u043d\u0430 \u0441\u0432\u044f\u0437\u044c, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 \u043f\u043e\u0434\u0432\u0430\u043b \u0438\u043b\u0438 \u0445\u043e\u043b\u043e\u0434\u043d\u044b\u0439 \u0441\u043a\u043b\u0430\u0434 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u044f\u0442 \u0447\u0435\u043b\u043e\u0432\u0435\u043a\u0430 \u043f\u043e\u0441\u0440\u0435\u0434\u0438 \u0441\u043f\u0438\u0441\u043a\u0430. \u041e\u0444\u043b\u0430\u0439\u043d-\u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 \u0441 \u043e\u0447\u0435\u0440\u0435\u0434\u044c\u044e \u043e\u0442\u043b\u043e\u0436\u0435\u043d\u043d\u044b\u0445 \u0437\u0430\u043f\u0438\u0441\u0435\u0439 \u0440\u0430\u0437\u0440\u0430\u0431\u0430\u0442\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0438 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0433\u043e\u0442\u043e\u0432\u043e. \u041b\u0443\u0447\u0448\u0435 \u043c\u044b \u0441\u043a\u0430\u0436\u0435\u043c \u044d\u0442\u043e, \u0447\u0435\u043c \u0432\u044b \u0443\u0437\u043d\u0430\u0435\u0442\u0435 \u043d\u0430 \u0441\u043c\u0435\u043d\u0435.', visible: 'yes' },
      { q: '\u041d\u0443\u0436\u043d\u043e \u043b\u0438 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435 \u0438\u0437 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430?', a: '\u041d\u0435\u0442. \u0420\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0432 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435 \u043b\u044e\u0431\u043e\u0433\u043e \u0441\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e\u0433\u043e \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u0430 \u0438 \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u0442\u0441\u044f \u043d\u0430 \u0434\u043e\u043c\u0430\u0448\u043d\u0438\u0439 \u044d\u043a\u0440\u0430\u043d \u2014 \u043d\u0438\u0447\u0435\u0433\u043e \u0443\u0441\u0442\u0430\u043d\u0430\u0432\u043b\u0438\u0432\u0430\u0442\u044c \u0438 \u043d\u0438\u0447\u0435\u0433\u043e \u0441\u043e\u0433\u043b\u0430\u0441\u043e\u0432\u044b\u0432\u0430\u0442\u044c \u0441 IT. \u041a\u0430\u043c\u0435\u0440\u0430, \u0432\u044b\u0431\u043e\u0440 \u0444\u0430\u0439\u043b\u0430 \u0438 \u043b\u043e\u043a\u0430\u0446\u0438\u044f \u0440\u0430\u0431\u043e\u0442\u0430\u044e\u0442 \u043e\u0442\u0442\u0443\u0434\u0430 \u0436\u0435.', visible: 'yes' },
      { q: '\u0421\u043a\u043e\u043b\u044c\u043a\u043e \u0437\u0430\u043d\u0438\u043c\u0430\u0435\u0442 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430?', a: '\u041f\u0435\u0440\u0432\u044b\u0439 \u0447\u0435\u043a-\u043b\u0438\u0441\u0442 \u2014 \u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043c\u0438\u043d\u0443\u0442. \u041f\u0435\u0440\u0435\u043d\u043e\u0441 \u0431\u0443\u043c\u0430\u0436\u043d\u043e\u0433\u043e \u0438\u043b\u0438 \u0442\u0430\u0431\u043b\u0438\u0447\u043d\u043e\u0433\u043e \u043f\u043e\u0440\u044f\u0434\u043a\u0430 \u0437\u0430\u043d\u0438\u043c\u0430\u0435\u0442 \u0441\u0442\u043e\u043b\u044c\u043a\u043e, \u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043d\u0430\u0431\u0440\u0430\u0442\u044c \u0435\u0433\u043e \u043e\u0434\u0438\u043d \u0440\u0430\u0437: \u0438\u043c\u043f\u043e\u0440\u0442\u0430 \u043d\u0435\u0442, \u0438 \u0434\u043b\u044f \u0431\u043e\u043b\u044c\u0448\u0438\u043d\u0441\u0442\u0432\u0430 \u043f\u0440\u043e\u0446\u0435\u0434\u0443\u0440 \u043f\u0435\u0440\u0435\u043d\u0430\u0431\u0440\u0430\u0442\u044c \u0431\u044b\u0441\u0442\u0440\u0435\u0435, \u0447\u0435\u043c \u0440\u0430\u0437\u043c\u0435\u0447\u0430\u0442\u044c \u0442\u0430\u0431\u043b\u0438\u0446\u0443.', visible: 'yes' },
      { q: '\u041a\u0430\u043a\u0438\u0435 \u044f\u0437\u044b\u043a\u0438 \u0438 \u0441\u043a\u043e\u043b\u044c\u043a\u043e \u043b\u044e\u0434\u0435\u0439?', a: '\u0410\u043d\u0433\u043b\u0438\u0439\u0441\u043a\u0438\u0439, \u0443\u0437\u0431\u0435\u043a\u0441\u043a\u0438\u0439 \u0438 \u0440\u0443\u0441\u0441\u043a\u0438\u0439, \u0430 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440 \u043c\u043e\u0436\u0435\u0442 \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0435\u0449\u0451 \u043e\u0434\u0438\u043d \u044f\u0437\u044b\u043a \u0438 \u043f\u0435\u0440\u0435\u0432\u0435\u0441\u0442\u0438 \u0435\u0433\u043e, \u043d\u0435 \u0434\u043e\u0436\u0438\u0434\u0430\u044f\u0441\u044c \u0440\u0435\u043b\u0438\u0437\u0430. \u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0439 \u0442\u0430\u0440\u0438\u0444 \u2014 \u043f\u044f\u0442\u044c \u0447\u0435\u043b\u043e\u0432\u0435\u043a; \u0431\u043e\u043b\u044c\u0448\u0438\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u044b \u0438 \u0431\u043e\u043b\u0435\u0435 \u0434\u043e\u043b\u0433\u043e\u0435 \u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435 \u0444\u043e\u0442\u043e \u0438 \u0444\u0430\u0439\u043b\u043e\u0432 \u2014 \u044d\u0442\u043e \u0442\u043e, \u0447\u0442\u043e \u0434\u0430\u044e\u0442 \u043f\u043b\u0430\u0442\u043d\u044b\u0435 \u0442\u0430\u0440\u0438\u0444\u044b.', visible: 'yes' },
      { q: '', a: '', visible: 'yes' },
      { q: '', a: '', visible: 'yes' },
    ],

    closeTitle: '\u041d\u0430\u0447\u043d\u0438\u0442\u0435 \u0441 \u043e\u0434\u043d\u043e\u0433\u043e \u0447\u0435\u043a-\u043b\u0438\u0441\u0442\u0430',
    closeBody:
      '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u043e\u0440\u044f\u0434\u043e\u043a, \u0437\u0430 \u043a\u043e\u0442\u043e\u0440\u044b\u0439 \u0432\u0430\u043c \u0447\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043e \u043f\u0440\u0438\u0445\u043e\u0434\u0438\u0442\u0441\u044f \u0440\u0443\u0447\u0430\u0442\u044c\u0441\u044f, \u0438 \u0437\u0430\u043f\u0438\u0448\u0438\u0442\u0435 \u0435\u0433\u043e \u043e\u0434\u0438\u043d \u0440\u0430\u0437. \u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e \u0434\u043b\u044f \u043f\u044f\u0442\u0438 \u0447\u0435\u043b\u043e\u0432\u0435\u043a \u0438 \u0431\u0435\u0437 \u043a\u0430\u0440\u0442\u044b.',

    footerProduct: 'Продукт',
    footerAccount: 'Аккаунт',
    footerLegal: 'Правовая информация',
    footerCompany: 'Gidlist — продукт UNUMIS LTD.',
    footerLanguage: 'Язык',
  },
};

/* ===========================================================================
 * Overrides
 *
 * A row in `site_content` replaces one string in the catalogue above. The
 * catalogue is the default and always complete, so an empty table — or a
 * database that cannot be reached — renders a full page in every language.
 * =========================================================================== */

/** A flat map of dotted key to overriding text, as stored in `site_content`. */
export type SiteOverrides = Record<string, string>;

/**
 * Every string an editor may change, as dotted paths.
 *
 * Derived from the English catalogue rather than hand-listed, so a string added
 * to `SiteMessages` becomes editable without anybody remembering to register
 * it. Functions are skipped: `pricingMembers` builds a sentence around a number
 * and a plural rule, and letting that be replaced by free text would break
 * Russian grammar in a way no editor could see coming.
 *
 * `htmlLang` is excluded for a blunter reason — it is markup, not copy, and an
 * editor who changed it would silently break hreflang for that language.
 */
export function siteContentKeys(): string[] {
  const keys: string[] = [];

  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      keys.push(path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}.${i}`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
    // Functions fall through and are not editable.
  };

  walk(MESSAGES.en, '');
  return keys.filter((k) => k !== 'htmlLang').sort();
}

/**
 * Layer overrides on top of the bundled copy for one locale.
 *
 * Two rules, both deliberate:
 *
 *   - **The catalogue is never mutated.** `MESSAGES` is module state that
 *     outlives a request, so writing into it would leak one visitor's overrides
 *     into the next render — and on a server that is every visitor. The arrays
 *     of cards are copied, not shared.
 *   - **An override only replaces a string that already exists.** An unknown or
 *     malformed key is ignored rather than adding a field, so a stale row left
 *     behind by a rename cannot inject anything into the page.
 */
export function applySiteOverrides(
  base: SiteMessages,
  overrides: SiteOverrides,
): SiteMessages {
  /*
   * The nested arrays are cloned, not shared. An override writes through a path
   * like `faqItems.2.a`, and without a copy that write would land in the shipped
   * catalogue itself — changing the default for every other language and for
   * every later request this process serves.
   */
  const next: SiteMessages = {
    ...base,
    walkSteps: base.walkSteps.map((c) => ({ ...c })) as SiteMessages['walkSteps'],
    cases: base.cases.map((c) => ({ ...c })) as SiteMessages['cases'],
    faqItems: base.faqItems.map((c) => ({ ...c })) as SiteMessages['faqItems'],
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'htmlLang' || typeof value !== 'string' || value.length === 0) continue;

    const path = key.split('.');
    const leaf = path.pop();
    if (!leaf) continue;

    let target: Record<string, unknown> = next as unknown as Record<string, unknown>;
    let reachable = true;

    for (const segment of path) {
      const child = (target as Record<string, unknown>)[segment];
      if (!child || typeof child !== 'object') {
        reachable = false;
        break;
      }
      target = child as Record<string, unknown>;
    }

    /*
     * Only replace an existing string. Anything else means the key no longer
     * matches the catalogue — an override saved against a key that has since
     * been removed, for instance — and the bundled copy is the safer answer.
     * This is what stops a stale row in `site_content` from breaking a page.
     */
    if (reachable && typeof target[leaf] === 'string') {
      target[leaf] = value;
    }
  }

  return next;
}

/* ===========================================================================
 * Grouping, for the editor
 * =========================================================================== */

export type SiteContentSection = {
  id: string;
  /** English, and not translated: the editor is an internal tool. */
  title: string;
  keys: string[];
};

/**
 * The order the sections appear on the page, and the order of the strings
 * inside each one.
 *
 * Prefixes rather than exact keys, so adding `faqItems.6.q` lands in the
 * right group without anybody registering it. A key belongs to the first
 * section that claims a prefix of it, and sorts by which prefix matched — which
 * is how the hero reads tagline, headline, subhead, then the buttons, rather
 * than alphabetically.
 */
const SECTION_DEFINITIONS: { id: string; title: string; prefixes: string[] }[] = [
  { id: 'meta', title: 'Search results and sharing', prefixes: ['metaTitle', 'metaDescription'] },
  {
    id: 'nav',
    title: 'Navigation',
    prefixes: ['navHow', 'navPricing', 'navFaq', 'navSignIn', 'navMenu', 'skipToContent'],
  },
  {
    id: 'hero',
    title: 'Hero',
    prefixes: ['tagline', 'headline', 'subhead', 'ctaPrimary', 'ctaSecondary', 'ctaNote'],
  },
  {
    id: 'pricing',
    title: 'Pricing',
    prefixes: [
      'pricingEyebrow',
      'pricingTitle',
      'pricingLead',
      'pricingPopular',
      'pricingFree',
      'pricingPerMonth',
      'pricingIncluded',
      'pricingCtaFree',
      'pricingCta',
      'pricingNote',
    ],
  },
  {
    id: 'frame',
    title: 'The idea (Trello comparison)',
    prefixes: [
      'frameEyebrow',
      'frameTitle',
      'frameLead',
      'frameEndsTitle',
      'frameEndsBody',
      'frameReturnsTitle',
      'frameReturnsBody',
    ],
  },
  { id: 'spaces', title: 'Scene: spaces', prefixes: ['spacesEyebrow', 'spacesTitle', 'spacesLead'] },
  {
    id: 'depth',
    title: 'Scene: nested checklists',
    prefixes: ['depthEyebrow', 'depthTitle', 'depthLead', 'depthNote'],
  },
  { id: 'proof', title: 'Scene: photo, file and location', prefixes: ['proofEyebrow', 'proofTitle', 'proofLead'] },
  { id: 'rhythm', title: 'Scene: scheduling', prefixes: ['rhythmEyebrow', 'rhythmTitle', 'rhythmLead'] },
  { id: 'people', title: 'Scene: assignment and notes', prefixes: ['peopleEyebrow', 'peopleTitle', 'peopleLead'] },
  {
    id: 'insights',
    title: 'Scene: reports',
    prefixes: ['insightsEyebrow', 'insightsTitle', 'insightsLead', 'insightsCaption'],
  },
  {
    id: 'walk',
    title: 'Attendance walkthrough',
    prefixes: ['walkEyebrow', 'walkTitle', 'walkLead', 'walkSteps.'],
  },
  {
    id: 'cases',
    title: 'Other use cases',
    prefixes: ['casesEyebrow', 'casesTitle', 'casesLead', 'casesEnforced', 'cases.'],
  },
  {
    id: 'traction',
    title: 'Gidlist so far (numbers)',
    prefixes: [
      'tractionVisible',
      'tractionLabel',
      'tractionNote',
      'tractionSpacesLabel',
      'tractionSpacesValue',
      'tractionSubmissionsLabel',
      'tractionSubmissionsValue',
      'tractionMembersLabel',
      'tractionMembersValue',
    ],
  },
  {
    id: 'faq',
    title: 'Questions and answers',
    prefixes: ['faqVisible', 'faqEyebrow', 'faqTitle', 'faqLead', 'faqItems.'],
  },
  { id: 'close', title: 'Closing section', prefixes: ['closeTitle', 'closeBody'] },
  {
    id: 'footer',
    title: 'Footer',
    prefixes: [
      'footerProduct',
      'footerAccount',
      'footerLegal',
      'footerCompany',
      'footerNote',
      'footerRights',
      'footerLanguage',
    ],
  },
];

/**
 * Every editable string, grouped by where it appears on the page.
 *
 * ENDS WITH A CATCH-ALL, and that is the important part. A string added to
 * `SiteMessages` that matches no prefix appears under "Not yet grouped" rather
 * than disappearing from the editor. Silently dropping it would be the worst
 * outcome: the copy would exist on the site and be uneditable, with nothing to
 * indicate why.
 */
/**
 * Order two keys that matched the same prefix.
 *
 * Nested keys look like `walkSteps.2.title`, and a plain alphabetical
 * sort puts `.body` above `.title` — so every card in the editor reads bottom
 * half first. This keeps the numeric part in order and puts the heading above
 * its own paragraph, which is how they appear on the page.
 */
function compareWithinSection(a: string, b: string): number {
  const parse = (key: string) => {
    const parts = key.split('.');
    return {
      index: parts.length > 1 ? Number(parts[1]) : -1,
      field: parts[parts.length - 1],
    };
  };

  const left = parse(a);
  const right = parse(b);

  if (left.index !== right.index) return left.index - right.index;

  const FIELD_ORDER = ['title', 'body'];
  const rank = (field: string) => {
    const i = FIELD_ORDER.indexOf(field);
    return i === -1 ? FIELD_ORDER.length : i;
  };

  return rank(left.field) - rank(right.field) || a.localeCompare(b);
}

export function siteContentSections(): SiteContentSection[] {
  const remaining = new Set(siteContentKeys());
  const sections: SiteContentSection[] = [];

  for (const definition of SECTION_DEFINITIONS) {
    const claimed: { key: string; rank: number }[] = [];

    for (const key of remaining) {
      const rank = definition.prefixes.findIndex((prefix) => key.startsWith(prefix));
      if (rank !== -1) claimed.push({ key, rank });
    }

    for (const { key } of claimed) remaining.delete(key);

    if (claimed.length > 0) {
      sections.push({
        id: definition.id,
        title: definition.title,
        keys: claimed
          .sort((a, b) => a.rank - b.rank || compareWithinSection(a.key, b.key))
          .map((c) => c.key),
      });
    }
  }

  if (remaining.size > 0) {
    sections.push({
      id: 'ungrouped',
      title: 'Not yet grouped',
      keys: [...remaining].sort(),
    });
  }

  return sections;
}

/**
 * Whether a hideable section is drawn.
 *
 * Fails safe on purpose: a typo, an empty value or an unexpected word leaves the
 * content on the page. The failure mode of a hide-flag should be "still there",
 * never "silently gone from the site with nothing to indicate why".
 *
 * Lives here, beside the `Visible` type it reads, because it was copied into two
 * components and then needed by a third — and a rule about what counts as hidden
 * that exists in three places is a rule that will eventually disagree with
 * itself. The header has to ask the same question the section does, or a nav
 * link survives its own destination.
 */
export function isVisible(value: Visible): boolean {
  return value.trim().toLowerCase() !== 'no';
}
