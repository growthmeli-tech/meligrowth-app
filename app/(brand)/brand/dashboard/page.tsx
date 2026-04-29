import Link from "next/link";
import { AlertBanner } from "@/components/alerts/alert-banner";
import { ScoreDisplay } from "@/components/score/score-display";
import { EmptyState } from "@/components/ui/empty-state";
import { getAccountHealthWithDelta } from "@/lib/data-v2/account-health";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { listPricingScenarios } from "@/lib/data-v2/pricing-scenarios";
import { listPricingSkus } from "@/lib/data-v2/pricing-skus";
import { getPrimaryAccountForManager } from "@/lib/data-v2/viewer";
import { weightedMargenPctFromPricingSkus } from "@/lib/pricing/stats";
import type { Database } from "@/lib/supabase/database.types";

type ScenarioRow = Database["public"]["Tables"]["pricing_scenarios"]["Row"];

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function pickBestScenario(rows: ScenarioRow[]): ScenarioRow | null {
  let best: ScenarioRow | null = null;
  for (const s of rows) {
    if (s.net_margin_pct === null || s.net_margin_pct === undefined) continue;
    const n = Number(s.net_margin_pct);
    if (!best || n > Number(best.net_margin_pct ?? -Infinity)) best = s;
  }
  return best;
}

export default async function BrandDashboardPage() {
  const accountResult = await getPrimaryAccountForManager();
  if (!accountResult.success) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar la vista gerencial.</div>;
  }

  if (!accountResult.data) {
    return <EmptyState context="diagnosticos" />;
  }
  const account = accountResult.data;

  const [healthResult, alertsResult, scenariosResult, skusResult] = await Promise.all([
    getAccountHealthWithDelta(account.id),
    listAlertsByAccount(account.id, { audience: "manager", includeResolved: false, limit: 5 }),
    listPricingScenarios(account.id),
    listPricingSkus(account.id)
  ]);

  if (!healthResult.success || !healthResult.data) {
    return <EmptyState context="diagnosticos" />;
  }

  const scenarios = scenariosResult.success ? scenariosResult.data : [];
  const pricingSkus = skusResult.success ? skusResult.data : [];
  const bestScenario = pickBestScenario(scenarios);
  const weightedMargen = weightedMargenPctFromPricingSkus(pricingSkus);
  const alerts: Array<{ client_name: string; client_id: string; message: string; priority: "urgente" | "alta" | "media" | "baja" }> =
    alertsResult.success
      ? alertsResult.data.map((alert) => ({
          client_name: account.account_name,
          client_id: account.company_id,
          message: alert.titulo,
          priority: alert.prioridad
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

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Rentabilidad</p>
        {bestScenario ? (
          <>
            <p className="mt-2 text-sm text-[#6B6B6B]">Mejor escenario ({bestScenario.plan})</p>
            <p className="mt-1 text-2xl font-black text-[#1A1A1A] tabular-nums">
              {bestScenario.monthly_profit !== null && bestScenario.monthly_profit !== undefined
                ? ars.format(Number(bestScenario.monthly_profit))
                : "—"}{" "}
              <span className="text-base font-semibold text-[#6B6B6B]">/ mes</span>
            </p>
            <p className="mt-1 text-sm font-medium text-[#1A1A1A]">
              Margen neto {(Number(bestScenario.net_margin_pct ?? 0) * 100).toFixed(1)}%
            </p>
          </>
        ) : pricingSkus.length > 0 ? (
          <>
            <p className="mt-2 text-sm text-[#6B6B6B]">Basado en tu catálogo importado</p>
            <p className="mt-1 text-2xl font-black text-[#1A1A1A] tabular-nums">
              {weightedMargen === null ? "—" : `${(weightedMargen * 100).toFixed(1)}%`}
              <span className="text-base font-semibold text-[#6B6B6B]"> margen objetivo ponderado</span>
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[#6B6B6B]">
            Cargá tu catálogo para ver rentabilidad.{" "}
            <Link href="/brand/files" className="font-semibold text-[#1A1A1A] underline underline-offset-2">
              Planillas
            </Link>
          </p>
        )}
        <Link
          href="/brand/profitability"
          className="mt-4 inline-flex text-sm font-semibold text-brand-dark underline underline-offset-2"
        >
          Ver análisis completo →
        </Link>
      </section>

      <section>
        <AlertBanner alerts={alerts} alertsHref={null} linkAlertItems={false} />
      </section>

      <Link href="/brand/metrics" className="inline-flex bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg px-4 py-2">
        Ver evolucion 6 meses →
      </Link>
    </main>
  );
}
