import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { todayInTimezone } from '@app/core';

export const TIMEZONE_COOKIE = 'tz';

/** Sensible default for this product's users until the probe reports back. */
const FALLBACK_TIMEZONE = 'Asia/Tashkent';

export const getTimezone = cache(async (): Promise<string> => {
  const store = await cookies();
  const value = store.get(TIMEZONE_COOKIE)?.value;
  if (!value) return FALLBACK_TIMEZONE;

  // Validated by attempting to use it: an unknown zone throws, and a bad cookie
  // must not take every page down.
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return FALLBACK_TIMEZONE;
  }
});

/** Today's calendar date where the user actually is. */
export async function getToday(): Promise<string> {
  return todayInTimezone(await getTimezone());
}
