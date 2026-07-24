import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const demoStorageKey = "hr-rajaklana-demo-v1";

async function waitForPageTransition(page: import("@playwright/test").Page) {
  await expect(page.locator("main > div").first()).toHaveCSS("opacity", "1");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => {
    if (!window.sessionStorage.getItem("hr-e2e-initialized")) {
      window.localStorage.removeItem(storageKey);
      window.sessionStorage.setItem("hr-e2e-initialized", "true");
    }
  }, demoStorageKey);
});

test("navigasi inti dapat digunakan tanpa overflow halaman", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Halo, Admin HRD" })
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Presensi", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/attendance$/);
  await expect(
    page.getByRole("heading", { name: "Presensi & Kehadiran" })
  ).toBeVisible();

  const hasBodyOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(hasBodyOverflow).toBe(false);
});

test("data karyawan bertahan setelah reload dan dapat direset", async ({
  page,
}) => {
  const employeeName = "Nadia Uji Persistensi";

  await page.goto("/employees");
  await page.getByRole("button", { name: "Tambah", exact: true }).click();

  const addDialog = page.getByRole("dialog", { name: "Tambah Karyawan Baru" });
  await addDialog
    .getByPlaceholder("Contoh: Rahmat Hidayat")
    .fill(employeeName);
  await addDialog
    .getByPlaceholder("Contoh: Team Lead Operasional")
    .fill("Quality Assurance");
  await addDialog.getByPlaceholder("081234567890").fill("081200001234");
  await addDialog
    .getByPlaceholder("nama@perusahaan.com")
    .fill("nadia.qa@example.com");
  await addDialog.getByRole("button", { name: "Simpan Staf" }).click();

  await expect(
    page.getByRole("heading", { name: employeeName, exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: employeeName, exact: true })
  ).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Keamanan & Akses" }).click();
  await page
    .getByRole("button", { name: "Reset Semua Data Demo" })
    .click();
  const resetDialog = page.getByRole("dialog", { name: "Reset Data Demo" });
  await resetDialog.getByRole("button", { name: "Ya, Reset Data" }).click();

  await page.goto("/employees");
  await expect(page.getByText(employeeName)).toHaveCount(0);
});

test("presensi tanpa selfie mengikuti kebijakan demo yang tersimpan", async ({
  page,
}) => {
  await page.addInitScript((storageKey) => {
    if (!window.sessionStorage.getItem("hr-e2e-preferences-seeded")) {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          preferences: {
            requireSelfie: false,
            lateTolerance: 15,
            minOvertime: 1,
            defaultLeaveBalance: 12,
            advanceNoticeDays: 0,
            notificationsEnabled: true,
          },
        })
      );
      window.sessionStorage.setItem("hr-e2e-preferences-seeded", "true");
    }
  }, demoStorageKey);

  await page.goto("/attendance");
  await page.getByRole("button", { name: "Absen Masuk (Clock In)" }).click();
  const attendanceDialog = page.getByRole("dialog", {
    name: "Form Presensi Masuk",
  });
  await expect(
    attendanceDialog.getByText("(Opsional)", { exact: true })
  ).toBeVisible();
  await attendanceDialog
    .getByRole("button", { name: "Konfirmasi Absen" })
    .click();

  await expect(page.getByText(/Sudah Absen Masuk pukul/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Sudah Absen Masuk pukul/)).toBeVisible();
});

test("pengajuan cuti dan lembur tersimpan setelah reload", async ({ page }) => {
  await page.addInitScript((storageKey) => {
    if (!window.sessionStorage.getItem("hr-e2e-preferences-seeded")) {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          preferences: {
            requireSelfie: true,
            lateTolerance: 15,
            minOvertime: 1,
            defaultLeaveBalance: 12,
            advanceNoticeDays: 0,
            notificationsEnabled: true,
          },
        })
      );
      window.sessionStorage.setItem("hr-e2e-preferences-seeded", "true");
    }
  }, demoStorageKey);

  const leaveReason = "Pengujian persistensi cuti prototype";
  await page.goto("/leaves");
  await page.getByRole("button", { name: "Ajukan Cuti" }).click();
  const leaveDialog = page.getByRole("dialog", {
    name: "Form Pengajuan Cuti Baru",
  });
  await leaveDialog
    .getByPlaceholder("Tuliskan keterangan keperluan cuti secara jelas...")
    .fill(leaveReason);
  await leaveDialog
    .getByRole("button", { name: "Kirim Permohonan" })
    .click();
  await expect(
    page.getByRole("heading", { name: leaveReason, exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: leaveReason, exact: true })
  ).toBeVisible();

  const overtimeReason = "Validasi laporan operasional prototype";
  await page.goto("/overtime");
  await page.getByRole("button", { name: "Ajukan Lembur" }).click();
  const overtimeDialog = page.getByRole("dialog", {
    name: "Form Pengajuan Lembur Staf",
  });
  await overtimeDialog
    .getByPlaceholder(
      "Jelaskan instruksi atau pekerjaan operasional yang dikerjakan saat lembur..."
    )
    .fill(overtimeReason);
  await overtimeDialog
    .getByRole("button", { name: "Kirim Pengajuan" })
    .click();
  await expect(page.locator("p").filter({ hasText: overtimeReason })).toBeVisible();
  await page.reload();
  await expect(page.locator("p").filter({ hasText: overtimeReason })).toBeVisible();
});

test("perubahan roster disimpan untuk tanggal sel yang dipilih", async ({
  page,
}) => {
  await page.goto("/schedule");
  await page.getByTitle("Edit shift Karyati tanggal 20").click();

  const scheduleDialog = page.getByRole("dialog", {
    name: "Atur Shift Karyawan",
  });
  await expect(scheduleDialog.getByText(/20 Juli 2026/)).toBeVisible();
  await scheduleDialog.getByRole("button", { name: "Simpan Shift" }).click();

  await expect
    .poll(async () =>
      page.evaluate((storageKey) => {
        const state = JSON.parse(
          window.localStorage.getItem(storageKey) ?? "{}"
        ) as {
          schedules?: Array<{ employeeId: string; date: string }>;
        };
        return state.schedules?.some(
          (schedule) =>
            schedule.employeeId === "EMP-010" &&
            schedule.date === "2026-07-20"
        );
      }, demoStorageKey)
    )
    .toBe(true);
});

test("halaman inti tidak memiliki pelanggaran aksesibilitas serius", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/employees",
    "/attendance",
    "/leaves",
    "/schedule",
    "/settings",
  ]) {
    await page.goto(route);
    await waitForPageTransition(page);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const seriousViolations = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical"
    );

    expect(
      seriousViolations,
      `${route}: ${seriousViolations
        .map((violation) => violation.id)
        .join(", ")}`
    ).toEqual([]);
  }
});
