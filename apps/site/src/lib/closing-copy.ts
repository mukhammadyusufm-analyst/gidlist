import type { BuiltinLocale } from '@/lib/i18n/locale';

/**
 * Scenes 10 to 14: the flagship walkthrough, the other cases, the objections,
 * and the close.
 *
 * WHAT IS DELIBERATELY ABSENT FROM THE WALKTHROUGH. No submission time window.
 * The obvious way to dramatise a clock-in is "the window is open, you are on
 * time" — and the product cannot enforce a window yet. Staging it would be the
 * most expensive kind of marketing lie, because the customer discovers it on day
 * one. What is shown instead is true: the tick carries the time it happened, and
 * a manager can see it.
 *
 * The objections are written as answers to real hesitations rather than as a
 * feature list phrased with question marks. Where the honest answer is "not
 * yet", it says so — a prospect who finds one straight answer tends to believe
 * the rest of the page, and one caught overstating loses all of it.
 */

export type Step = { title: string; body: string; caption: string };

export type Faq = { q: string; a: string };

export type ClosingCopy = {
  walkthrough: {
    eyebrow: string;
    title: string;
    body: string;
    steps: Step[];
    skip: string;
    replay: string;
    next: string;
    back: string;
    stepLabel: string;
    textVersion: string;
  };
  cases: {
    eyebrow: string;
    title: string;
    body: string;
    enforcedLabel: string;
    items: { name: string; what: string; enforced: string }[];
  };
  traction: {
    label: string;
    note: string;
    metrics: { label: string }[];
  };
  faq: { eyebrow: string; title: string; body: string; items: Faq[] };
  close: { title: string; body: string };
};

