import Link from "next/link";
import { createDiagnostic } from "@/app/(internal)/internal/clients/[id]/diagnostic/new/actions";
import { DiagnosticForm } from "@/components/diagnostic/diagnostic-form";
import { getCompanyById } from "@/lib/data-v2/companies";
import { getLatestMetricSnapshotByAccount } from "@/lib/data-v2/metric-snapshots";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import type { Diagnostic } from "@/lib/types";

export default async function NewDiagnosticPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const companyResult = await getCompanyById(resolvedParams.id);
  if (!companyResult.success || !companyResult.data) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar esta cuenta</div>
      </main>
    );
  }

  const accountsResult = await listMlAccountsByCompany(resolvedParams.id, { activeOnly: true });
  let mlAccount = accountsResult.success ? (accountsResult.data[0] ?? null) : null;
  if (!mlAccount) {
    const fallbackAccountsResult = await listMlAccountsByCompany(resolvedParams.id);
    mlAccount = fallbackAccountsResult.success ? (fallbackAccountsResult.data[0] ?? null) : null;
  }

  if (!mlAccount) {
    return (
      <main className="p-4 md:p-6 space-y-4">
        <div>
          <p className="text-xs text-[#6B6B6B]">Cartera interna</p>
          <h1 className="text-xl font-bold text-[#1A1A1A]">{companyResult.data.name}</h1>
        </div>
        <section className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-700">Esta company todavia no tiene una cuenta ML asociada.</p>
          <Link href={`/internal/clients/${resolvedParams.id}/settings`} className="mt-3 inline-flex rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold text-[#1A1A1A]">
            Ir a configurar conexion ML
          </Link>
        </section>
      </main>
    );
  }

  const latestSnapshotResult = await getLatestMetricSnapshotByAccount(mlAccount.id);
  const diagnostic = buildInitialDiagnostic(mlAccount.company_id, latestSnapshotResult.success ? latestSnapshotResult.data : null);
  const saveAction = createDiagnostic.bind(null, mlAccount.company_id, mlAccount.id);

  return (
    <main className="p-4 md:p-6 space-y-6">
      <div>
        <div className="text-sm font-semibold text-brand-dark">{companyResult.data.name}</div>
        <h1 className="text-3xl font-bold">Nuevo diagnóstico</h1>
        <p className="mt-2 text-zinc-600">El guardado calcula scores en servidor, crea historial y genera acciones recomendadas.</p>
      </div>
      {resolvedSearchParams.error ? (
        <div className="rounded-card border border-[#E24B4A]/30 bg-[#FCEBEB] p-4 text-sm font-semibold text-[#791F1F]">
          {resolvedSearchParams.error === "actions"
            ? "El diagnóstico se guardó, pero no se pudieron crear las acciones automáticas. Revisá permisos de actions."
            : "No se pudo guardar el diagnóstico. Revisá permisos RLS y que la cuenta pertenezca al operador."}
        </div>
      ) : null}
      <DiagnosticForm mlAccountId={mlAccount.id} companyId={mlAccount.company_id} diagnostic={diagnostic} action={saveAction} />
    </main>
  );
}

function buildInitialDiagnostic(companyId: string, snapshot: Record<string, unknown> | null): Diagnostic {
  const num = (value: unknown) => (typeof value === "number" ? value : 0);

  return {
    id: "new",
    clientId: companyId,
    date: new Date().toISOString().slice(0, 10),
    salud: {
      reclamos: num(snapshot?.["reclamos"]),
      mediaciones: num(snapshot?.["mediaciones"]),
      cancelaciones_vendedor: num(snapshot?.["cancelaciones_vendedor"]),
      envios_a_tiempo: num(snapshot?.["envios_a_tiempo"])
    },
    publicaciones: {
      pubs_activas_pct: num(snapshot?.["pubs_activas_pct"]),
      pubs_optimizadas_pct: num(snapshot?.["pubs_optimizadas_pct"]),
      ctr: num(snapshot?.["ctr"])
    },
    ads: {
      margen_pre_ads: num(snapshot?.["margen_pre_ads"]),
      gasto_ads: num(snapshot?.["gasto_ads"]),
      ventas_ads: num(snapshot?.["ventas_ads"]),
      ventas_totales: num(snapshot?.["ventas_totales"]),
      acos: num(snapshot?.["acos"]),
      roas: num(snapshot?.["roas"]),
      tacos: num(snapshot?.["tacos"])
    },
    logistica: {
      incidencias_pct: num(snapshot?.["incidencias_pct"]),
      uso_full_flex_pct: num(snapshot?.["uso_full_flex_pct"]),
      cancelaciones_stock_pct: num(snapshot?.["cancelaciones_stock_pct"])
    },
    stock: {
      skus_sin_stock_pct: num(snapshot?.["skus_sin_stock_pct"]),
      dias_stock: num(snapshot?.["dias_stock"]),
      lead_time_reposicion: num(snapshot?.["lead_time_reposicion"]),
      sistema_reposicion: num(snapshot?.["sistema_reposicion"])
    },
    scoreGlobal: 0,
    estadoGlobal: "critico",
    scores: { salud: 0, publicaciones: 0, ads: 0, logistica: 0, stock: 0 },
    source: "manual"
  };
}
