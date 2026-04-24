import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationBell({ href, unreadCount }: { href: string; unreadCount: number }) {
  return (
    <Link
      href={href}
      className="focus-ring relative grid h-10 w-10 place-items-center rounded-component border border-black/10 bg-white text-zinc-700"
      aria-label={`Notificaciones${unreadCount > 0 ? `: ${unreadCount} sin leer` : ""}`}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#E24B4A] px-1 text-[11px] font-bold leading-none text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
