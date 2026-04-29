import { Skeleton } from './ui/skeleton';

export function DashboardSkeleton() {
  return (
    <>
      <div className="flex flex-col items-center justify-center gap-4 mb-8 pt-8">
        <Skeleton className="h-10 w-52" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8 mt-6">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </>
  );
}
