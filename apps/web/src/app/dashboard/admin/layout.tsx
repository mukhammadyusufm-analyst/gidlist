import { notFound } from 'next/navigation';

import { hasAnyCapability } from '@/lib/platform/access';

/**
 * Every route under /dashboard/admin, gated in one place.
 *
 * The pages already check for themselves, and should keep doing so — but a
 * per-page check is a rule someone has to remember, and the cost of forgetting
 * once is an administrative surface open to every signed-in user. A layout
 * cannot be forgotten: a new file placed in this folder is covered the moment
 * it exists.
 *
 * Platform access is not space ownership. These pages change things shared by
 * every customer — interface wording most of all — so none of it is something
 * a space owner can grant.
 *
 * This layout asks only whether the person holds ANY capability, because that
 * is the question it can answer for the whole segment. Each page checks the
 * specific one it needs: holding `translations` must not open the accounts
 * page, which is the entire reason capabilities replaced a single flag.
 *
 * `notFound()` rather than a redirect, so the response does not confirm to a
 * curious signed-in user that an admin area exists at all.
 *
 * Neither this nor the page checks are the real control. Row Level Security
 * refuses these rows to anyone without the capability, so bypassing both would
 * still reach nothing — this decides what is worth rendering, not what is
 * allowed.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAnyCapability())) notFound();
  return <>{children}</>;
}