const en: ClosingCopy = {
  walkthrough: {
    eyebrow: '10 · One morning',
    title: 'Clock-in, verified',
    body: 'Attendance is the case where a signature on paper has always been worth the least. Walk through one employee, one morning — this is the whole flow, in six steps.',
    stepLabel: 'Step',
    skip: 'Skip to the end',
    replay: 'Start again',
    next: 'Next',
    back: 'Back',
    textVersion: 'Written version of this walkthrough',
    steps: [
      {
        title: 'Open the space',
        body: 'She opens Head office on her phone. Everything her branch runs lives in that one space.',
        caption: 'Head office',
      },
      {
        title: "Today's list is waiting",
        body: 'Daily attendance is already there. Nobody sent it, nobody had to remember: it repeats every weekday at 09:00.',
        caption: 'Daily attendance · 09:00',
      },
      {
        title: 'The task asks for a photo',
        body: 'This one cannot be ticked without one. The camera opens straight from the task rather than sending her to her gallery.',
        caption: 'Photo required',
      },
      {
        title: 'Location registers with it',
        body: 'The coordinates and their accuracy are attached to that tick, so the record answers where as well as what.',
        caption: '40.7821, 72.3442 · ±8 m',
      },
      {
        title: 'Submit',
        body: 'The tick is saved with the time it happened. Not the time it was uploaded, and not the time anybody typed it in later.',
        caption: 'Submitted 09:04',
      },
      {
        title: "The manager's view updates",
        body: 'Fourteen people, thirteen in, one still open — visible without asking anybody, and countable at the end of the month.',
        caption: '13/14 signed in',
      },
    ],
  },
  cases: {
    eyebrow: '11 · Elsewhere',
    title: 'Same shape, different room',
    body: 'Anywhere work repeats and somebody has to show it happened.',
    enforcedLabel: 'What gets enforced',
    items: [
      {
        name: 'Retail opening and closing',
        what: 'The routine that decides whether the doors open on time.',
        enforced: 'Photo of the floor, location at the branch',
      },
      {
        name: 'Food safety and hygiene',
        what: 'Temperature logs and cleaning schedules that an inspector will ask for.',
        enforced: 'Photo of every reading',
      },
      {
        name: 'Equipment maintenance rounds',
        what: 'Scheduled checks on machinery, with the detail nested under each machine.',
        enforced: 'Photo, and a note on anything out of range',
      },
      {
        name: 'Security patrol rounds',
        what: 'The round nobody can prove was walked.',
        enforced: 'Location at each point',
      },
    ],
  },
  traction: {
    label: 'Gidlist so far',
    note: 'Figures to be supplied.',
    metrics: [
      { label: 'Spaces created' },
      { label: 'Checklists submitted' },
      { label: 'Photos recorded' },
    ],
  },
  faq: {
    eyebrow: '13 · Before you ask',
    title: 'The questions worth asking us',
    body: 'The ones that decide whether this is usable where you work.',
    items: [
      {
        q: 'Where do the photos and locations end up?',
        a: 'In your space, visible to the people you have put in it and to nobody else. Photos sit in private storage reachable only through short-lived links, and access is enforced by the database itself rather than only by the app — so a fault in one screen cannot expose another company’s records. Our infrastructure providers operate outside Uzbekistan, which means your data may be stored abroad; if that matters to your obligations, talk to us before you put regulated records in.',
      },
      {
        q: 'Is it lawful to record where an employee ticked something?',
        a: 'That depends on where you are and what you tell your staff, and we are not the right people to advise you on it. What we can tell you is what the product does: location is captured only on tasks where you have switched it on, only at the moment of the tick, and never in the background — the app cannot read a position while it is closed. Tell your team what is being collected before you turn it on.',
      },
      {
        q: 'What happens when there is no signal?',
        a: 'Today, ticking needs a connection, so a basement or a cold store will stop somebody mid-list. Offline filling with a queue of pending writes is being built and is not finished; we would rather say that than let you find out on a shift.',
      },
      {
        q: 'Does it need an app from the store?',
        a: 'No. It runs in the browser on any modern phone and can be added to the home screen, so there is nothing to install and nothing to approve. The camera and location work from there.',
      },
      {
        q: 'How long does it take to set up?',
        a: 'A first checklist takes a few minutes. Moving a paper or spreadsheet routine across takes as long as typing it once — there is no import, and for most routines retyping is faster than mapping a spreadsheet would be.',
      },
      {
        q: 'Which languages, and how many people?',
        a: 'English, Uzbek and Russian, and an administrator can add another language and translate it without waiting for a release. The free plan covers five people; larger teams and longer retention of photos are what the paid plans buy.',
      },
    ],
  },
  close: {
    title: 'Start with one checklist',
    body: 'Pick the routine you most often have to vouch for, and write it down once. Free for five people, no card.',
  },
};

