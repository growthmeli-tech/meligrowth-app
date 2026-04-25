import { cn } from "@/lib/utils";

type LoadingSkeletonProps = {
  variant: "score-card" | "client-table" | "recommendation-list" | "chart" | "diagnostic-form";
  rows?: number;
};

export function LoadingSkeleton({ variant, rows = 3 }: LoadingSkeletonProps) {
  if (variant === "score-card") {
    return (
      <div className="animate-pulse rounded-xl border border-black/10 bg-white p-5">
        <div className="h-4 w-24 rounded bg-zinc-200" />
        <div className="mt-4 h-14 w-20 rounded bg-zinc-200" />
        <div className="mt-3 h-4 w-28 rounded bg-zinc-200" />
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className="animate-pulse rounded-xl border border-black/10 bg-white p-5">
        <div className="h-4 w-40 rounded bg-zinc-200" />
        <div className="mt-4 h-56 w-full rounded bg-zinc-100" />
      </div>
    );
  }

  if (variant === "recommendation-list") {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-xl border border-black/10 bg-white p-4">
            <div className="h-4 w-28 rounded bg-zinc-200" />
            <div className="mt-3 h-5 w-2/3 rounded bg-zinc-200" />
            <div className="mt-2 h-4 w-full rounded bg-zinc-100" />
            <div className="mt-1 h-4 w-5/6 rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "diagnostic-form") {
    return (
      <div className="grid animate-pulse gap-4 md:grid-cols-2">
        {Array.from({ length: rows * 2 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-black/10 bg-white p-4">
            <div className="h-4 w-1/3 rounded bg-zinc-200" />
            <div className="mt-3 h-10 w-full rounded bg-zinc-100" />
            <div className="mt-2 h-3 w-2/3 rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-pulse rounded-xl border border-black/10 bg-white">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={cn("grid grid-cols-4 gap-4 p-4", index > 0 && "border-t border-black/10")}>
          <div className="h-4 rounded bg-zinc-100" />
          <div className="h-4 rounded bg-zinc-100" />
          <div className="h-4 rounded bg-zinc-100" />
          <div className="h-4 rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}
