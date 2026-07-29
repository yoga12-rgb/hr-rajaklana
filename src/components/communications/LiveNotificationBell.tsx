"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  Clock,
  Megaphone,
  RefreshCw,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useHR } from "@/context/HRContext";
import {
  useCommunicationRealtime,
  useCommunicationWorkspace,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@/lib/communications/queries";
import type { CommunicationNotification } from "@/lib/communications/repository";
import { playClickSound, playSuccessHaptic } from "@/utils/clickSound";

type NotificationTab = "Semua" | "Jadwal" | "Pengajuan" | "Pengumuman";

function notificationRoute(notification: CommunicationNotification) {
  if (notification.subject_type?.includes("roster")) return "/schedule";
  if (notification.subject_type?.includes("leave")) return "/leaves";
  if (notification.subject_type?.includes("overtime")) return "/overtime";
  if (notification.subject_type?.includes("attendance")) return "/attendance";
  return "/";
}

function notificationTab(notification: CommunicationNotification): NotificationTab {
  if (
    notification.notification_type.includes("roster") ||
    notification.subject_type?.includes("roster")
  ) {
    return "Jadwal";
  }
  if (
    notification.notification_type.includes("announcement") ||
    notification.subject_type?.includes("announcement")
  ) {
    return "Pengumuman";
  }
  return "Pengajuan";
}

function formatRelative(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

/**
 * Tombol pusat notifikasi live pada Header.
 *
 * Menampilkan unread badge tahan-refresh, mendukung read receipt per pengguna,
 * serta memakai realtime dengan polling fallback untuk koneksi lapangan.
 */
export function LiveNotificationBell() {
  const { showToast } = useHR();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>("Semua");
  const workspace = useCommunicationWorkspace();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  useCommunicationRealtime(
    Boolean(workspace.data),
    workspace.data?.current_employee_id
  );

  const notifications = useMemo(
    () =>
      (workspace.data?.notifications ?? []).filter(
        (notification) =>
          activeTab === "Semua" || notificationTab(notification) === activeTab
      ),
    [activeTab, workspace.data?.notifications]
  );

  const handleRead = (notification: CommunicationNotification) => {
    if (notification.read_at || workspace.data?.role === "management") return;
    markOne.mutate(notification.id);
  };

  const handleMarkAll = async () => {
    try {
      playClickSound();
      await markAll.mutateAsync();
      playSuccessHaptic();
      showToast("Semua notifikasi ditandai dibaca.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Notifikasi belum diperbarui.",
        "warning"
      );
    }
  };

  const unreadCount =
    workspace.data?.role === "management"
      ? 0
      : (workspace.data?.unread_count ?? 0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          playClickSound();
          setIsOpen(true);
        }}
        className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        title="Pusat Notifikasi"
        aria-label={`Pusat Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-slate-900 bg-amber-400 px-1 text-[9px] font-extrabold text-slate-950">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Pusat Notifikasi"
        icon={Bell}
        maxWidth="sm:max-w-lg"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex gap-1 overflow-x-auto">
              {(["Semua", "Jadwal", "Pengajuan", "Pengumuman"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold ${
                      activeTab === tab
                        ? "bg-amber-500 text-slate-950"
                        : "text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {tab}
                  </button>
                )
              )}
            </div>
            {unreadCount > 0 && workspace.data?.role !== "management" && (
              <button
                type="button"
                disabled={markAll.isPending}
                onClick={handleMarkAll}
                className="flex shrink-0 items-center gap-1 text-[9px] font-semibold text-amber-400 disabled:opacity-60"
              >
                <CheckCheck className="h-3 w-3" />
                Baca semua
              </button>
            )}
          </div>

          {workspace.isLoading && (
            <div className="flex h-48 items-center justify-center text-xs text-slate-400">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin text-amber-400" />
              Memuat notifikasi...
            </div>
          )}

          {workspace.isError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center">
              <p className="text-xs text-rose-300">
                {workspace.error instanceof Error
                  ? workspace.error.message
                  : "Notifikasi belum dapat dimuat."}
              </p>
              <button
                type="button"
                onClick={() => void workspace.refetch()}
                className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {!workspace.isLoading && !workspace.isError && (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-center">
                  <Bell className="h-8 w-8 text-slate-600" />
                  <p className="mt-2 text-xs text-slate-400">
                    Tidak ada notifikasi pada kategori ini.
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const tab = notificationTab(notification);
                  const Icon =
                    tab === "Jadwal"
                      ? CalendarDays
                      : tab === "Pengumuman"
                        ? Megaphone
                        : Clock;
                  return (
                    <Link
                      key={notification.id}
                      href={notificationRoute(notification)}
                      onClick={() => {
                        handleRead(notification);
                        setIsOpen(false);
                      }}
                      className={`block rounded-xl border p-3 transition-colors ${
                        notification.read_at ||
                        workspace.data?.role === "management"
                          ? "border-slate-800 bg-slate-950"
                          : "border-amber-500/30 bg-amber-500/5"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <strong className="text-xs text-slate-100">
                              {notification.title}
                            </strong>
                            {!notification.read_at &&
                              workspace.data?.role !== "management" && (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                            )}
                          </span>
                          <span className="mt-1 block text-[11px] leading-relaxed text-slate-400">
                            {notification.body}
                          </span>
                          <span className="mt-1.5 block text-[9px] text-slate-500">
                            {formatRelative(notification.created_at)}
                          </span>
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
