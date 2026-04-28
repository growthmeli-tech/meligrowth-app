import Link from "next/link";
import { MetricRow } from "@/components/ops/metric-row";
import { ScoreEvolutionChart } from "@/components/charts/score-evolution-chart";
import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { EmptyState } from "@/components/ui/empty-state";
import { getLatestAccountHealthByAccount, listAccountHealthByAccount } from "@/lib/data-v2/account-health";
import { listAlertsByAccount } from "@/lib/data-v2/alerts";
import { getLatestMetricSnapshotByAccount } from "@/lib/data-v2/metric-snapshots";
import { listTasksByAccount } from "@/lib/data-v2/tasks";
import { getPrimaryAccountForOperator } from "@/lib/data-v2/viewer";
import { OPS_BLOCKS, getOperationalPriorityCopy, translateAlertDescription, translateOperationalCopy, type OpsBlockKey } from "@/lib/ops/copy";
import { getBlockContextHighlights, getBlockMeta, getBlockMetricRows } from "@/lib/ops/metrics";
import type { Recommendation } from "@/lib/recommendations/types";
import { getScoreLabel } from "@/lib/utils/scores";

const VALID_BLOCKS: OpsBlockKey[] = ["salud", "publicaciones", "ads", "logistica", "stock"];

export default async function OpsBlockDetailPage({ params }: { params: Promise<{ bloque: string }> }) {
  const { bloque } = await params;
  if (!VALID_BLOCKS.includes(bloque as OpsBlockKey)) {
    return (
      <main className="space-y-3">
        <p className="text-sm text-red-600">Bloque no válido.</p>
        <Link href="/ops/blocks" className="text-sm font-semibold text-[#1A1A1A] underline underline-offset-2">
          Volver a bloques
        </Link>
      </main>
    );
  }

  const blockKey = bloque as OpsBlockKey;
  const accountResult = await getPrimaryAccountForOperator();
  if (!accountResult.success || !accountResult.data) return <EmptyState context="recomendaciones" />;
  const account = accountResult.data;

  const [healthResult, snapshotResult, alertsResult, historyResult, pendingTasksResult] = await Promise.all([
    getLatestAccountHealthByAccount(account.id),
    getLatestMetricSnapshotByAccount(account.id),
    listAlertsByAccount(account.id, { audience: "operator", includeResolved: false, limit: 20 }),
    listAccountHealthByAccount(account.id, 8),
    listTasksByAccount(account.id, { status: "pendiente" })
  ]);

  if (!healthResult.success || !healthResult.data || !snapshotResult.success || !snapshotResult.data) {
    return <EmptyState context="diagnosticos" />;
  }

  const health = healthResult.data;
  const snapshot = snapshotResult.data;
  const blockMeta = getBlockMeta(blockKey);
  const blockScore = getBlockScore(health, blockKey);
  const metricRows = getBlockMetricRows(blockKey, snapshot);
  const highlights = getBlockContextHighlights(blockKey, snapshot);
  const blockAlerts = (alertsResult.success ? alertsResult.data : []).filter((alert) => alert.categoria === blockKey).slice(0, 6);
  const priorityRecommendations: Recommendation[] = blockAlerts.map((alert) => ({
    id: alert.id,
    categoria: (alert.categoria as Recommendation["categoria"]) ?? "salud",
    prioridad: alert.prioridad,
    titulo: getOperationalPriorityCopy(alert).title,
    descripcion: translateAlertDescription(alert.descripcion ?? alert.titulo),
    accion_concreta: translateAlertDescription(alert.accion_concreta ?? alert.titulo),
    metrica_afectada: alert.categoria ?? "general",
    impacto_estimado: "Impacto directo",
    benchmark_objetivo: translateOperationalCopy(alert.benchmark_objetivo ?? "Mejorar"),
    audiencia: alert.audiencia,
    bloque: alert.categoria ?? "General"
  }));
  const blockAlertIds = new Set(blockAlerts.map((alert) => alert.id));
  const pendingTasks = pendingTasksResult.success ? pendingTasksResult.data : [];
  const blockTasks = pendingTasks.filter((task) => task.alert_id && blockAlertIds.has(task.alert_id));
  const history = historyResult.success
    ? [...historyResult.data]
        .reverse()
        .map((item) => ({
          date: new Date(item.snapshot_date).toLocaleDateString("es-AR", { month: "short" }),
          score_global: Number(getBlockScore(item, blockKey))
        }))
    : [];

  return (
    <main className="space-y-4">
      <header className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <Link href="/ops/dashboard" className="text-xs font-semibold text-[#6B6B6B] underline underline-offset-2">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[#1A1A1A]">{`${blockMeta.number} ${blockMeta.label}`}</h1>
        <p className="mt-1 text-sm text-[#6B6B6B]">{`Score: ${Math.round(blockScore)} · ${getScoreLabel(blockScore)} · Peso ${blockMeta.weight}%`}</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Métricas del bloque</h2>
          {metricRows.map((row) => (
            <MetricRow
              key={row.key}
              label={row.label}
              valor={row.valor}
              unidad={row.unit}
              score={row.score}
              estado={row.estado}
              benchmark={row.benchmark}
              accion={row.accion}
              source={row.source}
              esCritica={row.esCritica}
            />
          ))}
        </div>

        <aside className="space-y-3">
          <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Qué hacer hoy</p>
            {priorityRecommendations.length === 0 && blockTasks.length === 0 ? (
              <p className="mt-3 text-sm text-[#1A1A1A]">Este bloque está al día ✅</p>
            ) : (
              <div className="mt-3 space-y-3">
                {priorityRecommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    variant="operator"
                    compact
                    mlAccountId={account.id}
                  />
                ))}
                {blockTasks.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-[#E8E8E2] bg-[#F5F5F0] p-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Tareas pendientes del bloque</p>
                    <ul className="space-y-1">
                      {blockTasks.map((task) => (
                        <li key={task.id} className="text-sm text-[#1A1A1A]">
                          {`• ${task.titulo} (${task.estado.replace("_", " ")})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Contexto operativo</p>
            <ul className="mt-3 space-y-2">
              {highlights.map((item) => (
                <li key={item} className="text-sm text-[#1A1A1A]">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6B6B6B]">Evolución histórica de este bloque</p>
        <div className="mt-3">{history.length > 0 ? <ScoreEvolutionChart data={history} /> : <EmptyState context="historial" />}</div>
      </section>
    </main>
  );
}

function getBlockScore(
  health: {
    score_salud: number | null;
    score_publicaciones: number | null;
    score_ads: number | null;
    score_logistica: number | null;
    score_stock: number | null;
  },
  blockKey: OpsBlockKey
) {
  if (blockKey === "salud") return Number(health.score_salud ?? 0);
  if (blockKey === "publicaciones") return Number(health.score_publicaciones ?? 0);
  if (blockKey === "ads") return Number(health.score_ads ?? 0);
  if (blockKey === "logistica") return Number(health.score_logistica ?? 0);
  return Number(health.score_stock ?? 0);
}
