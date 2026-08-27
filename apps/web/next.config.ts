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
 * The Content Security Policy is NOT here. It lives in `proxy.ts`, because a
 * strict `script-src` needs a fresh nonce per request and a static config
 * cannot produce one.
 *
 * Everything below is enforced from here instead: none of it varies per
 * request, and none of it can break a working page.
 *
 * `frame-ancestors` is in the CSP, but `X-Frame-Options` stays as well — it is
 * the older control, understood by anything that predates CSP, and the two
 * agree.
 *
 * @see proxy.ts for the policy and the two deliberate loosenings in it.
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
];

export default nextConfig;
