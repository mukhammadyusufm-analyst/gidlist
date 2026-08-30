'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, translate, type Locale, type Messages } from '@app/core/i18n';

type I18nValue = {
  locale: Locale;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  // Falling back to the key means an un-wrapped component renders something
  // recognisable in testing instead of blank space.
  t: (key: string) => key,
});

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: (key, values) => translate(messages, key, values),
    }),
    [locale, messages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Translations inside Client Components. Server Components use getTranslations(). */
export function useT() {
  return useContext(I18nContext);
}
