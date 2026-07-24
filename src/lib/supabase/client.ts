"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabasePublicEnv } from "./env";

/**
 * Membuat Supabase client untuk Client Components dan langganan Realtime.
 * Panggil fungsi ini hanya setelah `isSupabaseConfigured()` bernilai true.
 */
export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
