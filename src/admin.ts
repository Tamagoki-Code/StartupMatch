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

// ─── All-projects sprint progress (Sprint Dashboard, admin view) ───────────
// Admin has no contract of their own, so the Sprint Dashboard page would
// otherwise just show "no active contract" forever. This gives moderators
// the oversight view the role actually needs: every real contract's phase
// progress at a glance. RLS already grants admin full read on these tables.

export interface AdminContractProgressRow {
  contractId: string
  projectTitle: string
  studentName: string
  businessName: string
  totalPhases: number
  completedPhases: number
  currentPhaseStatus: string | null
  currentPhaseNumber: number | null
  deadline: string | null
}

async function fetchAllContractProgress(): Promise<AdminContractProgressRow[]> {
  const { data: contracts, error: cErr } = await supabase
    .from("contracts")
    .select("id, project_id, student_id, total_phases, deadline")
    .order("started", { ascending: false })
  if (cErr) throw cErr
  if (!contracts || contracts.length === 0) return []

  const projectIds = [...new Set(contracts.map((c) => c.project_id))]
  const studentIds = [...new Set(contracts.map((c) => c.student_id))]
  const contractIds = contracts.map((c) => c.id)

  const [projectsRes, studentsRes, phasesRes] = await Promise.all([
    supabase.from("marketplace_projects").select("id, title, enterprise_id").in("id", projectIds),
    supabase.from("profiles").select("id, name").in("id", studentIds),
    supabase.from("contract_phases").select("contract_id, number, status").in("contract_id", contractIds),
  ])
  if (projectsRes.error) throw projectsRes.error
  if (studentsRes.error) throw studentsRes.error
  if (phasesRes.error) throw phasesRes.error

  const enterpriseIds = [...new Set((projectsRes.data ?? []).map((p) => p.enterprise_id))]
  const { data: enterpriseProfiles, error: eErr } = await supabase
    .from("enterprise_profiles")
    .select("profile_id, business")
    .in("profile_id", enterpriseIds)
  if (eErr) throw eErr

  const projectById = new Map((projectsRes.data ?? []).map((p) => [p.id, p]))
  const studentNameById = new Map((studentsRes.data ?? []).map((s) => [s.id, s.name as string]))
  const businessByEnterprise = new Map((enterpriseProfiles ?? []).map((e) => [e.profile_id, e.business as string]))

  return contracts.map((c) => {
    const phases = (phasesRes.data ?? [])
      .filter((p) => p.contract_id === c.id)
      .sort((a, b) => a.number - b.number)
    const completedPhases = phases.filter((p) => p.status === "completed").length
    const current = phases.find((p) => p.status !== "completed") ?? phases[phases.length - 1] ?? null
    const project = projectById.get(c.project_id)

    return {
      contractId: c.id,
      projectTitle: project?.title ?? "Untitled Project",
      studentName: studentNameById.get(c.student_id) ?? "Unknown",
      businessName: project ? businessByEnterprise.get(project.enterprise_id) ?? "Unknown Business" : "Unknown Business",
      totalPhases: c.total_phases,
      completedPhases,
      currentPhaseStatus: current?.status ?? null,
      currentPhaseNumber: current?.number ?? null,
      deadline: c.deadline,
    }
  })
}

export function useAllContractProgress() {
  const [rows, setRows] = useState<AdminContractProgressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchAllContractProgress()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sprint progress"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { rows, loading, error, refresh }
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
