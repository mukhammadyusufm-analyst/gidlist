import { redirect } from 'next/navigation';

import { getUser } from '@/lib/supabase/server';

/**
 * The app subdomain has no front door of its own — it is a doorway.
 *
 * This used to be a Phase 0 placeholder landing page: a heading, a paragraph
 * and two buttons, written before the product had a design and never revisited.
 * It was the only page on `app.gidlist.com` that did not look like the rest of
 * the app, which is exactly how it was noticed.
 *
 * Restyling it would have been the wrong fix. `app.gidlist.com` is the product;
 * `gidlist.com` is where the selling happens. A landing page here would compete
 * with the marketing site for the same words and the same search results, and
 * the two would drift apart the moment either was edited. So the root sends
 * people where they were actually going and says nothing.
 *
 * Signed in to the dashboard, signed out to sign-in. Not a permanent redirect:
 * the destination depends on who is asking, so it must never be cached.
 *
 * `proxy.ts` reaches the same conclusion for `/login` and `/signup` — it sends
 * a signed-in visitor to the dashboard — and it already has the user in hand,
 * so this could have lived there instead. It does not, deliberately: the proxy
 * is the security boundary that gates every private route, and a cosmetic
 * routing preference is not worth editing that file for.
 */
export default async function HomePage() {
  const user = await getUser();
  redirect(user ? '/dashboard' : '/login');
}
