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

export type ContentSection = {
  id: string;
  title: string;
  rows: ContentRow[];
};

/**
 * The marketing copy, grouped by where it appears on the page.
 *
 * A textarea rather than an input, unlike the translations editor: these are
 * sentences and paragraphs, not button labels, and editing a three-line
 * paragraph through a single-line field is miserable.
 *
 * Saved on blur, which suits prose — nobody wants to press a button after every
 * sentence — with the row marked while the write is in flight so a slow network
 * does not look like nothing happening.
 *
 * The grouping comes from `siteContentSections()` rather than being decided
 * here, so the site's own catalogue declares the order and this renders it.
 */
/**
 * Keys that are a show/hide flag rather than text.
 *
 * The convention is the key name: anything ending in `visible` — the section
 * flags `faqVisible` and `tractionVisible`, and the per-item `faqItems.3.visible`.
 * Matching on the name rather than keeping a list here means a new optional
 * section gets its checkbox automatically, and cannot be added with a text box
 * by accident.
 */
function isToggle(key: string): boolean {
  return /visible$/i.test(key);
}

/** `no` hides; anything else shows, matching how the site reads these. */
function showing(value: string): boolean {
  return value.trim().toLowerCase() !== 'no';
}

export function ContentEditor({
  locale,
  localeName,
  sections,
}: {
  locale: string;
  localeName: string;
  sections: ContentSection[];
}) {
  // Flattened once for the counts and the search, which are about the whole
  // page rather than any one section.
  const rows = sections.flatMap((section) => section.rows);
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editedOnly, setEditedOnly] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // Filter inside each section and drop the ones left empty, so a search never
  // shows a heading with nothing under it.
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    const matches = (row: ContentRow) => {
      if (editedOnly && !row.override) return false;
      if (!term) return true;
      return (
        row.key.toLowerCase().includes(term) ||
        row.shipped.toLowerCase().includes(term) ||
        row.override.toLowerCase().includes(term)
      );
    };

    return sections
      .map((section) => ({ ...section, rows: section.rows.filter(matches) }))
      .filter((section) => section.rows.length > 0);
  }, [sections, query, editedOnly]);

  const matchCount = filtered.reduce((total, section) => total + section.rows.length, 0);

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
    <div className="space-y-6">
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

      {matchCount === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          Nothing matches.
        </p>
      ) : (
        filtered.map((section) => (
          <section key={section.id} className="space-y-2">
            <h2 className="text-sm font-semibold tracking-tight">
              {section.title}
              <span className="ml-2 font-normal text-[var(--color-muted-foreground)]">
                {section.rows.length}
              </span>
            </h2>

            <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
              {section.rows.map((row) => {
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

                    {isToggle(row.key) ? (
                      /*
                       * A show/hide flag, not prose.
                       *
                       * It is stored as a string like everything else the CMS
                       * keeps, but nobody should have to know that, let alone
                       * type `no` correctly to hide a section. The checkbox
                       * writes the word.
                       */
                      <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-sm">
                        <input
                          type="checkbox"
                          checked={showing(row.override || row.shipped)}
                          onChange={(e) =>
                            save(row.key, e.target.checked ? 'yes' : 'no', row.override)
                          }
                          className="size-4 cursor-pointer accent-[var(--color-primary)]"
                        />
                        {showing(row.override || row.shipped)
                          ? 'Shown on the website'
                          : 'Hidden from the website'}
                      </label>
                    ) : (
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
                    )}

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
          </section>
        ))
      )}
    </div>
  );
}
