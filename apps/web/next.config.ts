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
};

export default nextConfig;
