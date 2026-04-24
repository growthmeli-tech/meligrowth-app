import { expect, test } from "@playwright/test";

test("operator can start guided client onboarding in demo mode", async ({ page }) => {
  await page.goto("/operator/dashboard");

  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  await expect(page).toHaveURL(/\/operator\/clients\/new/);
  await expect(page.getByRole("heading", { name: "Nuevo cliente" })).toBeVisible();
  await expect(page.getByText("Alta guiada")).toBeVisible();
  await expect(page.getByText("Cuenta y plan")).toBeVisible();
  await expect(page.getByText("Primeras tareas")).toBeVisible();
  await expect(page.getByLabel("Vincular usuario cliente existente")).toBeVisible();

  await page.getByLabel("Nombre del cliente").fill("Demo Onboarding");
  await page.getByLabel("Plan").selectOption("scale");
  await page.getByLabel("Email de acceso cliente").fill("cliente@demo.com");
  await page.getByLabel("Vincular usuario cliente existente").selectOption("cl-1");
  await page.getByLabel("Seller ID").fill("123456");
  await page.getByRole("button", { name: "Crear cliente y seguir" }).click();

  await expect(page).toHaveURL(/\/operator\/clients\/c-1\/diagnostic\/new\?onboarding=demo/);
  await expect(page.getByRole("heading", { name: "Nuevo diagnóstico" })).toBeVisible();
});
