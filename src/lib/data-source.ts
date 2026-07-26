export type DataSourceMode = "demo" | "supabase";

export interface DataSourceConfig {
  mode: DataSourceMode;
  isExplicit: boolean;
}

/**
 * Menentukan sumber data aplikasi dari konfigurasi server.
 *
 * Nilai kosong tetap menjalankan mode demo untuk kompatibilitas prototype,
 * tetapi ditandai tidak eksplisit agar UI tidak menyamarkannya sebagai data
 * produksi. Nilai selain `demo` atau `supabase` ditolak.
 */
export function resolveDataSource(value: string | undefined): DataSourceConfig {
  if (!value) {
    return { mode: "demo", isExplicit: false };
  }

  if (value === "demo" || value === "supabase") {
    return { mode: value, isExplicit: true };
  }

  throw new Error(
    `APP_DATA_SOURCE tidak valid: "${value}". Gunakan "demo" atau "supabase".`
  );
}
