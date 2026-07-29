import { expect, test } from "@playwright/test";

test("endpoint ekspor laporan menolak sesi anonim", async ({ request }) => {
  const response = await request.post("/api/reports/exports", {
    data: {
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31",
      requestKey: "a7000000-0000-0000-0000-000000000099",
    },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: "Sesi habis. Silakan login ulang.",
  });
});
