import { FormSkeleton, LoadingRegion, HeadingSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * Settings is a column of small forms with an image control in the middle, not
 * a list of rows — so the generic shape would be wrong here in both directions.
 */
export default function SpaceSettingsLoading() {
  return (
    <LoadingRegion>
      <div className="max-w-lg space-y-10">
        <div className="space-y-4">
          <HeadingSkeleton />
          <FormSkeleton fields={2} />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-5 w-24" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-16 shrink-0 rounded-lg" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="aspect-[3/1] w-full rounded-xl" />
        </div>
      </div>
    </LoadingRegion>
  );
}
