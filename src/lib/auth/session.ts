import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Enums } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AuthAccount = {
  userId: string;
  email: string;
  accessRole: Enums<"access_role">;
  accountStatus: Enums<"account_status">;
  mustChangePassword: boolean;
  employeeId: string | null;
  fullName: string;
  nik: string | null;
  initials: string;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export const getCurrentAccount = cache(async (): Promise<AuthAccount | null> => {
  // Mode demo dan CI tanpa environment Supabase tetap harus dapat merender
  // halaman publik. Mutasi autentikasi tetap gagal secara jujur di Server Action.
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return null;
  }

  const { data: userData } = await supabase.auth.getUser();
  const { data: account, error: accountError } = await supabase
    .from("user_accounts")
    .select(
      "user_id, employee_id, access_role, account_status, must_change_password"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (accountError || !account) {
    return null;
  }

  let fullName = userData.user?.email ?? "Pengguna";
  let nik: string | null = null;

  if (account.employee_id) {
    const { data: employee } = await supabase
      .from("employees")
      .select("full_name, nik")
      .eq("id", account.employee_id)
      .maybeSingle();

    if (employee?.full_name) {
      fullName = employee.full_name;
      nik = employee.nik;
    }
  }

  return {
    userId: account.user_id,
    email: userData.user?.email ?? "",
    accessRole: account.access_role,
    accountStatus: account.account_status,
    mustChangePassword: account.must_change_password,
    employeeId: account.employee_id,
    fullName,
    nik,
    initials: getInitials(fullName) || "HR",
  };
});

export async function requireCurrentAccount() {
  const account = await getCurrentAccount();

  if (!account) {
    redirect("/login");
  }

  if (account.accountStatus === "locked") {
    redirect("/login?error=account_locked");
  }

  if (account.accountStatus === "deactivated") {
    redirect("/login?error=account_deactivated");
  }

  return account;
}

export async function requireSupervisorAccount() {
  const account = await requireCurrentAccount();

  if (account.accessRole !== "supervisor") {
    throw new Error("Aksi ini hanya dapat dilakukan supervisor.");
  }

  return account;
}
