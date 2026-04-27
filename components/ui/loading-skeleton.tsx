export type LoadingSkeletonProps = {
  variant: "score-hero" | "score-card" | "recommendation-list" | "company-table" | "client-table" | "chart" | "diagnostic-form";
  rows?: number;
};

export function LoadingSkeleton({ variant, rows = 3 }: LoadingSkeletonProps) {
  if (variant === "score-hero" || variant === "score-card") {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-full bg-gray-200 animate-pulse" />
        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (variant === "recommendation-list") {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-32 rounded-xl bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (variant === "company-table" || variant === "client-table") {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-16 rounded-lg bg-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (variant === "diagnostic-form") {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-12 w-full bg-gray-200 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "chart") {
    return <div className="h-40 md:h-48 rounded-xl bg-gray-200 animate-pulse" />;
  }

  return <p className="text-sm text-red-600">No pudimos renderizar loading state</p>;
}
