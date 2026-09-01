'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile, rendered explicitly rather than by class name.
 *
 * Supabase checks the token server-side on every auth endpoint once CAPTCHA is
 * switched on, so this has to appear on sign-in, sign-up and password reset —
 * not only on sign-up. Missing it anywhere locks that route out completely.
 *
 * EXPLICIT RENDER, NOT THE `cf-turnstile` CLASS. The automatic mode wants a
 * global function named in a `data-callback` attribute, which means putting a
 * function on `window` and naming it in markup. The explicit API takes the
 * callback as a value, so nothing global is created and the Content Security
 * Policy has one less thing to allow.
 *
 * A TOKEN IS SINGLE USE. Supabase rejects a token it has already seen, so a
 * failed sign-in — a mistyped password, say — leaves the widget holding a token
 * that will be refused on the retry, and the person is told their password is
 * wrong twice for two different reasons. The parent form fixes that by keying
 * this component on the moment of the last failure, which remounts it and
 * fetches a fresh token. See `at` in AuthState.
 *
 * WITH NO SITE KEY THIS RENDERS NOTHING, deliberately. Local development and
 * preview deploys without the variable set keep working, and the server simply
 * receives no token — which is correct as long as Supabase has CAPTCHA off for
 * that project. The moment it is on, the key has to be set or auth stops.
 */

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      theme?: 'auto' | 'light' | 'dark';
    },
  ) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const boxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  /*
   * The callback is held in a ref so re-rendering the parent — which happens on
   * every keystroke in the form above — does not tear down and rebuild the
   * widget, which would fetch a new challenge each time.
   *
   * Assigned in an effect rather than during render: a ref written while
   * rendering is not guaranteed to be the value React ends up committing, and
   * the lint rule that says so is right.
   */
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    // Captured once. Reading `boxRef.current` again inside the interval or the
    // cleanup could see a different node after a remount, and the widget would
    // then be removed from somewhere it was never drawn.
    const box = boxRef.current;
    if (!siteKey || !box) return;

    let widgetId: string | undefined;
    let cancelled = false;

    /*
     * The script is loaded by the layout, but it is not necessarily parsed by
     * the time this effect runs. Polling briefly is simpler and more robust
     * than racing a load event, and it stops on unmount.
     */
    const start = Date.now();
    const timer = setInterval(() => {
      if (cancelled) return;

      if (window.turnstile) {
        clearInterval(timer);
        widgetId = window.turnstile.render(box, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          'error-callback': () => setFailed(true),
          // An expired challenge is not an error; clearing the token means the
          // form submits without one and the server refuses, which is the
          // honest outcome.
          'expired-callback': () => onTokenRef.current(''),
          theme: 'auto',
        });
        return;
      }

      // Ten seconds is far longer than the script needs and short enough that a
      // blocked or failed load reports itself rather than hanging silently.
      if (Date.now() - start > 10_000) {
        clearInterval(timer);
        setFailed(true);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div>
      <div ref={boxRef} />
      {failed ? (
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          The verification widget could not load. Check your connection and reload the page.
        </p>
      ) : null}
    </div>
  );
}