const uz: ClosingCopy = {
  walkthrough: {
    eyebrow: '10 · Bir tong',
    title: 'Tasdiqlangan davomat',
    body: 'Davomat — qogʻozdagi imzo eng kam qiymatga ega boʻlgan holat. Bitta xodimning bitta tongini kuzating: butun jarayon olti qadamda.',
    stepLabel: 'Qadam',
    skip: 'Oxiriga oʻtish',
    replay: 'Qaytadan',
    next: 'Keyingi',
    back: 'Orqaga',
    textVersion: 'Ushbu jarayonning matnli varianti',
    steps: [
      {
        title: 'Maydonni ochadi',
        body: 'U telefonida Bosh ofis maydonini ochadi. Filiali bajaradigan hamma narsa shu bitta maydonda.',
        caption: 'Bosh ofis',
      },
      {
        title: 'Bugungi roʻyxat kutmoqda',
        body: 'Kunlik davomat allaqachon joyida. Uni hech kim yubormagan va hech kim eslashi shart emas: u har ish kuni 09:00 da takrorlanadi.',
        caption: 'Kunlik davomat · 09:00',
      },
      {
        title: 'Vazifa surat soʻraydi',
        body: 'Usiz bu vazifani belgilab boʻlmaydi. Kamera galereyaga yubormasdan, toʻgʻridan-toʻgʻri vazifadan ochiladi.',
        caption: 'Surat majburiy',
      },
      {
        title: 'Joylashuv ham qayd etiladi',
        body: 'Koordinatalar va ularning aniqligi oʻsha belgiga biriktiriladi — shunda yozuv nima bilan birga qayerda degan savolga ham javob beradi.',
        caption: '40.7821, 72.3442 · ±8 m',
      },
      {
        title: 'Yuboradi',
        body: 'Belgi sodir boʻlgan vaqti bilan saqlanadi. Yuklangan vaqti bilan emas va keyinroq kimdir kiritgan vaqt bilan ham emas.',
        caption: 'Yuborildi 09:04',
      },
      {
        title: 'Rahbar koʻrinishi yangilanadi',
        body: 'Oʻn toʻrt kishi, oʻn uchtasi keldi, bittasi ochiq — hech kimdan soʻramasdan koʻrinadi va oy oxirida sanab chiqiladi.',
        caption: '13/14 qayd etdi',
      },
    ],
  },
  cases: {
    eyebrow: '11 · Boshqa joylarda',
    title: 'Oʻsha shakl, boshqa xona',
    body: 'Ish takrorlanadigan va uni bajarilganini koʻrsatish kerak boʻlgan har qanday joyda.',
    enforcedLabel: 'Nima talab qilinadi',
    items: [
      {
        name: 'Doʻkon ochilishi va yopilishi',
        what: 'Eshiklar oʻz vaqtida ochilishini hal qiladigan tartib.',
        enforced: 'Zal surati, filialdagi joylashuv',
      },
      {
        name: 'Oziq-ovqat xavfsizligi va gigiyena',
        what: 'Nazoratchi soʻraydigan harorat jurnallari va tozalash jadvallari.',
        enforced: 'Har bir koʻrsatkich surati',
      },
      {
        name: 'Uskunalarga texnik xizmat',
        what: 'Rejali koʻriklar, har bir mashina ostida batafsil tartib bilan.',
        enforced: 'Surat va meʼyordan chetlashishga izoh',
      },
      {
        name: 'Qorovul aylanishlari',
        what: 'Hech kim bajarilganini isbotlay olmaydigan aylanish.',
        enforced: 'Har bir nuqtadagi joylashuv',
      },
    ],
  },
  traction: {
    label: 'Gidlist bugungi kunda',
    note: 'Raqamlar keyinroq qoʻshiladi.',
    metrics: [
      { label: 'Yaratilgan maydonlar' },
      { label: 'Yuborilgan roʻyxatlar' },
      { label: 'Qayd etilgan suratlar' },
    ],
  },
  faq: {
    eyebrow: '13 · Savol berishdan oldin',
    title: 'Bizga berishga arziydigan savollar',
    body: 'Bu sizning ish joyingizda ishlatsa boʻladimi yoki yoʻqmi — shuni hal qiladigan savollar.',
    items: [
      {
        q: 'Suratlar va joylashuv qayerga tushadi?',
        a: 'Sizning maydoningizga — siz kiritgan odamlarga koʻrinadi, boshqa hech kimga emas. Suratlar yopiq xotirada saqlanadi va faqat qisqa muddatli havolalar orqali ochiladi, kirish esa faqat ilova darajasida emas, maʼlumotlar bazasining oʻzida cheklanadi: bitta ekrandagi xato boshqa kompaniyaning yozuvlarini ocha olmaydi. Provayderlarimiz infratuzilmasi Oʻzbekistondan tashqarida ishlaydi, yaʼni maʼlumot chet elda saqlanishi mumkin; bu sizning majburiyatlaringizga taʼsir qilsa, tartibga solinadigan yozuvlarni joylashdan oldin biz bilan gaplashing.',
      },
      {
        q: 'Xodim qayerda belgilaganini yozib olish qonuniymi?',
        a: 'Bu siz qayerda ekanligingizga va xodimlaringizga nima deganingizga bogʻliq, va bu boʻyicha maslahat beradigan odam biz emasmiz. Mahsulot nima qilishini ayta olamiz: joylashuv faqat siz yoqqan vazifalarda, faqat belgilangan payt olinadi va hech qachon fonda emas — ilova yopiq boʻlganda oʻrningizni oʻqiy olmaydi. Yoqishdan oldin jamoangizga nima toʻplanishini ayting.',
      },
      {
        q: 'Aloqa boʻlmasa nima boʻladi?',
        a: 'Hozircha belgilash uchun aloqa kerak, shuning uchun yerto‘la yoki sovuq ombor odamni roʻyxat oʻrtasida toʻxtatadi. Oflayn toʻldirish va kutilayotgan yozuvlar navbati ishlab chiqilmoqda, hali tugallanmagan; buni smena paytida bilib olishingizdan koʻra aytganimiz maʼqul.',
      },
      {
        q: 'Doʻkondan ilova yuklash kerakmi?',
        a: 'Yoʻq. U har qanday zamonaviy telefonning brauzerida ishlaydi va bosh ekranga qoʻshilishi mumkin — oʻrnatadigan ham, tasdiqlatadigan ham narsa yoʻq. Kamera va joylashuv oʻsha yerdan ishlaydi.',
      },
      {
        q: 'Sozlash qancha vaqt oladi?',
        a: 'Birinchi roʻyxat bir necha daqiqa. Qogʻoz yoki jadvaldagi tartibni koʻchirish uni bir marta yozib chiqish qancha vaqt olsa, shuncha vaqt oladi — import yoʻq, va koʻpchilik tartiblar uchun qayta yozish jadvalni moslashtirishdan tezroq.',
      },
      {
        q: 'Qaysi tillar va necha kishi?',
        a: 'Ingliz, oʻzbek va rus tillari, administrator esa yangi relizni kutmasdan boshqa til qoʻshib, uni tarjima qilishi mumkin. Bepul tarif besh kishini qamrab oladi; kattaroq jamoalar va suratlarning uzoqroq saqlanishi pullik tariflar beradigan narsa.',
      },
    ],
  },
  close: {
    title: 'Bitta roʻyxatdan boshlang',
    body: 'Koʻpincha javob berishingizga toʻgʻri keladigan tartibni tanlang va uni bir marta yozib qoʻying. Besh kishi uchun bepul, karta kerak emas.',
  },
};

