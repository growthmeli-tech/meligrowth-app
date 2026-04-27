"use client";

import { useState } from "react";

type MLConnectionCardProps = {
  mlAccountId: string;
  sellerId: string | null;
  isConfigured: boolean;
  oauthUrl: string | null;
  lastSyncAt: string | null;
};

function formatLastSync(value: string | null) {
  if (!value) return "Pendiente";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pendiente";

  return date.toLocaleString("es-AR");
}

export function MLConnectionCard({ mlAccountId, sellerId, isConfigured, oauthUrl, lastSyncAt }: MLConnectionCardProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const isConnected = Boolean(sellerId);

  async function handleSyncNow() {
    try {
      setIsSyncing(true);
      setSyncMessage(null);

      const response = await fetch("/api/ml/sync", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ ml_account_id: mlAccountId })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setSyncMessage(payload.error ?? "No se pudo sincronizar ahora.");
        return;
      }

      setSyncMessage("Sincronizacion iniciada correctamente.");
    } catch {
      setSyncMessage("No se pudo sincronizar ahora.");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#E8E8E2] bg-white p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#1A1A1A]">Conexion con Mercado Libre</h2>

      <div className="mt-4 space-y-3 text-sm text-[#1A1A1A]">
        <p className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`} />
          Estado: {isConnected ? "Conectada" : "No conectada"}
        </p>

        {isConnected ? (
          <>
            <p>
              Seller ID: <span className="font-semibold">{sellerId}</span>
            </p>
            <p>Ultima sincronizacion: {formatLastSync(lastSyncAt)}</p>
          </>
        ) : (
          <p>Para obtener datos reales de esta cuenta, el seller tiene que autorizar el acceso.</p>
        )}
      </div>

      {!isConfigured ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Configuracion incompleta. Defini en el servidor: ML_CLIENT_ID, ML_CLIENT_SECRET y ML_REDIRECT_URI.
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={isConfigured && oauthUrl ? oauthUrl : "#"}
          aria-disabled={!isConfigured}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold ${
            isConfigured ? "bg-[#FFD600] text-[#1A1A1A]" : "cursor-not-allowed bg-zinc-200 text-zinc-500"
          }`}
        >
          {isConnected ? "Reconectar" : "Conectar cuenta de Mercado Libre"}
        </a>

        {isConnected ? (
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="inline-flex items-center justify-center rounded-lg border border-[#E8E8E2] px-4 py-2 text-sm font-semibold text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? "Sincronizando..." : "Sincronizar datos ahora"}
          </button>
        ) : null}
      </div>

      {syncMessage ? <p className="mt-3 text-sm text-[#6B6B6B]">{syncMessage}</p> : null}

      <div className="mt-5 border-t border-[#E8E8E2] pt-3 text-xs text-[#6B6B6B]">ml_account_id: {mlAccountId}</div>
    </section>
  );
}
