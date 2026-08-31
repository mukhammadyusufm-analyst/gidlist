'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { fromIsoDate, toIsoDate, isIsoDate } from '@app/core/dates';

import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';
import { cn } from '@/lib/utils';

/**
 * A date field that speaks the language the rest of the app is in.
 *
 * `<input type="date">` cannot do this. Its calendar is drawn by the browser and
 * labelled from the *browser's* locale, so a person running the product in Uzbek
 * on an English-language phone gets an English calendar and there is no API to
 * change it. The only fix is to draw the calendar ourselves.
 *
 * Month and weekday names come from `Intl`, not from the message catalogue —
 * the same decision as `describeSchedule`. Every locale already knows them in
 * the right form, and putting nineteen names per language into the catalogue
 * would be work that has to be redone every time an administrator adds a
 * language in the app.
 *
 * The week starts on Monday. That is right for Uzbek and Russian, which are the
 * languages this is mostly used in, and it matches the ISO weekday numbering the
 * schedules already use everywhere else.
 *
 * The value still travels as a plain `YYYY-MM-DD` in a hidden input, so every
 * server action that already parses a date keeps working untouched.
 */
export function DateField({
  name,
  id,
  defaultValue = '',
  required = false,
  min,
  value: controlledValue,
  onChange,
}: {
  name: string;
  id?: string;
  defaultValue?: string;
  required?: boolean;
  /** Earliest selectable date, as ISO. Days before it are shown but refused. */
  min?: string;
  /** Pass both to drive the field from outside; omit both to let it keep its own. */
  value?: string;
  onChange?: (iso: string) => void;
}) {
  const { t, locale } = useT();
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const controlled = controlledValue !== undefined;
  const [ownValue, setOwnValue] = useState(isIsoDate(defaultValue) ? defaultValue : '');
  const value = controlled ? controlledValue : ownValue;

  function setValue(next: string) {
    if (controlled) onChange?.(next);
    else setOwnValue(next);
  }
  const [open, setOpen] = useState(false);
  // The month on screen, which is not the same as the selection: someone
  // browsing to March has not chosen anything in March yet.
  const [cursor, setCursor] = useState(() => startOfMonth(value || toIsoDate(new Date())));

  const rootRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Both, because either alone leaves a way
  // to get stuck with the calendar covering the field below it.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        fromIsoDate(cursor),
      ),
    [cursor, locale],
  );

  /** Mon–Sun, named by the locale. 2024-01-01 was a Monday, which anchors this. */
  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
  }, [locale]);

  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);

  const display = value
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(fromIsoDate(value))
    : '';

  const todayIso = toIsoDate(new Date());

  function choose(iso: string) {
    if (min && iso < min) return;
    setValue(iso);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      {/* The real value. Everything above it is presentation. */}
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        id={fieldId}
        onClick={() => {
          setCursor(startOfMonth(value || todayIso));
          setOpen((v) => !v);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-[var(--color-border)]',
          'bg-[var(--color-background)] px-3 text-left text-sm',
          'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:outline-none',
        )}
      >
        <span className={value ? '' : 'text-[var(--color-muted-foreground)]'}>
          {display || t('date.choose')}
        </span>
        <CalendarDays className="size-4 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
      </button>

      {/* Required is enforced here rather than on the hidden input: a hidden
          input with `required` blocks submission with a validation bubble the
          browser cannot position, because there is nothing visible to point at. */}
      {required && !value ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value=""
          onChange={() => {}}
          className="pointer-events-none absolute bottom-0 left-3 h-0 w-0 opacity-0"
        />
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label={t('date.choose')}
          className={cn(
            'absolute z-50 mt-1 w-[19rem] rounded-xl border border-[var(--color-border)]',
            'bg-[var(--color-card)] p-3 shadow-e2',
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label={t('date.prevMonth')}
              onClick={() => setCursor(shiftMonth(cursor, -1))}
              className="rounded-md p-1.5 hover:bg-[var(--color-accent)]"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            {/* Capitalised by the locale's own rules, not by us: Russian and
                Uzbek month names are lower-case mid-sentence and this is a
                heading, so `Intl` output is used exactly as given. */}
            <span aria-live="polite" className="text-sm font-medium">
              {monthLabel}
            </span>
            <button
              type="button"
              aria-label={t('date.nextMonth')}
              onClick={() => setCursor(shiftMonth(cursor, 1))}
              className="rounded-md p-1.5 hover:bg-[var(--color-accent)]"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {weekdayNames.map((day) => (
              <span
                key={day}
                className="py-1 text-xs font-medium text-[var(--color-muted-foreground)]"
              >
                {day}
              </span>
            ))}

            {days.map((iso, index) =>
              iso === null ? (
                <span key={`pad-${index}`} />
              ) : (
                <button
                  key={iso}
                  type="button"
                  disabled={Boolean(min && iso < min)}
                  onClick={() => choose(iso)}
                  aria-current={iso === todayIso ? 'date' : undefined}
                  aria-pressed={iso === value}
                  className={cn(
                    'rounded-md py-1.5 text-sm transition-colors disabled:opacity-30',
                    iso === value
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                      : 'hover:bg-[var(--color-accent)]',
                    // Today is marked even when something else is selected, so
                    // the grid still says where "now" is.
                    iso === todayIso && iso !== value
                      ? 'font-semibold text-[var(--color-primary)]'
                      : '',
                  )}
                >
                  {Number(iso.slice(8, 10))}
                </button>
              ),
            )}
          </div>

          <div className="mt-2 flex justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => choose(todayIso)}>
              {t('date.today')}
            </Button>
            {value && !required ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setValue('');
                  setOpen(false);
                }}
              >
                {t('common.clear')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** All arithmetic is done in UTC, so a timezone never shifts a calendar square. */
function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(iso: string, by: number): string {
  const date = fromIsoDate(iso);
  return toIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + by, 1)));
}

/**
 * The month as a grid, padded at the front so the first day lands under its
 * weekday. Trailing padding is unnecessary — the grid simply ends.
 */
function buildMonthGrid(monthIso: string): (string | null)[] {
  const first = fromIsoDate(startOfMonth(monthIso));
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();

  // getUTCDay is Sunday-based; this shifts it to a Monday-based column index.
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toIsoDate(new Date(Date.UTC(year, month, i + 1))),
    ),
  ];
}
