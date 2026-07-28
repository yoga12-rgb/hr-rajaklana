import { expect, test } from "@playwright/test";

test("endpoint retensi internal menolak request tanpa bearer secret", async ({
  request,
}) => {
  const response = await request.get("/api/internal/attendance-retention", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(401);
  expect(response.headers().location).toBeUndefined();
  await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
});
