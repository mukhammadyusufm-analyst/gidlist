import type { BuiltinLocale } from '@app/core';

/**
 * Site copy, in the three languages the product ships in.
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

type Card = { title: string; body: string };

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
  navSignIn: string;
  skipToContent: string;

  // Hero
  headline: string;
  subhead: string;
  ctaPrimary: string;
  ctaSecondary: string;
  ctaNote: string;

  // Problem
  problemEyebrow: string;
  problemTitle: string;
  problemLead: string;
  problemCards: [Card, Card];
  problemClose: string;

  // What it does
  featuresEyebrow: string;
  featuresTitle: string;
  featuresLead: string;
  features: [Card, Card, Card, Card];

  // How it works — a real sequence, which is why it is numbered
  howEyebrow: string;
  howTitle: string;
  howLead: string;
  steps: [Card, Card, Card, Card];

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

  // Closing call to action
  finalTitle: string;
  finalLead: string;

  // Footer
  footerNote: string;
  footerRights: string;
  footerLanguage: string;
};

export const MESSAGES: Record<BuiltinLocale, SiteMessages> = {
  en: {
    htmlLang: 'en',
    tagline: 'Get it done.',
    metaTitle: 'Gidlist — checklists that prove they were done',
    metaDescription:
      'Recurring operational checklists with a record nobody can quietly edit. Schedule them, assign them, and show an auditor exactly what happened.',

    navHow: 'How it works',
    navPricing: 'Pricing',
    navSignIn: 'Sign in',
    skipToContent: 'Skip to content',

    headline: 'Checklists that prove they were done',
    subhead:
      'The opening check on a shop floor. The ward round in a clinic. The month-end close in a finance team. Gidlist schedules the work, assigns it, and keeps a record nobody can quietly edit.',
    ctaPrimary: 'Start free',
    ctaSecondary: 'See how it works',
    ctaNote: 'Free for 5 people. No card required.',

    problemEyebrow: 'The problem',
    problemTitle: 'Two rooms, one problem',
    problemLead:
      'The work almost certainly got done. That has never been the hard part. The hard part is showing it, three months later, to somebody who was not there.',
    problemCards: [
      {
        title: 'A clipboard and a group chat',
        body: 'The opening check is on paper in a drawer, or in a photo somebody sent at 6am. Nobody can tell you whether last Tuesday was signed off without going to look, and the sheet can be filled in afterwards.',
      },
      {
        title: 'A spreadsheet and a lost thread',
        body: 'The month-end close lives in a file with fourteen tabs and no history. Who ticked what, and when, is whatever the last person to save it says it is.',
      },
    ],
    problemClose:
      'Both end the same way: the work was probably done, and there is no way to show it.',

    featuresEyebrow: 'What it does',
    featuresTitle: 'A record, not a reminder',
    featuresLead:
      'Plenty of tools will nag somebody to do a task. The point of this one is what is left behind afterwards.',
    features: [
      {
        title: 'Recurring by schedule',
        body: 'Daily, weekly, monthly or a specific set of weekdays. Occurrences are created ahead of time and assigned automatically, so nobody has to remember to create this morning’s check.',
      },
      {
        title: 'Nothing goes missing',
        body: 'An occurrence nobody filled in is marked Missed on its own, overnight. A gap in the record is itself a record — which is what makes the rest of it trustworthy.',
      },
      {
        title: 'Submitted is final',
        body: 'A submitted checklist cannot be edited, by anyone, including an owner. If a record should not count, it is voided with a reason and stays visible. Nothing is quietly rewritten.',
      },
      {
        title: 'Versioned templates',
        body: 'Editing a template in March does not change what a January submission looked like. The history stays true to what people were actually asked to do at the time.',
      },
    ],

    howEyebrow: 'How it works',
    howTitle: 'Four steps, then it runs itself',
    howLead:
      'Setting up the first checklist takes about ten minutes. After that the schedule does the work.',
    steps: [
      {
        title: 'Build the checklist',
        body: 'Sections and items, nested up to five levels deep. A parent item completes itself once its sub-items are done. Publish it when it reads right.',
      },
      {
        title: 'Put it on a schedule',
        body: 'Choose how often it recurs and who it goes to. Assignments follow the schedule, so a new person joining a shift does not mean rebuilding anything.',
      },
      {
        title: 'People fill it in',
        body: 'On a phone, one-handed, with gloves on. Whole rows are tap targets. Notes attach to individual items where something needs explaining.',
      },
      {
        title: 'You have the evidence',
        body: 'Completion rates by day, by checklist, by person. Filter to a date range and a space, and you are looking at exactly what an auditor would ask for.',
      },
    ],

    pricingEyebrow: 'Pricing',
    pricingTitle: 'Priced per company, not per seat',
    pricingLead:
      'A checklist is worth less when half the shift is left off it. Charging per person would make the safest thing to do the expensive one, so plans are sized by capacity instead.',
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

    finalTitle: 'Start with one checklist',
    finalLead:
      'Pick the check that would be hardest to prove happened, and put that one in first. Free for five people, and nothing to install.',

    footerNote: 'Built in Uzbekistan.',
    footerRights: 'All rights reserved.',
    footerLanguage: 'Language',
  },

  uz: {
    htmlLang: 'uz',
    tagline: 'Hammasi bajariladi!',
    metaTitle: 'Gidlist — bajarilganini isbotlaydigan roʻyxatlar',
    metaDescription:
      'Muntazam ish roʻyxatlari va hech kim sezdirmay oʻzgartira olmaydigan yozuv. Rejalashtiring, biriktiring va nima boʻlganini aniq koʻrsating.',

    navHow: 'Qanday ishlaydi',
    navPricing: 'Narxlar',
    navSignIn: 'Kirish',
    skipToContent: 'Asosiy qismga oʻtish',

    headline: 'Bajarilganini isbotlaydigan roʻyxatlar',
    subhead:
      'Sexdagi ochilish tekshiruvi. Klinikadagi navbatchilik aylanishi. Moliya boʻlimidagi oy yakuni. Gidlist ishni rejalashtiradi, mas’ulini belgilaydi va hech kim sezdirmay oʻzgartira olmaydigan yozuvni saqlaydi.',
    ctaPrimary: 'Bepul boshlash',
    ctaSecondary: 'Qanday ishlashini koʻrish',
    ctaNote: '5 kishi uchun bepul. Karta talab qilinmaydi.',

    problemEyebrow: 'Muammo',
    problemTitle: 'Ikki xona, bitta muammo',
    problemLead:
      'Ish, ehtimol, bajarilgan. Qiyini bu emas. Qiyini — uch oy oʻtib, oʻsha yerda boʻlmagan odamga buni koʻrsatish.',
    problemCards: [
      {
        title: 'Planshet va guruh chati',
        body: 'Ochilish tekshiruvi qogʻozda, tortmada yotibdi yoki kimdir ertalab soat 6 da yuborgan suratda. Oʻtgan seshanba imzolanganmi — borib qaramasdan hech kim ayta olmaydi, varaqni esa keyin ham toʻldirib qoʻyish mumkin.',
      },
      {
        title: 'Jadval va yoʻqolgan yozishma',
        body: 'Oy yakuni oʻn toʻrtta varaqli faylda, tarixsiz. Kim nimani, qachon belgilagani — faylni oxirgi saqlagan odam nima desa, oʻsha.',
      },
    ],
    problemClose:
      'Ikkalasi ham bir xil tugaydi: ish, ehtimol, bajarilgan, lekin buni koʻrsatishning iloji yoʻq.',

    featuresEyebrow: 'Nima qiladi',
    featuresTitle: 'Eslatma emas, yozuv',
    featuresLead:
      'Vazifani eslatadigan dasturlar koʻp. Bunisining maʼnosi — ish tugagach ortda nima qolishida.',
    features: [
      {
        title: 'Jadval boʻyicha takrorlanadi',
        body: 'Har kuni, har hafta, har oy yoki tanlangan kunlarda. Takrorlar oldindan yaratiladi va avtomatik biriktiriladi — bugungi tekshiruvni yaratishni eslab qolish shart emas.',
      },
      {
        title: 'Hech narsa yoʻqolmaydi',
        body: 'Hech kim toʻldirmagan takror tunda oʻzi “Oʻtkazib yuborilgan” deb belgilanadi. Yozuvdagi boʻshliq ham yozuvdir — qolganiga ishonch shundan keladi.',
      },
      {
        title: 'Topshirilgani — yakuniy',
        body: 'Topshirilgan roʻyxatni hech kim, hatto egasi ham oʻzgartira olmaydi. Yozuv hisobga olinmasligi kerak boʻlsa, sababi bilan bekor qilinadi va koʻrinib turadi. Hech narsa sezdirmay qayta yozilmaydi.',
      },
      {
        title: 'Shablon versiyalari',
        body: 'Mart oyida shablonni tahrirlash yanvardagi topshiriqning koʻrinishini oʻzgartirmaydi. Tarix oʻsha paytda odamlardan aynan nima soʻralganiga sodiq qoladi.',
      },
    ],

    howEyebrow: 'Qanday ishlaydi',
    howTitle: 'Toʻrt qadam, keyin oʻzi ishlaydi',
    howLead:
      'Birinchi roʻyxatni sozlash taxminan oʻn daqiqa. Undan keyin ishni jadvalning oʻzi bajaradi.',
    steps: [
      {
        title: 'Roʻyxatni tuzing',
        body: 'Boʻlimlar va bandlar, besh darajagacha ichma-ich. Ost-bandlari bajarilgach, asosiy band oʻzi yopiladi. Matn joyida boʻlsa, chop eting.',
      },
      {
        title: 'Jadvalga qoʻying',
        body: 'Qanchalik tez-tez takrorlanishini va kimga borishini tanlang. Biriktirish jadvalga ergashadi, shuning uchun smenaga yangi odam qoʻshilsa, hech narsani qayta qurish kerak emas.',
      },
      {
        title: 'Odamlar toʻldiradi',
        body: 'Telefonda, bir qoʻlda, qoʻlqopda. Butun qator bosish uchun nishon. Izoh kerak boʻlgan joyda, aynan oʻsha bandga biriktiriladi.',
      },
      {
        title: 'Dalil sizda',
        body: 'Kunlar, roʻyxatlar va odamlar kesimida bajarilish darajasi. Sanani va makonni tanlang — tekshiruvchi soʻraydigan narsaning aynan oʻzi koʻrinadi.',
      },
    ],

    pricingEyebrow: 'Narxlar',
    pricingTitle: 'Har bir odam uchun emas, kompaniya uchun',
    pricingLead:
      'Smenaning yarmi chetda qolsa, roʻyxatning qiymati tushadi. Har bir odam uchun toʻlov eng xavfsiz yoʻlni eng qimmatiga aylantirar edi — shuning uchun tariflar sigʻim boʻyicha.',
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

    finalTitle: 'Bitta roʻyxatdan boshlang',
    finalLead:
      'Bajarilganini isbotlash eng qiyin boʻlgan tekshiruvni tanlang va avval oʻshani kiriting. Besh kishi uchun bepul, hech narsa oʻrnatish shart emas.',

    footerNote: 'Oʻzbekistonda yaratilgan.',
    footerRights: 'Barcha huquqlar himoyalangan.',
    footerLanguage: 'Til',
  },

  ru: {
    htmlLang: 'ru',
    tagline: 'Всё будет выполнено!',
    metaTitle: 'Gidlist — чек-листы, которые доказывают, что работа выполнена',
    metaDescription:
      'Регулярные операционные чек-листы и запись, которую нельзя незаметно изменить. Планируйте, назначайте и показывайте проверяющему, что именно произошло.',

    navHow: 'Как это работает',
    navPricing: 'Цены',
    navSignIn: 'Войти',
    skipToContent: 'Перейти к содержанию',

    headline: 'Чек-листы, которые доказывают, что работа выполнена',
    subhead:
      'Утренняя проверка в цехе. Обход в клинике. Закрытие месяца в финансовом отделе. Gidlist планирует работу, назначает ответственного и хранит запись, которую нельзя незаметно изменить.',
    ctaPrimary: 'Начать бесплатно',
    ctaSecondary: 'Как это работает',
    ctaNote: 'Бесплатно для 5 человек. Карта не нужна.',

    problemEyebrow: 'Проблема',
    problemTitle: 'Две комнаты, одна проблема',
    problemLead:
      'Работа почти наверняка была сделана. Сложность никогда не в этом. Сложность — показать это через три месяца тому, кого там не было.',
    problemCards: [
      {
        title: 'Планшет и групповой чат',
        body: 'Утренняя проверка — на бумаге в ящике или на фотографии, отправленной в шесть утра. Был ли подписан прошлый вторник, никто не скажет, не сходив и не посмотрев, а лист можно заполнить и задним числом.',
      },
      {
        title: 'Таблица и потерянная переписка',
        body: 'Закрытие месяца живёт в файле с четырнадцатью вкладками и без истории. Кто что отметил и когда — это то, что скажет последний сохранивший.',
      },
    ],
    problemClose:
      'И то и другое заканчивается одинаково: работа, вероятно, сделана, а показать это нечем.',

    featuresEyebrow: 'Что он делает',
    featuresTitle: 'Запись, а не напоминание',
    featuresLead:
      'Напоминалок про задачи хватает и без нас. Смысл этой системы — в том, что остаётся после.',
    features: [
      {
        title: 'Повторяется по расписанию',
        body: 'Ежедневно, еженедельно, ежемесячно или по выбранным дням недели. Повторения создаются заранее и назначаются автоматически — не нужно помнить, что сегодняшнюю проверку надо создать.',
      },
      {
        title: 'Ничего не теряется',
        body: 'Повторение, которое никто не заполнил, ночью само помечается как «Пропущено». Пробел в записи — тоже запись, и именно поэтому остальному можно верить.',
      },
      {
        title: 'Отправлено — значит окончательно',
        body: 'Отправленный чек-лист не может изменить никто, включая владельца. Если запись не должна учитываться, её аннулируют с указанием причины, и она остаётся видимой. Ничего не переписывается незаметно.',
      },
      {
        title: 'Версии шаблонов',
        body: 'Правка шаблона в марте не меняет того, как выглядела январская отправка. История остаётся верной тому, что тогда действительно требовалось от людей.',
      },
    ],

    howEyebrow: 'Как это работает',
    howTitle: 'Четыре шага — дальше само',
    howLead:
      'Настройка первого чек-листа занимает около десяти минут. Дальше работу делает расписание.',
    steps: [
      {
        title: 'Соберите чек-лист',
        body: 'Разделы и пункты, вложенность до пяти уровней. Родительский пункт закрывается сам, когда выполнены вложенные. Опубликуйте, когда формулировки читаются верно.',
      },
      {
        title: 'Поставьте на расписание',
        body: 'Выберите, как часто он повторяется и кому достаётся. Назначения следуют за расписанием, поэтому новый человек в смене не означает пересборку.',
      },
      {
        title: 'Люди заполняют',
        body: 'С телефона, одной рукой, в перчатках. Нажимается вся строка целиком. Заметка прикрепляется к конкретному пункту там, где нужно пояснение.',
      },
      {
        title: 'У вас есть доказательство',
        body: 'Выполнение по дням, по чек-листам, по людям. Задайте период и пространство — и вы смотрите ровно на то, что запросит проверяющий.',
      },
    ],

    pricingEyebrow: 'Цены',
    pricingTitle: 'Цена за компанию, а не за человека',
    pricingLead:
      'Чек-лист стоит меньше, если половина смены в него не попала. Оплата за человека сделала бы самый безопасный вариант самым дорогим, поэтому тарифы измеряются вместимостью.',
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

    finalTitle: 'Начните с одного чек-листа',
    finalLead:
      'Возьмите ту проверку, выполнение которой труднее всего доказать, и заведите сначала её. Бесплатно для пяти человек, ничего не нужно устанавливать.',

    footerNote: 'Сделано в Узбекистане.',
    footerRights: 'Все права защищены.',
    footerLanguage: 'Язык',
  },
};
