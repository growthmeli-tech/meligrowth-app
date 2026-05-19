import Link from "next/link";
import { CreateInviteForm } from "@/components/internal/create-invite-form";
import { MLConnectionCard } from "@/components/ml/ml-connection-card";
import { getServerEnv } from "@/lib/config/env";
import { getCompanyById } from "@/lib/data-v2/companies";
import { requireMeliGrowthTeamWithSupabase } from "@/lib/data-v2/internal-team";
import { listMlAccountsByCompany } from "@/lib/data-v2/ml-accounts";
import { getMLAuthorizationUrl } from "@/lib/ml/get-auth-url";
import type { Database } from "@/lib/supabase/database.types";

type MlAccountRow = Database["public"]["Tables"]["ml_accounts"]["Row"];
type InviteRow = {
  id: string;
  ml_account_id: string;
  client_email: string;
  client_name: string;
  status: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

/** Cuenta ML elegible para reconexión operador: conectada vía invite completada, no legacy suelta. */
function pickOperatorReconnectAccount(
  accounts: MlAccountRow[],
  invites: InviteRow[],
  sellerById: Map<string, boolean>
): MlAccountRow | null {
  const completedInvites = invites
    .filter((inv) => inv.status === "connected" || (inv.used_at != null && (sellerById.get(inv.ml_account_id) ?? false)))
    .sort((a, b) => new Date(b.used_at ?? b.created_at).getTime() - new Date(a.used_at ?? a.created_at).getTime());

  for (const inv of completedInvites) {
    const account = accounts.find((a) => a.id === inv.ml_account_id && a.seller_id);
    if (account) return account;
  }
  return null;
}

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
  const accounts = accountsResult.success ? accountsResult.data : [];

  const { data: mlRows } = await supabase.from("ml_accounts").select("id, seller_id, account_name").eq("company_id", id);
  const accountIds = (mlRows ?? []).map((r) => r.id);
  const sellerById = new Map((mlRows ?? []).map((r) => [r.id, Boolean(r.seller_id)]));
  const accountNameById = new Map((mlRows ?? []).map((r) => [r.id, r.account_name]));

  const invitesRes = accountIds.length
    ? await supabase
        .from("ml_account_invites")
        .select("id, client_email, client_name, status, expires_at, used_at, created_at, ml_account_id")
        .in("ml_account_id", accountIds)
        .order("created_at", { ascending: false })
    : { data: [] as const };
  const invites = (invitesRes.data ?? []) as InviteRow[];

  const connectedAccount = pickOperatorReconnectAccount(accounts, invites, sellerById);

  const { ml } = getServerEnv();
  let oauthUrl: string | null = null;
  if (connectedAccount && ml.isConfigured) {
    try {
      oauthUrl = await getMLAuthorizationUrl(connectedAccount.id);
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
        <h1 className="text-xl font-bold text-[#1A1A1A]">Configurar Mercado Libre</h1>
        <p className="text-sm text-[#6B6B6B]">{companyResult.data.name}</p>
        <p className="text-sm text-[#6B6B6B] max-w-2xl">
          Agregá cuentas ML para esta empresa. El camino habitual es crear una cuenta nueva e invitar al cliente por link. La reconexión
          directa es solo para operadores.
        </p>
      </header>

      <section className="space-y-4" aria-labelledby="client-invite-heading">
        <div className="border-b border-[#E8E8E2] pb-2">
          <h2 id="client-invite-heading" className="text-sm font-bold uppercase tracking-wide text-[#1A1A1A]">
            Nueva cuenta ML por invitación
          </h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">
            Creá una cuenta pendiente y enviá un link al cliente. Cada invitación genera una cuenta ML separada; el cliente autoriza con su
            email.
          </p>
        </div>

        <CreateInviteForm companyId={id} />

        <div className="rounded-xl border border-[#E8E8E2] bg-white p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#1A1A1A]">Cuentas e invitaciones</h3>
          {!invites.length ? (
            <p className="mt-3 text-sm text-[#6B6B6B]">
              Todavía no hay cuentas ML para esta empresa. Usá el formulario de arriba para crear la primera cuenta e invitar al cliente.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E8E8E2] text-xs uppercase text-[#6B6B6B]">
                    <th className="py-2 pr-2">Cliente</th>
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Cuenta ML</th>
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
                      <td className="py-2 pr-2">{accountNameById.get(row.ml_account_id) ?? "—"}</td>
                      <td className="py-2 pr-2">{inviteStatusLabel(row, sellerById.get(row.ml_account_id) ?? false)}</td>
                      <td className="py-2 pr-2">{new Date(row.expires_at).toLocaleString("es-AR")}</td>
                      <td className="py-2">{new Date(row.created_at).toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-[#6B6B6B]">Los links de conexión solo se muestran al crear la invitación.</p>
            </div>
          )}
        </div>
      </section>

      <details className="group rounded-xl border border-[#E8E8E2] bg-[#FAFAF8]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#6B6B6B] marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="text-xs transition-transform group-open:rotate-90">▶</span>
            Reconexión interna (solo operador MeliGrowth)
          </span>
        </summary>
        <div className="space-y-4 border-t border-[#E8E8E2] px-4 pb-4 pt-3">
          <p className="text-sm text-[#6B6B6B]">
            Usá esta opción solo si MeliGrowth debe reconectar o sincronizar una cuenta ya conectada. No reemplaza el link de invitación al
            cliente.
          </p>

          {connectedAccount ? (
            <MLConnectionCard
              operatorMode
              accountName={connectedAccount.account_name}
              mlAccountId={connectedAccount.id}
              sellerId={connectedAccount.seller_id}
              isConfigured={ml.isConfigured}
              oauthUrl={oauthUrl}
              lastSyncAt={connectedAccount.updated_at}
            />
          ) : (
            <div className="rounded-lg border border-[#E8E8E2] bg-white p-4 text-sm text-[#6B6B6B]">
              Cuando un cliente conecte una cuenta, acá podrás reconectarla o sincronizarla como operador.
            </div>
          )}
        </div>
      </details>
    </main>
  );
}
