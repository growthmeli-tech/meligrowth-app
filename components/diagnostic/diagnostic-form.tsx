"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { BlockScoreRealtime } from "@/components/diagnostic/block-score-realtime";
import { DiagnosticFieldBenchmark } from "@/components/diagnostic/diagnostic-field-benchmark";
import { DiagnosticResultScreen } from "@/components/diagnostic/diagnostic-result-screen";
import { ScoreDisplay } from "@/components/score/score-display";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { scoreDiagnostic } from "@/lib/scoring";
import type { MlDataSource } from "@/lib/ml/mappers/types";
import type { DiagnosticRecommendations } from "@/lib/recommendations/types";
import type { ActionResult } from "@/lib/types/api";
import type { BlockKey, Diagnostic, DiagnosticInput } from "@/lib/types";

type MetricField = {
  label: string;
  name: string;
  block: BlockKey;
  zone: "rapida" | "opcional";
  hint: string;
};

type SaveDiagnosticPayload = {
  diagnostic: {
    id: string;
    score_global: number;
    estado_global: string;
  };
  recommendations: DiagnosticRecommendations;
};

const tabs: Array<{ key: BlockKey; label: string }> = [
  { key: "salud", label: "01 Salud" },
  { key: "publicaciones", label: "02 Publicaciones" },
  { key: "ads", label: "03 Ads" },
  { key: "logistica", label: "04 Logística" },
  { key: "stock", label: "05 Stock" }
];

const fields: MetricField[] = [
  { block: "salud", label: "Reclamos", name: "reclamos", zone: "rapida", hint: "% sobre ventas. Menor es mejor." },
  { block: "salud", label: "Mediaciones", name: "mediaciones", zone: "opcional", hint: "% sobre ventas. Menor es mejor." },
  { block: "salud", label: "Cancelaciones vendedor", name: "cancelaciones_vendedor", zone: "rapida", hint: "% cancelado por vendedor." },
  { block: "salud", label: "Envíos a tiempo", name: "envios_a_tiempo", zone: "rapida", hint: "% entregas dentro de SLA." },
  { block: "publicaciones", label: "Publicaciones activas", name: "pubs_activas_pct", zone: "rapida", hint: "% del catálogo activo." },
  { block: "publicaciones", label: "Publicaciones optimizadas", name: "pubs_optimizadas_pct", zone: "rapida", hint: "% con ficha completa." },
  { block: "publicaciones", label: "CTR", name: "ctr", zone: "opcional", hint: "% de clics sobre impresiones." },
  { block: "ads", label: "Margen pre ads", name: "margen_pre_ads", zone: "rapida", hint: "% margen antes de publicidad." },
  { block: "ads", label: "Gasto ads", name: "gasto_ads", zone: "opcional", hint: "$ invertidos en el período." },
  { block: "ads", label: "Ventas ads", name: "ventas_ads", zone: "opcional", hint: "$ atribuidos a campañas." },
  { block: "ads", label: "Ventas totales", name: "ventas_totales", zone: "opcional", hint: "$ total del período." },
  { block: "ads", label: "ACOS", name: "acos", zone: "rapida", hint: "% gasto / ventas ads." },
  { block: "ads", label: "ROAS", name: "roas", zone: "rapida", hint: "Retorno por peso invertido." },
  { block: "ads", label: "TACOS", name: "tacos", zone: "rapida", hint: "% gasto / ventas totales." },
  { block: "logistica", label: "Incidencias", name: "incidencias_pct", zone: "rapida", hint: "% envíos con incidencia." },
  { block: "logistica", label: "Uso Full/Flex", name: "uso_full_flex_pct", zone: "rapida", hint: "% ventas con Full o Flex." },
  { block: "logistica", label: "Cancelaciones por stock", name: "cancelaciones_stock_pct", zone: "rapida", hint: "% cancelado por faltante." },
  { block: "stock", label: "SKUs sin stock", name: "skus_sin_stock_pct", zone: "rapida", hint: "% SKUs sin disponibilidad." },
  { block: "stock", label: "Días de stock", name: "dias_stock", zone: "rapida", hint: "Cobertura promedio." },
  { block: "stock", label: "Lead time reposición", name: "lead_time_reposicion", zone: "opcional", hint: "Días hasta reponer." },
  { block: "stock", label: "Sistema de reposición", name: "sistema_reposicion", zone: "opcional", hint: "% SKUs con criterio definido." }
];

