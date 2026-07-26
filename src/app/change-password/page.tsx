import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { requireCurrentAccount } from "@/lib/auth/session";

export default async function ChangePasswordPage() {
  const account = await requireCurrentAccount();

  if (!account.mustChangePassword && account.accountStatus === "active") {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <section className="w-full max-w-md space-y-5">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-lg font-black text-amber-400 shadow-lg shadow-amber-500/10">
            {account.initials}
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              Ubah kata sandi awal
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Halo, {account.fullName}. Kata sandi awal wajib diganti sebelum
              masuk ke aplikasi.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl shadow-black/30 sm:p-5">
          <ChangePasswordForm />
        </div>
      </section>
    </main>
  );
}
