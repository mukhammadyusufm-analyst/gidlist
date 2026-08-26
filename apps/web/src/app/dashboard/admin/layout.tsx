import { notFound } from 'next/navigation';

import { isPlatformAdmin } from '@/lib/i18n/server';

/**
 * Every route under /dashboard/admin, gated in one place.
 *
 * The pages already check for themselves, and should keep doing so — but a
 * per-page check is a rule someone has to remember, and the cost of forgetting
 * once is an administrative surface open to every signed-in user. A layout
 * cannot be forgotten: a new file placed in this folder is covered the moment
 * it exists.
 *
 * Platform admin is not space owner. These pages change things shared by every
 * customer — interface wording most of all — so this is deliberately not
 * something a space owner can grant. The flag is set with SQL only, so nobody
 * can promote themselves or a colleague from inside the product.
 *
 * `notFound()` rather than a redirect, so the response does not confirm to a
 * curious signed-in user that an admin area exists at all.
 *
 * Neither this nor the page checks are the real control. Row Level Security
 * refuses these rows to anyone without the flag, so bypassing both would still
 * reach nothing — this decides what is worth rendering, not what is allowed.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isPlatformAdmin())) notFound();
  return <>{children}</>;
}
