import { expect, test } from "@playwright/test";

test("login form redirects to operator dashboard in demo mode", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByAltText("MeliGrowth")).toBeVisible();
  await page.getByPlaceholder("Email").fill("luciano@meligrowth.com");
  await page.getByPlaceholder("Password").fill("demo-password");
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL(/\/operator\/dashboard/);
  await expect(page.getByRole("heading", { name: "Cartera de clientes" })).toBeVisible();
});
