/**
 * Ready-made checklists, one per industry the campaign sells to first.
 *
 * The largest obstacle between a demo and an active pilot is not persuasion —
 * it is somebody having to type twenty items before Wednesday morning. A
 * template turns that into one tap and an edit.
 *
 * The content comes from `gidlist-campaign-plan.txt` (section 1), so the
 * checklist a prospect is shown in a demo is the one they can start from.
 *
 * WHAT A TEMPLATE SETS, AND WHAT IT CANNOT:
 *   - photo: required where the plan says REQUIRED, offered where it says
 *     "photo required" in lower case (shown, not enforced);
 *   - a time window, RECORDED ONLY, where the plan gives one — the first
 *     morning should not refuse a tick because the customer opens at 09:30;
 *   - never a location: that needs the branch's own coordinates, which only
 *     the customer has. The builder's item conditions are where they add it.
 *
 * Data, not translations in the message catalogues: a template is a document
 * written in three languages, created in whichever one the person is reading.
 * The Uzbek and Russian are Claude's, not a native speaker's.
 */

type Text = { en: string; uz: string; ru: string };

/** The text in this language, or English for one the templates do not have. */
export function templateText(text: Text, locale: string): string {
  return text[locale as keyof Text] ?? text.en;
}

export type TemplateItem = {
  title: Text;
  description?: Text;
  photo?: 'required' | 'offered';
};

export type ChecklistTemplate = {
  key: string;
  title: Text;
  description: Text;
  /** HH:MM–HH:MM, recorded on every item but not enforced. */
  window?: [string, string];
  items: TemplateItem[];
};

const photoOfReading: Text = {
  en: 'Photograph the thermometer so the reading can be seen.',
  uz: 'Termometrni koʻrsatkichi koʻrinadigan qilib suratga oling.',
  ru: 'Сфотографируйте термометр так, чтобы были видны показания.',
};

const noteIfWrong: Text = {
  en: 'Tick when checked. Add a note if something needs attention.',
  uz: 'Tekshirgach belgilang. Biror narsa eʼtibor talab qilsa, izoh qoldiring.',
  ru: 'Отметьте после проверки. Если что-то требует внимания, оставьте заметку.',
};

