import { expect, test } from "@playwright/test";

test("diagnostic form exposes every scoring block and persists recommended actions", async ({ page }) => {
  await page.goto("/operator/clients/c-1/diagnostic/new");

  await expect(page.getByRole("heading", { name: "Nuevo diagnóstico" })).toBeVisible();
  for (const section of ["01 Salud", "02 Publicaciones", "03 Ads", "04 Logística", "05 Stock"]) {
    await expect(page.getByRole("button", { name: section })).toBeVisible();
  }

  await expect(page.getByRole("heading", { name: "Preview final" })).toBeVisible();
  await page.getByLabel("Reclamos").fill("5");
  await page.getByLabel("Envíos a tiempo").fill("82");
  await page.getByRole("button", { name: "03 Ads" }).click();
  await page.getByRole("spinbutton", { name: "ACOS", exact: true }).fill("35");
  await page.getByRole("button", { name: "04 Logística" }).click();
  await page.getByRole("spinbutton", { name: "Uso Full/Flex" }).fill("35");
  await page.getByRole("button", { name: "Guardar diagnóstico" }).click();

  await expect(page).toHaveURL(/\/operator\/clients\/c-1\?tab=diagnostico/);
  await expect(page.getByText("Score global")).toBeVisible();
  await expect(page.getByText(/Envíos a tiempo críticos|ACOS crítico|Aumentar Full\/Flex/)).toBeVisible();
});
