import { redirect } from 'next/navigation';

/**
 * Opening a space lands on Fill in.
 *
 * The space root used to *be* the checklist library, which put the builder's
 * list in front of everybody — including the people who only ever tick things
 * off, and who are most of a space. Fill in is the tab they open every day, so
 * it is what a space should open on; the library moved to `./checklists`.
 *
 * A redirect rather than moving Fill in to the root, because the two tabs then
 * keep their own addresses: the tab bar can mark exactly one as current, and a
 * link to the checklist library says so rather than reading as a link to the
 * space.
 *
 * Not permanent, and it must not be cached: `./checklists` redirects members
 * back here, so a cached 308 would strand somebody in a loop the moment their
 * role changed. `redirect()` issues a 307.
 */
export default async function BoardRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // The layout above has already resolved the board and 404s when there is
  // none, so there is nothing left to check here.
  redirect(`/dashboard/boards/${slug}/fill`);
}
