"use client";

import { useState, useTransition } from "react";
import { createMlAccountInviteAction } from "@/app/(internal)/internal/clients/[id]/accounts/actions";

type Props = { companyId: string };

export function CreateInviteForm({ companyId }: Props) {
  const [pending, startTransition] = useTransition();
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-xl border border-[#E8E8E2] bg-white p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#1A1A1A]">Añadir cuenta (invitación)</h2>
      <p className="text-sm text-[#6B6B6B]">
        Generá un enlace seguro para que el cliente autorice Mercado Libre. El token se muestra una sola vez; guardalo o copiá el
        link completo.
      </p>
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setPlainToken(null);
          setConnectUrl(null);
          setExpiresAt(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await createMlAccountInviteAction(companyId, fd);
            if (!res.success) {
              setError(res.error ?? "No se pudo generar el link");
              return;
            }
            setPlainToken(res.data.plainToken);
            setConnectUrl(res.data.connectUrl);
            setExpiresAt(res.data.expiresAt);
            e.currentTarget.reset();
          });
        }}
      >
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
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {plainToken && connectUrl ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 space-y-2">
          <p className="font-semibold">Copiá y guardá estos datos ahora. El token no se vuelve a mostrar.</p>
          {expiresAt ? <p className="text-xs">Vence: {new Date(expiresAt).toLocaleString("es-AR")}</p> : null}
          <div>
            <p className="text-xs font-semibold text-[#6B6B6B]">Link de conexión</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <code className="break-all rounded bg-white px-2 py-1 text-xs">{connectUrl}</code>
              <button
                type="button"
                className="rounded border border-emerald-600 px-2 py-1 text-xs font-semibold"
                onClick={() => navigator.clipboard.writeText(connectUrl)}
              >
                Copiar link
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#6B6B6B]">Token (referencia interna)</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <code className="break-all rounded bg-white px-2 py-1 text-xs">{plainToken}</code>
              <button
                type="button"
                className="rounded border border-emerald-600 px-2 py-1 text-xs font-semibold"
                onClick={() => navigator.clipboard.writeText(plainToken)}
              >
                Copiar token
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