function inputFromDiagnostic(diagnostic: Diagnostic): Record<string, number> {
  return {
    reclamos: diagnostic.salud.reclamos,
    mediaciones: diagnostic.salud.mediaciones,
    cancelaciones_vendedor: diagnostic.salud.cancelaciones_vendedor,
    envios_a_tiempo: diagnostic.salud.envios_a_tiempo,
    pubs_activas_pct: diagnostic.publicaciones.pubs_activas_pct,
    pubs_optimizadas_pct: diagnostic.publicaciones.pubs_optimizadas_pct,
    ctr: diagnostic.publicaciones.ctr,
    margen_pre_ads: diagnostic.ads.margen_pre_ads,
    gasto_ads: diagnostic.ads.gasto_ads,
    ventas_ads: diagnostic.ads.ventas_ads,
    ventas_totales: diagnostic.ads.ventas_totales,
    acos: diagnostic.ads.acos,
    roas: diagnostic.ads.roas,
    tacos: diagnostic.ads.tacos,
    incidencias_pct: diagnostic.logistica.incidencias_pct,
    uso_full_flex_pct: diagnostic.logistica.uso_full_flex_pct,
    cancelaciones_stock_pct: diagnostic.logistica.cancelaciones_stock_pct,
    skus_sin_stock_pct: diagnostic.stock.skus_sin_stock_pct,
    dias_stock: diagnostic.stock.dias_stock,
    lead_time_reposicion: diagnostic.stock.lead_time_reposicion,
    sistema_reposicion: diagnostic.stock.sistema_reposicion
  };
}

function buildInput(values: Record<string, number | null>): DiagnosticInput {
  return {
    salud: {
      reclamos: values.reclamos ?? 0,
      mediaciones: values.mediaciones ?? 0,
      cancelaciones_vendedor: values.cancelaciones_vendedor ?? 0,
      envios_a_tiempo: values.envios_a_tiempo ?? 0
    },
    publicaciones: {
      pubs_activas_pct: values.pubs_activas_pct ?? 0,
      pubs_optimizadas_pct: values.pubs_optimizadas_pct ?? 0,
      ctr: values.ctr ?? 0
    },
    ads: {
      margen_pre_ads: values.margen_pre_ads ?? 0,
      gasto_ads: values.gasto_ads ?? 0,
      ventas_ads: values.ventas_ads ?? 0,
      ventas_totales: values.ventas_totales ?? 0,
      acos: values.acos ?? 0,
      roas: values.roas ?? 0,
      tacos: values.tacos ?? 0
    },
    logistica: {
      incidencias_pct: values.incidencias_pct ?? 0,
      uso_full_flex_pct: values.uso_full_flex_pct ?? 0,
      cancelaciones_stock_pct: values.cancelaciones_stock_pct ?? 0
    },
    stock: {
      skus_sin_stock_pct: values.skus_sin_stock_pct ?? 0,
      dias_stock: values.dias_stock ?? 0,
      lead_time_reposicion: values.lead_time_reposicion ?? 0,
      sistema_reposicion: values.sistema_reposicion ?? 0
    }
  };
}

function warningsFor(values: Record<string, number | null>) {
  const warnings: string[] = [];
  const percentageFields = fields.filter((field) => field.name.includes("_pct") || ["envios_a_tiempo", "pubs_activas_pct", "pubs_optimizadas_pct", "margen_pre_ads", "acos", "tacos", "reclamos", "mediaciones", "cancelaciones_vendedor"].includes(field.name));

  percentageFields.forEach((field) => {
    const value = values[field.name] ?? 0;
    if (value < 0 || value > 100) warnings.push(`${field.label} debería estar entre 0 y 100.`);
  });

  if ((values.envios_a_tiempo ?? 0) < 90) warnings.push("Envíos a tiempo está por debajo de 90%. Revisar SLA logístico.");
  if ((values.acos ?? 0) > (values.margen_pre_ads ?? 0) * 0.36) warnings.push("ACOS supera el umbral rentable contra margen pre ads.");
  if ((values.uso_full_flex_pct ?? 0) < 50) warnings.push("Uso Full/Flex menor a 50%. Hay oportunidad logística.");
  if ((values.skus_sin_stock_pct ?? 0) > 12) warnings.push("SKUs sin stock por encima de 12%. Riesgo de ventas perdidas.");

  return warnings;
}

