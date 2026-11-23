import { useEffect, useState, useCallback } from "react"

import { supabase } from "./lib/supabaseClient"
import { getCachedAuthProfile } from "./supabaseAuth"
import type { MarketplaceProject, DevBid } from "./devProfile"

// ─── Mapping helpers ─────────────────────────────────────────────────────────
// Real rows are reshaped into the exact UI types the mock stores already use
// (MarketplaceProject / DevBid) so MarketplaceFeed/BidsView render either
// source without changes.

function formatPeso(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—"
  return `₱${n.toLocaleString("en-US")}`
}

function formatBudgetRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "Budget TBD"
  if (min !== null && max !== null && min !== max) {
    return `${formatPeso(min)} – ${formatPeso(max)}`
  }
  return formatPeso(min ?? max)
}

function formatDate(d: string | null): string {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return d
  }
}

// ─── Marketplace projects (read: everyone; write: posting enterprise) ──────

interface RawMarketplaceRow {
  id: string
  title: string
  tags: string[]
  budget_min: number | null
  budget_max: number | null
  deadline: string | null
  phases: number
  posted_at: string
  barangay: string | null
  enterprise_profiles: { business: string } | null
}

async function fetchOpenProjects(): Promise<MarketplaceProject[]> {
  const { data, error } = await supabase
    .from("marketplace_projects")
    .select(
      "id, title, tags, budget_min, budget_max, deadline, phases, posted_at, barangay, enterprise_profiles(business)",
    )
    .eq("status", "Open")
    .order("posted_at", { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as RawMarketplaceRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    business: row.enterprise_profiles?.business || "Unknown Business",
    barangay: row.barangay || "",
    tags: row.tags ?? [],
    budget: formatBudgetRange(row.budget_min, row.budget_max),
    deadline: formatDate(row.deadline),
    phases: row.phases,
    postedAt: formatDate(row.posted_at),
  }))
}

// enabled=false (no real Supabase account signed in) skips the fetch and
// returns an empty, non-loading result — callers fall back to mock data.
export function useMarketplaceProjects(enabled: boolean) {
  const [projects, setProjects] = useState<MarketplaceProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    fetchOpenProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load marketplace"))
      .finally(() => setLoading(false))
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { projects, loading, error, refresh }
}

export interface ProjectMilestoneInput {
  title: string
  dueDate: string // yyyy-mm-dd
}

export interface CreateProjectInput {
  title: string
  description: string
  tags: string[]
  budget: number | null
  deadline: string // yyyy-mm-dd
  phases: number
  barangay: string
  milestones: ProjectMilestoneInput[]
  status?: "Draft" | "Open" // defaults to "Open" — pass "Draft" for Save as Draft
}

export async function createMarketplaceProject(input: CreateProjectInput): Promise<void> {
  const me = getCachedAuthProfile()
  if (!me || me.role !== "enterprise") {
    throw new Error("You must be signed in with a verified enterprise account to post a project")
  }

  const { error } = await supabase.from("marketplace_projects").insert({
    enterprise_id: me.id,
    title: input.title,
    description: input.description,
    tags: input.tags,
    budget_min: input.budget,
    budget_max: input.budget,
    deadline: input.deadline || null,
    phases: input.phases,
    barangay: input.barangay || null,
    status: input.status ?? "Open",
    milestones: input.milestones,
  })

  if (error) throw error
}

// ─── Draft projects ("Save as Draft") ───────────────────────────────────────

export interface DraftProject {
  id: string
  title: string
  budget: string
  savedAt: string
}

export async function fetchMyDraftProjects(): Promise<DraftProject[]> {
  const me = getCachedAuthProfile()
  if (!me || me.role !== "enterprise") return []

  const { data, error } = await supabase
    .from("marketplace_projects")
    .select("id, title, budget_min, budget_max, posted_at")
    .eq("enterprise_id", me.id)
    .eq("status", "Draft")
    .order("posted_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string) || "Untitled draft",
    budget: formatBudgetRange(row.budget_min as number | null, row.budget_max as number | null),
    savedAt: formatDate(row.posted_at as string | null),
  }))
}

export async function publishDraftProject(id: string): Promise<void> {
  const { error } = await supabase.from("marketplace_projects").update({ status: "Open" }).eq("id", id)
  if (error) throw error
}

export async function deleteDraftProject(id: string): Promise<void> {
  const { error } = await supabase.from("marketplace_projects").delete().eq("id", id).eq("status", "Draft")
  if (error) throw error
}

// ─── Posted projects (Project Contracts view) ───────────────────────────────
// The "Project Contracts" table previously showed only awarded contracts
// (one per project, only once a bid is awarded), so a freshly published
// project with no bids yet never appeared there. This lists every project
// the enterprise has posted — Open, Awarded or Closed — regardless of
// whether it has a contract yet.

export interface PostedProject {
  id: string
  title: string
  status: "Open" | "Awarded" | "Closed"
  budget: string
  postedAt: string
  bidCount: number
}

export async function fetchMyPostedProjects(): Promise<PostedProject[]> {
  const me = getCachedAuthProfile()
  if (!me || me.role !== "enterprise") return []

  const { data, error } = await supabase
    .from("marketplace_projects")
    .select("id, title, status, budget_min, budget_max, posted_at, bids(count)")
    .eq("enterprise_id", me.id)
    .neq("status", "Draft")
    .order("posted_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    status: row.status as PostedProject["status"],
    budget: formatBudgetRange(row.budget_min as number | null, row.budget_max as number | null),
    postedAt: formatDate(row.posted_at as string | null),
    bidCount: Array.isArray(row.bids) ? ((row.bids[0] as { count: number } | undefined)?.count ?? 0) : 0,
  }))
}

// ─── Bids (read: bidder; write: bidding student) ───────────────────────────

interface RawBidRow {
  id: string
  amount: number
  status: DevBid["status"]
  placed_at: string
  marketplace_projects: { id: string; title: string; enterprise_profiles: { business: string } | null } | null
}

async function fetchMyBidsFromDb(studentId: string): Promise<DevBid[]> {
  const { data, error } = await supabase
    .from("bids")
    .select(
      "id, amount, status, placed_at, marketplace_projects(id, title, enterprise_profiles(business))",
    )
    .eq("student_id", studentId)
    .order("placed_at", { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as RawBidRow[]).map((row) => ({
    id: row.id,
    projectId: row.marketplace_projects?.id || "",
    project: row.marketplace_projects?.title || "Unknown Project",
    client: row.marketplace_projects?.enterprise_profiles?.business || "Unknown Business",
    amount: formatPeso(row.amount),
    status: row.status,
    placedAt: formatDate(row.placed_at),
  }))
}

export function useMyBids(enabled: boolean) {
  const [bids, setBids] = useState<DevBid[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    const me = getCachedAuthProfile()
    if (!enabled || !me) return
    setLoading(true)
    setError(null)
    fetchMyBidsFromDb(me.id)
      .then(setBids)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load bids"))
      .finally(() => setLoading(false))
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { bids, loading, error, refresh }
}

export async function placeBidOnProject(projectId: string, amount: number): Promise<void> {
  const me = getCachedAuthProfile()
  if (!me || me.role === "enterprise") {
    throw new Error("You must be signed in with a student account to place a bid")
  }

  const { error } = await supabase.from("bids").insert({
    project_id: projectId,
    student_id: me.id,
    amount,
  })

  if (error) throw error
}
