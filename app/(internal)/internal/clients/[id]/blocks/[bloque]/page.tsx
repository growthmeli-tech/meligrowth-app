import Link from "next/link";
import { BlockMetricsEditor, type BlockMetricRowModel } from "@/components/blocks/block-metrics-editor";
import { RecommendationsPanel } from "@/components/recommendations/recommendations-panel";
import { ScoreEvolutionChart } from "@/components/charts/score-evolution-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { getAccountHealthWithDelta, listAccountHealthByAccount } from "@/lib/data-v2/account-health";
import { getCompanyById } from "@/lib/data-v2/companies";
import { getLatestMetricSnapshotByAccount, listMetricSnapshotsByAccount } from "@/lib/data-v2/metric-snapshots";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import {
  calcAdsScoreFromMetricSnapshot,
  calcLogisticaScoreFromSnapshot,
  calcPublicacionesScoreFromSnapshot,
  calcSaludScoreFromSnapshot,
  calcStockScoreFromSnapshot
} from "@/lib/scoring";
import type { InternalBlockSlug } from "@/lib/internal/block-metrics-scope";
import type { Database } from "@/lib/supabase/database.types";
import { getScoreLabel } from "@/lib/utils/scores";

type MetricColumn = keyof Database["public"]["Tables"]["metric_snapshots"]["Insert"] | "ventas_ads_pct";

const BLOCK_CONFIG = {
  salud: {
    title: "01 Salud",
    weight: 35,
    category: "salud"
  },
  publicaciones: {
    title: "02 Publicaciones",
    weight: 20,
    category: "publicaciones"
  },
  ads: {
    title: "03 Ads",
    weight: 20,
    category: "ads"
  },
  logistica: {
    title: "04 Logística",
    weight: 15,
    category: "logistica"
  },
  stock: {
    title: "05 Stock",
    weight: 10,
    category: "stock"
  }
} as const;

type BlockSlug = keyof typeof BLOCK_CONFIG;

