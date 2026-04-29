"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Bell, BookOpen, CheckSquare, LayoutDashboard, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type OpsNavigationProps = {
  alertasUrgentes: number;
  tareasPendientes: number;
};

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "alertasUrgentes" | "tareasPendientes";
}> = [
  { href: "/ops/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ops/alerts", label: "Alertas", icon: Bell, badgeKey: "alertasUrgentes" },
  { href: "/ops/blocks", label: "Bloques", icon: BarChart2 },
  { href: "/ops/catalog", label: "Catálogo", icon: BookOpen },
  { href: "/ops/pricing", label: "Precios", icon: Tag },
  { href: "/ops/tasks", label: "Tareas", icon: CheckSquare, badgeKey: "tareasPendientes" }
];

export function OpsSidebarNav({ alertasUrgentes, tareasPendientes }: OpsNavigationProps) {
  const pathname = usePathname();
  const badges = { alertasUrgentes, tareasPendientes };

  return (
    <nav className="mt-6 space-y-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/ops/dashboard"
            ? pathname === "/ops/dashboard"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const badgeValue = item.badgeKey ? badges[item.badgeKey] : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-[#FFD600] text-[#1A1A1A]" : "text-[#1A1A1A] hover:bg-[#F5F5F0]"
            )}
          >
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
            {badgeValue > 0 ? <span className="rounded-full bg-[#1A1A1A] px-2 py-0.5 text-[11px] font-bold text-white">{badgeValue}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function OpsBottomNav({ alertasUrgentes, tareasPendientes }: OpsNavigationProps) {
  const pathname = usePathname();
  const badges = { alertasUrgentes, tareasPendientes };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E8E8E2] bg-white md:hidden">
      <ul className="grid grid-cols-3 gap-y-1 border-t border-transparent py-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/ops/dashboard"
              ? pathname === "/ops/dashboard"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badgeValue = item.badgeKey ? badges[item.badgeKey] : 0;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-semibold leading-tight",
                  active ? "text-[#1A1A1A]" : "text-[#6B6B6B]"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-[#1A1A1A]" : "text-[#6B6B6B]")} />
                <span className="text-center">{item.label}</span>
                {badgeValue > 0 ? (
                  <span className="absolute right-2 top-0.5 rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{badgeValue}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
