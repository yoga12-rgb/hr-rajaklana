"use client";

import { createContext, useContext } from "react";
import type { DataSourceConfig } from "@/lib/data-source";

const DataSourceContext = createContext<DataSourceConfig | null>(null);

/**
 * Menyediakan mode sumber data yang sudah divalidasi server kepada Client
 * Components tanpa mengekspos environment variable ke bundle browser.
 */
export function DataSourceProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: DataSourceConfig;
}) {
  return (
    <DataSourceContext.Provider value={value}>
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource() {
  const context = useContext(DataSourceContext);

  if (!context) {
    throw new Error("useDataSource harus dipakai di dalam DataSourceProvider.");
  }

  return context;
}
