import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { OpsBottomNav, OpsSidebarNav } from "@/components/ops/ops-navigation";
import { getLatestAccountHealthByAccount } from "@/lib/data-v2/account-health";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { getCompanyById } from "@/lib/data-v2/companies";
import { listTasksByAccount } from "@/lib/data-v2/tasks";
import { getCurrentViewerProfile, getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
import { getScoreLabel } from "@/lib/utils/scores";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const [viewerResult, accountResult] = await Promise.all([getCurrentViewerProfile(), getPrimaryAccountForOperator()]);
  const viewerName = viewerResult.success ? viewerResult.data.profile.name ?? "Operador" : "Operador";
  const viewerInitials = viewerName
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const account = accountResult.success ? accountResult.data : null;
  const [companyResult, healthResult, alertsResult, pendingTasksResult, inProgressTasksResult] = account
    ? await Promise.all([
        getCompanyById(account.company_id),
        getLatestAccountHealthByAccount(account.id),
        listAlertsByAccount(account.id, { audience: "operator", includeResolved: false }),
        listTasksByAccount(account.id, { status: "pendiente" }),
        listTasksByAccount(account.id, { status: "en_curso" })
      ])
    : [null, null, null, null, null];

  const companyName = companyResult && companyResult.success ? companyResult.data?.name ?? "Cuenta operativa" : "Cuenta operativa";
  const score = healthResult && healthResult.success ? healthResult.data?.score_global ?? null : null;
  const scoreLabel = score === null ? "Sin score" : getScoreLabel(Number(score));
  const urgentAlertsCount = alertsResult && alertsResult.success ? alertsResult.data.filter((item) => item.prioridad === "urgente").length : 0;
  const pendingTasksCount =
    (pendingTasksResult && pendingTasksResult.success ? pendingTasksResult.data.length : 0) +
    (inProgressTasksResult && inProgressTasksResult.success ? inProgressTasksResult.data.length : 0);

  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-28 md:grid md:grid-cols-[220px_1fr] md:pb-0">
      <aside className="hidden border-r border-[#E8E8E2] bg-white p-4 md:flex md:flex-col">
        <p className="text-sm font-black text-[#1A1A1A]">MELIGROWTH OPS</p>
        <div className="mt-4 rounded-xl border border-[#E8E8E2] bg-[#F5F5F0] p-3">
          <p className="text-xs font-semibold text-[#6B6B6B]">{companyName}</p>
          <p className="mt-1 text-sm font-bold text-[#1A1A1A]">{score === null ? "--" : score}</p>
          <p className="text-xs text-[#6B6B6B]">{scoreLabel}</p>
        </div>

        <OpsSidebarNav alertasUrgentes={urgentAlertsCount} tareasPendientes={pendingTasksCount} />

        <div className="mt-auto rounded-xl border border-[#E8E8E2] p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FFD600] text-sm font-black text-[#1A1A1A]">{viewerInitials}</span>
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A]">{viewerName}</p>
              <p className="text-xs text-[#6B6B6B]">Operador</p>
            </div>
          </div>
          <form action={logout} className="mt-3">
            <button type="submit" className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600">
              <LogOut className="h-3.5 w-3.5" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <section className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-[#E8E8E2] bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black text-[#1A1A1A]">MELIGROWTH OPS</p>
              <p className="text-xs text-[#6B6B6B]">{companyName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-[#1A1A1A]">{score === null ? "--" : `Score ${score}`}</p>
              <form action={logout}>
                <button type="submit" className="text-xs font-semibold text-red-500">
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
          <p className="mt-2 text-xs font-semibold text-[#6B6B6B]">{viewerName}</p>
        </header>

        <main className="px-4 py-4 md:p-6">{children}</main>
      </section>

      <OpsBottomNav alertasUrgentes={urgentAlertsCount} tareasPendientes={pendingTasksCount} />
    </div>
  );
}
