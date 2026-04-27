import Link from "next/link";
import { AlertBanner } from "@/components/alerts/alert-banner";
import { ScoreDisplay } from "@/components/score/score-display";
import { EmptyState } from "@/components/ui/empty-state";
import { getAccountHealthWithDelta } from "@/lib/data-v2/account-health";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { getPrimaryAccountForManager } from "@/lib/data-v2/viewer";

export default async function BrandDashboardPage() {
  const accountResult = await getPrimaryAccountForManager();
  if (!accountResult.success) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar la vista gerencial.</div>;
  }

  if (!accountResult.data) {
    return <EmptyState context="diagnosticos" />;
  }
  const account = accountResult.data;

  const healthResult = await getAccountHealthWithDelta(account.id);
  if (!healthResult.success || !healthResult.data) {
    return <EmptyState context="diagnosticos" />;
  }

  const alertsResult = await listAlertsByAccount(account.id, { audience: "manager", includeResolved: false, limit: 5 });
  const alerts: Array<{ client_name: string; client_id: string; message: string; priority: "urgente" | "alta" }> = alertsResult.success
    ? alertsResult.data.map((alert) => ({
        client_name: account.account_name,
        client_id: account.company_id,
        message: alert.titulo,
        priority: alert.prioridad === "urgente" ? "urgente" : "alta"
      }))
    : [];

  const { current, delta } = healthResult.data;

  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">Tu cuenta este mes</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">Lectura ejecutiva en lenguaje de negocio.</p>
      </header>

      <section className="bg-white rounded-xl shadow-sm border border-[#E8E8E2] p-4">
        <ScoreDisplay score={current.score_global} delta={delta} size="lg" showLabel showDelta animated />
      </section>

      <section>
        <AlertBanner alerts={alerts} />
      </section>

      <Link href="/brand/metrics" className="inline-flex bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
        Ver evolucion 6 meses →
      </Link>
    </main>
  );
}
