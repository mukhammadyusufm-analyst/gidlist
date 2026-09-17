import 'server-only';

import { createClient } from '@/lib/supabase/server';

/** How long an instruction file stays reachable. Long enough for a shift. */
const SIGNED_URL_SECONDS = 60 * 60 * 8;

/**
 * Signed links for instruction files, by storage path.
 *
 * The bucket is private — only the checklist's own people may read it — so the
 * page mints links for the paths it is about to render, in one call. A path the
 * viewer may not read comes back without a URL and is simply not shown.
 */
export async function signInstructionUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)].filter(Boolean);
  if (unique.length === 0) return {};

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from('checklist-instructions')
    .createSignedUrls(unique, SIGNED_URL_SECONDS);

  const urls: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) urls[row.path] = row.signedUrl;
  }
  return urls;
}
