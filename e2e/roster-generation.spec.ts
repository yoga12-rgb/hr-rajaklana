import { expect, test } from "@playwright/test";

test("endpoint generator roster menolak bulan yang bukan tanggal pertama", async ({
  request,
}) => {
  const response = await request.post("/api/roster/generate", {
    data: { monthStart: "2026-07-15" },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Bulan roster wajib memakai tanggal pertama bulan.",
  });
});
