export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return (
    // `role="alert"` so screen readers announce the problem when it appears,
    // rather than leaving it silently on screen.
    <p role="alert" className="mt-1.5 text-sm text-[var(--color-destructive)]">
      {messages[0]}
    </p>
  );
}

export function FormNotice({ kind, children }: { kind: 'error' | 'info'; children: React.ReactNode }) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={
        kind === 'error'
          ? 'rounded-md border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 px-3 py-2 text-sm text-[var(--color-destructive)]'
          : 'rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-3 py-2 text-sm text-[var(--color-success)]'
      }
    >
      {children}
    </div>
  );
}
