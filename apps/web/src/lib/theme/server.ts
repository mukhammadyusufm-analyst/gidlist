import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { DEFAULT_THEME, isTheme, type Theme } from '@app/core';

export const THEME_COOKIE = 'theme';

/**
 * The chosen theme.
 *
 * Read on the server so `data-theme` is already on the html element in the
 * first byte of HTML. The alternative — an inline script that reads
 * localStorage before paint — is the usual approach and it still flickers on a
 * slow phone, which is exactly the device this runs on.
 */
export const getTheme = cache(async (): Promise<Theme> => {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : DEFAULT_THEME;
});
