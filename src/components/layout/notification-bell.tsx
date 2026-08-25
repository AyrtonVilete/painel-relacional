"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { clsx } from "clsx";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";

type NotificationRow = Tables<"notifications">;

// No Realtime infra exists anywhere else in this app (everything else is
// fetch-once + optimistic local updates) — light polling keeps this
// consistent with that instead of introducing a new architecture just for
// the bell.
const POLL_INTERVAL_MS = 45000;

function formatRelative(createdAt: string) {
  const diffMin = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  return `há ${Math.round(diffH / 24)}d`;
}

export function NotificationBell({
  currentUserId,
  membersById,
}: {
  currentUserId: string;
  membersById: Map<string, string>;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    if (!currentUserId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Same click-outside/Escape dropdown pattern as filter-chip.tsx.
  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function handleToggleOpen() {
    if (!isOpen) fetchNotifications();
    setIsOpen((prev) => !prev);
  }

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: readAt } : n))
    );
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: readAt }).in("id", ids);
  }

  function handleNotificationClick(n: NotificationRow) {
    markRead([n.id]);
    setIsOpen(false);
    const params = new URLSearchParams({ ticket: n.ticket_id });
    if (n.comment_id) params.set("comment", n.comment_id);
    router.push(`/board?${params.toString()}`);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-expanded={isOpen}
        aria-label="Notificações"
        className="relative rounded-lg border border-slate-300 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-1.5 w-80 rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400 dark:text-slate-500">
                Nenhuma notificação ainda.
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={clsx(
                    "block w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800",
                    !n.read_at && "bg-indigo-50/60 dark:bg-indigo-950/20"
                  )}
                >
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {(n.actor_id && membersById.get(n.actor_id)) || "Alguém"} mencionou você
                  </p>
                  <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">
                    {n.body_preview}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {formatRelative(n.created_at)}
                  </p>
                </button>
              ))
            )}
          </div>
          {unreadCount > 0 && (
            <div className="mt-1.5 border-t border-slate-200 px-3 pt-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => markRead(notifications.filter((n) => !n.read_at).map((n) => n.id))}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Marcar todas como lidas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
