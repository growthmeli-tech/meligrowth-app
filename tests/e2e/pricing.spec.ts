import { expect, test } from "@playwright/test";
import path from "node:path";

test("operator can simulate a pricing proposal", async ({ page }) => {
  await page.goto("/operator/pricing");

  await expect(page.getByRole("heading", { name: "Calculadora de precios" })).toBeVisible();
  await expect(page.getByText("Precio mensual sugerido")).toBeVisible();
  await expect(page.getByRole("link", { name: "Descargar XLSX" })).toHaveAttribute("href", "/templates/pricing-calculadora.xlsx");

  await page.getByLabel("Plan").selectOption("scale");
  await page.getByLabel("Facturación actual mensual").fill("18000000");
  await page.getByLabel("Facturación proyectada mensual").fill("26000000");
  await page.getByLabel("Margen bruto cliente %").fill("34");
  await page.getByLabel("Costo operativo MeliGrowth").fill("420000");
  await page.getByLabel("Setup inicial").fill("250000");
  await page.getByRole("button", { name: "Calcular escenario" }).click();

  await expect(page).toHaveURL(/plan=scale/);
  await expect(page.getByText("Recomendado")).toBeVisible();
  await expect(page.getByText("Valor contrato estimado")).toBeVisible();
  await expect(page.getByText("Resultado MeliGrowth")).toBeVisible();
  await expect(page.getByText("Comparación por plan")).toBeVisible();
  await expect(page.getByText("Señales comerciales")).toBeVisible();
  await expect(page.getByText("Resumen para propuesta")).toBeVisible();
  await expect(page.getByText("Historial reciente de propuestas")).toBeVisible();
  await expect(page.getByText("Importar desde archivos del cliente")).toBeVisible();

  await page.setInputFiles('input[name="file"]', path.join(process.cwd(), "tests", "fixtures", "pricing_calculadora.csv"));
  await page.getByRole("button", { name: "Importar plantilla" }).click();

  await expect(page).toHaveURL(/imported=1/);
  await expect(page).toHaveURL(/plan=starter/);
  await expect(page.getByText("Plantilla importada correctamente.")).toBeVisible();
  await expect(page.getByText(/Plan Starter con fee mensual/)).toBeVisible();

  await page.getByLabel("Guardar para cliente").selectOption("c-1");
  await page.getByLabel("Notas internas").fill("Propuesta importada desde plantilla del cliente");
  await page.getByRole("button", { name: "Guardar propuesta" }).click();

  await expect(page).toHaveURL(/saved=1/);
  await expect(page.getByText("Propuesta comercial guardada correctamente.")).toBeVisible();

  await page.goto("/operator/pricing");
  await page.getByLabel("Archivo disponible").selectOption("f-pricing-demo");
  await page.getByRole("button", { name: "Importar desde Storage" }).click();
  await expect(page).toHaveURL(/imported=1/);
  await expect(page).toHaveURL(/importedFrom=storage/);
  await expect(page.getByText("Plantilla importada desde archivos del cliente.")).toBeVisible();
});
