import { generateActions } from "@/lib/actions-engine";
import { scoreDiagnostic } from "@/lib/scoring";
import { calculatePricing } from "@/lib/pricing";
import type { Client, ClientFile, Diagnostic, DiagnosticInput, MeliSession, PricingProposal, User } from "@/lib/types";

export const users: User[] = [
  { id: "op-1", email: "luciano@meligrowth.com", role: "operator", name: "Luciano" },
  { id: "op-2", email: "ops@meligrowth.com", role: "operator", name: "Equipo Ops" },
  { id: "cl-1", email: "cliente@tiendapampa.com", role: "client", name: "Tienda Pampa" }
];

export const clients: Client[] = [
  {
    id: "c-1",
    name: "Tienda Pampa",
    initials: "TP",
    plan: "growth",
    operatorId: "op-1",
    clientUserId: "cl-1",
    meliAccountUrl: "https://www.mercadolibre.com.ar/perfil/TIENDA-PAMPA",
    meliSellerId: "1849201",
    active: true,
    lastUpdatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString()
  },
  {
    id: "c-2",
    name: "Electro Norte",
    initials: "EN",
    plan: "scale",
    operatorId: "op-2",
    meliAccountUrl: "https://www.mercadolibre.com.ar/perfil/ELECTRO-NORTE",
    meliSellerId: "7788122",
    active: true,
    lastUpdatedAt: new Date(Date.now() - 9 * 86_400_000).toISOString()
  },
  {
    id: "c-3",
    name: "Casa Oliva",
    initials: "CO",
    plan: "starter",
    operatorId: "op-1",
    meliAccountUrl: "https://www.mercadolibre.com.ar/perfil/CASA-OLIVA",
    meliSellerId: "4411982",
    active: true,
    lastUpdatedAt: new Date(Date.now() - 5 * 86_400_000).toISOString()
  }
];

const inputs: Array<{ clientId: string; input: DiagnosticInput; source: Diagnostic["source"] }> = [
  {
    clientId: "c-1",
    source: "manual",
    input: {
      salud: { reclamos: 1.2, mediaciones: 0.4, cancelaciones_vendedor: 0.8, envios_a_tiempo: 96 },
      publicaciones: { pubs_activas_pct: 88, pubs_optimizadas_pct: 82, ctr: 3.1 },
      ads: { margen_pre_ads: 34, gasto_ads: 760000, ventas_ads: 6200000, ventas_totales: 14300000, acos: 12.3, roas: 8.1, tacos: 5.3 },
      logistica: { incidencias_pct: 2.2, uso_full_flex_pct: 73, cancelaciones_stock_pct: 1.1 },
      stock: { skus_sin_stock_pct: 8, dias_stock: 28, lead_time_reposicion: 6, sistema_reposicion: 78 }
    }
  },
  {
    clientId: "c-2",
    source: "scraping",
    input: {
      salud: { reclamos: 4.8, mediaciones: 1.8, cancelaciones_vendedor: 3.7, envios_a_tiempo: 82 },
      publicaciones: { pubs_activas_pct: 69, pubs_optimizadas_pct: 58, ctr: 1.4 },
      ads: { margen_pre_ads: 27, gasto_ads: 1280000, ventas_ads: 4100000, ventas_totales: 9900000, acos: 31.2, roas: 3.2, tacos: 12.9 },
      logistica: { incidencias_pct: 6.2, uso_full_flex_pct: 38, cancelaciones_stock_pct: 3.9 },
      stock: { skus_sin_stock_pct: 19, dias_stock: 12, lead_time_reposicion: 18, sistema_reposicion: 42 }
    }
  },
  {
    clientId: "c-3",
    source: "import",
    input: {
      salud: { reclamos: 0.3, mediaciones: 0.1, cancelaciones_vendedor: 0.4, envios_a_tiempo: 98.7 },
      publicaciones: { pubs_activas_pct: 92, pubs_optimizadas_pct: 87, ctr: 3.8 },
      ads: { margen_pre_ads: 41, gasto_ads: 210000, ventas_ads: 2800000, ventas_totales: 7200000, acos: 7.5, roas: 13.3, tacos: 2.9 },
      logistica: { incidencias_pct: 0.8, uso_full_flex_pct: 82, cancelaciones_stock_pct: 0.4 },
      stock: { skus_sin_stock_pct: 4, dias_stock: 34, lead_time_reposicion: 4, sistema_reposicion: 86 }
    }
  }
];

export const diagnostics: Diagnostic[] = inputs.map(({ clientId, input, source }, index) => {
  const scored = scoreDiagnostic(input);
  return {
    id: `d-${index + 1}`,
    clientId,
    date: clients.find((client) => client.id === clientId)?.lastUpdatedAt ?? new Date().toISOString(),
    ...input,
    scoreGlobal: scored.scoreGlobal,
    estadoGlobal: scored.estadoGlobal,
    scores: scored.scores,
    source
  };
});

