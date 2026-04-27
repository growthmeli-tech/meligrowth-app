import Link from "next/link";
import { getCompanyById } from "@/lib/data-v2/companies";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import { getAuthorizationUrl } from "@/lib/ml/auth";

const GROWTH_ML_ACCOUNT_ID = "9a766789-288e-4bfb-9ca9-365389ba5f98";

export default async function ClientSettingsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const companyResult = await getCompanyById(id);

  if (!companyResult.success || !companyResult.data) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar esta company</div>
      </main>
    );
  }

  const accountsResult = await listMlAccountsByCompany(id, { activeOnly: true });
  const account = accountsResult.success ? (accountsResult.data[0] ?? null) : null;

  if (!account) {
    return (
      <main className="p-4 md:p-6 space-y-4">
        <Link href={`/internal/clients/${id}`} className="inline-flex text-sm font-semibold text-[#1A1A1A] underline underline-offset-2">
          Volver a la cuenta
        </Link>
        <div className="rounded-xl border border-[#E8E8E2] bg-white p-4 text-sm text-[#1A1A1A]">
          Esta company no tiene cuentas ML activas para conectar.
        </div>
      </main>
    );
  }

  let oauthUrl: string | null = null;
  let oauthError: string | null = null;
  try {
    oauthUrl = getAuthorizationUrl(account.id);
  } catch (error) {
    oauthError = error instanceof Error ? error.message : "No se pudo generar la URL de OAuth";
  }

  const isConnected = Boolean(account.seller_id);
  const buttonLabel = isConnected ? "Reconectar" : "Conectar cuenta ML";
  const isGrowthAccount = account.id === GROWTH_ML_ACCOUNT_ID;

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="space-y-2">
        <Link href={`/internal/clients/${id}`} className="inline-flex text-sm font-semibold text-[#1A1A1A] underline underline-offset-2">
          Volver a la cuenta
        </Link>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Settings ML</h1>
        <p className="text-sm text-[#6B6B6B]">{companyResult.data.name}</p>
      </header>

      <section className="rounded-xl border border-[#E8E8E2] bg-white p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6B6B6B]">Estado de conexion</p>
          <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{isConnected ? "Conectada" : "Sin conectar"}</p>
        </div>

        <div className="grid gap-2 text-sm text-[#1A1A1A]">
          <p>
            <span className="font-semibold">ml_account_id:</span> {account.id}
          </p>
          <p>
            <span className="font-semibold">seller_id:</span> {account.seller_id ?? "Sin asignar"}
          </p>
          <p>
            <span className="font-semibold">Estado:</span> {isConnected ? "Conectada" : "No conectada"}
          </p>
          {isGrowthAccount ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              Cuenta Growth detectada: {GROWTH_ML_ACCOUNT_ID}
            </p>
          ) : null}
        </div>

        {oauthError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{oauthError}</p>
        ) : (
          <a
            href={oauthUrl ?? "#"}
            className="inline-flex items-center justify-center rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold text-[#1A1A1A]"
          >
            {buttonLabel}
          </a>
        )}
      </section>
    </main>
  );
}
