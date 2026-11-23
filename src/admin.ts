import { useCallback, useEffect, useState } from "react"

import { supabase } from "./lib/supabaseClient"
import type { SupabaseRole } from "./supabaseAuth"

export interface AdminProfileRow {
  id: string
  role: SupabaseRole
  name: string
  email: string
  verificationStatus: "Verified" | "Pending Review" | "Under Review" | "Rejected"
  createdAt: string
  documentUrl: string | null
  establishmentPhotoUrl: string | null
  lastSeenAt: string | null
}

async function fetchAllProfiles(): Promise<AdminProfileRow[]> {
  const [profilesRes, documentsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, role, name, email, verification_status, created_at, last_seen_at")
      .order("created_at", { ascending: false }),
    supabase.from("verification_documents").select("profile_id, document_url, establishment_photo_url"),
  ])

  if (profilesRes.error) throw profilesRes.error

  const docByProfile = new Map(
    (documentsRes.data ?? []).map((d) => [
      d.profile_id,
      { documentUrl: d.document_url as string | null, establishmentPhotoUrl: d.establishment_photo_url as string | null },
    ]),
  )

  return (profilesRes.data ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
    documentUrl: docByProfile.get(row.id)?.documentUrl ?? null,
    establishmentPhotoUrl: docByProfile.get(row.id)?.establishmentPhotoUrl ?? null,
    lastSeenAt: row.last_seen_at,
  }))
}

// Real-accounts admin roster. RLS still gates the underlying writes (only an
// admin can update someone else's profile) — this hook just drives the UI.
export function useAllProfiles() {
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAllProfiles()
      .then(setProfiles)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load accounts"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { profiles, loading, error, refresh }
}

export async function setVerificationStatus(
  profileId: string,
  status: AdminProfileRow["verificationStatus"],
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ verification_status: status })
    .eq("id", profileId)

  if (error) throw error
}

export async function promoteToAdmin(profileId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin", verification_status: "Verified" })
    .eq("id", profileId)

  if (error) throw error
}
