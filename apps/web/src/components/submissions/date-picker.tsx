'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, fromIsoDate } from '@app/core/dates';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';

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
  const inputRef = useRef<HTMLInputElement>(null);

  function go(date: string) {
    router.push(`/dashboard/boards/${slug}/fill?date=${date}`);
  }

  /**
   * Open the native calendar.
   *
   * `showPicker()` is the only way to open it programmatically — the browser's
   * own indicator is the sole built-in trigger, and clicking the text part of
   * the field does nothing. It throws when unsupported or when not called from
   * a user gesture, so focusing the field is the fallback.
   */
  function openCalendar() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
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
          case on a phone, where opening the native picker is a detour. */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => go(addDays(value, -1))}
        aria-label={t('fill.previousDay')}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>

      <div className="relative min-w-0 flex-1">
        {/* A real button, not decoration. The previous version rendered this
            icon with `pointer-events-none`, so it looked like the way to open
            the calendar and did nothing when tapped. */}
        <button
          type="button"
          onClick={openCalendar}
          aria-label={t('compliance.date')}
          className="absolute top-1/2 left-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none"
        >
          <CalendarDays className="size-4" aria-hidden="true" />
        </button>

        <Input
          ref={inputRef}
          type="date"
          value={value}
          onChange={(e) => e.target.value && go(e.target.value)}
          // Clicking anywhere in the field opens the calendar too, which is what
          // people expect from a date field on a touchscreen.
          onClick={openCalendar}
          className="native-date-plain cursor-pointer pl-11"
          aria-label={t('compliance.date')}
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

      <span className="sr-only">{label}</span>
    </div>
  );
}
