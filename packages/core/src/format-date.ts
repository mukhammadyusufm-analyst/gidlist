/**
 * Dates in the reader's language — with Uzbek written out by hand.
 *
 * Chromium ships without Uzbek month and weekday names, so on Chrome, Android
 * Chrome and every Chromium webview, `Intl` in `uz` prints "2026 M09 19" where
 * "19-sentabr, 2026" belongs. Node has the full data and prints the right thing,
 * so the same component rendered correctly on the server and wrongly after
 * hydration. Uzbek is therefore formatted here, identically on both sides, with
 * the CLDR patterns for `uz-Latn`; every other language goes straight to `Intl`.
 *
 * Only the option shapes the app uses are covered: day/month/year in any
 * combination, weekday, `dateStyle`, and hour/minute or `timeStyle: 'short'`.
 */

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const WEEKDAYS_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatDate(value: Date, locale: string, options: Intl.DateTimeFormatOptions = {}): string {
  if (locale.split('-')[0] !== 'uz' || locale.includes('Cyrl')) {
    return new Intl.DateTimeFormat(locale, options).format(value);
  }

  // The numbers themselves, in the requested time zone.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: options.timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(value)
      .map((p) => [p.type, p.value]),
  );
  const year = parts.year;
  const month = Number(parts.month) - 1;
  const day = Number(parts.day);
  const weekday = EN_WEEKDAYS.indexOf(parts.weekday);
  const time = `${parts.hour}:${parts.minute}`;

  let o = options;
  if (o.dateStyle || o.timeStyle) {
    const style = {
      full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
      long: { day: 'numeric', month: 'long', year: 'numeric' },
      medium: { day: 'numeric', month: 'short', year: 'numeric' },
      short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    } as const;
    o = {
      ...(o.dateStyle ? style[o.dateStyle] : {}),
      ...(o.timeStyle ? { hour: '2-digit', minute: '2-digit' } : {}),
    };
  }
  const hasDate = o.day || o.month || o.year || o.weekday;
  const hasTime = o.hour || o.minute;
  if (!hasDate && !hasTime) o = { day: '2-digit', month: '2-digit', year: 'numeric' };

  let date = '';
  if (o.month === 'numeric' || o.month === '2-digit') {
    // CLDR uz short date: dd/MM/y.
    date = [String(day).padStart(2, '0'), String(month + 1).padStart(2, '0'), year].join('/');
  } else if (o.month) {
    const name = o.month === 'long' ? MONTHS[month] : MONTHS_SHORT[month];
    if (o.day) date = `${day}-${name}${o.year ? `, ${year}` : ''}`;
    else date = o.year ? `${capitalise(name)}, ${year}` : capitalise(name);
  } else if (o.day) {
    date = String(day);
  } else if (o.year) {
    date = year;
  }
  if (o.weekday) {
    const name = o.weekday === 'long' ? WEEKDAYS[weekday] : WEEKDAYS_SHORT[weekday];
    date = date ? `${name}, ${date}` : capitalise(name);
  }

  return [date, o.hour || o.minute ? time : ''].filter(Boolean).join(', ');
}
