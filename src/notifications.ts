// Real, role-independent notification feed for the bell icon that appears in
// every top bar (student, enterprise, admin). Unlike the Sprint Dashboard's
// notifications panel, this doesn't depend on a contract being loaded — it
// reads directly by recipient_id, so it works the moment someone signs in.

import { useCallback, useEffect, useState } from "react"
import { supabase } from "./lib/supabaseClient"
import { getCachedAuthProfile } from "./supabaseAuth"
import type { SprintNotifType } from "./contractTypes"

// Real Supabase writes, independent of whether a contract is loaded — the
// projectStore.ts versions of these only touch Supabase when a real contract
// happens to be active (and don't return a Promise at all otherwise), which
// doesn't fit the bell: notifications can exist before any contract does.
export async function markNotificationSeen(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id)
  if (error) throw error
}

export async function markAllNotificationsSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("recipient_id", userId)
    .eq("read", false)
  if (error) throw error
}

export interface NotificationRow {
  id: string
  type: SprintNotifType
  time: string
  text: string
  read: boolean
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, body, read, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) throw error

  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type as SprintNotifType,
    time: formatDateTime(n.created_at),
    text: n.body,
    read: n.read,
  }))
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    const me = getCachedAuthProfile()
    if (!me) {
      setNotifications([])
      setLoading(false)
      return
    }
    fetchNotifications(me.id)
      .then(setNotifications)
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const markOneRead = useCallback(
    (id: string) => {
      markNotificationSeen(id)
        .then(refresh)
        .catch(() => {})
    },
    [refresh],
  )

  const markAllRead = useCallback(() => {
    const me = getCachedAuthProfile()
    if (!me) return
    markAllNotificationsSeen(me.id)
      .then(refresh)
      .catch(() => {})
  }, [refresh])

  return { notifications, loading, refresh, markOneRead, markAllRead }
}
