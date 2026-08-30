/**
 * Environment validation.
 *
 * Reading `process.env` all over the codebase means a typo or a missing Vercel
 * variable shows up as a confusing runtime crash on some deep page. Parsing it
 * once here turns that into a clear message the moment the app boots.
 *
 * WHY THIS IS HAND-WRITTEN RATHER THAN A ZOD SCHEMA, which is what it used to
 * be. This module is imported by `lib/supabase/client.ts`, which runs in the
 * browser — so Zod came with it, and the bundler put it in the first load of
 * every route that touches Supabase from the client: 288 KB of validator to
 * check that one string is a URL and another is not empty. The checks below are
 * the same two checks and produce the same messages. Keep them dependency-free;
 * if this file ever needs a schema library again, split the browser half out
 * first.
 */

/** Collected so a misconfigured deploy reports every problem, not just the first. */
const problems: string[] = [];

/*
 * These must be written out literally rather than spread from `process.env`.
 * Next replaces `process.env.NEXT_PUBLIC_*` at build time by static text
 * substitution, so a dynamic lookup would come back undefined in the browser.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** `new URL` accepts `mailto:` and friends, so the protocol is checked too. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

if (!supabaseUrl || !isHttpUrl(supabaseUrl)) {
  problems.push(
    '  - NEXT_PUBLIC_SUPABASE_URL must be the full https URL of your Supabase project.',
  );
}

if (!supabaseAnonKey) {
  problems.push('  - NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
}

if (problems.length > 0) {
  throw new Error(
    `Environment is not configured correctly:\n${problems.join('\n')}\n\n` +
      'Copy .env.example to .env.local and fill in the values from your Supabase ' +
      'project (Settings -> API).',
  );
}

export const env = {
  // Narrowed by the throw above, which TypeScript cannot see through.
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl as string,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey as string,
};
