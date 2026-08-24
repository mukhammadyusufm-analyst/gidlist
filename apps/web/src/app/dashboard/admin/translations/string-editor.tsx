'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { saveTranslation } from '@/lib/translations/actions';
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
      return (
        row.key.toLowerCase().includes(term) ||
        row.english.toLowerCase().includes(term) ||
        effective.toLowerCase().includes(term)
      );
    });
  }, [rows, query, editedOnly, untranslatedOnly]);

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
        <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
          {filtered.map((row) => (
            <StringRow
              key={row.key}
              row={row}
              labels={labels}
              localeName={localeName}
              justSaved={savedKey === row.key}
              onSave={save}
            />
          ))}
        </ul>
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
  // Keyed by the value so the field picks up a change made elsewhere (a reset,
  // or a save from another tab) instead of holding a stale draft.
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
