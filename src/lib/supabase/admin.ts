import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseAdminEnv } from "./env";

/**
 * Supabase admin client untuk operasi server-only seperti bootstrap akun,
 * reset password, dan audit auth. Jangan import dari Client Component.
 */
export function createAdminClient() {
  const { url, secretKey } = getSupabaseAdminEnv();

  return createClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
