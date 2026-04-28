import Link from "next/link";
import { BellRing, Building2, Calculator, LayoutDashboard, LogOut, Settings, Upload } from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { getOperatorClientsList, getUnreadNotificationCount } from "@/lib/data";

function getOperatorNav(clientId: string | null) {
  const defaultClientHref = clientId ? `/internal/clients/${clientId}` : "/internal/clients/new";
  const defaultFilesHref = clientId ? `/internal/clients/${clientId}/files` : "/internal/clients/new";

  return [
    { href: "/internal/dashboard", label: "Cartera", icon: LayoutDashboard },
    { href: "/internal/clients/new", label: "Nuevo cliente", icon: Building2 },
    { href: defaultClientHref, label: "Cliente", icon: Building2 },
    { href: defaultFilesHref, label: "Archivos", icon: Upload },
    { href: "/internal/pricing", label: "Precios", icon: Calculator },
    { href: "/internal/notifications", label: "Notificaciones", icon: BellRing },
    { href: "/internal/settings", label: "Settings", icon: Settings }
  ];
}

const clientNav = [
  { href: "/client/dashboard", label: "Mi cuenta", icon: LayoutDashboard },
  { href: "/client/metrics", label: "Métricas", icon: Building2 },
  { href: "/client/files", label: "Archivos", icon: Upload },
  { href: "/client/notifications", label: "Notificaciones", icon: BellRing }
];

export async function AppShell({
  children,
  mode
}: {
  children: React.ReactNode;
  mode: "operator" | "client";
}) {
  const operatorClients = mode === "operator" ? await getOperatorClientsList() : [];
  const nav = mode === "operator" ? getOperatorNav(operatorClients[0]?.id ?? null) : clientNav;
  const unreadCount = await getUnreadNotificationCount();
  const notificationsHref = mode === "operator" ? "/internal/notifications" : "/client/notifications";
  return (
    <div className="min-h-screen bg-[#FBFBFD]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-black/10 bg-white px-4 py-5 lg:block">
        <Link href="/" className="block">
          <BrandLogo className="h-16 w-full" priority />
        </Link>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex min-h-11 items-center gap-3 rounded-component px-3 text-sm font-medium text-zinc-700 hover:bg-brand-light hover:text-brand-dark">
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/10 bg-white/95 px-4 backdrop-blur md:px-8">
          <div>
            <div className="text-sm font-semibold text-brand-dark">{mode === "operator" ? "Panel de operadores" : "Dashboard de cliente"}</div>
            <div className="text-xs text-zinc-500">Automatización y salud de cuenta</div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell href={notificationsHref} unreadCount={unreadCount} />
            <form action={logout}>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-component border border-black/10 bg-white text-zinc-700" aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
