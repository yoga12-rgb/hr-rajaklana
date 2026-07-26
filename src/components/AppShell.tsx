"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

const authOnlyRoutes = ["/login", "/change-password"];

/**
 * Memisahkan tampilan autentikasi dari shell navigasi utama aplikasi.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthOnlyRoute = authOnlyRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isAuthOnlyRoute) {
    return (
      <div className="min-h-dvh min-w-0 flex-1 bg-slate-950">
        {children}
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-950 pb-16 md:pb-0">
        <Header />
        <main className="mx-auto w-full max-w-lg flex-1 p-4 sm:p-6 md:max-w-7xl">
          {children}
        </main>
        <BottomNav />
      </div>
    </>
  );
}
