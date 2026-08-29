'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker, and nothing else.
 *
 * Renders no markup. It exists because registration has to happen in the
 * browser and every layout in this app is a server component.
 *
 * Registered after load rather than during it: the worker's only jobs are the
 * install prompt and an offline fallback, neither of which matters on the first
 * paint, and fetching it early competes with the page's own JavaScript on the
 * slow connection where that actually hurts.
 *
 * Failure is silent on purpose. A browser with service workers disabled, a
 * private window, or an insecure origin all end up here, and none of them is a
 * problem the person using the app can do anything about — the app works
 * exactly as before without it.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Nothing to recover. See above.
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
