import { PageSkeleton } from '@/components/ui/skeleton';

/**
 * Shown the instant a dashboard navigation starts.
 *
 * One file at this level covers every page beneath it that does not define its
 * own, which is most of them. Nested routes with a distinct shape — a space, for
 * instance — get their own alongside this.
 */
export default function DashboardLoading() {
  return <PageSkeleton />;
}
