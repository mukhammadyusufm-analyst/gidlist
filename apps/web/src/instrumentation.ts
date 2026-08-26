import type { Instrumentation } from 'next';

/**
 * Server errors, captured by the framework rather than by remembering to catch.
 *
 * Next calls `onRequestError` for anything that fails while handling a request —
 * a Server Component render, a Server Action, a route handler, the proxy. That
 * coverage is the point: a try/catch only helps where somebody thought to put
 * one, and production faults are by definition the ones nobody anticipated.
 *
 * No SDK. `onRequestError` is a framework export and the reporting is one fetch,
 * so this costs no dependency, works on this version of Next today rather than
 * whenever a vendor catches up, and can be pointed at any service later without
 * touching this file.
 *
 * Deliberately narrow in what it passes on — see the note in `report.ts` about
 * `request.headers` carrying the session cookie.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // Imported here rather than at module scope: this file is loaded on every
  // runtime Next initialises, and `report.ts` is server-only.
  const { reportError } = await import('@/lib/observability/report');

  const message = error instanceof Error ? error.message : String(error);

  // React replaces the error during Server Component rendering, so the digest
  // is sometimes the only way to tie what was logged to what a user saw.
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest: unknown }).digest)
      : undefined;

  await reportError({
    message,
    digest,
    route: context.routePath,
    kind: context.routeType,
    method: request.method,
    // Query string dropped. A path can carry an email, an invitation token or a
    // search term somebody typed, none of which belong in a log or a webhook.
    path: request.path?.split('?')[0],
    stack: error instanceof Error ? error.stack : undefined,
  });
};
