import { expect, test } from "@playwright/test";

test("operator can create, filter and complete actions in demo mode", async ({ page }) => {
  await page.goto("/operator/clients/c-1?tab=acciones");

  await expect(page.getByRole("heading", { name: "Nueva acción" })).toBeVisible();
  await page.getByLabel("Título").fill("Revisar pricing de top SKUs");
  await page.getByLabel("Descripción").fill("Validar margen y oportunidad de crecimiento antes de ajustar campañas.");
  await page.getByLabel("Bloque").selectOption("ads");
  await page.getByLabel("Prioridad").selectOption("urgente");
  await page.getByRole("button", { name: "Crear acción" }).click();

  await expect(page).toHaveURL(/created=1/);
  await expect(page.getByText("Acción creada correctamente.")).toBeVisible();

  await page.getByRole("link", { name: "Urgentes" }).click();
  await expect(page).toHaveURL(/prioridad=urgente/);
  await expect(page.getByRole("heading", { name: "Backlog operativo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Altas" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Medias" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Completadas" })).toBeVisible();

  await page.getByRole("button", { name: "Completar" }).first().click();
  await expect(page).toHaveURL(/completed=1/);
  await expect(page.getByText("Acción marcada como completada.")).toBeVisible();

  await page.getByRole("link", { name: "Completadas" }).click();
  await expect(page).toHaveURL(/estado=completada/);
});
