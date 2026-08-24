import Link from 'next/link';

import { getUser } from '@/lib/supabase/server';
import { buttonVariants } from '@/components/ui/button';

/**
 * Placeholder landing page.
 *
 * Phase 0 only needs somewhere for signed-out visitors to land and a way in.
 * The real marketing page is a separate concern — per the SEO plan it belongs
 * on the main site under a subfolder, not inside the app.
 */
export default async function HomePage() {
  const user = await getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Operational checklists that actually get completed
      </h1>
      <p className="mt-4 max-w-xl text-[var(--color-muted-foreground)]">
        Build checklist templates once, schedule them, assign them, and see exactly what was done,
        what is still a draft, and what was missed.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {user ? (
          <Link href="/dashboard" className={buttonVariants({ size: 'lg' })}>
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
              Get started
            </Link>
            <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
