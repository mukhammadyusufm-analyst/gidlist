/**
 * Digital Asset Links: the proof that this website and that Android app are the
 * same product.
 *
 * =============================================================================
 * WHAT BREAKS WITHOUT IT, AND WHY IT LOOKS LIKE NOTHING
 *
 * A Trusted Web Activity is Chrome rendering this site with no browser chrome.
 * Android only grants that once it has fetched this file over HTTPS and found
 * the signing certificate of the installed app listed in it.
 *
 * When the check fails there is no error. The app opens in a Custom Tab
 * instead — the same pages, with an address bar and a title strip across the
 * top — and the only clue is that it does not look like an app. It is the
 * single most common way a TWA ships wrong, and it is invisible unless you know
 * to look for the bar.
 *
 * =============================================================================
 * WHY THE FINGERPRINT IS AN ENVIRONMENT VARIABLE
 *
 * It is not a secret — it is a public statement about a public key, and Google
 * fetches it anonymously. It lives in the environment for two other reasons.
 *
 * First, it does not exist yet when this code is written: the keystore is
 * created on his machine, by him, and nothing in this repository should be
 * waiting on that. Second, it changes. Play App Signing re-signs every upload
 * with a key Google holds, so the certificate that ends up on a phone is NOT
 * the one that signed the upload — and getting that wrong is exactly the
 * failure above. Both can be listed, comma separated, which is the safe answer:
 * the upload key for anything sideloaded during testing, and Play's own key for
 * anything installed from the store.
 *
 * ANDROID_CERT_FINGERPRINT: SHA-256 fingerprints, colon-separated hex, comma
 * separated from each other.
 * ANDROID_PACKAGE_NAME: the application id, if it is ever not the default.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME ?? 'com.gidlist.app';

  const fingerprints = (process.env.ANDROID_CERT_FINGERPRINT ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  /*
   * An empty list rather than a 404 when nothing is configured.
   *
   * Both refuse the app equally, and this one is honest about the reason: the
   * file exists, is well formed, and names nobody. A 404 would look like a
   * routing fault and send whoever is debugging it to the wrong place — which
   * matters, because the symptom they are chasing is an address bar that should
   * not be there.
   */
  const statements =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: packageName,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];

  return new Response(JSON.stringify(statements, null, 2), {
    headers: {
      // The content type Android's verifier expects. It is fetched by a machine,
      // so nothing here is negotiable.
      'content-type': 'application/json',
      // Short, because the first thing anybody does after a failed verification
      // is fix the fingerprint and try again — and an hour of cache would make
      // that look like the fix did not work.
      'cache-control': 'public, max-age=300',
    },
  });
}
