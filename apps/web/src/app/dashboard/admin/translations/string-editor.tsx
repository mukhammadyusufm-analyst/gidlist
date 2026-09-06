'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { saveTranslation } from '@/lib/translations/actions';
import { stringSections } from '@/lib/i18n/sections';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { cn } from '@/lib/utils';

type Row = {
  key: string;
  english: string;
  /** What the app ships for this language, if it is a built-in one. */
  shipped: string;
  /** What an administrator has saved, if anything. */
  override: string;
};

type Labels = {
  heading: string;
  english: string;
  value: string;
  edited: string;
  reset: string;
  search: string;
  editedOnly: string;
  untranslatedOnly: string;
  none: string;
};

export function StringEditor({
  locale,
  localeName,
  rows,
  labels,
}: {
  locale: string;
  localeName: string;
  rows: Row[];
  labels: Labels;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editedOnly, setEditedOnly] = useState(false);
  const [untranslatedOnly, setUntranslatedOnly] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const effective = row.override || row.shipped;
      if (editedOnly && !row.override) return false;
      // "Untranslated" means this language has nothing of its own — the user
      // would currently be reading English.
      if (untranslatedOnly && effective) return false;
      if (!term) return true;
      /*
       * FIND BY VALUE, WHICH IS HOW ANYBODY ACTUALLY ARRIVES HERE.
       *
       * Nobody opens this screen knowing a key. They saw a sentence on a screen
       * and disliked it, so the sentence is the thing they have — in English, or
       * in the language they were reading. Searching the key alone would serve
       * only the person who wrote it.
       */
      return (
        row.key.toLowerCase().includes(term) ||
        row.english.toLowerCase().includes(term) ||
        effective.toLowerCase().includes(term)
      );
    });
  }, [rows, query, editedOnly, untranslatedOnly]);

  /*
   * The surviving rows, put back into their sections.
   *
   * Grouping AFTER filtering rather than filtering inside each section, so a
   * section with no matches disappears entirely instead of sitting there empty.
   * Searching a 500-string catalogue and being shown ten headings with nothing
   * under them is worse than a flat list, which is what this replaced.
   */
  const grouped = useMemo(() => {
    const bySection = stringSections(filtered.map((r) => r.key));
    const byKey = new Map(filtered.map((r) => [r.key, r]));

    return bySection.map((section) => ({
      ...section,
      rows: section.keys.map((key) => byKey.get(key)!).filter(Boolean),
    }));
  }, [filtered]);

  // Narrowed to something small: open everything, because the person is looking
  // at a handful of rows and closing them again is pure friction. Otherwise the
  // first section only, so the page opens as a readable list of places rather
  // than five hundred fields.
  const expandAll = filtered.length <= 25;

  function save(key: string, value: string) {
    setError(null);
    startTransition(async () => {
      const result = await saveTranslation({ locale, key, value });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSavedKey(key);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{labels.heading}</h2>

      {error ? <FormNotice kind="error">{error}</FormNotice> : null}

      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.search}
          className="min-w-48 flex-1"
        />
        <Button
          type="button"
          variant={editedOnly ? 'primary' : 'outline'}
          size="sm"
          aria-pressed={editedOnly}
          onClick={() => setEditedOnly((v) => !v)}
        >
          {labels.editedOnly}
        </Button>
        <Button
          type="button"
          variant={untranslatedOnly ? 'primary' : 'outline'}
          size="sm"
          aria-pressed={untranslatedOnly}
          onClick={() => setUntranslatedOnly((v) => !v)}
        >
          {labels.untranslatedOnly}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
          {labels.none}
        </p>
      ) : (
        /*
         * Keyed on the search term, and ONLY this list.
         *
         * `<details open>` is an initial state rather than a binding, so a new
         * search would otherwise leave every section exactly as the last one
         * left it — you would search for a sentence, get one match, and be
         * looking at a collapsed heading. Remounting re-applies the rule above.
         *
         * The key must not go on the whole section: that contains the search
         * field, which would then remount on every keystroke and lose focus
         * after one character.
         */
        <div className="space-y-3" key={query.trim().toLowerCase()}>
          {grouped.map((section, index) => (
          <details
            key={section.id}
            /*
             * `open` on a `<details>` is an initial state, not a binding — React
             * will not force a section shut once somebody has opened it, which
             * is the behaviour wanted here. The `key` carries the search term
             * so a NEW search does remount and re-apply this.
             */
            open={expandAll || index === 0}
            className="rounded-xl border border-[var(--color-border)]"
          >
            <summary className="cursor-pointer px-4 py-3">
              <span className="text-sm font-medium">{section.title}</span>
              <span className="ml-2 text-xs text-[var(--color-muted-foreground)] tabular-nums">
                {section.rows.length}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                {section.hint}
              </span>
            </summary>

            <ul className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
              {section.rows.map((row) => (
                <StringRow
              /*
               * Locale and value both belong in this key, and neither was here.
               *
               * `row.key` alone is the string's identifier — `common.save` — and
               * it is the same in every language. Switching language re-rendered
               * with Russian rows, React matched them to the existing components
               * by that identical key, and `useState` inside each row kept the
               * Uzbek draft it was initialised with. The heading said Russian and
               * the fields showed Uzbek until a full reload threw the state away.
               *
               * The value is here for the reason the row's own comment always
               * claimed: a reset, or a save in another tab, changes what the
               * field should show, and only a remount picks that up.
               *
               * The locale is here because the value alone is not enough. An
               * untranslated string is empty in every language, so two locales
               * would produce the same key and the stale draft would survive
               * exactly where it is least obvious — a field that looks blank.
               */
                  key={`${locale}:${row.key}:${row.override || row.shipped}`}
                  row={row}
                  labels={labels}
                  localeName={localeName}
                  justSaved={savedKey === row.key}
                  onSave={save}
                />
              ))}
            </ul>
          </details>
          ))}
        </div>
      )}
    </section>
  );
}

