import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";

type CommunicationClient = SupabaseClient<Database>;

export type CommunicationRole = "employee" | "supervisor" | "management";
export type AnnouncementCategory =
  | "Operasional"
  | "Info K3"
  | "Event Perusahaan"
  | "Kebijakan HR";
export type AnnouncementTargetType = "all" | "outlet" | "employee";

export interface CommunicationNotification {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  subject_type: string | null;
  subject_id: string | null;
  payload: Json;
  created_at: string;
  read_at: string | null;
  acknowledged_at: string | null;
}

export interface LiveAnnouncement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  is_pinned: boolean;
  acknowledgement_required: boolean;
  published_at: string;
  expires_at: string | null;
  target_summary: string;
  read_at: string | null;
  acknowledged_at: string | null;
  recipient_count: number | null;
  read_count: number | null;
  acknowledged_count: number | null;
  can_acknowledge: boolean;
}

export interface CommunicationTargetOption {
  id: string;
  name: string;
  subtext?: string | null;
}

export interface CommunicationWorkspace {
  role: CommunicationRole;
  current_employee_id: string;
  unread_count: number;
  notifications: CommunicationNotification[];
  announcements: LiveAnnouncement[];
  target_outlets: CommunicationTargetOption[];
  target_employees: CommunicationTargetOption[];
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  category: AnnouncementCategory;
  isPinned: boolean;
  acknowledgementRequired: boolean;
  targetType: AnnouncementTargetType;
  targetId?: string | null;
  expiresAt?: string | null;
}

function communicationError(prefix: string, error: { message: string }) {
  return new Error(`${prefix}: ${error.message}`);
}

function parseWorkspace(value: Json) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Respons server komunikasi tidak valid.");
  }
  return value as unknown as CommunicationWorkspace;
}

export async function getCommunicationWorkspace(client: CommunicationClient) {
  const { data, error } = await client.rpc("get_communication_workspace");
  if (error) {
    throw communicationError("Pusat komunikasi belum dapat dimuat", error);
  }
  return parseWorkspace(data);
}

export async function createAnnouncement(
  client: CommunicationClient,
  input: CreateAnnouncementInput
) {
  const { data, error } = await client.rpc("create_announcement", {
    p_title: input.title,
    p_body: input.body,
    p_category: input.category,
    p_is_pinned: input.isPinned,
    p_acknowledgement_required: input.acknowledgementRequired,
    p_target_type: input.targetType,
    ...(input.targetId ? { p_target_id: input.targetId } : {}),
    ...(input.expiresAt ? { p_expires_at: input.expiresAt } : {}),
  });
  if (error) {
    throw communicationError("Pengumuman belum dapat dipublikasikan", error);
  }
  return data;
}

export async function markNotificationRead(
  client: CommunicationClient,
  notificationId: string
) {
  const { data, error } = await client.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) {
    throw communicationError("Notifikasi belum dapat ditandai dibaca", error);
  }
  return data;
}

export async function markAllNotificationsRead(client: CommunicationClient) {
  const { data, error } = await client.rpc("mark_all_notifications_read");
  if (error) {
    throw communicationError("Notifikasi belum dapat ditandai dibaca", error);
  }
  return data;
}

export async function acknowledgeAnnouncement(
  client: CommunicationClient,
  announcementId: string
) {
  const { data, error } = await client.rpc("acknowledge_announcement", {
    p_announcement_id: announcementId,
  });
  if (error) {
    throw communicationError("Konfirmasi pengumuman belum dapat disimpan", error);
  }
  return data;
}
