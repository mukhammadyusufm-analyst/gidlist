import { History } from 'lucide-react';

export type AuditEntry = {
  id: number;
  action: string;
  actor_name: string;
  detail: Record<string, string | null>;
  created_at: string;
};

/**
 * Audit entries, newest first.
 *
 * Each row is a sentence rather than a field dump. "member.role_changed
 * {from: editor, to: admin}" is a database row; "Alice changed carol@… from
 * editor to admin" is what somebody reviewing access can actually read, and
 * reviewing is the only reason this exists.
 *
 * An unrecognised action still renders — as its raw key with the detail beside
 * it. A future trigger whose phrasing nobody added should show something
 * imperfect rather than vanish, because a silently missing audit row is
 * indistinguishable from an action that never happened.
 */
export function AuditList({
  entries,
  phrase,
  emptyLabel,
  locale,
}: {
  entries: AuditEntry[];
  /** Turns an entry into a sentence. Supplied by the caller so the space-level
   *  view can translate and the platform view can stay in English. */
  phrase: (entry: AuditEntry) => string;
  emptyLabel: string;
  locale: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
        {emptyLabel}
      </p>
    );
  }

  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
          <History
            className="mt-0.5 size-3.5 shrink-0 text-[var(--color-muted-foreground)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm">{phrase(entry)}</p>
            {/* The timestamp is a <time> element so a screen reader announces a
                date rather than reading the formatted string as prose. */}
            <time
              dateTime={entry.created_at}
              className="text-xs text-[var(--color-muted-foreground)]"
            >
              {when.format(new Date(entry.created_at))}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