const ru: ClosingCopy = {
  walkthrough: {
    eyebrow: '10 · Одно утро',
    title: 'Отметка о приходе, подтверждённая',
    body: 'Явка — тот случай, где подпись на бумаге всегда стоила меньше всего. Пройдите одно утро одного сотрудника: весь процесс в шести шагах.',
    stepLabel: 'Шаг',
    skip: 'Сразу к концу',
    replay: 'Сначала',
    next: 'Дальше',
    back: 'Назад',
    textVersion: 'Текстовая версия этого прохода',
    steps: [
      {
        title: 'Открывает пространство',
        body: 'Она открывает «Головной офис» в телефоне. Всё, что делает её филиал, живёт в этом одном пространстве.',
        caption: 'Головной офис',
      },
      {
        title: 'Сегодняшний список уже ждёт',
        body: 'Ежедневная явка уже на месте. Никто её не отправлял и никому не нужно было помнить: она повторяется по будням в 09:00.',
        caption: 'Ежедневная явка · 09:00',
      },
      {
        title: 'Задача требует фото',
        body: 'Без него отметить нельзя. Камера открывается прямо из задачи, а не отправляет её в галерею.',
        caption: 'Фото обязательно',
      },
      {
        title: 'Вместе с ним фиксируется локация',
        body: 'Координаты и их точность прикрепляются к этой отметке, поэтому запись отвечает и на «где», а не только на «что».',
        caption: '40.7821, 72.3442 · ±8 м',
      },
      {
        title: 'Отправляет',
        body: 'Отметка сохраняется со временем, когда она произошла. Не со временем загрузки и не со временем, когда её кто-то вписал позже.',
        caption: 'Отправлено 09:04',
      },
      {
        title: 'Вид руководителя обновляется',
        body: 'Четырнадцать человек, тринадцать отметились, один открыт — видно, ничего ни у кого не спрашивая, и считается в конце месяца.',
        caption: '13/14 отметились',
      },
    ],
  },
  cases: {
    eyebrow: '11 · В других местах',
    title: 'Та же форма, другая комната',
    body: 'Везде, где работа повторяется и кто-то должен показать, что она сделана.',
    enforcedLabel: 'Что требуется',
    items: [
      {
        name: 'Открытие и закрытие магазина',
        what: 'Порядок, от которого зависит, откроются ли двери вовремя.',
        enforced: 'Фото зала, локация на точке',
      },
      {
        name: 'Пищевая безопасность и гигиена',
        what: 'Журналы температур и графики уборки, которые спросит проверяющий.',
        enforced: 'Фото каждого показания',
      },
      {
        name: 'Обслуживание оборудования',
        what: 'Плановые осмотры с детализацией под каждой машиной.',
        enforced: 'Фото и примечание к отклонениям',
      },
      {
        name: 'Обходы охраны',
        what: 'Обход, который никто не может доказать.',
        enforced: 'Локация в каждой точке',
      },
    ],
  },
  traction: {
    label: 'Gidlist сегодня',
    note: 'Цифры будут добавлены.',
    metrics: [
      { label: 'Создано пространств' },
      { label: 'Отправлено чек-листов' },
      { label: 'Записано фотографий' },
    ],
  },
  faq: {
    eyebrow: '13 · Прежде чем спросить',
    title: 'Вопросы, которые стоит нам задать',
    body: 'Те, что решают, применимо ли это там, где вы работаете.',
    items: [
      {
        q: 'Где оказываются фотографии и локации?',
        a: 'В вашем пространстве, видимые тем, кого вы туда добавили, и больше никому. Фотографии лежат в закрытом хранилище, доступном только по кратковременным ссылкам, а доступ ограничивает сама база данных, а не только приложение: ошибка на одном экране не может открыть записи другой компании. Инфраструктура наших поставщиков расположена за пределами Узбекистана, то есть данные могут храниться за рубежом; если это важно для ваших обязательств, поговорите с нами до того, как размещать регулируемые записи.',
      },
      {
        q: 'Законно ли фиксировать, где сотрудник поставил отметку?',
        a: 'Это зависит от вашей юрисдикции и от того, что вы сказали сотрудникам, и советовать здесь должны не мы. Мы можем сказать, что делает продукт: локация снимается только в задачах, где вы её включили, только в момент отметки и никогда в фоне — приложение не может определить позицию, пока закрыто. Предупредите команду о том, что собирается, до включения.',
      },
      {
        q: 'Что будет, если нет связи?',
        a: 'Сегодня для отметки нужна связь, поэтому подвал или холодный склад остановят человека посреди списка. Офлайн-заполнение с очередью отложенных записей разрабатывается и пока не готово; лучше мы скажем это, чем вы узнаете на смене.',
      },
      {
        q: 'Нужно ли приложение из магазина?',
        a: 'Нет. Работает в браузере любого современного телефона и добавляется на домашний экран — ничего устанавливать и согласовывать не нужно. Камера и локация работают оттуда.',
      },
      {
        q: 'Сколько занимает настройка?',
        a: 'Первый чек-лист — несколько минут. Перенос бумажного или табличного порядка занимает столько, сколько занимает набрать его один раз: импорта нет, и для большинства процедур перенабрать быстрее, чем размечать таблицу.',
      },
      {
        q: 'Какие языки и сколько людей?',
        a: 'Английский, узбекский и русский, а администратор может добавить ещё один язык и перевести интерфейс, не дожидаясь релиза. Бесплатный тариф — пять человек; большие команды и более долгое хранение фотографий это то, что покупают платные тарифы.',
      },
    ],
  },
  close: {
    title: 'Начните с одного чек-листа',
    body: 'Выберите порядок, за который вам чаще всего приходится ручаться, и запишите его один раз. Бесплатно для пяти человек, без карты.',
  },
};

export const CLOSING: Record<BuiltinLocale, ClosingCopy> = { en, uz, ru };
