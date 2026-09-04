import { FormSkeleton, LoadingRegion, HeadingSkeleton } from '@/components/ui/skeleton';

export default function AccountLoading() {
  return (
    <LoadingRegion>
      <div className="space-y-8">
        <HeadingSkeleton />
        <FormSkeleton fields={3} />
      </div>
    </LoadingRegion>
  );
}
