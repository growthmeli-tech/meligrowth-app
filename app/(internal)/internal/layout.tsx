import Link from "next/link";
import { LayoutDashboard, Users, Bell } from "lucide-react";
import { getInternalDashboardCompanies } from "@/lib/data-v2/dashboard-internal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const dashboardResult = await getInternalDashboardCompanies();
  const companies = dashboardResult.success ? dashboardResult.data : [];
  const clientsCount = companies.length;
  const unreadAlerts = companies.reduce((acc, company) => acc + company.urgentAlertsPending, 0);

  return (
    <div className="min-h-screen bg-[#F5F5F0] md:grid md:grid-cols-[264px_1fr]">
      <aside className="hidden md:flex md:flex-col md:justify-between border-r border-[#E8E8E2] bg-white p-4">
        <div>
          <div className="flex items-center gap-2 px-2 py-4">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#FFD600] text-[#1A1A1A] font-black text-xs">MG</span>
            <p className="text-sm font-black text-[#1A1A1A] tracking-wide">MELIGROWTH</p>
          </div>

          <nav className="mt-4 space-y-1">
            <NavItem href="/internal/dashboard" label="Dashboard" icon={<LayoutDashboard className="h-4 w-4" />} />
            <NavItem
              href="/internal/clients"
              label="Clientes"
              icon={<Users className="h-4 w-4" />}
              badge={clientsCount > 0 ? String(clientsCount) : undefined}
            />
            <NavItem
              href="/internal/alerts"
              label="Alertas"
              icon={<Bell className="h-4 w-4" />}
              badge={unreadAlerts > 0 ? String(unreadAlerts) : undefined}
            />
          </nav>
        </div>

        <div className="rounded-xl border border-[#E8E8E2] p-3">
          <p className="text-sm font-semibold text-[#1A1A1A]">Joaquin</p>
          <p className="text-xs text-[#6B6B6B]">internal</p>
        </div>
      </aside>

      <main className="min-h-screen">{children}</main>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  badge
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-[#1A1A1A] hover:bg-[#FFD600]/20">
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      {badge ? <span className="rounded-full bg-[#FFD600] px-2 py-0.5 text-xs font-bold text-[#1A1A1A]">{badge}</span> : null}
    </Link>
  );
}
