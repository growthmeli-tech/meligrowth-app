import { redirect } from "next/navigation";
import {
  CLIENT_PARSED_DATA_PREVIEW_LIMIT,
  DEFAULT_PRICING_TEMPLATE_LIMIT
} from "@/lib/config/constants";
import { getCurrentProfile } from "@/lib/data/clients";
import { clients as mockClients } from "@/lib/mock-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PricingTemplateFile } from "@/lib/types";

function isPricingTemplateFilename(filename: string) {
  const normalized = filename.toLowerCase();
  return (
    (normalized.endsWith(".csv") || normalized.endsWith(".xlsx")) &&
    (normalized.includes("pricing") ||
      normalized.includes("precio") ||
      normalized.includes("comercial") ||
      normalized.includes("propuesta") ||
      normalized.includes("cotizacion"))
  );
}

export async function getParsedDataPreview(clientId: string) {
  if (!isSupabaseConfigured()) {
    return {
      products: [
        { sku: "MLA-1002", stock: 24, title: "Producto demo", updatedAt: new Date().toISOString() },
        { sku: "MLA-1048", stock: 18, title: "Producto demo 2", updatedAt: new Date().toISOString() }
      ],
      margins: [
        { sku: "MLA-1002", costo: 12000, precio: 18500, margen: 35 },
        { sku: "MLA-1048", costo: 9000, precio: 14000, margen: 36 }
      ],
      specs: [{ sku: "MLA-1002", titulo: "Producto demo", descripcion: "Ficha normalizada", attributes: {} }]
    };
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const [{ data: products }, { data: margins }, { data: specs }] = await Promise.all([
    supabase
      .from("products")
      .select("sku, stock, title, updated_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(CLIENT_PARSED_DATA_PREVIEW_LIMIT),
    supabase
      .from("margins")
      .select("sku, costo, precio, margen")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(CLIENT_PARSED_DATA_PREVIEW_LIMIT),
    supabase
      .from("product_specs")
      .select("sku, titulo, descripcion, attributes")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(CLIENT_PARSED_DATA_PREVIEW_LIMIT)
  ]);

  return {
    products: (products ?? []).map((row) => ({
      sku: row.sku,
      stock: row.stock,
      title: row.title,
      updatedAt: row.updated_at
    })),
    margins: (margins ?? []).map((row) => ({
      sku: row.sku,
      costo: row.costo,
      precio: row.precio,
      margen: row.margen
    })),
    specs: (specs ?? []).map((row) => ({
      sku: row.sku,
      titulo: row.titulo,
      descripcion: row.descripcion,
      attributes: row.attributes
    }))
  };
}

export async function getPricingTemplateFiles(limit = DEFAULT_PRICING_TEMPLATE_LIMIT) {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: "f-pricing-demo",
        clientId: "c-1",
        clientName: "Tienda Pampa",
        filename: "pricing_comercial_tienda_pampa.xlsx",
        createdAt: new Date().toISOString()
      }
    ] satisfies PricingTemplateFile[];
  }

  const profile = await getCurrentProfile();
  if (profile.role !== "operator") redirect("/client/dashboard");

  const supabase = await createServerSupabaseClient();
  const [{ data: fileRows }, { data: clientRows }] = await Promise.all([
    supabase
      .from("client_files")
      .select("id, client_id, filename, created_at")
      .order("created_at", { ascending: false })
      .limit(limit * 4),
    supabase.from("clients").select("id, name")
  ]);

  const clientNames = new Map((clientRows ?? []).map((row) => [row.id, row.name]));

  return (fileRows ?? [])
    .filter((row) => isPricingTemplateFilename(row.filename))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      clientId: row.client_id,
      clientName: clientNames.get(row.client_id) ?? mockClients[0].name,
      filename: row.filename,
      createdAt: row.created_at
    })) satisfies PricingTemplateFile[];
}
