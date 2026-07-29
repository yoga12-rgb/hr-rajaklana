import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type OperationsClient = SupabaseClient<Database>;

export interface OperationalAuditEvent {
  action: string;
  entity_type: string;
  created_at: string;
  source: "system" | "user";
  outcome: "recorded" | "attention";
}

export interface OperationalHealthWorkspace {
  role: "supervisor" | "management";
  generated_at: string;
  overall_status: "healthy" | "attention" | "critical";
  issue_count: number;
  retention: {
    scheduled: number;
    retrying: number;
    overdue: number;
    stale_processing: number;
    exhausted: number;
    last_cron_at: string | null;
    last_cron_status: "completed" | "failed" | null;
    last_cron_stale: boolean;
  };
  report_exports: {
    scheduled: number;
    stale_scheduled: number;
    processing: number;
    stale_processing: number;
    retrying: number;
    exhausted: number;
    last_completed_at: string | null;
  };
  roster_generation: {
    active: number;
    stale: number;
    failed: number;
    last_completed_at: string | null;
  };
  audit: {
    events_24h: number;
    failures_24h: number;
    last_event_at: string | null;
    recent_events: OperationalAuditEvent[];
  };
  application_backups: {
    completed_artifacts: number;
    last_completed_at: string | null;
    provider_backup_verified: boolean;
    note: string;
  };
}

function parseOperationalHealth(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Respons kesehatan operasional tidak valid.");
  }
  return value as unknown as OperationalHealthWorkspace;
}

export async function getOperationalHealthWorkspace(client: OperationsClient) {
  const { data, error } = await client.rpc("get_operational_health_workspace");
  if (error) {
    throw new Error(`Kesehatan operasional belum dapat dimuat: ${error.message}`);
  }
  return parseOperationalHealth(data);
}
