'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, fromIsoDate } from '@app/core/dates';

import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';

/**
 * Which day's checklists to show.
 *
 * THE CALENDAR IS OURS, NOT THE BROWSER'S. This used to be `<input type="date">`,
 * whose picker is drawn by the browser and labelled from the *browser's* locale
 * — so somebody running the product in Uzbek on an English-language phone got
 * an English calendar, with no API to change it. That is the same reason
 * `DateField` exists, and this page is the one place that had not adopted it,
 * which meant the fill page and the scheduling screen disagreed about what
 * language the product is in.
 *
 * `today` comes from the server, resolved in the space's timezone, and is
 * handed down rather than left to the browser. A night shift working at 01:00
 * in Tashkent is still on the previous day's list, and the browser's own
 * calendar would have moved on without them.
 */
export function DatePicker({
  slug,
  value,
  today,
}: {
  slug: string;
  value: string;
  today: string;
}) {
  const router = useRouter();
  const { t, locale } = useT();

  function go(date: string) {
    router.push(`/dashboard/boards/${slug}/fill?date=${date}`);
  }

  // Formatted from local calendar parts. Round-tripping through UTC shifted
  // every date back a day east of Greenwich.
  const label = fromIsoDate(value).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex items-center gap-2">
      {/* Arrows as well as the calendar: stepping a day at a time is the common
          case on a phone, where opening any picker is a detour. */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => go(addDays(value, -1))}
        aria-label={t('fill.previousDay')}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>

      <div className="min-w-0 flex-1">
        {/*
          Controlled, and navigating rather than storing: the selected day is
          the URL, so it survives a reload and can be sent to somebody.

          `name` is required by DateField for its hidden input. There is no form
          here and nothing ever submits it, but a name it never uses is cheaper
          than making the prop optional for one caller.
        */}
        <DateField
          name="date"
          value={value}
          onChange={(iso) => {
            // Clearing is not offered — `required` hides that control — but the
            // guard costs nothing and an empty date here would navigate to a
            // page with no day at all.
            if (iso) go(iso);
          }}
          today={today}
          required
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => go(addDays(value, 1))}
        aria-label={t('fill.nextDay')}
      >
        <ChevronRight aria-hidden="true" />
      </Button>

      {value !== today ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => go(today)}>
          {t('fill.today')}
        </Button>
      ) : null}

      {/* The weekday, for a screen reader. The field itself reads the date but
          not the day of the week, and "is this Monday's list" is the question
          somebody opening this page is usually asking. */}
      <span className="sr-only">{label}</span>
    </div>
  );
}
