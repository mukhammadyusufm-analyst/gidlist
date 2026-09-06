import { redirect } from 'next/navigation';

import { getUser } from '@/lib/supabase/server';
import { DiagnosticsReport } from '@/components/offline/diagnostics-report';

/**
 * The service hatch. Unlinked, and that is on purpose.
 *
 * =============================================================================
 * WHY IT IS NOT IN THE NAVIGATION
 *
 * Nobody filling in a checklist has any use for it, and a menu item nobody
 * understands makes a product feel like a piece of equipment. It is reached by
 * typing the address, which is exactly the level of ceremony it deserves:
 * whoever needs it is being told where to go by whoever is fixing the problem.
 *
 * It is behind the ordinary session check rather than an admin capability,
 * because the person who can reproduce a fault is the person holding the phone,
 * and everything shown is about their own device and their own queue.
 */
export const metadata = { title: 'Diagnostics' };

// Nothing here may be cached: the point is the state of this device right now.
export const dynamic = 'force-dynamic';

export default async function DiagnosticsPage() {
  const user = await getUser();
  if (!user) redirect('/login?next=/dashboard/diagnostics');

  /*
   * Read on the server, where Vercel puts it, and handed down.
   *
   * This is the line that answers the question three rounds of debugging never
   * established: whether the phone reporting the fault is running the build that
   * was supposed to fix it. Every other explanation was worth less than that one
   * fact, and nobody had it.
   */
  const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 8);

  // The deployment, not a timestamp. A clock read here would be request time
  // rather than build time, which is the sort of number that looks like an
  // answer and is not one.
  const builtAt = process.env.VERCEL_DEPLOYMENT_ID?.slice(-8) ?? 'dev';

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">Diagnostics</h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        The state of this device. Reproduce the problem first, then open this page and send the two
        blocks below.
      </p>

      <DiagnosticsReport userId={user.id} commit={commit} builtAt={builtAt} />
    </div>
  );
}
