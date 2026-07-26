"use client";

import { useActionState } from "react";
import { KeyRound, Save } from "lucide-react";
import {
  changePasswordAction,
  type AuthActionState,
} from "@/lib/auth/actions";

const initialState: AuthActionState = {
  status: "idle",
  message: "",
};

/**
 * Form wajib ganti password pertama dengan validasi client-native dan server.
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState
  );

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-200"
        >
          <KeyRound className="h-3.5 w-3.5 text-amber-400" />
          <span>Kata sandi baru</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3.5 py-3 text-base text-slate-100 placeholder-slate-500 outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 sm:text-sm"
          placeholder="Minimal 8 karakter"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="confirmPassword"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-200"
        >
          <KeyRound className="h-3.5 w-3.5 text-amber-400" />
          <span>Konfirmasi kata sandi</span>
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-xl border border-slate-700/80 bg-slate-950 px-3.5 py-3 text-base text-slate-100 placeholder-slate-500 outline-none transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 sm:text-sm"
          placeholder="Ulangi kata sandi baru"
        />
      </div>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Gunakan huruf besar, huruf kecil, angka, dan minimal 8 karakter.
      </p>

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
        <Save className="h-4 w-4" />
        <span>{pending ? "Menyimpan..." : "Simpan kata sandi"}</span>
      </button>
    </form>
  );
}