function StringRow({
  row,
  labels,
  localeName,
  justSaved,
  onSave,
}: {
  row: Row;
  labels: Labels;
  localeName: string;
  justSaved: boolean;
  onSave: (key: string, value: string) => void;
}) {
  const current = row.override || row.shipped;
  /*
   * Initialised once per mount, which is only correct because the caller's key
   * includes the locale and the value — see the note there. This state does not
   * follow its prop, so if that key is ever reduced to `row.key` again, the
   * field silently keeps showing the previous language.
   */
  const [draft, setDraft] = useState(current);

  return (
    <li className="p-4">
      <div className="flex items-center justify-between gap-3">
        <code className="text-xs text-[var(--color-muted-foreground)]">{row.key}</code>
        <div className="flex items-center gap-2">
          {row.override ? (
            <span className="rounded bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-xs text-[var(--color-warning)]">
              {labels.edited}
            </span>
          ) : null}
          {justSaved ? (
            <span className="text-xs text-[var(--color-success)]">✓</span>
          ) : null}
        </div>
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {labels.english}
          </span>
          <p className="mt-0.5 text-sm">{row.english}</p>
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {labels.value} · {localeName}
          </label>
          <textarea
            value={draft}
            rows={draft.length > 80 ? 3 : 1}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim() !== current.trim()) onSave(row.key, draft);
            }}
            className={cn(
              'mt-0.5 w-full rounded-md border bg-transparent px-3 py-2 text-base sm:text-sm',
              current ? 'border-[var(--color-input)]' : 'border-dashed border-[var(--color-warning)]',
            )}
          />
          {row.override ? (
            <button
              type="button"
              // Saving an empty value removes the override, which restores the
              // original wording rather than blanking the label.
              onClick={() => {
                setDraft(row.shipped);
                onSave(row.key, '');
              }}
              className="mt-1 text-xs text-[var(--color-muted-foreground)] underline underline-offset-2"
            >
              {labels.reset}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
