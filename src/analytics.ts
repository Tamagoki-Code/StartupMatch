// Platform-wide analytics for the admin's Enterprise Analytics dashboard.
// Reads across all projects/contracts/profiles — relies on the is_admin()
// RLS bypass, so this only returns real numbers when called by an admin.

import { useEffect, useState } from "react"
import { supabase } from "./lib/supabaseClient"

const CAT5 = ["#2563EB", "#16A34A", "#D97706", "#7C3AED", "#0891B2"]

export interface PlatformKpis {
  activeAgreements: number
  fulfillmentRate: number | null
  fulfillmentSample: number
  verifiedDevelopers: number
  onTimeRate: number | null
  onTimeSample: number
}

export interface TechStackSlice {
  name: string
  pct: number
  fill: string
}

export interface BarangaySlice {
  name: string
  projects: number
  fill: string
}

export interface TrajectoryPoint {
  month: string
  bids: number
  completions: number
}

export interface PlatformAnalytics {
  kpis: PlatformKpis
  techStack: TechStackSlice[]
  barangays: BarangaySlice[]
  trajectory: TrajectoryPoint[]
}

interface RawPhaseRow {
  contract_id: string
  status: string
  approved_at: string | null
  dev_deadline: string | null
}

async function fetchPlatformAnalytics(): Promise<PlatformAnalytics> {
  const [profilesRes, projectsRes, bidsRes, phasesRes] = await Promise.all([
    supabase.from("profiles").select("role, verification_status"),
    supabase.from("marketplace_projects").select("tags, barangay"),
    supabase.from("bids").select("placed_at"),
    supabase.from("contract_phases").select("contract_id, status, approved_at, dev_deadline"),
  ])

  if (profilesRes.error) throw profilesRes.error
  if (projectsRes.error) throw projectsRes.error
  if (bidsRes.error) throw bidsRes.error
  if (phasesRes.error) throw phasesRes.error

  const profiles = profilesRes.data ?? []
  const projects = (projectsRes.data ?? []) as { tags: string[] | null; barangay: string | null }[]
  const bids = (bidsRes.data ?? []) as { placed_at: string }[]
  const phases = (phasesRes.data ?? []) as RawPhaseRow[]

  // ── KPIs ────────────────────────────────────────────────────────────────

  const verifiedDevelopers = profiles.filter(
    (p) => p.role === "student" && p.verification_status === "Verified",
  ).length

  const contractIds = [...new Set(phases.map((p) => p.contract_id))]
  const activeAgreements = contractIds.filter((cid) =>
    phases.some((p) => p.contract_id === cid && p.status !== "completed"),
  ).length

  const completed = phases.filter((p) => p.status === "completed")
  const disputed = phases.filter((p) => p.status === "disputed")
  const fulfillmentSample = completed.length + disputed.length
  const fulfillmentRate =
    fulfillmentSample > 0 ? Math.round((completed.length / fulfillmentSample) * 1000) / 10 : null

  const completedWithDeadline = completed.filter((p) => p.dev_deadline && p.approved_at)
  const onTime = completedWithDeadline.filter(
    (p) => new Date(p.approved_at as string).getTime() <= new Date(`${p.dev_deadline}T23:59:59`).getTime(),
  )
  const onTimeSample = completedWithDeadline.length
  const onTimeRate = onTimeSample > 0 ? Math.round((onTime.length / onTimeSample) * 1000) / 10 : null

  // ── Tech stack distribution ──────────────────────────────────────────────

  const tagCounts = new Map<string, number>()
  for (const proj of projects) {
    for (const tag of proj.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const totalTagMentions = [...tagCounts.values()].reduce((a, b) => a + b, 0)
  const techStack: TechStackSlice[] = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], i) => ({
      name,
      pct: totalTagMentions > 0 ? Math.round((count / totalTagMentions) * 100) : 0,
      fill: CAT5[i % CAT5.length],
    }))

  // ── Barangay distribution ────────────────────────────────────────────────

  const barangayCounts = new Map<string, number>()
  for (const proj of projects) {
    if (!proj.barangay) continue
    barangayCounts.set(proj.barangay, (barangayCounts.get(proj.barangay) ?? 0) + 1)
  }
  const barangays: BarangaySlice[] = [...barangayCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], i) => ({ name, projects: count, fill: CAT5[i % CAT5.length] }))

  // ── 6-month trajectory ────────────────────────────────────────────────────

  const now = new Date()
  const monthKeys = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-US", { month: "short" }) }
  })

  const bidsByMonth = new Map<string, number>()
  for (const b of bids) {
    const d = new Date(b.placed_at)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    bidsByMonth.set(key, (bidsByMonth.get(key) ?? 0) + 1)
  }

  const completionsByMonth = new Map<string, number>()
  for (const p of completed) {
    if (!p.approved_at) continue
    const d = new Date(p.approved_at)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    completionsByMonth.set(key, (completionsByMonth.get(key) ?? 0) + 1)
  }

  const trajectory: TrajectoryPoint[] = monthKeys.map((m) => ({
    month: m.label,
    bids: bidsByMonth.get(m.key) ?? 0,
    completions: completionsByMonth.get(m.key) ?? 0,
  }))

  return {
    kpis: { activeAgreements, fulfillmentRate, fulfillmentSample, verifiedDevelopers, onTimeRate, onTimeSample },
    techStack,
    barangays,
    trajectory,
  }
}

export function usePlatformAnalytics() {
  const [data, setData] = useState<PlatformAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPlatformAnalytics()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}
