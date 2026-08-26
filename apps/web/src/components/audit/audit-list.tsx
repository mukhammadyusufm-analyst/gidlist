import { History } from 'lucide-react';

export type AuditEntry = {
  id: number;
  action: string;
  /** The only value that actually distinguishes one person from another. */
  actor_id: string | null;
  actor_name: string;
  actor_email: string | null;
  detail: Record<string, string | null>;
  created_at: string;
  total_count: number;
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
                date rather than reading the formatted string as prose.

                The email sits beside it because a display name is not an
                identity: two colleagues can share one, and a name is editable
                after the fact — the address is what lets somebody say which
                account this was. The account id is on the title attribute
                rather than on screen, since it is what you need only when the
                email is not enough, and it would be noise the rest of the time. */}
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-muted-foreground)]">
              <time dateTime={entry.created_at}>{when.format(new Date(entry.created_at))}</time>
              {entry.actor_email ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span title={entry.actor_id ?? undefined}>{entry.actor_email}</span>
                </>
              ) : null}
              <span aria-hidden="true">·</span>
              <code className="text-[0.7rem] opacity-70">{entry.action}</code>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
