import { LoadingRegion, HeadingSkeleton, PageSkeleton } from '@/components/ui/skeleton';

export default function MembersLoading() {
  return (
    <LoadingRegion>
      <div className="space-y-6">
        <HeadingSkeleton />
        <PageSkeleton rows={5} />
      </div>
    </LoadingRegion>
  );
}
