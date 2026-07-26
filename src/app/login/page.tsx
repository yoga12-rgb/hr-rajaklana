import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentAccount } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  account_locked: "Akun terkunci. Hubungi supervisor untuk dibuka kembali.",
  account_deactivated: "Akun sudah dinonaktifkan.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const account = await getCurrentAccount();
  const params = await searchParams;

  if (account?.accountStatus === "active" && !account.mustChangePassword) {
    redirect("/");
  }

  if (account?.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <section className="w-full max-w-md space-y-5">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-lg font-black text-amber-400 shadow-lg shadow-amber-500/10">
            HR
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              Masuk HR Rajaklana
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Gunakan akun yang dibuat oleh supervisor.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl shadow-black/30 sm:p-5">
          {params.error && errorMessages[params.error] && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
            >
              {errorMessages[params.error]}
            </p>
          )}
          <LoginForm />
        </div>

        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          Public sign-up dinonaktifkan. Reset kata sandi dilakukan oleh
          supervisor melalui proses internal.
        </p>
      </section>
    </main>
  );
}
