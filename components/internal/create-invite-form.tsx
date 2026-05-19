"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import {
  createMlAccountInviteAction,
  initialInviteFormState
} from "@/app/(internal)/internal/clients/[id]/accounts/actions";

type Props = { companyId: string };

export function CreateInviteForm({ companyId }: Props) {
  const router = useRouter();
  const refreshedForUrl = useRef<string | null>(null);
  const [state, formAction, pending] = useFormState(
    createMlAccountInviteAction.bind(null, companyId),
    initialInviteFormState
  );

  useEffect(() => {
    if (!state.success || !state.connectUrl) return;
    if (refreshedForUrl.current === state.connectUrl) return;
    refreshedForUrl.current = state.connectUrl;
    router.refresh();
  }, [state.success, state.connectUrl, router]);

  return (
    <div className="space-y-3 rounded-xl border border-[#E8E8E2] bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#1A1A1A]">Generar link para el cliente</h2>
      <p className="text-sm text-[#6B6B6B]">
        El cliente abre el link, inicia sesión con el email indicado y autoriza Mercado Libre. Copiá el link completo y enviáselo; solo se
        muestra una vez al generarlo.
      </p>
      <form action={formAction} className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-[#1A1A1A]">Cliente / nombre comercial *</span>
          <input
            name="client_name"
            required
            className="rounded-lg border border-[#E8E8E2] px-3 py-2"
            placeholder="Ej. Distribuidora Norte"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-[#1A1A1A]">Email del cliente *</span>
          <input name="client_email" type="email" required className="rounded-lg border border-[#E8E8E2] px-3 py-2" placeholder="contacto@empresa.com" />
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          <span className="font-semibold text-[#6B6B6B]">Nombre de cuenta (opcional)</span>
          <input name="optional_account_label" className="rounded-lg border border-[#E8E8E2] px-3 py-2" placeholder="Etiqueta interna / MLB" />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#FFD600] px-4 py-2 text-sm font-semibold text-[#1A1A1A] disabled:opacity-60"
          >
            {pending ? "Generando…" : "Generar link de conexión"}
          </button>
        </div>
      </form>
      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success && state.connectUrl ? (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p className="font-semibold">Copiá este link ahora. Por seguridad no se mostrará nuevamente.</p>
          {state.expiresAt ? <p className="text-xs">Vence: {new Date(state.expiresAt).toLocaleString("es-AR")}</p> : null}
          <div className="flex flex-wrap gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-xs">{state.connectUrl}</code>
            <button
              type="button"
              className="rounded border border-emerald-600 px-2 py-1 text-xs font-semibold"
              onClick={() => navigator.clipboard.writeText(state.connectUrl!)}
            >
              Copiar link
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
