import type { MetadataRoute } from 'next';

/**
 * The web app manifest — what makes the product installable to a home screen.
 *
 * Deliberately not a substitute for the Expo apps in Phase 8. What this buys is
 * a home-screen icon and a standalone window with no browser chrome, which is
 * most of what somebody filling in a checklist on a shift actually notices. The
 * things it does not buy — reliable offline in a basement, dependable iOS push
 * — are what native is for.
 *
 * A route rather than a static `manifest.json` so the name can eventually come
 * from the translations the rest of the product already uses. It is static for
 * now because the manifest is fetched once at install time, in whatever
 * language the person happened to be using, and a half-translated install is
 * worse than a consistently English one.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gidlist',
    short_name: 'Gidlist',
    description: 'Checklists that prove they were done.',

    /**
     * Straight to the spaces list, not `/`.
     *
     * `/` redirects — signed in to the dashboard, signed out to sign-in — so
     * starting there would cost every launch a round trip. Somebody who is
     * signed out still lands on sign-in, because the proxy sends them there.
     */
    start_url: '/dashboard',
    scope: '/',

    /**
     * `standalone`, so it opens without browser chrome and reads as an app.
     * Not `fullscreen`: hiding the status bar takes away the clock and the
     * battery from somebody who is working a shift.
     */
    display: 'standalone',
    orientation: 'portrait',

    // Matches the tokens in packages/design. The background is what fills the
    // screen during launch, so it must be the app's own background rather than
    // white, or every cold start flashes.
    theme_color: '#2961ce',
    background_color: '#fbfbfc',

    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      /*
       * Maskable is a separate file, not the same one relabelled. Android crops
       * an icon to whatever shape the launcher uses — circle, squircle, teardrop
       * — so a maskable icon has to bleed to the edges with the mark inside a
       * safe zone. Reusing the rounded-square version would get its corners
       * clipped off.
       */
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],

    categories: ['business', 'productivity'],
    lang: 'en',
    dir: 'ltr',
  };
}
