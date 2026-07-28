import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import {
  getSupabasePublicEnv,
  isSupabaseConfigured,
} from "./env";

const authPublicPaths = ["/login"];
const authUtilityPaths = ["/change-password"];
const internalServicePaths = ["/api/internal/attendance-retention"];

function isE2EPrototypeMode() {
  return (
    process.env.E2E_AUTH_BYPASS === "1" &&
    process.env.VERCEL !== "1"
  );
}

function isAuthPublicPath(pathname: string) {
  return authPublicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isAuthUtilityPath(pathname: string) {
  return authUtilityPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isInternalServicePath(pathname: string) {
  return internalServicePaths.includes(pathname);
}

function redirectToLogin(request: NextRequest, reason?: string) {
  const loginUrl = new URL("/login", request.url);

  if (reason) {
    loginUrl.searchParams.set("error", reason);
  } else if (!isAuthPublicPath(request.nextUrl.pathname)) {
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    );
  }

  return NextResponse.redirect(loginUrl);
}

/**
 * Menyegarkan cookie sesi Supabase tanpa mengambil alih otorisasi aplikasi.
 * Ketika env belum tersedia, prototype dilanjutkan tanpa koneksi backend.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // Menjaga regression test prototype tetap terisolasi dari hosted Auth.
  // Vercel selalu menolak bypass ini walaupun variabel tersetel tanpa sengaja.
  if (isE2EPrototypeMode()) {
    return response;
  }

  // Route internal melakukan autentikasi bearer sendiri dan harus dapat
  // dipanggil Vercel Cron tanpa cookie sesi pengguna.
  if (isInternalServicePath(pathname)) {
    return response;
  }

  if (!isSupabaseConfigured()) {
    return response;
  }

  const { url, publishableKey } = getSupabasePublicEnv();
  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    if (isAuthPublicPath(pathname)) {
      return response;
    }

    return redirectToLogin(request);
  }

  const { data: account } = await supabase
    .from("user_accounts")
    .select("account_status, must_change_password")
    .eq("user_id", userId)
    .maybeSingle();

  if (!account) {
    return redirectToLogin(request);
  }

  if (account.account_status === "locked") {
    return redirectToLogin(request, "account_locked");
  }

  if (account.account_status === "deactivated") {
    return redirectToLogin(request, "account_deactivated");
  }

  if (account.must_change_password && !isAuthUtilityPath(pathname)) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (
    !account.must_change_password &&
    (isAuthPublicPath(pathname) || isAuthUtilityPath(pathname))
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
