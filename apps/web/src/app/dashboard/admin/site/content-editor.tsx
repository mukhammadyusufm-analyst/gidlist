'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { saveSiteContent } from '@/lib/site-content/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { cn } from '@/lib/utils';

export type ContentRow = {
  key: string;
  /** What the site ships for this language. Shown as the placeholder. */
  shipped: string;
  /** What somebody has saved, if anything. */
  override: string;
};

/**
 * The marketing copy, one string at a time.
 *
 * A textarea rather than an input, unlike the translations editor: these are
 * sentences and paragraphs, not button labels, and editing a three-line
 * paragraph through a single-line field is miserable.
 *
 * Saved on blur, which suits prose — nobody wants to press a button after every
 * sentence — with the row marked while the write is in flight so a slow network
 * does not look like nothing happening.
 */
export function ContentEditor({
  locale,
  localeName,
  rows,
}: {
  locale: string;
  localeName: string;
  rows: ContentRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editedOnly, setEditedOnly] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (editedOnly && !row.override) return false;
      if (!term) return true;
      return (
        row.key.toLowerCase().includes(term) ||
        row.shipped.toLowerCase().includes(term) ||
        row.override.toLowerCase().includes(term)
      );
    });
  }, [rows, query, editedOnly]);

  function save(key: string, next: string, previous: string) {
    if (next.trim() === previous.trim()) return;

    setError(null);
    setPendingKey(key);

    startTransition(async () => {
      const result = await saveSiteContent({ locale, key, value: next });
      setPendingKey(null);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSavedKey(key);
      router.refresh();
    });
  }

  const editedCount = rows.filter((r) => r.override).length;

  return (
    <div className="space-y-4">
      {error ? <FormNotice kind="error">{error}</FormNotice> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${localeName} copy`}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={editedOnly}
            onChange={(e) => setEditedOnly(e.target.checked)}
            className="size-4"
          />
          Edited only ({editedCount})
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          Nothing matches.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {filtered.map((row) => {
            const edited = Boolean(row.override);

            return (
              <li key={row.key} className="p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <code className="font-mono text-xs text-[var(--color-muted-foreground)]">
                    {row.key}
                  </code>

                  <span className="flex items-center gap-2 text-xs">
                    {pendingKey === row.key ? (
                      <span className="text-[var(--color-muted-foreground)]">Saving…</span>
                    ) : savedKey === row.key ? (
                      <span className="text-[var(--color-success)]">Saved</span>
                    ) : null}

                    {edited ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => save(row.key, '', row.override)}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </span>
                </div>

                <textarea
                  key={`${row.key}:${row.override}`}
                  defaultValue={row.override}
                  placeholder={row.shipped}
                  rows={Math.min(6, Math.max(2, Math.ceil(row.shipped.length / 80)))}
                  onBlur={(e) => save(row.key, e.target.value, row.override)}
                  className={cn(
                    'mt-2 w-full rounded-lg border bg-[var(--color-surface)] px-3 py-2 text-sm',
                    edited ? 'border-[var(--color-primary)]' : 'border-[var(--color-input)]',
                  )}
                />

                {/* The shipped text stays visible while an override exists.
                    Otherwise the only way to compare an edit against what it
                    replaced would be to delete the edit. */}
                {edited ? (
                  <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
                    Ships as: {row.shipped}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
