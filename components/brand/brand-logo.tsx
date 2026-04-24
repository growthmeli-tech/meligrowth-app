import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden rounded-card border border-black/10 bg-white", className)}>
      <Image
        src="/brand/meligrowth-logo.png"
        alt="MeliGrowth"
        fill
        priority={priority}
        sizes="(max-width: 768px) 260px, 220px"
        className="object-contain"
      />
    </div>
  );
}
