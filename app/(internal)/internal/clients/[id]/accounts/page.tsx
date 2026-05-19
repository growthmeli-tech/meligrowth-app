import Link from "next/link";
import { CreateInviteForm } from "@/components/internal/create-invite-form";
import { MLConnectionCard } from "@/components/ml/ml-connection-card";
import { getServerEnv } from "@/lib/config/env";
import { getCompanyById } from "@/lib/data-v2/companies";
import { requireMeliGrowthTeamWithSupabase } from "@/lib/data-v2/internal-team";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import { getMLAuthorizationUrl } from "@/lib/ml/get-auth-url";

function inviteStatusLabel(row: { status: string; expires_at: string; used_at: string | null }, sellerConnected: boolean) {
  if (sellerConnected || row.status === "connected") return "Conectada";
  if (row.status === "revoked") return "Revocada";
  if (row.status === "expired") return "Vencida";
  if (new Date(row.expires_at) < new Date()) return "Vencida";
  if (row.status === "pending") return "Pendiente";
  return row.status;
}

export default async function CompanyAccountsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const companyResult = await getCompanyById(id);
  if (!companyResult.success || !companyResult.data) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No pudimos cargar esta empresa</div>
      </main>
    );
  }

  const gate = await requireMeliGrowthTeamWithSupabase();
  if (!gate.success) {
    return (
      <main className="p-4 md:p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{gate.error ?? "Sin permiso"}</div>
      </main>
    );
  }

  const { supabase } = gate.data;

  const accountsResult = await listMlAccountsByCompany(id, { activeOnly: true });
  let operatorAccount = accountsResult.success ? (accountsResult.data[0] ?? null) : null;
  if (!operatorAccount) {
    const fallbackAccountsResult = await listMlAccountsByCompany(id);
    operatorAccount = fallbackAccountsResult.success ? (fallbackAccountsResult.data[0] ?? null) : null;
  }

  const { data: mlRows } = await supabase.from("ml_accounts").select("id, seller_id").eq("company_id", id);
  const accountIds = (mlRows ?? []).map((r) => r.id);
  const sellerById = new Map((mlRows ?? []).map((r) => [r.id, Boolean(r.seller_id)]));

  const invitesRes = accountIds.length
    ? await supabase
        .from("ml_account_invites")
        .select("id, client_email, client_name, status, expires_at, used_at, created_at, ml_account_id")
        .in("ml_account_id", accountIds)
        .order("created_at", { ascending: false })
    : { data: [] as const };
  const invites = invitesRes.data ?? [];

  const { ml } = getServerEnv();
  let oauthUrl: string | null = null;
  if (operatorAccount && ml.isConfigured) {
    try {
      oauthUrl = await getMLAuthorizationUrl(operatorAccount.id);
    } catch {
      oauthUrl = null;
    }
  }

  return (
    <main className="p-4 md:p-6 space-y-8">
      <header className="space-y-2">
        <Link href={`/internal/clients/${id}`} className="inline-flex text-sm font-semibold text-[#1A1A1A] underline underline-offset-2">
          Volver a la cuenta
        </Link>
        <h1 className="text-xl font-bold text-[#1A1A1A]">Configurar ML</h1>
        <p className="text-sm text-[#6B6B6B]">{companyResult.data.name}</p>
        <p className="text-sm text-[#6B6B6B] max-w-2xl">
          Para que el cliente autorice su cuenta, generá un link de invitación. La reconexión interna de abajo es solo para operadores
          MeliGrowth.
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="client-invite-heading">
        <div className="border-b border-[#E8E8E2] pb-2">
          <h2 id="client-invite-heading" className="text-sm font-bold uppercase tracking-wide text-[#1A1A1A]">
            1. Onboarding del cliente (recomendado)
          </h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">El cliente recibe un link seguro y completa OAuth con su email autorizado.</p>
        </div>

        <CreateInviteForm companyId={id} />

        <div className="rounded-xl border border-[#E8E8E2] bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#1A1A1A]">Invitaciones</h3>
          {!invites.length ? (
            <p className="mt-3 text-sm text-[#6B6B6B]">
              Todavía no hay invitaciones. Generá el primer link con el formulario de arriba para que el cliente conecte Mercado Libre.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E8E8E2] text-xs uppercase text-[#6B6B6B]">
                    <th className="py-2 pr-2">Cliente</th>
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Estado</th>
                    <th className="py-2 pr-2">Vence</th>
                    <th className="py-2">Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((row) => (
                    <tr key={row.id} className="border-b border-[#F5F5F0]">
                      <td className="py-2 pr-2 font-medium">{row.client_name}</td>
                      <td className="py-2 pr-2">{row.client_email}</td>
                      <td className="py-2 pr-2">{inviteStatusLabel(row, sellerById.get(row.ml_account_id) ?? false)}</td>
                      <td className="py-2 pr-2">{new Date(row.expires_at).toLocaleString("es-AR")}</td>
                      <td className="py-2">{new Date(row.created_at).toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-[#6B6B6B]">Los links de conexión solo se muestran al generar la invitación.</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="operator-reconnect-heading">
        <div className="border-b border-[#E8E8E2] pb-2">
          <h2 id="operator-reconnect-heading" className="text-sm font-bold uppercase tracking-wide text-[#1A1A1A]">
            2. Reconexión interna (operador)
          </h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Usá esta opción solo si MeliGrowth debe reconectar la cuenta directamente. No reemplaza el link de invitación al cliente.
          </p>
        </div>

        {operatorAccount ? (
          <MLConnectionCard
            mlAccountId={operatorAccount.id}
            sellerId={operatorAccount.seller_id}
            isConfigured={ml.isConfigured}
            oauthUrl={oauthUrl}
            lastSyncAt={operatorAccount.updated_at}
          />
        ) : (
          <div className="rounded-xl border border-[#E8E8E2] bg-white p-4 text-sm text-[#6B6B6B]">
            Todavía no hay una cuenta ML en esta empresa. Creá una invitación en la sección de arriba: al generar el link se crea la cuenta
            pendiente y el cliente podrá conectarla.
          </div>
        )}
      </section>
    </main>
  );
}
