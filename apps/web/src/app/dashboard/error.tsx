'use client';

import { useEffect } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';
import { record } from '@/lib/offline/log';

/**
 * The last line of defence, and it should have existed before now.
 *
 * Every failure anywhere under /dashboard reached Next's own error screen —
 * "This page couldn't load" — which tells somebody standing in a warehouse
 * nothing about whether their work survived, and offers them nothing to do
 * about it. Three separate offline bugs presented as that screen, and each time
 * the screen itself made the bug harder to understand than it needed to be.
 *
 * WHY A BOUNDARY RATHER THAN MORE try/catch. Both, in fact — but the catches
 * cannot be the whole answer. A Server Action that fails on the network is
 * reported to the nearest error boundary by React's transition machinery
 * regardless of what the caller does with the promise, so a catch at the call
 * site does not stop it arriving here. What the catches do is prevent the
 * common cases; what this does is make the uncommon one survivable.
 *
 * It leans towards the network explanation on purpose. In this product, on the
 * devices it runs on, a failure under /dashboard is far more often a phone in a
 * lift than a genuine fault — and being told the connection dropped when the
 * real cause was a bug is a smaller harm than being told nothing at all.
 * `reset()` retries the render, which is the right action either way.
 *
 * TRANSLATED, UNLIKE `global-error.tsx`. That one replaces the root layout, so
 * no translation provider exists there and plain English is the honest choice.
 * This one renders INSIDE the root layout, where the provider does exist — so
 * it was English only because nobody had wired it up, and somebody working in
 * Uzbek met the one screen that matters most in a language they had not chosen.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useT();

  useEffect(() => {
    // The digest is what ties this to the structured log line written by
    // `onRequestError` in instrumentation.ts, so a report from a shop floor can
    // be matched to the actual failure.
    console.error('[dashboard] render failed:', error.message, error.digest ?? '');
    record('error.dashboard', error.digest ? `${error.message} [${error.digest}]` : error);
  }, [error]);

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {offline ? (
        <WifiOff className="size-9 text-[var(--color-muted-foreground)]" aria-hidden="true" />
      ) : (
        <RefreshCw className="size-9 text-[var(--color-muted-foreground)]" aria-hidden="true" />
      )}

      <h1 className="mt-4 text-lg font-semibold tracking-tight">
        {offline ? t('errors.boundaryOfflineTitle') : t('errors.boundaryTitle')}
      </h1>

      <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        {offline ? t('errors.boundaryOfflineBody') : t('errors.boundaryBody')}
      </p>

      <Button type="button" className="mt-5" onClick={reset}>
        {t('errors.tryAgain')}
      </Button>
    </div>
  );
}
