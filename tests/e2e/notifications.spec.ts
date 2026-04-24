import { expect, test } from "@playwright/test";

test("operator notification filters work by status and type", async ({ page }) => {
  await page.goto("/operator/notifications");
  const main = page.getByRole("main");

  await expect(page.getByRole("heading", { name: "Notificaciones" })).toBeVisible();
  await expect(page.getByText("Archivo procesado")).toBeVisible();
  await expect(page.getByText("Caída fuerte de score")).toBeVisible();
  await expect(page.getByText("Cuenta en estado crítico")).toBeVisible();

  await main.getByRole("link", { name: "Sin leer", exact: true }).click();
  await expect(page).toHaveURL(/estado=sin_leer/);
  await expect(page.getByText("Archivo procesado")).toBeVisible();
  await expect(page.getByText("Caída fuerte de score")).toBeVisible();
  await expect(page.getByText("Cuenta en estado crítico")).not.toBeVisible();

  await main.getByRole("link", { name: "Críticas", exact: true }).click();
  await expect(page).toHaveURL(/tipo=alerta_critica/);
  await expect(page.getByText("No hay notificaciones para este filtro.")).toBeVisible();

  await main.getByRole("link", { name: "Todas", exact: true }).click();
  await expect(page).toHaveURL(/estado=todas/);
  await expect(page.getByText("Cuenta en estado crítico")).toBeVisible();

  await main.getByRole("link", { name: "Score", exact: true }).click();
  await expect(page).toHaveURL(/tipo=score_bajo/);
  await expect(page.getByText("Caída fuerte de score")).toBeVisible();
  await expect(page.getByText("Archivo procesado")).not.toBeVisible();

  await main.getByRole("link", { name: "Archivos", exact: true }).click();
  await expect(page).toHaveURL(/tipo=archivo_procesado/);
  await expect(page.getByText("Archivo procesado")).toBeVisible();
  await expect(page.getByText("Caída fuerte de score")).not.toBeVisible();
});