export const CHECKLIST_TEMPLATES: readonly ChecklistTemplate[] = [
  {
    key: 'kitchen-opening',
    title: { en: 'Kitchen opening', uz: 'Oshxonani ochish', ru: 'Открытие кухни' },
    description: {
      en: 'Restaurants and cafés. Fridges, gas, hygiene — before the first order.',
      uz: 'Restoran va kafelar. Sovutgichlar, gaz, gigiyena — birinchi buyurtmagacha.',
      ru: 'Рестораны и кафе. Холодильники, газ, гигиена — до первого заказа.',
    },
    window: ['07:00', '09:00'],
    items: [
      {
        title: { en: 'Walk-in fridge temperature', uz: 'Sovutish kamerasi harorati', ru: 'Температура в холодильной камере' },
        description: photoOfReading,
        photo: 'required',
      },
      {
        title: { en: 'Freezer temperature', uz: 'Muzlatgich harorati', ru: 'Температура морозильника' },
        description: photoOfReading,
        photo: 'required',
      },
      {
        title: { en: 'Hot water at the wash station', uz: 'Yuvish joyida issiq suv bor', ru: 'Горячая вода на мойке' },
      },
      {
        title: { en: 'Hand-wash stations stocked', uz: 'Qoʻl yuvish joylari toʻldirilgan', ru: 'Раковины для рук укомплектованы' },
        description: { en: 'Soap, paper towels, sanitiser.', uz: 'Sovun, qogʻoz sochiq, antiseptik.', ru: 'Мыло, бумажные полотенца, антисептик.' },
        photo: 'offered',
      },
      {
        title: { en: 'Extraction hood clean', uz: 'Soʻrgich (vytyajka) toza', ru: 'Вытяжка чистая' },
        photo: 'offered',
      },
      {
        title: { en: 'Gas line and burners checked', uz: 'Gaz quvuri va gorelkalar tekshirildi', ru: 'Газовая линия и горелки проверены' },
      },
      {
        title: { en: "Yesterday's waste removed", uz: 'Kechagi chiqindilar olib chiqildi', ru: 'Вчерашние отходы вынесены' },
      },
      {
        title: { en: 'Anything wrong?', uz: 'Muammo bormi?', ru: 'Есть проблемы?' },
        description: noteIfWrong,
      },
    ],
  },
  {
    key: 'cleaning-round',
    title: { en: 'Floor cleaning round', uz: 'Qavatni tozalash aylanmasi', ru: 'Обход этажа (уборка)' },
    description: {
      en: 'Cleaning and facility management. Evidence of the round, taken at the building.',
      uz: 'Tozalash va binoga xizmat koʻrsatish. Aylanma bajarilganining dalili — bino ichida olingan.',
      ru: 'Клининг и управление зданиями. Доказательство обхода, снятое на объекте.',
    },
    items: [
      {
        title: { en: 'Toilets: bins emptied, floor dry', uz: 'Hojatxonalar: chelaklar boʻshatilgan, pol quruq', ru: 'Туалеты: урны пусты, пол сухой' },
        photo: 'required',
      },
      {
        title: { en: 'Consumables restocked', uz: 'Sarf materiallari toʻldirildi', ru: 'Расходники пополнены' },
        description: { en: 'Soap, toilet paper, paper towels.', uz: 'Sovun, hojatxona qogʻozi, qogʻoz sochiq.', ru: 'Мыло, туалетная бумага, бумажные полотенца.' },
        photo: 'offered',
      },
      {
        title: { en: 'Corridor and lift lobby clean', uz: 'Yoʻlak va lift oldi toza', ru: 'Коридор и лифтовой холл чистые' },
      },
      {
        title: { en: 'Waste taken to the collection point', uz: 'Chiqindilar yigʻish joyiga olib borildi', ru: 'Мусор вынесен в точку сбора' },
      },
      {
        title: { en: 'Client requests handled', uz: 'Mijoz soʻrovlari bajarildi', ru: 'Просьбы клиента выполнены' },
        description: noteIfWrong,
      },
    ],
  },
  {
    key: 'store-opening',
    title: { en: 'Store opening', uz: 'Doʻkonni ochish', ru: 'Открытие магазина' },
    description: {
      en: 'Retail chains and supermarkets. The same opening in every branch, and one report.',
      uz: 'Chakana tarmoqlar va supermarketlar. Har bir filialda bir xil ochilish va bitta hisobot.',
      ru: 'Розничные сети и супермаркеты. Одинаковое открытие в каждом филиале и один отчёт.',
    },
    window: ['08:00', '10:00'],
    items: [
      {
        title: { en: 'Chilled display temperature', uz: 'Sovutgichli vitrina harorati', ru: 'Температура холодильной витрины' },
        description: photoOfReading,
        photo: 'required',
      },
      {
        title: { en: 'Freezer display temperature', uz: 'Muzlatgichli vitrina harorati', ru: 'Температура морозильной витрины' },
        description: photoOfReading,
        photo: 'required',
      },
      {
        title: { en: 'Expired stock removed', uz: 'Muddati oʻtgan mahsulotlar olib qoʻyildi', ru: 'Просроченный товар снят' },
        photo: 'offered',
      },
      {
        title: { en: 'Price labels match the till', uz: 'Narx yorliqlari kassaga mos', ru: 'Ценники совпадают с кассой' },
      },
      {
        title: { en: 'Entrance and sales floor clean', uz: 'Kirish va savdo zali toza', ru: 'Вход и торговый зал чистые' },
        photo: 'offered',
      },
      {
        title: { en: 'Cash desk opened and counted', uz: 'Kassa ochildi va sanaldi', ru: 'Касса открыта и пересчитана' },
      },
      {
        title: { en: 'Notes for head office', uz: 'Bosh ofis uchun izohlar', ru: 'Заметки для головного офиса' },
        description: noteIfWrong,
      },
    ],
  },
  {
    key: 'pharmacy-temperature',
    title: { en: 'Morning temperature log', uz: 'Ertalabki harorat jurnali', ru: 'Утренний журнал температуры' },
    description: {
      en: 'Pharmacies. Every entry with a photograph, ready for an inspector.',
      uz: 'Dorixonalar. Har bir yozuv surat bilan — tekshiruvchi uchun tayyor.',
      ru: 'Аптеки. Каждая запись с фотографией — готово для проверяющего.',
    },
    window: ['08:00', '10:00'],
    items: [
      {
        title: { en: 'Refrigerator temperature', uz: 'Sovutgich harorati', ru: 'Температура холодильника' },
        description: photoOfReading,
        photo: 'required',
      },
      {
        title: { en: 'Room temperature', uz: 'Xona harorati', ru: 'Температура в помещении' },
        description: photoOfReading,
        photo: 'required',
      },
      {
        title: { en: 'Fridge door seal intact', uz: 'Sovutgich eshigi zichlagichi butun', ru: 'Уплотнитель двери холодильника цел' },
      },
      {
        title: { en: "Expiry check — today's shelf", uz: 'Yaroqlilik muddati — bugungi javon', ru: 'Проверка сроков — полка дня' },
        photo: 'offered',
      },
      {
        title: { en: 'Licence and price list on display', uz: 'Litsenziya va narxlar roʻyxati osilgan', ru: 'Лицензия и прайс-лист на виду' },
      },
      {
        title: { en: 'Notes', uz: 'Izohlar', ru: 'Заметки' },
        description: noteIfWrong,
      },
    ],
  },
  {
    key: 'changing-rooms',
    title: { en: 'Changing room round', uz: 'Kiyinish xonalarini aylanish', ru: 'Обход раздевалок' },
    description: {
      en: 'Fitness clubs, spas and salons. The rounds your customers judge you on.',
      uz: 'Fitnes klublar, spa va salonlar. Mijozlar sizni baholaydigan aylanmalar.',
      ru: 'Фитнес-клубы, спа и салоны. Обходы, по которым вас оценивают клиенты.',
    },
    items: [
      {
        title: { en: 'Showers clean, drains clear', uz: 'Dushlar toza, suv oqimi ochiq', ru: 'Душевые чистые, сливы свободны' },
        photo: 'offered',
      },
      {
        title: { en: 'Towels restocked', uz: 'Sochiqlar toʻldirildi', ru: 'Полотенца пополнены' },
        photo: 'offered',
      },
      {
        title: { en: 'Lockers checked', uz: 'Shkafchalar tekshirildi', ru: 'Шкафчики проверены' },
      },
      {
        title: { en: 'Floor dry', uz: 'Pol quruq', ru: 'Пол сухой' },
      },
      {
        title: { en: 'Anything broken?', uz: 'Biror narsa buzilganmi?', ru: 'Что-то сломано?' },
        description: noteIfWrong,
      },
    ],
  },
  {
    key: 'station-shift-start',
    title: { en: 'Shift start', uz: 'Smena boshlanishi', ru: 'Начало смены' },
    description: {
      en: 'Petrol stations and car service. Safety checks that work without signal.',
      uz: 'Yoqilgʻi quyish shoxobchalari va avtoservis. Aloqasiz ham ishlaydigan xavfsizlik tekshiruvlari.',
      ru: 'АЗС и автосервис. Проверки безопасности, которые работают без связи.',
    },
    items: [
      {
        title: { en: 'Fire extinguishers in place and in date', uz: 'Oʻt oʻchirgichlar joyida va muddati oʻtmagan', ru: 'Огнетушители на месте и в сроке' },
        photo: 'required',
      },
      {
        title: { en: 'Emergency stop accessible', uz: 'Favqulodda toʻxtatish tugmasi ochiq', ru: 'Аварийная остановка доступна' },
        photo: 'offered',
      },
      {
        title: { en: 'Dispensers undamaged, no leaks', uz: 'Kolonkalar butun, oqish yoʻq', ru: 'Колонки целы, утечек нет' },
        photo: 'offered',
      },
      {
        title: { en: 'Forecourt and canopy lights working', uz: 'Hudud va soyabon chiroqlari ishlaydi', ru: 'Освещение площадки и навеса работает' },
      },
      {
        title: { en: 'Tank reading recorded', uz: 'Rezervuar koʻrsatkichi yozildi', ru: 'Показания резервуара записаны' },
        description: {
          en: 'Photograph the gauge so the reading can be seen.',
          uz: 'Koʻrsatkich koʻrinadigan qilib datchikni suratga oling.',
          ru: 'Сфотографируйте датчик так, чтобы были видны показания.',
        },
        photo: 'required',
      },
      {
        title: { en: 'Handover notes', uz: 'Smena topshirish izohlari', ru: 'Заметки при передаче смены' },
        description: noteIfWrong,
      },
    ],
  },
];

export function findTemplate(key: string): ChecklistTemplate | undefined {
  return CHECKLIST_TEMPLATES.find((t) => t.key === key);
}
