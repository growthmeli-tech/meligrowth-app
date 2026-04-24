import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  style
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn("inline-flex min-h-7 items-center rounded-component border border-black/10 px-2.5 text-xs font-semibold", className)}
      style={style}
    >
      {children}
    </span>
  );
}
