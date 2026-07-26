import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Writable } from "node:stream";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Environment ${key} belum tersedia.`);
    process.exit(1);
  }
}

let suppressTerminalOutput = false;
const protectedOutput = new Writable({
  write(chunk, _encoding, callback) {
    if (!suppressTerminalOutput) {
      output.write(chunk);
    }
    callback();
  },
});
const rl = createInterface({
  input,
  output: input.isTTY ? protectedOutput : output,
  terminal: Boolean(input.isTTY),
});

async function question(label, fallback = "") {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = await rl.question(`${label}${suffix}: `);
  return answer.trim() || fallback;
}

async function passwordQuestion(label) {
  if (!input.isTTY) {
    const answer = await rl.question(`${label}: `);
    return answer.trim();
  }

  output.write(`${label}: `);
  suppressTerminalOutput = true;
  const answer = await rl.question("");
  suppressTerminalOutput = false;
  output.write("\n");
  return answer.trim();
}

function assertPassword(password) {
  const errors = [];

  if (password.length < 8) errors.push("minimal 8 karakter");
  if (!/[a-z]/.test(password)) errors.push("huruf kecil");
  if (!/[A-Z]/.test(password)) errors.push("huruf besar");
  if (!/[0-9]/.test(password)) errors.push("angka");

  if (errors.length > 0) {
    throw new Error(`Password harus memiliki ${errors.join(", ")}.`);
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

try {
  const fullName = await question("Nama supervisor pertama");
  const email = (await question("Email supervisor pertama")).toLowerCase();
  const nik = await question("NIK", "RK-2026-001");
  const positionName = await question("Jabatan", "Supervisor SDM");
  const statusName = await question("Status kerja", "Tetap");
  const joinedAt = await question("Tanggal mulai kerja YYYY-MM-DD", "2026-07-24");
  const password = await passwordQuestion("Password awal");

  assertPassword(password);

  const positionCode = positionName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  const statusCode = statusName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);

  const { data: position, error: positionError } = await supabase
    .from("job_positions")
    .upsert(
      {
        code: positionCode,
        name: positionName,
        auto_roster_eligible: false,
        is_active: true,
      },
      { onConflict: "code" }
    )
    .select("id")
    .single();

  if (positionError) throw positionError;

  const { data: status, error: statusError } = await supabase
    .from("employment_statuses")
    .upsert(
      {
        code: statusCode,
        name: statusName,
        is_active: true,
      },
      { onConflict: "code" }
    )
    .select("id")
    .single();

  if (statusError) throw statusError;

  const { data: existingEmployee, error: existingEmployeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("nik", nik)
    .maybeSingle();

  if (existingEmployeeError) throw existingEmployeeError;

  const employeeId = existingEmployee?.id;
  const { data: employee, error: employeeError } = employeeId
    ? await supabase
        .from("employees")
        .update({
          full_name: fullName,
          joined_at: joinedAt,
          employment_status_id: status.id,
          job_position_id: position.id,
        })
        .eq("id", employeeId)
        .select("id")
        .single()
    : await supabase
        .from("employees")
        .insert({
          nik,
          full_name: fullName,
          joined_at: joinedAt,
          employment_status_id: status.id,
          job_position_id: position.id,
        })
        .select("id")
        .single();

  if (employeeError) throw employeeError;

  const { data: userList, error: listError } =
    await supabase.auth.admin.listUsers();

  if (listError) throw listError;

  const existingUser = userList.users.find((user) => user.email === email);
  const { data: userResult, error: userError } = existingUser
    ? await supabase.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          employee_id: employee.id,
          access_role: "supervisor",
        },
      })
    : await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          employee_id: employee.id,
          access_role: "supervisor",
        },
      });

  if (userError || !userResult.user) {
    throw userError ?? new Error("User belum berhasil dibuat.");
  }

  const { error: accountError } = await supabase.from("user_accounts").upsert(
    {
      user_id: userResult.user.id,
      employee_id: employee.id,
      access_role: "supervisor",
      account_status: "invited",
      must_change_password: true,
    },
    { onConflict: "user_id" }
  );

  if (accountError) throw accountError;

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_user_id: userResult.user.id,
    action: "bootstrap_supervisor",
    entity_type: "user_account",
    entity_id: userResult.user.id,
    reason: "initial_supervisor_bootstrap_script",
  });

  if (auditError) throw auditError;

  console.log("Supervisor pertama siap. Login akan memaksa ubah kata sandi.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
}
