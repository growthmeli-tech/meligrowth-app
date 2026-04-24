import { cn } from "@/lib/utils";

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-component px-4 text-sm font-semibold transition",
        variant === "primary" && "bg-brand-purple text-white hover:bg-brand-dark",
        variant === "secondary" && "border border-black/10 bg-white text-brand-dark hover:bg-brand-light",
        variant === "ghost" && "text-brand-dark hover:bg-brand-light",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
