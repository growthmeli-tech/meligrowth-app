"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { saveFinancialSettingsForAccount } from "@/app/(ops)/ops/financial-settings/actions";
import type { SellerFinancialSettings } from "@/lib/pricing/calculator";

function pctFieldFromModel(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  const dec = v > 1 ? v / 100 : v;
  const pct = dec * 100;
  return String(Math.round(pct * 100) / 100);
}

function moneyFieldFromModel(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(v);
}

function parseOptPct(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseOptMoney(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

type Props = {
  mlAccountId: string;
  initialSettings: SellerFinancialSettings | null;
  onSaved: (settings: SellerFinancialSettings) => void;
};

export function AccountFiscalConfigPanel({ mlAccountId, initialSettings, onSaved }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [iibb, setIibb] = useState("");
  const [tax, setTax] = useState("");
  const [logInt, setLogInt] = useState("");
  const [addPct, setAddPct] = useState("");
  const [addFixed, setAddFixed] = useState("");

  const hydrate = useCallback((s: SellerFinancialSettings | null) => {
    if (!s) {
      setIibb("");
      setTax("");
      setLogInt("");
      setAddPct("");
      setAddFixed("");
      return;
    }
    setIibb(pctFieldFromModel(s.iibbPct));
    setTax(pctFieldFromModel(s.taxPct));
    setLogInt(moneyFieldFromModel(s.internalLogisticsCost));
    setAddPct(pctFieldFromModel(s.additionalCostsPct));
    setAddFixed(moneyFieldFromModel(s.additionalCostsFixed));
  }, []);

  useEffect(() => {
    hydrate(initialSettings);
  }, [mlAccountId, initialSettings, hydrate]);

  const onSubmit = () => {
    setError(null);
    setSaved(false);
    const input: SellerFinancialSettings = {
      iibbPct: parseOptPct(iibb),
      taxPct: parseOptPct(tax),
      internalLogisticsCost: parseOptMoney(logInt),
      additionalCostsPct: parseOptPct(addPct),
      additionalCostsFixed: parseOptMoney(addFixed)
    };
    startTransition(async () => {
      const res = await saveFinancialSettingsForAccount(mlAccountId, input);
      if (!res.success) {
        setError(res.error ?? "No pudimos guardar la configuración fiscal. Revisá los datos e intentá nuevamente.");
        return;
      }
      hydrate(res.data);
      onSaved(res.data);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="rounded-lg border border-[#E8E8E2] bg-[#FAFAF8] p-3 text-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-[#6B6B6B]">Configuración fiscal de la cuenta</p>
      <p className="mt-1 text-xs text-[#6B6B6B]">Necesaria para calcular margen neto real.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-xs font-semibold text-[#6B6B6B]">
          IIBB %
          <input
            className="mt-1 w-full rounded border border-[#E8E8E2] bg-white px-2 py-1.5 text-sm"
            value={iibb}
            onChange={(e) => setIibb(e.target.value)}
            placeholder="vacío = sin dato"
            inputMode="decimal"
          />
        </label>
        <label className="block text-xs font-semibold text-[#6B6B6B]">
          Impuestos %
          <input
            className="mt-1 w-full rounded border border-[#E8E8E2] bg-white px-2 py-1.5 text-sm"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            placeholder="vacío = sin dato"
            inputMode="decimal"
          />
        </label>
        <label className="block text-xs font-semibold text-[#6B6B6B]">
          Logística interna / u.
          <input
            className="mt-1 w-full rounded border border-[#E8E8E2] bg-white px-2 py-1.5 text-sm"
            value={logInt}
            onChange={(e) => setLogInt(e.target.value)}
            placeholder="ARS, vacío = sin dato"
            inputMode="decimal"
          />
        </label>
        <label className="block text-xs font-semibold text-[#6B6B6B]">
          Costos adic. %
          <input
            className="mt-1 w-full rounded border border-[#E8E8E2] bg-white px-2 py-1.5 text-sm"
            value={addPct}
            onChange={(e) => setAddPct(e.target.value)}
            placeholder="vacío = sin dato"
            inputMode="decimal"
          />
        </label>
        <label className="block text-xs font-semibold text-[#6B6B6B]">
          Costos adic. fijos
          <input
            className="mt-1 w-full rounded border border-[#E8E8E2] bg-white px-2 py-1.5 text-sm"
            value={addFixed}
            onChange={(e) => setAddFixed(e.target.value)}
            placeholder="ARS, vacío = sin dato"
            inputMode="decimal"
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onSubmit}
          className="rounded-lg bg-[#1A1A1A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar fiscal"}
        </button>
        {saved ? (
          <p role="status" className="text-xs font-semibold text-emerald-700">
            Configuración fiscal guardada. Márgenes recalculados.
          </p>
        ) : null}
      </div>
    </div>
  );
}