export const actions = diagnostics.flatMap(generateActions).concat([
  {
    id: "a-manual-1",
    clientId: "c-1",
    bloque: "publicaciones",
    titulo: "Actualizar fichas de top 20 SKUs",
    descripcion: "Completar atributos y mejorar imágenes de productos con mayor tráfico.",
    prioridad: "media",
    estado: "en_curso",
    responsable: "Equipo Ops",
    dueDate: new Date(Date.now() + 4 * 86_400_000).toISOString()
  }
]);

export const files: ClientFile[] = [
  { id: "f-1", clientId: "c-1", tipo: "skus_stock", filename: "stock_tienda_pampa.xlsx", sizeBytes: 286_120, procesado: true, createdAt: new Date(Date.now() - 1 * 86_400_000).toISOString() },
  { id: "f-2", clientId: "c-2", tipo: "margenes", filename: "margenes_q2.csv", sizeBytes: 94_230, procesado: false, errorProcesamiento: "Falta columna margen_pre_ads", createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  { id: "f-3", clientId: "c-3", tipo: "ficha_tecnica", filename: "fichas_productos.ods", sizeBytes: 519_004, procesado: true, createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString() }
];

export const scoreHistory = clients.flatMap((client) => {
  const diagnostic = diagnostics.find((item) => item.clientId === client.id)!;
  return [5, 4, 3, 2, 1, 0].map((monthsAgo) => {
    const date = new Date();
    date.setMonth(date.getMonth() - monthsAgo);
    const drift = monthsAgo * (client.id === "c-2" ? 3 : -1);
    return {
      clientId: client.id,
      date: date.toISOString().slice(0, 10),
      scoreGlobal: Math.max(30, Math.min(99, diagnostic.scoreGlobal + drift)),
      salud: Math.max(30, diagnostic.scores.salud + drift),
      publicaciones: Math.max(30, diagnostic.scores.publicaciones + drift),
      ads: Math.max(30, diagnostic.scores.ads + drift),
      logistica: Math.max(30, diagnostic.scores.logistica + drift),
      stock: Math.max(30, diagnostic.scores.stock + drift)
    };
  });
});

export const pricingProposals: PricingProposal[] = [
  {
    id: "pp-1",
    clientId: "c-1",
    clientName: "Tienda Pampa",
    createdBy: "op-1",
    source: "template",
    notes: "Escenario base importado desde plantilla comercial.",
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    ...(() => {
      const input = {
        plan: "growth" as const,
        currentRevenue: 8_000_000,
        projectedRevenue: 11_500_000,
        grossMarginPct: 32,
        deliveryCost: 280_000,
        setupFee: 100_000,
        months: 6
      };
      return { ...input, ...calculatePricing(input) };
    })()
  },
  {
    id: "pp-2",
    clientId: "c-2",
    clientName: "Electro Norte",
    createdBy: "op-2",
    source: "manual",
    notes: "Escenario de revisión para renegociar fee.",
    createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    ...(() => {
      const input = {
        plan: "scale" as const,
        currentRevenue: 18_000_000,
        projectedRevenue: 26_000_000,
        grossMarginPct: 34,
        deliveryCost: 420_000,
        setupFee: 250_000,
        months: 6
      };
      return { ...input, ...calculatePricing(input) };
    })()
  }
];

export const meliSessions: MeliSession[] = [
  {
    id: "ms-1",
    clientId: "c-1",
    sellerId: "1849201",
    storagePath: "c-1/1849201-session.json",
    status: "validated",
    source: "upload",
    lastValidatedAt: new Date(Date.now() - 1 * 86_400_000).toISOString(),
    warnings: [],
    createdAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 86_400_000).toISOString()
  },
  {
    id: "ms-2",
    clientId: "c-2",
    sellerId: "7788122",
    storagePath: "c-2/7788122-session.json",
    status: "error",
    source: "upload",
    lastError: "La sesión venció y requiere volver a autenticarse.",
    warnings: ["captcha_detected"],
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString()
  }
];

export function getClientBundle(clientId: string) {
  const client = clients.find((item) => item.id === clientId) ?? clients[0];
  const diagnostic = diagnostics.find((item) => item.clientId === client.id) ?? diagnostics[0];
  const operator = users.find((user) => user.id === client.operatorId);
  return {
    client,
    diagnostic,
    operator,
    actions: actions.filter((item) => item.clientId === client.id),
    files: files.filter((item) => item.clientId === client.id),
    history: scoreHistory.filter((item) => item.clientId === client.id)
  };
}