export default async function InternalClientBlockDetailPage({
  params
}: {
  params: Promise<{ id: string; bloque: string }>;
}) {
  const { id, bloque } = await params;
  if (!isBlockSlug(bloque)) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Bloque inválido</div>
      </main>
    );
  }

  const companyResult = await getCompanyById(id);
  if (!companyResult.success || !companyResult.data) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar esta cuenta</div>
      </main>
    );
  }

  const accountsResult = await listMlAccountsByCompany(id, { activeOnly: true });
  const account = accountsResult.success ? (accountsResult.data[0] ?? null) : null;
  if (!account) return <EmptyState context="diagnosticos" />;

  const [healthResult, latestSnapshotResult, snapshotsResult, historyResult] = await Promise.all([
    getAccountHealthWithDelta(account.id),
    getLatestMetricSnapshotByAccount(account.id),
    listMetricSnapshotsByAccount(account.id, 6),
    listAccountHealthByAccount(account.id, 6)
  ]);

  if (!latestSnapshotResult.success || !latestSnapshotResult.data || !healthResult.success) {
    return <EmptyState context="diagnosticos" />;
  }

  const health = healthResult.data.current;
  const latestSnapshot = latestSnapshotResult.data;
  const config = BLOCK_CONFIG[bloque];
  const blockScore = getBlockScoreFromHealth(health, bloque);
  const blockMetrics = buildBlockMetrics(bloque, latestSnapshot);
  const editorRows: BlockMetricRowModel[] = blockMetrics.map((metric) => ({
    metrica: metric.metrica,
    label: metric.label,
    benchmarkKey: `${config.category}.${metric.benchmarkMetric}`,
    valor: metric.valor,
    column: metric.column,
    ...(metric.valueUnit ? { valueUnit: metric.valueUnit } : {})
  }));
  const sourceByBlock = extractBlockSource(latestSnapshot.data_sources, bloque);

  const chartData = snapshotsResult.success
    ? [...snapshotsResult.data]
        .reverse()
        .map((snapshot) => ({
          date: new Date(snapshot.snapshot_date).toLocaleDateString("es-AR", { month: "short" }),
          score_global: computeBlockScoreFromSnapshot(bloque, snapshot)
        }))
    : [];
  const hasSinglePoint = chartData.length === 1;

  const scoreHistory = historyResult.success
    ? [...historyResult.data]
        .reverse()
        .map((item) => ({
          date: new Date(item.snapshot_date).toLocaleDateString("es-AR", { month: "short" }),
          score_global: Number(item.score_global),
          score_salud: Number(item.score_salud ?? 0),
          score_ads: Number(item.score_ads ?? 0)
        }))
    : [];

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Link href={`/internal/clients/${id}`} className="text-xs font-semibold text-[#6B6B6B] hover:underline">
              ← {companyResult.data.name}
            </Link>
            <h1 className="mt-1 text-xl font-bold text-[#1A1A1A]">{config.title}</h1>
            <p className="text-sm text-[#6B6B6B]">Peso: {config.weight}% del score global</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-[#6B6B6B]">Score</p>
            <p className="text-2xl font-black text-[#1A1A1A]">{Math.round(blockScore)}</p>
            <p className="text-xs text-[#6B6B6B]">{getScoreLabel(blockScore)}</p>
          </div>
        </div>
      </header>

      <BlockMetricsEditor mlAccountId={account.id} block={bloque as InternalBlockSlug} rows={editorRows} blockSource={sourceByBlock} />

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Recomendaciones de este bloque</p>
        <div className="mt-3">
          <RecommendationsPanel clientId={id} maxVisible={5} filterByCategory={config.category} />
        </div>
      </section>

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Evolución histórica</p>
        {chartData.length === 0 ? (
          <p className="text-sm text-[#6B6B6B]">Sin historial suficiente para mostrar evolución.</p>
        ) : (
          <ScoreEvolutionChart data={chartData} />
        )}
        {hasSinglePoint ? <p className="text-sm text-[#6B6B6B]">Agregá más diagnósticos para ver la evolución.</p> : null}
        {scoreHistory.length > 1 ? (
          <div className="pt-2">
            <p className="text-xs text-[#6B6B6B]">Referencia global de la cuenta</p>
            <ScoreEvolutionChart data={scoreHistory} showBlocks />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function isBlockSlug(value: string): value is BlockSlug {
  return value in BLOCK_CONFIG;
}

function extractBlockSource(dataSources: unknown, block: BlockSlug): "api" | "manual" | null {
  if (!dataSources || typeof dataSources !== "object") return null;
  const source = (dataSources as Record<string, unknown>)[block];
  if (source === "api") return "api";
  if (source === "manual" || source === "scraper" || source === "unavailable") return "manual";
  return null;
}

function getBlockScoreFromHealth(
  health: {
    score_salud: number | null;
    score_publicaciones: number | null;
    score_ads: number | null;
    score_logistica: number | null;
    score_stock: number | null;
  },
  block: BlockSlug
) {
  if (block === "salud") return Number(health.score_salud ?? 0);
  if (block === "publicaciones") return Number(health.score_publicaciones ?? 0);
  if (block === "ads") return Number(health.score_ads ?? 0);
  if (block === "logistica") return Number(health.score_logistica ?? 0);
  return Number(health.score_stock ?? 0);
}

function buildBlockMetrics(
  block: BlockSlug,
  snapshot: {
    reclamos: number | null;
    mediaciones: number | null;
    cancelaciones_vendedor: number | null;
    envios_a_tiempo: number | null;
    pubs_activas_pct: number | null;
    pubs_optimizadas_pct: number | null;
    ctr: number | null;
    acos: number | null;
    roas: number | null;
    gasto_ads: number | null;
    ventas_ads: number | null;
    ventas_totales: number | null;
    incidencias_pct: number | null;
    uso_full_flex_pct: number | null;
    cancelaciones_stock_pct: number | null;
    skus_sin_stock_pct: number | null;
    dias_stock: number | null;
    lead_time_reposicion: number | null;
  }
): Array<{
  metrica: string;
  benchmarkMetric: string;
  label: string;
  valor: number | null;
  column: MetricColumn;
  valueUnit?: "pct" | "x" | "dias" | "nivel" | "plain";
}> {
  if (block === "salud") {
    return [
      { metrica: "reclamos", benchmarkMetric: "reclamos", label: "Reclamos", valor: snapshot.reclamos, column: "reclamos" },
      { metrica: "mediaciones", benchmarkMetric: "mediaciones", label: "Mediaciones", valor: snapshot.mediaciones, column: "mediaciones" },
      {
        metrica: "cancelaciones_vendedor",
        benchmarkMetric: "cancelaciones_vendedor",
        label: "Cancelaciones vendedor",
        valor: snapshot.cancelaciones_vendedor,
        column: "cancelaciones_vendedor"
      },
      { metrica: "envios_a_tiempo", benchmarkMetric: "envios_a_tiempo", label: "Envíos a tiempo", valor: snapshot.envios_a_tiempo, column: "envios_a_tiempo" }
    ];
  }
  if (block === "publicaciones") {
    return [
      {
        metrica: "pubs_activas_pct",
        benchmarkMetric: "pubs_activas_pct",
        label: "Publicaciones activas",
        valor: snapshot.pubs_activas_pct,
        column: "pubs_activas_pct"
      },
      {
        metrica: "pubs_optimizadas_pct",
        benchmarkMetric: "pubs_optimizadas_pct",
        label: "Publicaciones optimizadas",
        valor: snapshot.pubs_optimizadas_pct,
        column: "pubs_optimizadas_pct"
      },
      { metrica: "ctr", benchmarkMetric: "ctr", label: "CTR", valor: snapshot.ctr, column: "ctr" }
    ];
  }
  if (block === "ads") {
    return [
      {
        metrica: "ventas_totales",
        benchmarkMetric: "ventas_totales",
        label: "Ventas totales",
        valor: snapshot.ventas_totales,
        column: "ventas_totales",
        valueUnit: "plain"
      },
      {
        metrica: "gasto_ads",
        benchmarkMetric: "gasto_ads",
        label: "Gasto en Ads",
        valor: snapshot.gasto_ads,
        column: "gasto_ads",
        valueUnit: "plain"
      },
      {
        metrica: "ventas_ads",
        benchmarkMetric: "ventas_ads",
        label: "Ventas por Ads",
        valor: snapshot.ventas_ads,
        column: "ventas_ads",
        valueUnit: "plain"
      },
      {
        metrica: "ventas_ads_pct",
        benchmarkMetric: "ventas_ads_pct",
        label: "% ventas por ads",
        valor: toAdsSalesPct(snapshot),
        column: "ventas_ads_pct"
      },
      { metrica: "acos", benchmarkMetric: "acos", label: "ACOS", valor: snapshot.acos, column: "acos" },
      { metrica: "roas", benchmarkMetric: "roas", label: "ROAS", valor: snapshot.roas, column: "roas" }
    ];
  }
  if (block === "logistica") {
    return [
      {
        metrica: "incidencias_pct",
        benchmarkMetric: "incidencias_pct",
        label: "Incidencias",
        valor: snapshot.incidencias_pct,
        column: "incidencias_pct"
      },
      {
        metrica: "uso_full_flex_pct",
        benchmarkMetric: "uso_full_flex_pct",
        label: "Uso Full/Flex",
        valor: snapshot.uso_full_flex_pct,
        column: "uso_full_flex_pct"
      },
      {
        metrica: "cancelaciones_stock_pct",
        benchmarkMetric: "cancelaciones_stock_pct",
        label: "Cancelaciones por stock",
        valor: snapshot.cancelaciones_stock_pct,
        column: "cancelaciones_stock_pct"
      }
    ];
  }
  return [
    {
      metrica: "skus_sin_stock_pct",
      benchmarkMetric: "skus_sin_stock_pct",
      label: "SKUs sin stock",
      valor: snapshot.skus_sin_stock_pct,
      column: "skus_sin_stock_pct"
    },
    { metrica: "dias_stock", benchmarkMetric: "dias_stock", label: "Días de stock", valor: snapshot.dias_stock, column: "dias_stock" },
    {
      metrica: "lead_time_reposicion",
      benchmarkMetric: "lead_time_reposicion",
      label: "Lead time reposición",
      valor: snapshot.lead_time_reposicion,
      column: "lead_time_reposicion"
    }
  ];
}

function toAdsSalesPct(snapshot: { ventas_ads: number | null; ventas_totales: number | null }) {
  if (!snapshot.ventas_ads || !snapshot.ventas_totales || snapshot.ventas_totales <= 0) return null;
  return (snapshot.ventas_ads / snapshot.ventas_totales) * 100;
}

function computeBlockScoreFromSnapshot(
  block: BlockSlug,
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
  }
) {
  if (block === "salud") {
    return calcSaludScoreFromSnapshot(snapshot);
  }
  if (block === "publicaciones") {
    return calcPublicacionesScoreFromSnapshot(snapshot);
  }
  if (block === "ads") {
    return calcAdsScoreFromMetricSnapshot(snapshot);
  }
  if (block === "logistica") {
    return calcLogisticaScoreFromSnapshot(snapshot);
  }
  return calcStockScoreFromSnapshot(snapshot);
}
