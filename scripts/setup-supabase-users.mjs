import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUDIT_OPERATOR_EMAIL",
  "AUDIT_OPERATOR_PASSWORD",
  "AUDIT_CLIENT_EMAIL",
  "AUDIT_CLIENT_PASSWORD"
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env: ${key}`);
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const OPERATOR_NAME = "Operador MeliGrowth";
const CLIENT_NAME = "Cliente Demo";
const CLIENT_ACCOUNT_NAME = "Cuenta Demo Supabase";
const CLIENT_ID = "11111111-1111-1111-1111-111111111111";
const DIAGNOSTIC_ID = "22222222-2222-2222-2222-222222222222";
const ACTION_ID = "33333333-3333-3333-3333-333333333333";
const NOTIFICATION_OPERATOR_ID = "44444444-4444-4444-4444-444444444444";
const NOTIFICATION_CLIENT_ID = "55555555-5555-5555-5555-555555555555";
const HISTORY_ID = "66666666-6666-6666-6666-666666666666";
const FILE_PRICING_ID = "77777777-7777-7777-7777-777777777777";
const FILE_STOCK_ID = "88888888-8888-8888-8888-888888888888";

function initials(value) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

async function ensureAuthUser({ email, password, name }) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  if (listError) {
    throw new Error(listError.message);
  }

  const existing = list.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);

  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email: normalizedEmail,
      email_confirm: true,
      user_metadata: { name }
    });
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: { name }
  });

  if (error?.message?.includes("already been registered")) {
    const { data: retriedList, error: retriedListError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });
    if (retriedListError) {
      throw new Error(retriedListError.message);
    }

    const retriedExisting = retriedList.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (retriedExisting) {
      await supabase.auth.admin.updateUserById(retriedExisting.id, {
        password,
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { name }
      });
      return retriedExisting.id;
    }
  }

  if (error || !data.user) {
    throw new Error(error?.message ?? `Could not create auth user ${email}`);
  }

  return data.user.id;
}

async function main() {
  const operatorId = await ensureAuthUser({
    email: process.env.AUDIT_OPERATOR_EMAIL,
    password: process.env.AUDIT_OPERATOR_PASSWORD,
    name: OPERATOR_NAME
  });

  const clientUserId = await ensureAuthUser({
    email: process.env.AUDIT_CLIENT_EMAIL,
    password: process.env.AUDIT_CLIENT_PASSWORD,
    name: CLIENT_NAME
  });

  const { error: usersError } = await supabase.from("users").upsert(
    [
      {
        id: operatorId,
        email: process.env.AUDIT_OPERATOR_EMAIL.trim().toLowerCase(),
        name: OPERATOR_NAME,
        role: "operator"
      },
      {
        id: clientUserId,
        email: process.env.AUDIT_CLIENT_EMAIL.trim().toLowerCase(),
        name: CLIENT_NAME,
        role: "client"
      }
    ],
    { onConflict: "id" }
  );

  if (usersError) {
    throw new Error(usersError.message);
  }

  const { error: clientError } = await supabase.from("clients").upsert(
    {
      id: CLIENT_ID,
      name: CLIENT_ACCOUNT_NAME,
      initials: initials(CLIENT_ACCOUNT_NAME),
      plan: "growth",
      operator_id: operatorId,
      client_user_id: clientUserId,
      meli_account_url: "https://www.mercadolibre.com.ar",
      meli_seller_id: "SUPABASE-DEMO-001",
      active: true
    },
    { onConflict: "id" }
  );

  if (clientError) {
    throw new Error(clientError.message);
  }

  const { error: diagnosticError } = await supabase.from("diagnostics").upsert(
    {
      id: DIAGNOSTIC_ID,
      client_id: CLIENT_ID,
      date: "2026-04-23",
      score_global: 81,
      estado_global: "desarrollo",
      reclamos: 1.2,
      mediaciones: 0.3,
      cancelaciones_vendedor: 1.1,
      envios_a_tiempo: 97,
      score_salud: 84,
      pubs_activas_pct: 92,
      pubs_optimizadas_pct: 74,
      ctr: 2.8,
      score_publicaciones: 78,
      margen_pre_ads: 34,
      gasto_ads: 180000,
      ventas_ads: 820000,
      ventas_totales: 2100000,
      acos: 22,
      roas: 4.5,
      tacos: 8.6,
      score_ads: 80,
      incidencias_pct: 2.2,
      uso_full_flex_pct: 68,
      cancelaciones_stock_pct: 1.8,
      score_logistica: 76,
      skus_sin_stock_pct: 9,
      dias_stock: 24,
      lead_time_reposicion: 7,
      sistema_reposicion: 70,
      score_stock: 83,
      created_by: operatorId,
      source: "manual"
    },
    { onConflict: "id" }
  );

  if (diagnosticError) {
    throw new Error(diagnosticError.message);
  }

  const { error: historyError } = await supabase.from("score_history").upsert(
    {
      id: HISTORY_ID,
      client_id: CLIENT_ID,
      date: "2026-04-23",
      score_global: 81,
      score_salud: 84,
      score_pubs: 78,
      score_ads: 80,
      score_logistica: 76,
      score_stock: 83
    },
    { onConflict: "id" }
  );

  if (historyError) {
    throw new Error(historyError.message);
  }

  const { error: actionError } = await supabase.from("actions").upsert(
    {
      id: ACTION_ID,
      client_id: CLIENT_ID,
      created_by: operatorId,
      bloque: "ads",
      titulo: "Optimizar campañas de bajo ROAS",
      descripcion: "Pausar grupos con ROAS menor a 3 y revisar pujas por catálogo.",
      prioridad: "alta",
      estado: "pendiente",
      due_date: "2026-04-30"
    },
    { onConflict: "id" }
  );

  if (actionError) {
    throw new Error(actionError.message);
  }

  const { error: notificationError } = await supabase.from("notifications").upsert(
    [
      {
        id: NOTIFICATION_OPERATOR_ID,
        client_id: CLIENT_ID,
        user_id: operatorId,
        tipo: "archivo_procesado",
        titulo: "Entorno Supabase listo",
        mensaje: "Se configuraron las cuentas de auditoría y el cliente demo quedó vinculado.",
        leida: false
      },
      {
        id: NOTIFICATION_CLIENT_ID,
        client_id: CLIENT_ID,
        user_id: clientUserId,
        tipo: "reporte_semanal",
        titulo: "Cuenta demo inicializada",
        mensaje: "Tu dashboard ya está listo para revisión inicial.",
        leida: false
      }
    ],
    { onConflict: "id" }
  );

  if (notificationError) {
    throw new Error(notificationError.message);
  }

  const pricingTemplatePath = path.join(process.cwd(), "public", "templates", "pricing-calculadora.csv");
  const stockTemplatePath = path.join(process.cwd(), "public", "templates", "skus-stock.csv");
  const pricingStoragePath = `${CLIENT_ID}/seed-pricing-calculadora.csv`;
  const stockStoragePath = `${CLIENT_ID}/seed-skus-stock.csv`;

  const pricingTemplateBuffer = await readFile(pricingTemplatePath);
  const stockTemplateBuffer = await readFile(stockTemplatePath);

  await supabase.storage.from("client-files").upload(pricingStoragePath, pricingTemplateBuffer, {
    contentType: "text/csv",
    upsert: true
  });
  await supabase.storage.from("client-files").upload(stockStoragePath, stockTemplateBuffer, {
    contentType: "text/csv",
    upsert: true
  });

  const { error: fileError } = await supabase.from("client_files").upsert(
    [
      {
        id: FILE_PRICING_ID,
        client_id: CLIENT_ID,
        uploaded_by: operatorId,
        tipo: "otro",
        filename: "pricing_comercial_cliente_demo.csv",
        storage_path: pricingStoragePath,
        size_bytes: pricingTemplateBuffer.byteLength,
        procesado: false
      },
      {
        id: FILE_STOCK_ID,
        client_id: CLIENT_ID,
        uploaded_by: operatorId,
        tipo: "skus_stock",
        filename: "skus_stock_cliente_demo.csv",
        storage_path: stockStoragePath,
        size_bytes: stockTemplateBuffer.byteLength,
        procesado: false
      }
    ],
    { onConflict: "id" }
  );

  if (fileError) {
    throw new Error(fileError.message);
  }

  console.log(
    JSON.stringify(
      {
        operator: {
          email: process.env.AUDIT_OPERATOR_EMAIL,
          id: operatorId
        },
        client: {
          email: process.env.AUDIT_CLIENT_EMAIL,
          id: clientUserId
        },
        seededClientId: CLIENT_ID
      },
      null,
      2
    )
  );
}

await main();
