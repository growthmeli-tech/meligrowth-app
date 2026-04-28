import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { getLatestAccountHealthByAccount } from "@/lib/data-v2/account-health";
import { getLatestMetricSnapshotByAccount } from "@/lib/data-v2/metric-snapshots";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
import { OPS_BLOCKS, type OpsBlockKey } from "@/lib/ops/copy";
import { getBlockMetricRows } from "@/lib/ops/metrics";
import { getScoreLabel } from "@/lib/utils/scores";

export default async function OpsBlocksPage() {
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) return <EmptyState context="recomendaciones" />;

  const [healthResult, snapshotResult] = await Promise.all([
    getLatestAccountHealthByAccount(accountResult.data.id),
    getLatestMetricSnapshotByAccount(accountResult.data.id)
  ]);
  if (!healthResult.success || !healthResult.data || !snapshotResult.success || !snapshotResult.data) return <EmptyState context="diagnosticos" />;

  const health = healthResult.data;
  const snapshot = snapshotResult.data;
  const blockScores = [
    { key: "salud", score: Number(health.score_salud ?? 0) },
    { key: "publicaciones", score: Number(health.score_publicaciones ?? 0) },
    { key: "ads", score: Number(health.score_ads ?? 0) },
    { key: "logistica", score: Number(health.score_logistica ?? 0) },
    { key: "stock", score: Number(health.score_stock ?? 0) }
  ] as const;

  const ordered = [...blockScores].sort((a, b) => a.score - b.score);

  return (
    <main className="space-y-4">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Bloques operativos</p>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Detalle por bloque</h1>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        {ordered.map((item) => {
          const meta = OPS_BLOCKS.find((block) => block.key === item.key);
          const topIssue = getTopIssue(item.key, snapshot);
          return (
            <Link key={item.key} href={`/ops/blocks/${item.key}`} className="rounded-xl border border-[#E8E8E2] bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">{`${meta?.number ?? "--"} · ${meta?.label ?? item.key}`}</p>
              <p className="mt-2 text-3xl font-black text-[#1A1A1A]">{Math.round(item.score)}</p>
              <p className="text-sm font-semibold text-[#6B6B6B]">{getScoreLabel(item.score)}</p>
              <p className="mt-2 text-sm text-[#1A1A1A]">{topIssue}</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

function getTopIssue(
  block: OpsBlockKey,
  snapshot: {
    reclamos: number | null;
    mediaciones: number | null;
    cancelaciones_vendedor: number | null;
    envios_a_tiempo: number | null;
    pubs_activas_pct: number | null;
    pubs_optimizadas_pct: number | null;
    ctr: number | null;
    margen_pre_ads: number | null;
    gasto_ads: number | null;
    ventas_ads: number | null;
    ventas_totales: number | null;
    acos: number | null;
    roas: number | null;
    tacos: number | null;
    incidencias_pct: number | null;
    uso_full_flex_pct: number | null;
    cancelaciones_stock_pct: number | null;
    skus_sin_stock_pct: number | null;
    dias_stock: number | null;
    lead_time_reposicion: number | null;
    sistema_reposicion: number | null;
    data_sources: unknown;
  }
) {
  const rows = getBlockMetricRows(block, snapshot);
  if (rows.length === 0) return "Sin métricas disponibles.";
  const worst = [...rows].sort((a, b) => a.score - b.score)[0];
  return `${worst.label}: ${worst.valor === null ? "Sin datos" : worst.unit === "x" ? `${worst.valor.toFixed(2)}x` : worst.unit === "%" ? `${worst.valor.toFixed(1)}%` : `${worst.valor.toFixed(1)} ${worst.unit}`}`;
}
