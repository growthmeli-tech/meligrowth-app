import { expect, test } from "@playwright/test";
import path from "node:path";

test("client can view dashboard and upload a supported template in demo mode", async ({ page }) => {
  await page.goto("/client/dashboard");

  await expect(page.getByRole("heading", { name: /Tu cuenta/ })).toBeVisible();
  await expect(page.getByText("Lo que está pasando esta semana")).toBeVisible();

  await page.goto("/client/files");
  await expect(page.getByRole("heading", { name: "Subir archivos" })).toBeVisible();
  await expect(page.getByText("Planilla 1: SKUs y Stock")).toBeVisible();
  await expect(page.getByText("Planilla 2: Márgenes y Costos")).toBeVisible();
  await expect(page.getByText("Planilla 3: Ficha Técnica")).toBeVisible();
  await expect(page.getByText("Planilla 4: Pricing Comercial")).toBeVisible();
  await expect(page.getByRole("link", { name: "Descargar SKUs y Stock" })).toHaveAttribute("href", "/templates/skus-stock.csv");
  await expect(page.getByRole("link", { name: "Descargar Márgenes y Costos" })).toHaveAttribute("href", "/templates/margenes-costos.csv");
  await expect(page.getByRole("link", { name: "Descargar Ficha Técnica" })).toHaveAttribute("href", "/templates/ficha-tecnica.csv");
  await expect(page.getByRole("link", { name: "Descargar Pricing Comercial" })).toHaveAttribute("href", "/templates/pricing-calculadora.xlsx");

  await page.setInputFiles('input[name="file"]', path.join(process.cwd(), "tests", "fixtures", "skus_stock.csv"));
  await page.getByRole("button", { name: "Subir archivo" }).click();

  await expect(page).toHaveURL(/\/client\/files\?uploaded=1/);
  await expect(page.getByText("Archivo subido. Quedó pendiente de procesamiento.")).toBeVisible();
});
