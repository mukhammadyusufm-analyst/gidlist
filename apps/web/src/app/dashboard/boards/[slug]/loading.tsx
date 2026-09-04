import { LoadingRegion, PageSkeleton } from '@/components/ui/skeleton';

/**
 * Moving between tabs inside a space.
 *
 * Content only, deliberately. This renders inside `[slug]/layout.tsx`, which has
 * already drawn the real banner, the real heading and the real tab strip — those
 * do not change when you move from Fill in to Compliance, and repeating them as
 * skeletons underneath the real ones looks like a fault rather than a wait.
 *
 * The banner-and-tabs version of this lives one level up in `boards/loading.tsx`,
 * where the layout genuinely has not been built yet. See the note there.
 */
export default function SpaceContentLoading() {
  return (
    <LoadingRegion>
      <PageSkeleton rows={4} />
    </LoadingRegion>
  );
}
