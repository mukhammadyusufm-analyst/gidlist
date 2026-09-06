'use client';

import { useEffect } from 'react';

import { record } from '@/lib/offline/log';

/**
 * Catches the failures that never reach a React error boundary.
 *
 * A boundary sees a render that threw. It does not see an exception from an
 * event handler, a rejected promise nobody awaited, or a script that failed to
 * load — and on a phone with no signal those are the likely ones. Two window
 * listeners cover all three, and they cost nothing when nothing goes wrong.
 *
 * Renders nothing. Mounted once in the dashboard layout, which is the whole of
 * the app somebody fills a checklist in.
 */
export function ErrorRecorder() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      record('error.window', event.error ?? event.message);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      record('error.rejection', event.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    // Not an error, but the line that makes the rest of the trace readable:
    // every entry after this one belongs to this page load.
    record('page.load', location.pathname);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
