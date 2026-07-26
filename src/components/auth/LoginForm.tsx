"use client";

import { useActionState } from "react";
import { LockKeyhole, LogIn, Mail } from "lucide-react";
import { signInAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = {
  status: "idle",
  message: "",
};

/**
 * Form login email/password yang mengirim kredensial melalui Server Action.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState
  );

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-200"
        >
          <Mail className="h-3.5 w-3.5 text-amber-400" />
          <span>Email</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3.5 py-3 text-base text-slate-100 placeholder-slate-500 outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 sm:text-sm"
          placeholder="nama@perusahaan.com"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-200"
        >
          <LockKeyhole className="h-3.5 w-3.5 text-amber-400" />
          <span>Kata sandi</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3.5 py-3 text-base text-slate-100 placeholder-slate-500 outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 sm:text-sm"
          placeholder="Masukkan kata sandi"
        />
      </div>

      {state.message && (
        <p
          role="alert"
          aria-live="polite"
          className={`rounded-xl border px-3 py-2 text-xs ${
            state.status === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
      >
        <LogIn className="h-4 w-4" />
        <span>{pending ? "Memeriksa akun..." : "Masuk"}</span>
      </button>
    </form>
  );
}
