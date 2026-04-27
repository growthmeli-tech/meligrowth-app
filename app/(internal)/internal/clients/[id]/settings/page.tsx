import Link from "next/link";
import { MLConnectionCard } from "@/components/ml/ml-connection-card";
import { getServerEnv } from "@/lib/config/env";
import { getCompanyById } from "@/lib/data-v2/companies";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import { getMLAuthorizationUrl } from "@/lib/ml/get-auth-url";

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
  let account = accountsResult.success ? (accountsResult.data[0] ?? null) : null;
  if (!account) {
    const fallbackAccountsResult = await listMlAccountsByCompany(id);
    account = fallbackAccountsResult.success ? (fallbackAccountsResult.data[0] ?? null) : null;
  }

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

  const { ml } = getServerEnv();
  let oauthUrl: string | null = null;
  if (ml.isConfigured) {
    try {
      oauthUrl = getMLAuthorizationUrl(account.id);
    } catch {
      oauthUrl = null;
    }
  }

  return (
    <main className="p-4 md:p-6 space-y-4">
      <header className="space-y-2">
        <Link href={`/internal/clients/${id}`} className="inline-flex text-sm font-semibold text-[#1A1A1A] underline underline-offset-2">
          Volver a la cuenta
        </Link>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Settings ML</h1>
        <p className="text-sm text-[#6B6B6B]">{companyResult.data.name}</p>
      </header>

      <MLConnectionCard
        mlAccountId={account.id}
        sellerId={account.seller_id}
        isConfigured={ml.isConfigured}
        oauthUrl={oauthUrl}
        lastSyncAt={account.updated_at}
      />
    </main>
  );
}
