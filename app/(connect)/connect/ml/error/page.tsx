import Link from "next/link";

const MSGS: Record<string, string> = {
  duplicate_seller:
    "Esta cuenta de Mercado Libre ya está vinculada a otro perfil en tu empresa. Contactá a MeliGrowth para unificar el acceso.",
  invite_email_mismatch: "El usuario logueado no coincide con el email de la invitación.",
  session_required: "Necesitamos que inicies sesión con el email de la invitación antes de autorizar.",
  invalid_invite: "La invitación no es válida o ya fue utilizada.",
  default: "No pudimos completar la conexión. Volvé a intentar o contactá a MeliGrowth."
};

export default async function ConnectMlErrorPage({
  searchParams
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const reason = sp.reason ?? "default";
  const msg = MSGS[reason] ?? MSGS.default;

  return (
    <main className="min-h-screen bg-[#F5F5F0] px-4 py-16 flex items-center justify-center">
      <div className="max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm space-y-3">
        <p className="text-lg font-bold text-red-800">No se pudo conectar</p>
        <p className="text-sm text-[#1A1A1A]">{msg}</p>
        <Link href="/connect/ml" className="inline-block text-sm font-semibold text-[#1A1A1A] underline">
          Volver
        </Link>
      </div>
    </main>
  );
}