export function DiagnosticForm({
  mlAccountId,
  companyId,
  diagnostic,
  action
}: {
  mlAccountId: string;
  companyId: string;
  diagnostic: Diagnostic;
  action: (formData: FormData) => Promise<ActionResult<SaveDiagnosticPayload>>;
}) {
  const [activeTab, setActiveTab] = useState<BlockKey>("salud");
  const [values, setValues] = useState<Record<string, number | null>>(() => inputFromDiagnostic(diagnostic));
  const [expandedOptional, setExpandedOptional] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMlLoading, setIsMlLoading] = useState(false);
  const [mlMessage, setMlMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedResult, setSavedResult] = useState<SaveDiagnosticPayload | null>(null);
  const [sourceByBlock, setSourceByBlock] = useState<Record<BlockKey, MlDataSource>>(() => {
    const fallback: MlDataSource = diagnostic.source === "manual" ? "manual" : "scraper";
    return {
      salud: fallback,
      publicaciones: fallback,
      ads: fallback,
      logistica: fallback,
      stock: fallback
    };
  });
  const scored = useMemo(() => scoreDiagnostic(buildInput(values)), [values]);
  const warnings = useMemo(() => warningsFor(values), [values]);
  const activeFields = fields.filter((field) => field.block === activeTab);
  const submissionSource = useMemo(() => {
    const hasAutomatedData = Object.values(sourceByBlock).some((source) => source === "api" || source === "scraper");
    return hasAutomatedData ? "scraping" : "manual";
  }, [sourceByBlock]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    setIsMlLoading(true);

    async function loadMlPrefill() {
      try {
        const response = await fetch("/api/ml/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ client_id: companyId, ml_account_id: mlAccountId }),
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as
          | { success: true; data: Record<string, unknown> & { data_sources?: Record<string, MlDataSource> } }
          | { success: false; error?: string }
          | null;
        if (!response.ok || !payload || !payload.success) {
          setMlMessage(payload && "error" in payload && payload.error ? payload.error : "No pudimos sincronizar Mercado Libre. Podés completar manualmente.");
          return;
        }

        setValues((current) => {
          const next = { ...current };
          for (const field of fields) {
            const raw = payload.data[field.name];
            if (raw === null) {
              next[field.name] = null;
            } else if (typeof raw === "number" && Number.isFinite(raw)) {
              next[field.name] = raw;
            }
          }
          return next;
        });

        const dataSources = payload.data.data_sources ?? {};
        const normalizeSource = (source: MlDataSource | undefined): MlDataSource => source ?? "unavailable";
        setSourceByBlock({
          salud: normalizeSource(dataSources.salud),
          publicaciones: normalizeSource(dataSources.publicaciones),
          ads: normalizeSource(dataSources.ads),
          logistica: normalizeSource(dataSources.logistica),
          stock: normalizeSource(dataSources.stock)
        });
        setMlMessage("Datos pre-cargados desde Mercado Libre. Revisá los campos marcados por fuente.");
      } catch {
        setMlMessage("No pudimos sincronizar Mercado Libre en este momento. Podés continuar manualmente.");
      } finally {
        clearTimeout(timeout);
        setIsMlLoading(false);
      }
    }

    void loadMlPrefill();

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [companyId, mlAccountId]);

  function updateValue(name: string, value: number | null) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("source", submissionSource);
    const result = await action(formData);

    if (!result.success) {
      setSubmitError(result.error);
      setIsSubmitting(false);
      return;
    }

    setSavedResult(result.data);
    setIsSubmitting(false);
  }

  if (savedResult) {
    return (
      <DiagnosticResultScreen
        score={savedResult.diagnostic.score_global}
        estado={savedResult.diagnostic.estado_global}
        delta={null}
        recommendations={savedResult.recommendations}
        clientId={companyId}
        diagnosticId={savedResult.diagnostic.id}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Card>
        <div className="mb-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`focus-ring min-h-10 rounded-component border px-3 text-sm font-semibold ${activeTab === tab.key ? "border-brand-purple bg-brand-light text-brand-dark" : "border-black/10 bg-white text-zinc-600 hover:bg-brand-light"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="mb-5 block max-w-xs space-y-2">
          <span className="text-sm font-semibold text-zinc-700">Fecha del diagnóstico</span>
          <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" defaultValue={new Date().toISOString().slice(0, 10)} name="date" type="date" />
        </label>

        <section>
          {isMlLoading ? <p className="mb-3 text-sm font-semibold text-zinc-600">Sincronizando datos desde Mercado Libre...</p> : null}
          {mlMessage ? <p className="mb-3 text-sm text-zinc-600">{mlMessage}</p> : null}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">{tabs.find((tab) => tab.key === activeTab)?.label}</h2>
              <p className="mt-1 text-sm text-zinc-600">Completá Zona A primero. Zona B suma precisión opcional.</p>
            </div>
            <div className="text-sm font-semibold text-brand-dark">Score bloque (realtime): {scored.scores[activeTab]}</div>
          </div>

          <FieldZone
            title="Zona A"
            fields={activeFields.filter((field) => field.zone === "rapida")}
            values={values}
            onChange={updateValue}
            sourceByBlock={sourceByBlock}
          />
          <button type="button" className="mt-4 text-sm font-semibold text-brand-dark" onClick={() => setExpandedOptional((current) => !current)}>
            {expandedOptional ? "Ocultar Zona B" : "Ver datos opcionales"}
          </button>
          {expandedOptional ? (
            <FieldZone
              title="Zona B"
              fields={activeFields.filter((field) => field.zone === "opcional")}
              values={values}
              onChange={updateValue}
              sourceByBlock={sourceByBlock}
            />
          ) : null}
        </section>

        <div className="mt-5 rounded-card border border-[#BA7517]/30 bg-[#FAEEDA] p-4 text-sm text-[#633806]">
          El score y los benchmarks se recalculan en cada cambio para que puedas ajustar antes de guardar.
        </div>

        {submitError ? <div className="mt-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{submitError}</div> : null}
      </Card>

      <Card className="h-fit">
        <h2 className="text-lg font-bold">Preview en tiempo real</h2>
        <div className="mt-4">
          <ScoreDisplay score={scored.scoreGlobal} delta={null} size="md" />
        </div>
        <div className="mt-5 space-y-4">
          <BlockScoreRealtime bloque="01_salud" metricas={values} peso={35} />
          <BlockScoreRealtime bloque="02_publicaciones" metricas={values} peso={20} />
          <BlockScoreRealtime bloque="03_ads" metricas={values} peso={20} />
          <BlockScoreRealtime bloque="04_logistica" metricas={values} peso={15} />
          <BlockScoreRealtime bloque="05_stock" metricas={values} peso={10} />
        </div>

        {warnings.length > 0 ? (
          <div className="mt-5 rounded-card border border-[#D85A30]/30 bg-[#FAECE7] p-4 text-sm text-[#712B13]">
            <div className="font-bold">Warnings</div>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {warnings.slice(0, 4).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button className="mt-6 w-full" type="submit" disabled={isSubmitting}>
          <Save className="h-4 w-4" />
          {isSubmitting ? "Guardando..." : "Guardar diagnóstico"}
        </Button>
      </Card>
    </form>
  );
}

function FieldZone({
  title,
  fields: zoneFields,
  values,
  onChange,
  sourceByBlock
}: {
  title: string;
  fields: MetricField[];
  values: Record<string, number | null>;
  onChange: (name: string, value: number | null) => void;
  sourceByBlock: Record<BlockKey, MlDataSource>;
}) {
  if (zoneFields.length === 0) return null;

  return (
    <div className="mt-5">
      <h3 className="mb-3 text-sm font-bold text-zinc-950">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {zoneFields.map((field) => (
          <div key={field.name}>
            <DiagnosticFieldBenchmark
              name={field.name}
              label={field.label}
              metrica={field.name}
              value={values[field.name]}
              onChange={(value) => onChange(field.name, value)}
              dataSource={sourceByBlock[field.block]}
            />
            <p className="mt-1 text-xs text-zinc-500">{field.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
