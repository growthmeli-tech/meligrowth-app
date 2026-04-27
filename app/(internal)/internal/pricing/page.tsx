import Link from "next/link";
import { Calculator, CheckCircle2, CircleAlert, ClipboardCheck, Download, FileSpreadsheet, TrendingUp, UploadCloud } from "lucide-react";
import { importPricingTemplate, importPricingTemplateFromClientFile } from "@/app/(internal)/internal/pricing/actions";
import { savePricingProposal } from "@/app/(internal)/internal/pricing/save-actions";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOperatorClientsList, getPricingProposalHistory, getPricingTemplateFiles } from "@/lib/data";
import { calculatePricing, comparePricingPlans, getPricingSignals, normalizePricingPlan, pricingPlans, selectRecommendedPricingPlan, toNumber } from "@/lib/pricing";
import { formatMoney, formatPct } from "@/lib/utils";
import type { Plan } from "@/lib/types";

const planLabels: Record<Plan, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale"
};

export default async function PricingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const imported = params.imported === "1";
  const importedFrom = Array.isArray(params.importedFrom) ? params.importedFrom[0] : params.importedFrom;
  const saved = params.saved === "1";
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  const selectedClientId = Array.isArray(params.clientId) ? params.clientId[0] : params.clientId ?? "";
  const plan = normalizePricingPlan(params.plan);
  const clients = await getOperatorClientsList();
  const proposalHistory = await getPricingProposalHistory();
  const pricingTemplateFiles = await getPricingTemplateFiles();
  const input = {
    plan,
    currentRevenue: toNumber(params.currentRevenue, 8_000_000),
    projectedRevenue: toNumber(params.projectedRevenue, 11_500_000),
    grossMarginPct: toNumber(params.grossMarginPct, 32),
    deliveryCost: toNumber(params.deliveryCost, 280_000),
    setupFee: toNumber(params.setupFee, 0),
    months: Math.max(1, Math.round(toNumber(params.months, 6)))
  };
  const result = calculatePricing(input);
  const planComparison = comparePricingPlans(input);
  const recommendedPlan = selectRecommendedPricingPlan(input);
  const signals = getPricingSignals(input, result);

  return (
    <AppShell mode="operator">
      <div className="space-y-6">
        <div>
          <div className="text-sm font-semibold text-brand-dark">Herramientas operator</div>
          <h1 className="mt-1 text-3xl font-bold text-zinc-950">Calculadora de precios</h1>
          <p className="mt-2 max-w-3xl text-zinc-600">
            Simulá fee fijo, comisión sobre crecimiento, rentabilidad MeliGrowth y retorno estimado para el cliente. También podés importar una plantilla completa desde Excel o CSV.
          </p>
        </div>

        {imported ? (
          <div className="rounded-card border border-[#639922]/30 bg-[#EAF3DE] p-4 text-sm font-semibold text-[#27500A]">
            {importedFrom === "storage"
              ? "Plantilla importada desde archivos del cliente. La calculadora tomó los valores guardados en Storage."
              : "Plantilla importada correctamente. La calculadora tomó los valores del archivo subido."}
          </div>
        ) : null}
        {saved ? (
          <div className="rounded-card border border-[#639922]/30 bg-[#EAF3DE] p-4 text-sm font-semibold text-[#27500A]">
            Propuesta comercial guardada correctamente.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-card border border-[#E24B4A]/30 bg-[#FCEBEB] p-4 text-sm font-semibold text-[#791F1F]">
            {error === "missing_file"
              ? "Seleccioná una plantilla antes de importar."
              : error === "invalid_format"
                ? "Formato no soportado. Usá CSV o XLSX."
                : error === "missing_client"
                  ? "Elegí un cliente antes de guardar la propuesta."
                  : error === "save_failed"
                    ? "No pudimos guardar la propuesta en el historial."
                : "No pudimos leer la plantilla. Revisá encabezados y la primera fila de datos."}
          </div>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <Card>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-component bg-brand-light text-brand-purple">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-950">Plantilla modelo de pricing</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Descargala, completala en Excel o Google Sheets, y luego importala para calcular la propuesta comercial.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {["plan", "current_revenue", "projected_revenue", "gross_margin_pct", "delivery_cost", "setup_fee", "months"].map((column) => (
                <Badge key={column} className="bg-zinc-100 text-zinc-700">{column}</Badge>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/templates/pricing-calculadora.xlsx" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-dark" download>
                <Download className="h-4 w-4" />
                Descargar XLSX
              </Link>
              <Link href="/templates/pricing-calculadora.csv" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-dark" download>
                <Download className="h-4 w-4" />
                Descargar CSV
              </Link>
            </div>
          </Card>

          <form action={importPricingTemplate} className="rounded-card border border-dashed border-brand-purple/40 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-component bg-brand-light text-brand-purple">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-950">Importar plantilla completada</h2>
                <p className="mt-1 text-sm text-zinc-600">Acepta `.xlsx` y `.csv`. Se usa la primera fila con datos de la hoja principal.</p>
              </div>
            </div>
            <input className="mt-5 block w-full text-sm" name="file" type="file" accept=".csv,.xlsx" required />
            <Button className="mt-5" type="submit">
              <UploadCloud className="h-4 w-4" />
              Importar plantilla
            </Button>
          </form>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <Card>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-component bg-brand-light text-brand-purple">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-950">Importar desde archivos del cliente</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Reutilizá una planilla comercial ya cargada en Supabase Storage sin volver a subirla manualmente.
                </p>
              </div>
            </div>
            <form action={importPricingTemplateFromClientFile} className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-700">Archivo disponible</span>
                <select className="focus-ring h-11 w-full rounded-component border border-black/10 bg-white px-3" name="clientFileId" defaultValue="">
                  <option value="">Seleccionar archivo</option>
                  {pricingTemplateFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.clientName} · {file.filename}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button type="submit" variant="secondary">
                  <UploadCloud className="h-4 w-4" />
                  Importar desde Storage
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-zinc-950">Atajo operativo</h2>
            <div className="mt-4 space-y-3 text-sm text-zinc-600">
              <p>1. El cliente u operador sube la planilla comercial a Archivos.</p>
              <p>2. Desde esta pantalla la importás directo desde Storage.</p>
              <p>3. Guardás la propuesta en el historial sin descargar nada localmente.</p>
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <form className="space-y-5 rounded-card border border-black/10 bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-700">Plan</span>
                <select className="focus-ring h-11 w-full rounded-component border border-black/10 bg-white px-3" name="plan" defaultValue={input.plan}>
                  {Object.entries(planLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-zinc-700">Meses de contrato</span>
                <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="months" type="number" min="1" defaultValue={input.months} />
              </label>

              <MoneyField label="Facturación actual mensual" name="currentRevenue" value={input.currentRevenue} />
              <MoneyField label="Facturación proyectada mensual" name="projectedRevenue" value={input.projectedRevenue} />
              <NumberField label="Margen bruto cliente %" name="grossMarginPct" value={input.grossMarginPct} />
              <MoneyField label="Costo operativo MeliGrowth" name="deliveryCost" value={input.deliveryCost} />
              <MoneyField label="Setup inicial" name="setupFee" value={input.setupFee} />
            </div>

            <div className="rounded-card border border-[#BA7517]/30 bg-[#FAEEDA] p-4 text-sm text-[#633806]">
              La comisión variable se calcula solo sobre crecimiento positivo vs facturación actual.
            </div>

            <Button type="submit">
              <Calculator className="h-4 w-4" />
              Calcular escenario
            </Button>
          </form>

          <div className="space-y-4">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-brand-dark">Precio mensual sugerido</div>
                  <div className="mt-2 text-4xl font-bold text-zinc-950">{formatMoney(result.monthlyFee)}</div>
                </div>
                <Badge className={result.recommended ? "bg-[#EAF3DE] text-[#27500A]" : "bg-[#FCEBEB] text-[#791F1F]"}>
                  {result.recommended ? "Recomendado" : "Revisar"}
                </Badge>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniMetric label="Fee fijo" value={formatMoney(result.fixedFee)} />
                <MiniMetric label="Variable" value={formatMoney(result.variableCommission)} />
                <MiniMetric label="Crecimiento" value={formatMoney(result.growth)} />
                <MiniMetric label="Comisión" value={formatPct(result.growthCommissionPct)} />
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-zinc-950">Rentabilidad</h2>
              <div className="mt-4 space-y-3">
                <OutcomeRow label="Margen bruto incremental cliente" value={formatMoney(result.contributionMargin)} positive={result.contributionMargin > 0} />
                <OutcomeRow label="Contribución neta cliente" value={formatMoney(result.clientNetContribution)} positive={result.clientNetContribution > 0} />
                <OutcomeRow label="Resultado MeliGrowth" value={formatMoney(result.operatorProfit)} positive={result.operatorProfit > 0} />
                <OutcomeRow label="Margen operator" value={formatPct(result.operatorMarginPct)} positive={result.operatorMarginPct >= 35} />
              </div>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <Card>
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <h2 className="text-lg font-bold text-zinc-950">Comparación por plan</h2>
                <p className="mt-1 text-sm text-zinc-500">Mismo escenario comercial aplicado a Starter, Growth y Scale.</p>
              </div>
              <Badge className="bg-brand-light text-brand-dark">Sugerido: {planLabels[recommendedPlan.plan]}</Badge>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="py-2">Plan</th>
                    <th className="py-2">Fee mensual</th>
                    <th className="py-2">Variable</th>
                    <th className="py-2">Margen MG</th>
                    <th className="py-2">ROI cliente</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/10">
                  {planComparison.map((planResult) => (
                    <tr key={planResult.plan} className={planResult.plan === input.plan ? "bg-brand-light/50" : ""}>
                      <td className="py-3 font-semibold">{planLabels[planResult.plan]}</td>
                      <td className="py-3">{formatMoney(planResult.monthlyFee)}</td>
                      <td className="py-3">{formatMoney(planResult.variableCommission)}</td>
                      <td className="py-3">{formatPct(planResult.operatorMarginPct)}</td>
                      <td className="py-3">{planResult.paybackRatio}x</td>
                      <td className="py-3">
                        <Badge className={planResult.recommended ? "bg-[#EAF3DE] text-[#27500A]" : "bg-zinc-100 text-zinc-700"}>
                          {planResult.recommended ? "Viable" : "Revisar"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-zinc-950">Señales comerciales</h2>
            <div className="mt-4 space-y-3">
              {signals.map((signal) => (
                <div key={signal.title} className={`rounded-component border p-3 ${signal.tone === "success" ? "border-[#639922]/20 bg-[#EAF3DE] text-[#27500A]" : signal.tone === "warning" ? "border-[#BA7517]/25 bg-[#FAEEDA] text-[#633806]" : "border-[#E24B4A]/25 bg-[#FCEBEB] text-[#791F1F]"}`}>
                  <div className="font-semibold">{signal.title}</div>
                  <div className="mt-1 text-sm opacity-80">{signal.detail}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <TrendingUp className="h-5 w-5 text-brand-purple" />
            <div className="mt-3 text-2xl font-bold">{formatMoney(result.totalContractValue)}</div>
            <div className="text-sm text-zinc-500">Valor contrato estimado</div>
          </Card>
          <Card>
            <CheckCircle2 className="h-5 w-5 text-[#639922]" />
            <div className="mt-3 text-2xl font-bold">{result.paybackRatio}x</div>
            <div className="text-sm text-zinc-500">Retorno bruto vs fee mensual</div>
          </Card>
          <Card>
            <CircleAlert className="h-5 w-5 text-[#BA7517]" />
            <div className="mt-3 text-2xl font-bold">{formatMoney(result.minRecommendedRevenue)}</div>
            <div className="text-sm text-zinc-500">Facturación mínima sugerida para {planLabels[input.plan]}</div>
          </Card>
        </section>

        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-brand-purple" />
                <h2 className="text-lg font-bold text-zinc-950">Resumen para propuesta</h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-zinc-600">
                Plan {planLabels[input.plan]} con fee mensual de {formatMoney(result.monthlyFee)}, compuesto por {formatMoney(result.fixedFee)} fijo y {formatMoney(result.variableCommission)} variable sobre crecimiento. El escenario proyecta {formatMoney(result.growth)} de crecimiento mensual y un retorno bruto de {result.paybackRatio}x para el cliente.
              </p>
            </div>
            <Badge className={result.recommended ? "bg-[#EAF3DE] text-[#27500A]" : "bg-[#FAEEDA] text-[#633806]"}>
              {result.recommended ? "Listo para presentar" : "Requiere ajuste"}
            </Badge>
          </div>
          <form action={savePricingProposal} className="mt-5 grid gap-4 rounded-component border border-black/10 p-4 md:grid-cols-[1.2fr_1fr_auto]">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-zinc-700">Guardar para cliente</span>
              <select className="focus-ring h-11 w-full rounded-component border border-black/10 bg-white px-3" name="clientId" defaultValue={selectedClientId}>
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-zinc-700">Notas internas</span>
              <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="notes" placeholder="Ej: escenario base importado por el cliente" />
            </label>
            <div className="flex items-end">
              <Button type="submit">Guardar propuesta</Button>
            </div>
            <input type="hidden" name="source" value={imported ? "template" : "manual"} />
            <input type="hidden" name="plan" value={input.plan} />
            <input type="hidden" name="currentRevenue" value={input.currentRevenue} />
            <input type="hidden" name="projectedRevenue" value={input.projectedRevenue} />
            <input type="hidden" name="grossMarginPct" value={input.grossMarginPct} />
            <input type="hidden" name="deliveryCost" value={input.deliveryCost} />
            <input type="hidden" name="setupFee" value={input.setupFee} />
            <input type="hidden" name="months" value={input.months} />
            <input type="hidden" name="fixedFee" value={result.fixedFee} />
            <input type="hidden" name="variableCommission" value={result.variableCommission} />
            <input type="hidden" name="monthlyFee" value={result.monthlyFee} />
            <input type="hidden" name="operatorProfit" value={result.operatorProfit} />
            <input type="hidden" name="operatorMarginPct" value={result.operatorMarginPct} />
            <input type="hidden" name="totalContractValue" value={result.totalContractValue} />
            <input type="hidden" name="paybackRatio" value={result.paybackRatio} />
            <input type="hidden" name="recommended" value={String(result.recommended)} />
          </form>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-zinc-950">Historial reciente de propuestas</h2>
              <p className="mt-1 text-sm text-zinc-500">Escenarios comerciales guardados por cliente para seguimiento y renegociación.</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2">Cliente</th>
                  <th className="py-2">Plan</th>
                  <th className="py-2">Fee mensual</th>
                  <th className="py-2">Contrato</th>
                  <th className="py-2">Origen</th>
                  <th className="py-2">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {proposalHistory.map((proposal) => (
                  <tr key={proposal.id}>
                    <td className="py-3 font-semibold">{proposal.clientName}</td>
                    <td className="py-3">{planLabels[proposal.plan]}</td>
                    <td className="py-3">{formatMoney(proposal.monthlyFee)}</td>
                    <td className="py-3">{formatMoney(proposal.totalContractValue)}</td>
                    <td className="py-3">
                      <Badge className={proposal.source === "template" ? "bg-brand-light text-brand-dark" : "bg-zinc-100 text-zinc-700"}>
                        {proposal.source === "template" ? "Plantilla" : "Manual"}
                      </Badge>
                    </td>
                    <td className="py-3">{new Date(proposal.createdAt).toLocaleDateString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-zinc-950">Tabla base de planes</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2">Plan</th>
                  <th className="py-2">Fee fijo</th>
                  <th className="py-2">Comisión crecimiento</th>
                  <th className="py-2">Facturación mínima sugerida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {(Object.entries(pricingPlans) as Array<[Plan, (typeof pricingPlans)[Plan]]>).map(([key, config]) => (
                  <tr key={key}>
                    <td className="py-3 font-semibold">{planLabels[key]}</td>
                    <td className="py-3">{formatMoney(config.fixedFee)}</td>
                    <td className="py-3">{formatPct(config.growthCommissionPct)}</td>
                    <td className="py-3">{formatMoney(config.minRecommendedRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function MoneyField({ label, name, value }: { label: string; name: string; value: number }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-zinc-700">{label}</span>
      <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name={name} type="number" min="0" step="1000" defaultValue={value} />
    </label>
  );
}

function NumberField({ label, name, value }: { label: string; name: string; value: number }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-zinc-700">{label}</span>
      <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name={name} type="number" min="0" step="0.1" defaultValue={value} />
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-component border border-black/10 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-bold text-zinc-950">{value}</div>
    </div>
  );
}

function OutcomeRow({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-component border border-black/10 p-3">
      <span className="text-sm text-zinc-600">{label}</span>
      <span className={positive ? "font-bold text-[#27500A]" : "font-bold text-[#791F1F]"}>{value}</span>
    </div>
  );
}
