"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { communicationKeys } from "./query-keys";
import {
  acknowledgeAnnouncement,
  createAnnouncement,
  getCommunicationWorkspace,
  markAllNotificationsRead,
  markNotificationRead,
  type CreateAnnouncementInput,
} from "./repository";

export function useCommunicationWorkspace(enabled = true) {
  return useQuery({
    queryKey: communicationKeys.workspace(),
    queryFn: () => getCommunicationWorkspace(createClient()),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

function useRefreshCommunications() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: communicationKeys.all });
}

export function useCreateAnnouncement() {
  const refresh = useRefreshCommunications();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) =>
      createAnnouncement(createClient(), input),
    onSuccess: refresh,
  });
}

export function useMarkNotificationRead() {
  const refresh = useRefreshCommunications();
  return useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(createClient(), notificationId),
    onSuccess: refresh,
  });
}

export function useMarkAllNotificationsRead() {
  const refresh = useRefreshCommunications();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(createClient()),
    onSuccess: refresh,
  });
}

export function useAcknowledgeAnnouncement() {
  const refresh = useRefreshCommunications();
  return useMutation({
    mutationFn: (announcementId: string) =>
      acknowledgeAnnouncement(createClient(), announcementId),
    onSuccess: refresh,
  });
}

/**
 * Menyegarkan cache komunikasi ketika Supabase mengirim perubahan realtime.
 * Polling tetap aktif sebagai fallback bila koneksi websocket terputus.
 */
export function useCommunicationRealtime(
  enabled: boolean,
  currentEmployeeId?: string
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !currentEmployeeId) return;

    const client = createClient();
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: communicationKeys.all });
    };
    const channel = client
      .channel(`communications:${currentEmployeeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `employee_id=eq.${currentEmployeeId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        refresh
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [currentEmployeeId, enabled, queryClient]);
}
