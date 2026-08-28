import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `@app/core` ships raw TypeScript rather than a build step, so Next compiles
   * it alongside the app — the same arrangement the product uses.
   */
  transpilePackages: ['@app/core'],

  /**
   * In a pnpm workspace the app is not the repo root. Without this, output
   * tracing looks at the wrong directory and Vercel drops files it needs.
   */
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),

  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

/**
 * Security headers.
 *
 * Deliberately a shorter list than the product's. This site is public, has no
 * session and no private data, so the headers that exist to protect a logged-in
 * user are not the point here — what matters is that a compromised dependency
 * cannot quietly start doing something the site never does.
 *
 * There is no Content Security Policy here yet. When the animation work lands
 * in Phase B it will need one, and it belongs in a proxy rather than this file
 * for the same reason it does in the product: a strict `script-src` needs a
 * fresh nonce per request, and a static config cannot produce one.
 *
 * @see apps/web/src/proxy.ts for how that is done.
 */
const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // A marketing page benefits from full referrers on outbound links, but not
    // enough to leak which page somebody was reading to every third party.
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
];

export default nextConfig;
