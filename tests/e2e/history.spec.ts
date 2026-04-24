import { expect, test } from "@playwright/test";

test("operator can inspect score evolution ranges and action backlog", async ({ page }) => {
  await page.goto("/operator/clients/c-1?tab=evolucion&period=3");

  await expect(page.getByRole("heading", { name: "Tienda Pampa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Score global" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Bloques: anterior vs actual" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Historial de diagnósticos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "3m" })).toHaveClass(/bg-brand-light/);

  await page.getByRole("link", { name: "12m" }).click();
  await expect(page).toHaveURL(/period=12/);
  await expect(page.getByRole("link", { name: "12m" })).toHaveClass(/bg-brand-light/);

  await page.getByRole("link", { name: "Acciones" }).click();
  await expect(page).toHaveURL(/tab=acciones/);
  await expect(page.getByRole("heading", { name: "Nueva acción" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Backlog operativo" })).toBeVisible();
  await expect(page.getByText(/Responsable:/).first()).toBeVisible();
});

test("client can inspect metric history and previous-period comparison", async ({ page }) => {
  await page.goto("/client/metrics?period=3");

  await expect(page.getByRole("heading", { name: "Mis métricas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evolución" })).toBeVisible();
  await expect(page.getByText(/Último cambio|Sin período anterior/)).toBeVisible();
  await expect(page.getByRole("link", { name: "3m" })).toHaveClass(/bg-brand-light/);
  await expect(page.getByText(/Anterior:/).first()).toBeVisible();
  await expect(page.getByText(/Actual:/).first()).toBeVisible();

  await page.getByRole("link", { name: "12m" }).click();
  await expect(page).toHaveURL(/period=12/);
  await expect(page.getByRole("link", { name: "12m" })).toHaveClass(/bg-brand-light/);
});
