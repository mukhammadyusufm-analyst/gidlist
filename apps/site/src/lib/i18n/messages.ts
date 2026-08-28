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
 */
export type SiteMessages = {
  /** Used as the `<html lang>` value and in hreflang alternates. */
  htmlLang: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  headline: string;
  subhead: string;
  ctaPrimary: string;
  ctaSecondary: string;
  navSignIn: string;
  footerNote: string;
};

export const MESSAGES: Record<BuiltinLocale, SiteMessages> = {
  en: {
    htmlLang: 'en',
    tagline: 'Get it done.',
    metaTitle: 'Gidlist — checklists that prove they were done',
    metaDescription:
      'Recurring operational checklists with a record nobody can quietly edit. Schedule them, assign them, and show an auditor exactly what happened.',
    headline: 'Checklists that prove they were done',
    subhead:
      'The opening check on a shop floor. The ward round in a clinic. The month-end close in a finance team. Gidlist schedules the work, assigns it, and keeps a record nobody can quietly edit.',
    ctaPrimary: 'Start free',
    ctaSecondary: 'See how it works',
    navSignIn: 'Sign in',
    footerNote: 'Built in Uzbekistan.',
  },
  uz: {
    htmlLang: 'uz',
    tagline: 'Hammasi bajariladi!',
    metaTitle: 'Gidlist — bajarilganini isbotlaydigan roʻyxatlar',
    metaDescription:
      'Muntazam ish roʻyxatlari va hech kim sezdirmay oʻzgartira olmaydigan yozuv. Rejalashtiring, biriktiring va nima boʻlganini aniq koʻrsating.',
    headline: 'Bajarilganini isbotlaydigan roʻyxatlar',
    subhead:
      'Sexdagi ochilish tekshiruvi. Klinikadagi navbatchilik aylanishi. Moliya boʻlimidagi oy yakuni. Gidlist ishni rejalashtiradi, mas’ulini belgilaydi va hech kim sezdirmay oʻzgartira olmaydigan yozuvni saqlaydi.',
    ctaPrimary: 'Bepul boshlash',
    ctaSecondary: 'Qanday ishlashini koʻrish',
    navSignIn: 'Kirish',
    footerNote: 'Oʻzbekistonda yaratilgan.',
  },
  ru: {
    htmlLang: 'ru',
    tagline: 'Всё будет выполнено!',
    metaTitle: 'Gidlist — чек-листы, которые доказывают, что работа выполнена',
    metaDescription:
      'Регулярные операционные чек-листы и запись, которую нельзя незаметно изменить. Планируйте, назначайте и показывайте проверяющему, что именно произошло.',
    headline: 'Чек-листы, которые доказывают, что работа выполнена',
    subhead:
      'Утренняя проверка в цехе. Обход в клинике. Закрытие месяца в финансовом отделе. Gidlist планирует работу, назначает ответственного и хранит запись, которую нельзя незаметно изменить.',
    ctaPrimary: 'Начать бесплатно',
    ctaSecondary: 'Как это работает',
    navSignIn: 'Войти',
    footerNote: 'Сделано в Узбекистане.',
  },
};
