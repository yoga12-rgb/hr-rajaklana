import { expect, test } from "@playwright/test";

test("form login berada di tengah viewport", async ({ page }) => {
  await page.goto("/login");

  const heading = page.getByRole("heading", { name: "Masuk HR Rajaklana" });
  await expect(heading).toBeVisible();

  const section = page.locator("main > section");
  await expect(section).toBeVisible();
  const sectionBox = await section.boundingBox();
  const viewport = page.viewportSize();

  expect(sectionBox).not.toBeNull();
  expect(viewport).not.toBeNull();

  if (!sectionBox || !viewport) {
    return;
  }

  const sectionCenter = sectionBox.x + sectionBox.width / 2;
  const viewportCenter = viewport.width / 2;

  expect(Math.abs(sectionCenter - viewportCenter)).toBeLessThanOrEqual(2);
});
