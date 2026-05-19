import Link from "next/link";
import { createDiagnostic } from "@/app/(internal)/internal/clients/[id]/diagnostic/new/actions";
import { DiagnosticForm } from "@/components/diagnostic/diagnostic-form";
import { getCompanyById } from "@/lib/data-v2/companies";
import { getLatestMetricSnapshotByAccount } from "@/lib/data-v2/metric-snapshots";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import { initialManualFormValuesFromSnapshot } from "@/lib/scoring/metric-snapshot";

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
  let mlAccount = accountsResult.success ? pickPreferredMlAccount(accountsResult.data) : null;
  if (!mlAccount) {
    const fallbackAccountsResult = await listMlAccountsByCompany(resolvedParams.id);
    mlAccount = fallbackAccountsResult.success ? pickPreferredMlAccount(fallbackAccountsResult.data) : null;
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
          <Link href={`/internal/clients/${resolvedParams.id}/accounts`} className="mt-3 inline-flex rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold text-[#1A1A1A]">
            Ir a configurar conexion ML
          </Link>
        </section>
      </main>
    );
  }

  const latestSnapshotResult = await getLatestMetricSnapshotByAccount(mlAccount.id);
  console.info("[ml-diagnostic-new] selected_ml_account", {
    companyId: resolvedParams.id,
    mlAccountId: mlAccount.id,
    hasSellerId: Boolean(mlAccount.seller_id)
  });
  const initialFormValues = initialManualFormValuesFromSnapshot(latestSnapshotResult.success ? latestSnapshotResult.data : null);
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
      <DiagnosticForm mlAccountId={mlAccount.id} companyId={mlAccount.company_id} initialValues={initialFormValues} action={saveAction} />
    </main>
  );
}

function pickPreferredMlAccount<T extends { id: string; seller_id: string | null; active: boolean | null }>(accounts: T[]): T | null {
  if (accounts.length === 0) return null;
  const connected = accounts.find((account) => Boolean(account.seller_id));
  if (connected) return connected;
  const active = accounts.find((account) => account.active === true);
  return active ?? accounts[0];
}
