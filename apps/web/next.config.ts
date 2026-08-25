import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * `@app/core` ships raw TypeScript rather than a build step, so Next has to
   * compile it alongside the app. This keeps the shared domain package free of
   * its own bundler config, which matters once the Expo app consumes it too.
   */
  transpilePackages: ['@app/core'],

  /**
   * In a pnpm workspace the app is not the repo root. Without this, standalone
   * output traces the wrong directory and Vercel drops files it actually needs.
   */
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),

  images: {
    remotePatterns: [
      {
        // Board logos and checklist banners are served from Supabase Storage.
        // Narrow this to the exact project host once the Supabase URL is known.
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

/**
 * The browser talks to Supabase directly — auth, storage uploads — so its
 * origin has to be allowed explicitly rather than covered by 'self'.
 */
const SUPABASE_ORIGIN = 'https://*.supabase.co';

/**
 * Reported, not enforced, and deliberately so.
 *
 * Two things stand between this and a strict enforced policy:
 *
 *   1. `style-src` cannot drop 'unsafe-inline' while seven components set
 *      `style={{…}}`, including the drag transforms in the checklist builder,
 *      which change every frame and cannot be a stylesheet.
 *   2. The strict `script-src` Next recommends needs a per-request nonce, and a
 *      nonce forces every page to render dynamically — the exact opposite of
 *      the static-shell work in README open item 2b. Choosing the CSP before
 *      that decision is settled would mean choosing twice.
 *
 * Report-Only still surfaces violations in the browser console, so it tells us
 * what an enforced policy would break without breaking anything for a tester
 * today. Promote it to `Content-Security-Policy` once 2b lands.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE_ORIGIN} wss://*.supabase.co`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * Sent on every response. Vercel adds none of these itself.
 *
 * Everything here is enforced because none of it can break a working page —
 * unlike the CSP above, which can and therefore is not.
 */
const SECURITY_HEADERS = [
  {
    // Two years, preloadable. Only meaningful over HTTPS, which is the only way
    // the app is served.
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // Stops a browser second-guessing Content-Type — the trick that turns an
    // uploaded "image" into an executed script.
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Full URLs leak space slugs and submission ids to any external site a user
    // clicks through to. Same-origin navigation keeps the path.
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Clickjacking. `frame-ancestors` in the CSP is the modern control, but that
    // policy is report-only, so this is what is actually enforcing it today.
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // The app asks for none of these. Denying them means a compromised
    // dependency cannot start asking either.
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
];

export default nextConfig;
