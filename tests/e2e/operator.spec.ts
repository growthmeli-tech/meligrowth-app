import { expect, test } from "@playwright/test";
import path from "node:path";

test("operator can inspect portfolio and create a diagnostic in demo mode", async ({ page }) => {
  await page.goto("/operator/dashboard");

  await expect(page.getByRole("heading", { name: "Cartera de clientes" })).toBeVisible();
  await expect(page.getByText("Tienda Pampa")).toBeVisible();
  await expect(page.getByText("Score promedio cartera")).toBeVisible();
  await page.getByPlaceholder("Buscar cliente o Seller ID").fill("Pampa");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/q=Pampa/);
  await expect(page.getByRole("link", { name: "Acciones" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Archivos" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Config" }).first()).toBeVisible();

  await page.goto("/operator/dashboard");
  await page.locator('select[name="operator"]').selectOption("op-2");
  await page.locator('select[name="plan"]').selectOption("scale");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/operator=op-2/);
  await expect(page).toHaveURL(/plan=scale/);
  await expect(page.getByText("Electro Norte")).toBeVisible();
  await expect(page.getByText("Tienda Pampa")).not.toBeVisible();

  await page.goto("/operator/dashboard");
  await page.locator('select[name="onboarding"]').selectOption("sin_acceso");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/onboarding=sin_acceso/);
  await expect(page.getByText("Electro Norte")).toBeVisible();
  await expect(page.getByText("Casa Oliva")).toBeVisible();
  await expect(page.getByText("Tienda Pampa")).not.toBeVisible();

  await page.goto("/operator/dashboard");
  await page.locator('select[name="estado"]').selectOption("sin_diagnostico");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page).toHaveURL(/estado=sin_diagnostico/);
  await expect(page.getByText("No hay clientes para esos filtros.")).toBeVisible();

  await page.getByRole("link", { name: "Ver alertas" }).click();
  await expect(page).toHaveURL(/\/operator\/notifications\?estado=sin_leer&tipo=todas/);

  await page.goto("/operator/dashboard?q=Pampa");
  await page.getByText("Tienda Pampa").click();
  await expect(page.getByRole("heading", { name: "Tienda Pampa" })).toBeVisible();
  await expect(page.getByText("Decisión de la semana")).toBeVisible();

  await page.goto("/operator/clients/c-1/diagnostic/new");
  await expect(page.getByRole("heading", { name: "Nuevo diagnóstico" })).toBeVisible();

  await page.getByLabel("Reclamos").fill("1.4");
  await page.getByLabel("Envíos a tiempo").fill("96");
  await page.getByRole("button", { name: "03 Ads" }).click();
  await page.getByRole("spinbutton", { name: "ACOS", exact: true }).fill("12");
  await page.getByRole("button", { name: "Guardar diagnóstico" }).click();

  await expect(page).toHaveURL(/\/operator\/clients\/c-1\?tab=diagnostico/);
  await expect(page.getByText("Score global")).toBeVisible();
});

test("operator can view parsed data preview and notifications", async ({ page }) => {
  await page.goto("/operator/clients/c-1/files");

  await expect(page.getByRole("heading", { name: "Archivos del cliente" })).toBeVisible();
  await expect(page.getByText("Carga asistida por operador")).toBeVisible();
  await expect(page.getByText("Vista previa extraída")).toBeVisible();
  await expect(page.getByRole("heading", { name: "SKUs y stock", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Márgenes", exact: true })).toBeVisible();
  await page.setInputFiles('input[name="file"]', path.join(process.cwd(), "tests", "fixtures", "skus_stock.csv"));
  await page.getByRole("button", { name: "Subir archivo" }).click();
  await expect(page).toHaveURL(/uploaded=uploaded/);

  await page.goto("/operator/notifications");
  await expect(page.getByRole("heading", { name: "Notificaciones" })).toBeVisible();
  await expect(page.getByText("Archivo procesado")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sin leer", exact: true })).toBeVisible();

  await page.goto("/operator/settings");
  await expect(page.getByRole("heading", { name: "Configuración general" })).toBeVisible();
  await expect(page.getByText("Variables configuradas")).toBeVisible();
  await expect(page.getByText("Core Supabase")).toBeVisible();
});
