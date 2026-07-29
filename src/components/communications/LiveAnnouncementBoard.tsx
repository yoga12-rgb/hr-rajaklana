"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Megaphone,
  Pin,
  Plus,
  Send,
  Users,
} from "lucide-react";
import { Combobox } from "@/components/ui/Combobox";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useHR } from "@/context/HRContext";
import {
  useAcknowledgeAnnouncement,
  useCommunicationWorkspace,
  useCreateAnnouncement,
} from "@/lib/communications/queries";
import type {
  AnnouncementCategory,
  AnnouncementTargetType,
} from "@/lib/communications/repository";
import { playClickSound, playSuccessHaptic } from "@/utils/clickSound";

const categoryOptions = [
  "Operasional",
  "Info K3",
  "Event Perusahaan",
  "Kebijakan HR",
].map((value) => ({ value, label: value }));

const targetTypeOptions = [
  { value: "all", label: "Seluruh perusahaan" },
  { value: "outlet", label: "Outlet tertentu" },
  { value: "employee", label: "Karyawan tertentu" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Papan pengumuman live M8.
 *
 * Supervisor dapat menerbitkan informasi bertarget, sedangkan karyawan
 * menerima dan mengonfirmasi pengumuman sesuai target dari database.
 * Management memperoleh tampilan agregat hanya-baca.
 */
export function LiveAnnouncementBoard() {
  const { showToast } = useHR();
  const workspace = useCommunicationWorkspace();
  const createMutation = useCreateAnnouncement();
  const acknowledgeMutation = useAcknowledgeAnnouncement();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] =
    useState<AnnouncementCategory>("Operasional");
  const [targetType, setTargetType] =
    useState<AnnouncementTargetType>("all");
  const [targetId, setTargetId] = useState("");
  const [isPinned, setIsPinned] = useState(true);
  const [acknowledgementRequired, setAcknowledgementRequired] = useState(false);

  const targetOptions = useMemo(() => {
    const items =
      targetType === "outlet"
        ? workspace.data?.target_outlets ?? []
        : workspace.data?.target_employees ?? [];
    return items.map((item) => ({
      value: item.id,
      label: item.name,
      subtext: item.subtext ?? undefined,
    }));
  }, [
    targetType,
    workspace.data?.target_employees,
    workspace.data?.target_outlets,
  ]);

  const closeCreate = () => {
    if (!createMutation.isPending) setIsCreateOpen(false);
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setCategory("Operasional");
    setTargetType("all");
    setTargetId("");
    setIsPinned(true);
    setAcknowledgementRequired(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (targetType !== "all" && !targetId) {
      showToast("Pilih penerima pengumuman terlebih dahulu.", "warning");
      return;
    }

    try {
      await createMutation.mutateAsync({
        title,
        body,
        category,
        targetType,
        targetId: targetType === "all" ? null : targetId,
        isPinned,
        acknowledgementRequired,
      });
      playSuccessHaptic();
      showToast("Pengumuman berhasil dipublikasikan.", "success");
      resetForm();
      setIsCreateOpen(false);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Pengumuman belum tersimpan.",
        "warning"
      );
    }
  };

  const handleAcknowledge = async (announcementId: string) => {
    try {
      playClickSound();
      await acknowledgeMutation.mutateAsync(announcementId);
      playSuccessHaptic();
      showToast("Pengumuman telah dikonfirmasi.", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Konfirmasi belum tersimpan.",
        "warning"
      );
    }
  };

  if (workspace.isLoading) {
    return (
      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (workspace.isError || !workspace.data) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-slate-900 p-4 text-center">
        <p className="text-xs text-rose-300">
          {workspace.error instanceof Error
            ? workspace.error.message
            : "Pengumuman belum dapat dimuat."}
        </p>
        <button
          type="button"
          onClick={() => void workspace.refetch()}
          className="mt-3 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const { announcements, role } = workspace.data;

  return (
    <>
      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
              Pengumuman Perusahaan
            </h3>
          </div>
          {role === "supervisor" && (
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-400"
            >
              <Plus className="h-3 w-3" />
              Buat
            </button>
          )}
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center">
            <Megaphone className="mx-auto h-7 w-7 text-slate-600" />
            <p className="mt-2 text-xs text-slate-400">
              Belum ada pengumuman aktif untuk Anda.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {announcements.map((announcement) => (
              <article
                key={announcement.id}
                className={`space-y-2 rounded-xl border bg-slate-950 p-3 ${
                  announcement.is_pinned
                    ? "border-amber-500/30"
                    : "border-slate-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {announcement.is_pinned && (
                      <Pin className="h-3 w-3 shrink-0 rotate-45 text-amber-400" />
                    )}
                    <span className="truncate rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                      {announcement.category}
                    </span>
                  </div>
                  <time className="shrink-0 text-[9px] text-slate-500">
                    {formatDate(announcement.published_at)}
                  </time>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100">
                    {announcement.title}
                  </h4>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">
                    {announcement.body}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2">
                  <span className="flex items-center gap-1 text-[9px] text-slate-500">
                    <Users className="h-3 w-3" />
                    {announcement.target_summary}
                  </span>
                  {(role === "supervisor" || role === "management") &&
                    announcement.recipient_count !== null && (
                      <span className="text-[9px] text-slate-400">
                        Dibaca {announcement.read_count ?? 0}/
                        {announcement.recipient_count}
                        {announcement.acknowledgement_required &&
                          ` · Konfirmasi ${announcement.acknowledged_count ?? 0}`}
                      </span>
                    )}
                  {announcement.can_acknowledge &&
                    !announcement.acknowledged_at && (
                      <button
                        type="button"
                        disabled={acknowledgeMutation.isPending}
                        onClick={() => handleAcknowledge(announcement.id)}
                        className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1.5 text-[10px] font-bold text-slate-950 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Saya sudah membaca
                      </button>
                    )}
                  {announcement.acknowledged_at && (
                    <span className="flex items-center gap-1 text-[9px] font-semibold text-amber-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Telah dikonfirmasi
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal
        isOpen={isCreateOpen}
        onClose={closeCreate}
        title="Publikasikan Pengumuman"
        icon={Megaphone}
        maxWidth="sm:max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-200">Judul</span>
            <input
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              placeholder="Informasi yang perlu diketahui tim"
            />
          </label>

          <Combobox
            label="Kategori"
            options={categoryOptions}
            value={category}
            onChange={(value) => setCategory(value as AnnouncementCategory)}
          />
          <Combobox
            label="Target penerima"
            options={targetTypeOptions}
            value={targetType}
            onChange={(value) => {
              setTargetType(value as AnnouncementTargetType);
              setTargetId("");
            }}
          />
          {targetType !== "all" && (
            <Combobox
              label={targetType === "outlet" ? "Pilih outlet" : "Pilih karyawan"}
              options={targetOptions}
              value={targetId}
              onChange={setTargetId}
              placeholder={
                targetOptions.length
                  ? "Pilih penerima..."
                  : "Belum ada penerima tersedia"
              }
            />
          )}

          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <FileText className="h-3.5 w-3.5 text-amber-400" />
              Isi pengumuman
            </span>
            <textarea
              required
              rows={4}
              maxLength={3000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-base text-slate-100 outline-none focus:border-amber-500 sm:text-xs"
              placeholder="Tuliskan informasi secara jelas..."
            />
          </label>

          {[
            {
              label: "Sematkan di posisi teratas",
              value: isPinned,
              setValue: setIsPinned,
            },
            {
              label: "Wajib dikonfirmasi penerima",
              value: acknowledgementRequired,
              setValue: setAcknowledgementRequired,
            },
          ].map((option) => (
            <div
              key={option.label}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3"
            >
              <span className="text-xs font-semibold text-slate-200">
                {option.label}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={option.value}
                aria-label={option.label}
                onClick={() => option.setValue(!option.value)}
                className={`relative h-6 w-11 rounded-full p-0.5 transition-colors ${
                  option.value ? "bg-amber-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-slate-950 transition-transform ${
                    option.value ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
          ))}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-xs font-bold text-slate-950 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {createMutation.isPending ? "Mempublikasikan..." : "Publikasikan"}
          </button>
        </form>
      </Modal>
    </>
  );
}
