import { expect, test } from "@playwright/test";
import path from "node:path";

test("operator can edit client settings in demo mode", async ({ page }) => {
  await page.goto("/operator/clients/c-1");

  await page.getByRole("button", { name: "Configuración" }).click();
  await expect(page).toHaveURL(/\/operator\/clients\/c-1\/settings/);
  await expect(page.getByRole("heading", { name: "Configuración de cliente" })).toBeVisible();

  await page.getByLabel("Nombre del cliente").fill("Tienda Pampa Demo");
  await page.getByLabel("Plan").selectOption("scale");
  await page.getByLabel("Email usuario cliente").fill("cliente@tiendapampa.com");
  await page.getByLabel("Usuario cliente vinculado").selectOption("cl-1");
  await page.getByLabel("Seller ID").fill("1849201");
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(page).toHaveURL(/saved=1/);
  await expect(page.getByText("Cliente actualizado correctamente.")).toBeVisible();
  await expect(page.getByText("Sesión Mercado Libre")).toBeVisible();
  await page.setInputFiles('input[name="file"]', path.join(process.cwd(), "tests", "fixtures", "meli_session.json"));
  await page.getByRole("button", { name: "Subir sesión JSON" }).click();
  await expect(page).toHaveURL(/session_saved=1/);
  await expect(page.getByText("Sesión Mercado Libre subida correctamente.")).toBeVisible();
});
