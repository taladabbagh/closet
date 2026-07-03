import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div className="mb-1 space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <Skeleton className="mb-2 h-3 w-16" />
          <Skeleton className="h-[clamp(8.5rem,22vh,13rem)] rounded-[1.75rem]" />
        </div>
      ))}
      <div className="mt-4 flex justify-center">
        <Skeleton className="h-11 w-64 rounded-full" />
      </div>
    </div>
  );
}
