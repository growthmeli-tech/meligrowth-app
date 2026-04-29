import Link from "next/link";
import { CatalogParetoChart } from "@/components/brand/catalog-pareto-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { getLatestMetricSnapshotByAccount } from "@/lib/data-v2/metric-snapshots";
import { listPricingScenarios } from "@/lib/data-v2/pricing-scenarios";
import { listPricingSkus } from "@/lib/data-v2/pricing-skus";
import { getPrimaryAccountForManager } from "@/lib/data-v2/viewer";
import { weightedMargenPctFromPricingSkus } from "@/lib/pricing/stats";
import type { Database } from "@/lib/supabase/database.types";

type PricingSkuRow = Database["public"]["Tables"]["pricing_skus"]["Row"];
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

function paretoData(skus: PricingSkuRow[]): { label: string; value: number }[] {
  const scored = skus.map((r) => ({
    label: ((r.sku ?? r.producto).slice(0, 18)),
    value: Number(r.ganancia_unit ?? 0) * Number(r.costo ?? 0)
  }));
  scored.sort((a, b) => b.value - a.value);
  const k = Math.max(1, Math.ceil(skus.length * 0.2));
  return scored.slice(0, k).filter((x) => x.value > 0);
}

export default async function BrandProfitabilityPage() {
  const accountResult = await getPrimaryAccountForManager();
  if (!accountResult.success || !accountResult.data) {
    return <EmptyState context="diagnosticos" />;
  }

  const accountId = accountResult.data.id;

  const [scenariosResult, skusResult, snapResult] = await Promise.all([
    listPricingScenarios(accountId),
    listPricingSkus(accountId),
    getLatestMetricSnapshotByAccount(accountId)
  ]);

  const scenarios = scenariosResult.success ? scenariosResult.data : [];
  const skus = skusResult.success ? skusResult.data : [];
  const snap = snapResult.success ? snapResult.data : null;

  const best = pickBestScenario(scenarios);
  const weighted = weightedMargenPctFromPricingSkus(skus);
  const pareto = paretoData(skus);
  const destructores = skus.filter((r) => r.margen_pct !== null && r.margen_pct !== undefined && Number(r.margen_pct) < 0);

  const ventas = snap?.ventas_totales !== null && snap?.ventas_totales !== undefined ? Number(snap.ventas_totales) : null;
  const tacos = snap?.tacos !== null && snap?.tacos !== undefined ? Number(snap.tacos) : null;
  const margenPreAds = snap?.margen_pre_ads !== null && snap?.margen_pre_ads !== undefined ? Number(snap.margen_pre_ads) : null;

  return (
    <main className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-[#1A1A1A]">Rentabilidad</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">Escenarios comerciales y catálogo importado.</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Escenarios comerciales</h2>
        {scenarios.length === 0 ? (
          <div className="rounded-xl border border-[#E8E8E2] bg-white p-5 text-sm text-[#1A1A1A]">
            Subí la Planilla 4 (Pricing Comercial) para ver proyecciones.
            <div className="mt-3">
              <Link href="/brand/files" className="font-semibold text-brand-dark underline underline-offset-2">
                Cómo cargar planillas
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E8E8E2] bg-white">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E8E8E2] bg-[#F5F5F0] text-xs font-bold uppercase text-[#6B6B6B]">
                  <th className="p-3">Plan</th>
                  <th className="p-3">Revenue actual</th>
                  <th className="p-3">Revenue proyectado</th>
                  <th className="p-3">Margen neto</th>
                  <th className="p-3">Ganancia mensual</th>
                  <th className="p-3">Total proyectado</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => {
                  const isBest = best?.id === s.id;
                  return (
                    <tr key={s.id} className={isBest ? "border-b border-[#E8E8E2] bg-[#FFFBE6]" : "border-b border-[#E8E8E2]"}>
                      <td className="p-3 font-semibold text-[#1A1A1A]">
                        {s.plan}
                        {isBest ? (
                          <span className="ml-2 rounded-full bg-[#FFD600] px-2 py-0.5 text-[10px] font-bold uppercase text-[#1A1A1A]">
                            Mejor escenario
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 tabular-nums">{ars.format(Number(s.current_revenue))}</td>
                      <td className="p-3 tabular-nums">{ars.format(Number(s.projected_revenue))}</td>
                      <td className="p-3 tabular-nums">
                        {s.net_margin_pct !== null && s.net_margin_pct !== undefined
                          ? `${(Number(s.net_margin_pct) * 100).toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="p-3 tabular-nums">
                        {s.monthly_profit !== null && s.monthly_profit !== undefined ? ars.format(Number(s.monthly_profit)) : "—"}
                      </td>
                      <td className="p-3 tabular-nums">
                        {s.total_projected_profit !== null && s.total_projected_profit !== undefined
                          ? ars.format(Number(s.total_projected_profit))
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Análisis de catálogo</h2>
        {skus.length === 0 ? (
          <p className="rounded-xl border border-[#E8E8E2] bg-white p-5 text-sm text-[#6B6B6B]">
            Cuando importes la planilla de márgenes verás el reparto por SKU.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#E8E8E2] bg-white p-4">
              <p className="text-sm font-semibold text-[#1A1A1A]">
                Margen objetivo ponderado por costo:{" "}
                <span className="tabular-nums">{weighted === null ? "—" : `${(weighted * 100).toFixed(1)}%`}</span>
              </p>
            </div>

            <CatalogParetoChart data={pareto} />

            {destructores.length > 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
                <p className="text-sm font-bold text-red-900">Destructores de margen (margen objetivo &lt; 0)</p>
                <ul className="mt-2 space-y-2 text-sm text-red-900">
                  {destructores.map((r) => (
                    <li key={r.id}>
                      <span className="font-mono text-xs">{r.sku ?? "—"}</span> · {r.producto} — revisá costo y precio de venta
                      estimado.
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Motor de profit</h2>
        <div className="rounded-xl border border-[#E8E8E2] bg-white p-5 font-mono text-sm leading-relaxed text-[#1A1A1A]">
          <p>Ganancia estimada = Ventas totales</p>
          <p className="pl-4">− Comisiones ML (13,75% promedio)</p>
          <p className="pl-4">
            − Inversión Ads (TACOS: {tacos === null ? "sin dato" : `${tacos.toFixed(1)}%`})
          </p>
          <p className="pl-4">
            − Costos de producto vía margen pre-ads ({margenPreAds === null ? "sin dato" : `${margenPreAds.toFixed(1)}%`})
          </p>
          <p className="mt-3 text-xs text-[#6B6B6B]">
            Ventas totales (último snapshot): {ventas === null ? "sin dato" : ars.format(ventas)}.
          </p>
        </div>
      </section>

      <Link href="/brand/dashboard" className="inline-flex text-sm font-semibold text-brand-dark underline underline-offset-2">
        ← Volver al dashboard
      </Link>
    </main>
  );
}
