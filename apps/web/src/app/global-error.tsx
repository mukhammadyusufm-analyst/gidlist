'use client';

import { useEffect, useState } from 'react';

/**
 * The screen that was actually being hit, and the one I kept failing to
 * replace.
 *
 * =============================================================================
 * WHY `dashboard/error.tsx` DID NOT CATCH ANY OF THIS
 *
 * The evidence was in the DOM the whole time: `<html id="__next_error__">`. That
 * is Next's GLOBAL error page, not a segment boundary. It is what the App
 * Router renders when a *navigation* fails rather than a render — and a
 * navigation in this app is a client-side RSC fetch, so with no connection it
 * fails before any segment exists to have a boundary. A file at
 * `dashboard/error.tsx` is never consulted.
 *
 * The same is true of a Server Action that fails on the network: the router
 * treats it as a failed request and lands here, which is why three rounds of
 * try/catch at the call site changed nothing.
 *
 * This file replaces that screen. It cannot prevent the failure — an
 * uncached page genuinely cannot be fetched with no signal — but "This page
 * couldn't load. Reload to try again, or go back." is the worst possible thing
 * to say to somebody halfway through a checklist in a basement. It does not say
 * whether their work survived, and both of the things it offers make it worse.
 *
 * =============================================================================
 * IT MUST RENDER ITS OWN <html> AND <body>
 *
 * A global error replaces the root layout, so nothing from it exists here: no
 * fonts, no theme, no I18nProvider. Hence plain English and inline styling —
 * the same trade the offline page makes, for the same reason. Confident text in
 * a language somebody did not choose is worse than short English.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Read after mount: `navigator` does not exist while this renders on the
  // server, and assuming offline would be wrong far more often than right.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    console.error('[global] ', error.message, error.digest ?? '');
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f1a',
          color: '#e8ecf5',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          padding: '2rem 1.5rem',
        }}
      >
        <div style={{ maxWidth: '26rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            {offline ? 'No connection' : 'That did not load'}
          </h1>

          {/*
            The sentence that matters. Somebody in a freezer needs to know their
            ticks are safe before they need anything else — every version of
            this screen until now left them to guess.
          */}
          <p style={{ marginTop: '0.75rem', lineHeight: 1.6, opacity: 0.75, fontSize: '0.9rem' }}>
            {offline
              ? 'This page needs a connection. Anything you have already ticked is saved on this device and will be sent when you have signal.'
              : 'Something went wrong. Anything you have already ticked is saved and has not been lost.'}
          </p>

          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {/*
              Offered first when there is no signal, because it is the only one
              that leads anywhere useful: /offline is served from the service
              worker cache and lists the checklists held on this device, which
              can still be filled in.
            */}
            {offline ? (
              <a
                href="/offline"
                style={{
                  padding: '0.6rem 1rem',
                  borderRadius: '0.5rem',
                  background: '#3b6fd4',
                  color: '#fff',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                }}
              >
                Saved checklists
              </a>
            ) : null}

            <button
              type="button"
              onClick={reset}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(232,236,245,0.25)',
                background: 'transparent',
                color: 'inherit',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
