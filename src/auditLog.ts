// Real audit log for the admin's Audit Logs page. Rows are written entirely
// by database triggers (see supabase/migrations/20260906120000_audit_log.sql)
// — this file only reads them.

import { useCallback, useEffect, useState } from "react"
import { supabase } from "./lib/supabaseClient"

export type AuditStatus = "success" | "warning" | "danger" | "info"

export interface AuditLogRow {
  id: string
  ts: string
  event: string
  role: string
  user: string
  status: AuditStatus
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

async function fetchAuditLog(limit: number): Promise<AuditLogRow[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, created_at, event, actor_name, actor_role, status")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    ts: formatTimestamp(row.created_at),
    event: row.event,
    role: row.actor_role,
    user: row.actor_name,
    status: row.status as AuditStatus,
  }))
}

export function useAuditLog(limit = 50) {
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAuditLog(limit)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load audit log"))
      .finally(() => setLoading(false))
  }, [limit])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, loading, error, refresh }
}
