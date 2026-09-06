/**
 * Keeps the cached offline page in step with the deployed build.
 *
 * =============================================================================
 * THE BUG THIS EXISTS TO FIX, AND THE ONE I WRONGLY RULED OUT
 *
 * `sw.js` precaches `/offline` once, in its `install` handler, and never looks
 * at it again. A service worker only reinstalls when its own bytes change — and
 * `sw.js` does not change from one deploy to the next. So the copy of `/offline`
 * on a device is frozen at whenever that worker first installed, potentially
 * many builds ago, while every online page is current.
 *
 * That matters far more than it sounds, because `/offline` is not a static
 * apology page any more. It boots React and renders the real fill sheet from
 * IndexedDB — so a stale copy means the CODE THAT RUNS WITH NO SIGNAL is old
 * code, on a device whose online pages are new. Every fix to the offline path
 * ships to everybody except the situation it was written for.
 *
 * I told him a stale worker could not be serving old JavaScript, reasoning that
 * `/_next/static/*` filenames carry a content hash so a stale entry can never be
 * returned for new code. That reasoning was sound and the conclusion was wrong:
 * hashed assets are safe, but the HTML that NAMES them is not, and this cache
 * holds exactly that. It was the fourth wrong theory in a row, and the first one
 * I had actually talked myself out of.
 *
 * =============================================================================
 * WHY THE PAGE REFRESHES IT RATHER THAN THE WORKER
 *
 * The worker cannot: it is not running when a deploy happens, and nothing wakes
 * it to check. The page, on the other hand, is by definition online whenever it
 * can do anything about this. So while there is a connection it fetches the
 * current `/offline`, and swaps it in.
 *
 * THE ORDER IS THE WHOLE OF THE SAFETY. The new HTML names new chunk files by
 * hash, and if those are not in the cache the page boots to nothing with no
 * signal — which is strictly worse than serving a build that is old but whole.
 * So the assets are stored FIRST, and the HTML is swapped only if every one of
 * them arrived. A failed refresh leaves the previous, working copy alone.
 */

/** Both names must match `public/sw.js`. */
const SHELL = 'gidlist-shell-v2';
const ASSETS = 'gidlist-assets-v1';
const OFFLINE_URL = '/offline';

/** Stamped into the page by `app/offline/page.tsx`. */
function buildOf(html: string): string | null {
  return /data-build="([^"]*)"/.exec(html)?.[1] ?? null;
}

/**
 * The build of the copy currently on the device, for the diagnostics page.
 *
 * `null` means either no copy or a copy from before this marker existed — which
 * is itself the answer, since a page with no marker is by definition old.
 */
export async function cachedShellBuild(): Promise<string | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const hit = await caches.match(OFFLINE_URL);
    return hit ? buildOf(await hit.text()) : null;
  } catch {
    return null;
  }
}

/**
 * Everything the offline page needs in order to boot.
 *
 * Read out of the markup rather than guessed: Next names the route's own chunks
 * in script tags and preload links, and those names change every build.
 */
function assetsIn(html: string): string[] {
  const found = html.match(/\/_next\/static\/[^"'\s>]+/g) ?? [];
  return [...new Set(found)].filter((url) => url.endsWith('.js') || url.endsWith('.css'));
}

/** Once per page load is plenty; this runs beside real work. */
let done = false;

export async function refreshShell(
  /** Set by the diagnostics button, which is somebody asking on purpose. */
  force = false,
): Promise<'skipped' | 'current' | 'updated' | 'failed'> {
  if ((done && !force) || typeof caches === 'undefined' || !navigator.onLine) return 'skipped';
  done = true;

  try {
    // `no-store` so this asks the network rather than being answered by the very
    // cache it is trying to correct.
    const response = await fetch(OFFLINE_URL, { cache: 'no-store' });
    if (!response.ok) return 'failed';

    const html = await response.clone().text();
    const build = buildOf(html);

    // A copy already matching the deployment is left alone — including its
    // assets, which must have been stored to get here in the first place.
    if (build && build === (await cachedShellBuild())) return 'current';

    // Assets first. `addAll` rejects as a whole if any single request fails,
    // which is exactly the guarantee wanted: either the new page can boot or
    // nothing is touched.
    const assets = assetsIn(html);
    if (assets.length > 0) await (await caches.open(ASSETS)).addAll(assets);

    await (await caches.open(SHELL)).put(OFFLINE_URL, response);
    return 'updated';
  } catch {
    // Offline mid-refresh, storage full, or a chunk that 404s. The previous copy
    // survives, which is the point.
    return 'failed';
  }
}
