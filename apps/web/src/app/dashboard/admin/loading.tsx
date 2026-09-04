import { LoadingRegion, HeadingSkeleton, TableSkeleton } from '@/components/ui/skeleton';

/**
 * Covers every admin screen that does not define its own. They are all a
 * heading over a wide table — accounts, translations, history, plans, access —
 * so one shape genuinely fits.
 */
export default function AdminLoading() {
  return (
    <LoadingRegion>
      <div className="space-y-6">
        <HeadingSkeleton />
        <TableSkeleton rows={8} columns={6} />
      </div>
    </LoadingRegion>
  );
}
