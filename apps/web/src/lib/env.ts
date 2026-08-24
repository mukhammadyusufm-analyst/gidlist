import { z } from 'zod';

/**
 * Environment validation.
 *
 * Reading `process.env` all over the codebase means a typo or a missing Vercel
 * variable shows up as a confusing runtime crash on some deep page. Parsing it
 * once here turns that into a clear message the moment the app boots.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: 'NEXT_PUBLIC_SUPABASE_URL must be the full https URL of your Supabase project.',
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, { error: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.' }),
});

/**
 * These must be written out literally rather than spread from `process.env`.
 * Next replaces `process.env.NEXT_PUBLIC_*` at build time by static text
 * substitution, so a dynamic lookup would come back undefined in the browser.
 */
const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.message}`).join('\n');
  throw new Error(
    `Environment is not configured correctly:\n${details}\n\n` +
      'Copy .env.example to .env.local and fill in the values from your Supabase ' +
      'project (Settings -> API).',
  );
}

export const env = parsed.data;
