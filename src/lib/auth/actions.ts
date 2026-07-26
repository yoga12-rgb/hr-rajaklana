"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Enums } from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireSupervisorAccount } from "./session";
import { validatePassword } from "./password";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signInAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getString(formData, "email").toLowerCase();
  const password = getString(formData, "password");
  let nextPath: string | null = null;

  try {
    if (!email || !password) {
      return {
        status: "error",
        message: "Isi email dan kata sandi terlebih dahulu.",
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        status: "error",
        message: "Email atau kata sandi tidak sesuai.",
      };
    }

    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
      await supabase.auth.signOut();
      return {
        status: "error",
        message: "Sesi login tidak valid. Silakan coba lagi.",
      };
    }

    const { data: account } = await supabase
      .from("user_accounts")
      .select("account_status, must_change_password")
      .eq("user_id", userId)
      .maybeSingle();

    if (!account) {
      await supabase.auth.signOut();
      return {
        status: "error",
        message: "Akun aplikasi belum terdaftar.",
      };
    }

    if (account.account_status === "locked") {
      await supabase.auth.signOut();
      return {
        status: "error",
        message: "Akun terkunci. Hubungi supervisor.",
      };
    }

    if (account.account_status === "deactivated") {
      await supabase.auth.signOut();
      return {
        status: "error",
        message: "Akun sudah dinonaktifkan.",
      };
    }

    const admin = createAdminClient();
    await admin
      .from("user_accounts")
      .update({ last_login_at: new Date().toISOString() })
      .eq("user_id", userId);

    nextPath = account.must_change_password ? "/change-password" : "/";
  } catch {
    return {
      status: "error",
      message: "Login belum dapat diproses. Periksa konfigurasi Supabase.",
    };
  }

  revalidatePath("/", "layout");
  redirect(nextPath);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function changePasswordAction(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirmPassword");
  let shouldRedirect = false;

  try {
    if (password !== confirmPassword) {
      return {
        status: "error",
        message: "Konfirmasi kata sandi belum sama.",
      };
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return {
        status: "error",
        message: passwordCheck.errors.join(" "),
      };
    }

    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
      return {
        status: "error",
        message: "Sesi habis. Silakan login ulang.",
      };
    }

    const { data: account } = await supabase
      .from("user_accounts")
      .select("account_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (!account || account.account_status === "locked") {
      return {
        status: "error",
        message: "Akun tidak dapat mengubah kata sandi saat ini.",
      };
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password,
    });

    if (passwordError) {
      return {
        status: "error",
        message: "Kata sandi belum dapat diperbarui.",
      };
    }

    const { error: completionError } = await supabase.rpc(
      "complete_password_change"
    );

    if (completionError) {
      return {
        status: "error",
        message:
          "Kata sandi berubah, tetapi aktivasi akun belum selesai. Silakan login ulang untuk mencoba kembali.",
      };
    }

    shouldRedirect = true;
  } catch {
    return {
      status: "error",
      message: "Perubahan kata sandi belum dapat diproses.",
    };
  }

  revalidatePath("/", "layout");
  if (shouldRedirect) {
    redirect("/");
  }

  return {
    status: "success",
    message: "Kata sandi berhasil diperbarui.",
  };
}

export type CreateAccountInput = {
  email: string;
  initialPassword: string;
  employeeId: string;
  accessRole: Enums<"access_role">;
};

export async function createUserAccount(input: CreateAccountInput) {
  const actor = await requireSupervisorAccount();
  const passwordCheck = validatePassword(input.initialPassword);

  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.errors.join(" "));
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.initialPassword,
    email_confirm: true,
    user_metadata: {
      employee_id: input.employeeId,
      access_role: input.accessRole,
    },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Akun belum dapat dibuat.");
  }

  await admin.from("user_accounts").insert({
    user_id: data.user.id,
    employee_id: input.employeeId,
    access_role: input.accessRole,
    account_status: "invited",
    must_change_password: true,
  });

  await admin.from("audit_logs").insert({
    actor_user_id: actor.userId,
    action: "create_user_account",
    entity_type: "user_account",
    entity_id: data.user.id,
    reason: "supervisor_created_initial_password",
  });

  revalidatePath("/employees");
  return { userId: data.user.id };
}

export async function resetUserPassword(userId: string, nextPassword: string) {
  const actor = await requireSupervisorAccount();
  const passwordCheck = validatePassword(nextPassword);

  if (!passwordCheck.valid) {
    throw new Error(passwordCheck.errors.join(" "));
  }

  if (actor.userId === userId) {
    throw new Error("Supervisor tidak dapat reset kata sandi akunnya sendiri.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: nextPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  await admin
    .from("user_accounts")
    .update({ must_change_password: true })
    .eq("user_id", userId);

  await admin.from("audit_logs").insert({
    actor_user_id: actor.userId,
    action: "reset_user_password",
    entity_type: "user_account",
    entity_id: userId,
    reason: "manual_password_replacement",
  });

  revalidatePath("/employees");
}
