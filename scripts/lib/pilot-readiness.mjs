const REQUIRED_POLICY_TYPES = ["attendance", "leave", "overtime", "roster"];
const REQUIRED_SHIFT_TYPES = ["morning", "middle", "night"];

function isEffectiveOn(row, date) {
  return (
    row.start <= date && (row.end === null || row.end === undefined || row.end >= date)
  );
}

/**
 * Menghitung outlet yang secara teknis siap menjadi kandidat pilot tanpa
 * mengembalikan ID outlet atau karyawan ke output operator.
 */
export function countPilotCapableOutlets(snapshot) {
  const eligiblePositionIds = new Set(
    snapshot.jobPositions
      .filter((position) => position.is_active && position.auto_roster_eligible)
      .map((position) => position.id)
  );
  const eligibleEmployeeIds = new Set(
    snapshot.employees
      .filter(
        (employee) =>
          employee.archived_at === null &&
          eligiblePositionIds.has(employee.job_position_id)
      )
      .map((employee) => employee.id)
  );
  const readyEmployeeIds = new Set(
    snapshot.userAccounts
      .filter(
        (account) =>
          account.access_role === "employee" &&
          account.account_status === "active" &&
          account.must_change_password === false &&
          account.employee_id &&
          eligibleEmployeeIds.has(account.employee_id)
      )
      .map((account) => account.employee_id)
  );
  const currentPlacements = snapshot.placements.filter(
    (placement) =>
      placement.is_primary &&
      readyEmployeeIds.has(placement.employee_id) &&
      isEffectiveOn(
        { start: placement.start_date, end: placement.end_date },
        snapshot.today
      )
  );
  const activeTemplates = snapshot.shiftTemplates.filter(
    (template) => template.is_active
  );
  return snapshot.outlets.filter((outlet) => {
    if (!outlet.is_active) return false;

    const employeeCount = new Set(
      currentPlacements
        .filter((placement) => placement.outlet_id === outlet.id)
        .map((placement) => placement.employee_id)
    ).size;
    const configuredShiftTypes = new Set(
      activeTemplates
        .filter(
          (template) =>
            template.outlet_id === outlet.id &&
            snapshot.staffingRequirements.some(
              (requirement) =>
                requirement.outlet_id === outlet.id &&
                requirement.shift_template_id === template.id &&
                requirement.cashier_count === employeeCount &&
                isEffectiveOn(
                  {
                    start: requirement.effective_from,
                    end: requirement.effective_until,
                  },
                  snapshot.today
                )
            )
        )
        .map((template) => template.shift_type)
    );

    return (
      employeeCount >= 3 &&
      REQUIRED_SHIFT_TYPES.every((shiftType) =>
        configuredShiftTypes.has(shiftType)
      )
    );
  }).length;
}

function check(status, label, detail) {
  return { status, label, detail };
}

/**
 * Mengubah fakta agregat production menjadi gate PASS/WAIT/BLOCKED. WAIT tidak
 * menggagalkan command karena bukti manual dan berbasis waktu memang dapat
 * belum tersedia, sedangkan BLOCKED menghasilkan exit code gagal.
 */
export function evaluatePilotReadiness(facts) {
  const checks = [
    check(
      facts.activeSupervisors >= 1 ? "PASS" : "BLOCKED",
      "Akun supervisor",
      facts.activeSupervisors >= 1
        ? `${facts.activeSupervisors} akun aktif`
        : "belum ada supervisor aktif"
    ),
    check(
      facts.activeOutlets >= 1 ? "PASS" : "BLOCKED",
      "Outlet aktif",
      facts.activeOutlets >= 1
        ? `${facts.activeOutlets} outlet tersedia`
        : "belum ada outlet aktif"
    ),
    check(
      facts.rosterEligibleEmployees >= 3 ? "PASS" : "BLOCKED",
      "Kasir eligible",
      `${facts.rosterEligibleEmployees} karyawan aktif eligible roster`
    ),
    check(
      facts.readyEmployeeAccounts >= 3 ? "PASS" : "BLOCKED",
      "Akun karyawan siap",
      `${facts.readyEmployeeAccounts} akun aktif tanpa kewajiban ganti sandi`
    ),
    check(
      facts.pilotCapableOutlets >= 1 ? "PASS" : "BLOCKED",
      "Kandidat outlet pilot",
      facts.pilotCapableOutlets >= 1
        ? `${facts.pilotCapableOutlets} outlet memenuhi data minimum`
        : "butuh 3 akun kasir siap, penempatan aktif, serta Pagi/Middle/Malam dengan kebutuhan staf"
    ),
    check(
      facts.activePolicyTypes.length === REQUIRED_POLICY_TYPES.length
        ? "PASS"
        : "BLOCKED",
      "Kebijakan aktif",
      facts.activePolicyTypes.length === REQUIRED_POLICY_TYPES.length
        ? "attendance, leave, overtime, dan roster tersedia"
        : `belum lengkap (${facts.activePolicyTypes.length}/${REQUIRED_POLICY_TYPES.length})`
    ),
    check(
      facts.overdueDeletionJobs === 0 &&
        facts.exhaustedDeletionJobs === 0 &&
        facts.staleDeletionJobs === 0
        ? "PASS"
        : "BLOCKED",
      "Antrean retensi",
      `${facts.overdueDeletionJobs} jatuh tempo, ${facts.exhaustedDeletionJobs} retry habis, ${facts.staleDeletionJobs} lease tertahan`
    ),
    check(
      facts.exhaustedReportJobs === 0 ? "PASS" : "BLOCKED",
      "Antrean ekspor laporan",
      `${facts.exhaustedReportJobs} job retry habis`
    ),
  ];

  if (!facts.latestCron) {
    checks.push(
      check(
        "WAIT",
        "Invocation otomatis cron",
        "belum ada bukti audit; verifikasi M6 tetap ditunda"
      )
    );
  } else {
    const cronSucceeded =
      facts.latestCron.action === "cron_completed" &&
      (facts.latestCron.failed === null || facts.latestCron.failed === 0) &&
      !facts.latestCron.isStale;
    checks.push(
      check(
        cronSucceeded ? "PASS" : "BLOCKED",
        "Invocation otomatis cron",
        cronSucceeded
          ? `audit berhasil pada ${facts.latestCron.createdAt}`
          : facts.latestCron.isStale
            ? `audit terakhir sudah kedaluwarsa (${facts.latestCron.createdAt})`
            : `audit terakhir gagal pada ${facts.latestCron.createdAt}`
      )
    );
  }

  checks.push(
    check(
      "WAIT",
      "Bukti retensi tujuh hari",
      "wajib diverifikasi dengan evidence nyata melalui attendance:verify-retention"
    ),
    check(
      "WAIT",
      "Backup hosted",
      "wajib diperiksa manual di Supabase Dashboard"
    ),
    check(
      "WAIT",
      "Scope pilot",
      "outlet dan pengguna pilot belum disetujui pemilik produk"
    )
  );

  const status = checks.some((item) => item.status === "BLOCKED")
    ? "BLOCKED"
    : checks.some((item) => item.status === "WAIT")
      ? "WAIT"
      : "PASS";

  return { status, checks };
}

export { REQUIRED_POLICY_TYPES };
