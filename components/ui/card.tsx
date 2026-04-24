import { cn } from "@/lib/utils";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-card border border-black/10 bg-white p-5", className)}>{children}</div>;
}
