import { supabase } from "./lib/supabaseClient"
import { getCachedAuthProfile } from "./supabaseAuth"
import type {
  CommentRole,
  PhaseComment,
  PhaseTask,
  ProjectPhase,
  SprintNotifType,
  SprintNotification,
  SprintProject,
} from "./contractTypes"

// ─── Meta (which real contract is currently loaded) ─────────────────────────
// Set by fetchActiveContract(); read by every write action below so they
// know which contract/phase to target and who the "other party" is for
// notifications.

interface ContractMeta {
  contractId: string
  studentId: string
  enterpriseId: string
  phasePayout: number
  paidToDate: number
}

let meta: ContractMeta | null = null

function requireMeta(): ContractMeta {
  if (!meta) throw new Error("No active contract loaded")
  return meta
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "TBD"
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

function daysUntil(d: string | null): number {
  if (!d) return 0
  const target = new Date(d).getTime()
  if (Number.isNaN(target)) return 0
  return Math.ceil((target - Date.now()) / 86_400_000)
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

const ROLE_AVATAR_BG: Record<CommentRole, [string, string]> = {
  developer: ["#DBEAFE", "#1D4ED8"],
  client: ["#ECFDF5", "#065F46"],
  admin: ["#F5F3FF", "#5B21B6"],
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Load ────────────────────────────────────────────────────────────────────

interface RawContractRow {
  id: string
  project_id: string
  student_id: string
  contract_type: string
  total_budget: number
  phase_budget: number
  phase_payout: number
  paid_to_date: number
  total_phases: number
  started: string
  deadline: string | null
  platform: string | null
}

interface RawPhaseRow {
  id: string
  contract_id: string
  number: number
  status: ProjectPhase["status"]
  submitted_at: string | null
  approved_at: string | null
  score: number | null
  revision_reason: string | null
  dev_title: string | null
  dev_deadline: string | null
  dev_description: string | null
  dev_repo_link: string | null
  dev_prototype_link: string | null
  dev_updates: string | null
  client_title: string | null
  client_deadline: string | null
  client_description: string | null
  client_repo_link: string | null
  client_prototype_link: string | null
  client_updates: string | null
}

// Finds "the" active contract for this user — the most recently started
// contract that isn't fully wrapped up, or else the most recent one overall.
// (The UI, inherited from the original mock, only ever shows one contract at
// a time; a real multi-contract switcher is future work.)
export async function fetchActiveContract(): Promise<SprintProject | null> {
  const me = getCachedAuthProfile()
  if (!me) return null

  let contractRows: RawContractRow[] = []

  if (me.role === "enterprise") {
    const { data: myProjects, error: projErr } = await supabase
      .from("marketplace_projects")
      .select("id")
      .eq("enterprise_id", me.id)
    if (projErr) throw projErr
    const projectIds = (myProjects ?? []).map((p) => p.id)
    if (projectIds.length === 0) return null

    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .in("project_id", projectIds)
      .order("started", { ascending: false })
    if (error) throw error
    contractRows = data ?? []
  } else {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("student_id", me.id)
      .order("started", { ascending: false })
    if (error) throw error
    contractRows = data ?? []
  }

  if (contractRows.length === 0) {
    meta = null
    return null
  }

  const contractRow = contractRows[0]

  const { data: project, error: projectErr } = await supabase
    .from("marketplace_projects")
    .select("id, title, enterprise_id")
    .eq("id", contractRow.project_id)
    .single()
  if (projectErr || !project) throw projectErr ?? new Error("Project not found for contract")

  const { data: enterpriseProfile } = await supabase
    .from("enterprise_profiles")
    .select("business")
    .eq("profile_id", project.enterprise_id)
    .single()

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", contractRow.student_id)
    .single()

  const { data: phaseRows, error: phaseErr } = await supabase
    .from("contract_phases")
    .select("*")
    .eq("contract_id", contractRow.id)
    .order("number")
  if (phaseErr) throw phaseErr

  const phaseIds = (phaseRows ?? []).map((p) => p.id)

  interface RawTaskRow {
    id: string
    phase_id: string
    label: string
    done: boolean
  }

  interface RawCommentRow {
    id: string
    phase_id: string
    author_id: string | null
    author_name: string
    role: CommentRole
    body: string
    created_at: string
  }

  const [taskRes, commentRes, notifRes] = await Promise.all([
    phaseIds.length
      ? supabase.from("phase_tasks").select("*").in("phase_id", phaseIds)
      : Promise.resolve({ data: [] as RawTaskRow[], error: null }),
    phaseIds.length
      ? supabase.from("phase_comments").select("*").in("phase_id", phaseIds).order("created_at")
      : Promise.resolve({ data: [] as RawCommentRow[], error: null }),
    supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", me.id)
      .order("created_at", { ascending: false }),
  ])
  const taskRows = taskRes.data as RawTaskRow[] | null
  const commentRows = commentRes.data as RawCommentRow[] | null
  const notifRows = notifRes.data

  const phases: ProjectPhase[] = (phaseRows as RawPhaseRow[]).map((row) => {
    const tasks: PhaseTask[] = (taskRows ?? [])
      .filter((t) => t.phase_id === row.id)
      .map((t) => ({ id: t.id, label: t.label, done: t.done }))

    const comments: PhaseComment[] = (commentRows ?? [])
      .filter((c) => c.phase_id === row.id)
      .map((c) => ({
        id: c.id,
        author: c.author_name,
        role: c.role,
        avatar: initialsFrom(c.author_name),
        avatarBg: ROLE_AVATAR_BG[c.role],
        time: formatDateTime(c.created_at),
        text: c.body,
      }))

    return {
      number: row.number,
      status: row.status,
      submittedAt: row.submitted_at ? formatDateTime(row.submitted_at) : null,
      approvedAt: row.approved_at ? formatDateTime(row.approved_at) : null,
      score: row.score,
      revisionReason: row.revision_reason ?? undefined,
      dev: {
        title: row.dev_title || `Phase ${row.number}`,
        deadline: formatDate(row.dev_deadline),
        daysLeft: daysUntil(row.dev_deadline),
        description: row.dev_description || "",
        repoLink: row.dev_repo_link || "",
        prototypeLink: row.dev_prototype_link || undefined,
        updates: row.dev_updates || "",
      },
      client: {
        title: row.client_title || `Phase ${row.number}`,
        deadline: formatDate(row.client_deadline),
        daysLeft: daysUntil(row.client_deadline),
        description: row.client_description || "",
        repoLink: row.client_repo_link || "",
        prototypeLink: row.client_prototype_link || undefined,
        updates: row.client_updates || "",
      },
      tasks,
      comments,
    }
  })

  const notifications: SprintNotification[] = (notifRows ?? []).map((n) => ({
    id: n.id,
    type: n.type as SprintNotifType,
    time: formatDateTime(n.created_at),
    text: n.body,
    read: n.read,
  }))

  meta = {
    contractId: contractRow.id,
    studentId: contractRow.student_id,
    enterpriseId: project.enterprise_id,
    phasePayout: contractRow.phase_payout,
    paidToDate: contractRow.paid_to_date,
  }

  return {
    id: contractRow.id,
    project: project.title,
    client: enterpriseProfile?.business || "Unknown Business",
    developer: studentProfile?.name || "Unknown Developer",
    totalPhases: contractRow.total_phases,
    deadline: formatDate(contractRow.deadline),
    daysLeft: daysUntil(contractRow.deadline),
    contractType: contractRow.contract_type,
    totalBudget: contractRow.total_budget,
    phaseBudget: contractRow.phase_budget,
    phasePayout: contractRow.phase_payout,
    paidToDate: contractRow.paid_to_date,
    started: formatDate(contractRow.started),
    platform: contractRow.platform || "StartupMatch",
    phases,
    notifications,
  }
}

export function clearActiveContract() {
  meta = null
}

// ─── Notifications ───────────────────────────────────────────────────────────

async function notify(recipientId: string, type: SprintNotifType, body: string) {
  try {
    await supabase.from("notifications").insert({ recipient_id: recipientId, type, body })
  } catch {
    // best-effort — a failed notification shouldn't block the underlying action
  }
}

// ─── Phase lookup ────────────────────────────────────────────────────────────

async function getPhaseId(number: number): Promise<string> {
  const m = requireMeta()
  const { data, error } = await supabase
    .from("contract_phases")
    .select("id")
    .eq("contract_id", m.contractId)
    .eq("number", number)
    .single()
  if (error || !data) throw new Error(`Phase ${number} not found`)
  return data.id
}

// ─── Actions (student / "dev" side) ─────────────────────────────────────────

export async function submitPhase(number: number, repoLink: string, notes: string) {
  const m = requireMeta()
  const phaseId = await getPhaseId(number)
  const { error } = await supabase
    .from("contract_phases")
    .update({
      status: "in_review",
      submitted_at: new Date().toISOString(),
      ...(repoLink ? { dev_repo_link: repoLink } : {}),
      ...(notes ? { dev_updates: notes } : {}),
    })
    .eq("id", phaseId)
  if (error) throw error

  await notify(m.enterpriseId, "info", `Sprint ${number} submitted for verification. Awaiting client review.`)
}

export async function resubmitPhase(number: number, repoLink: string, notes: string) {
  const m = requireMeta()
  const phaseId = await getPhaseId(number)
  const { error } = await supabase
    .from("contract_phases")
    .update({
      status: "in_review",
      submitted_at: new Date().toISOString(),
      revision_reason: null,
      ...(repoLink ? { dev_repo_link: repoLink } : {}),
      ...(notes ? { dev_updates: notes } : {}),
    })
    .eq("id", phaseId)
  if (error) throw error

  await notify(m.enterpriseId, "info", `Sprint ${number} resubmitted after revision. Ready for client re-review.`)
}

export async function reviseSubmission(number: number) {
  const phaseId = await getPhaseId(number)
  const { error } = await supabase
    .from("contract_phases")
    .update({ status: "active", submitted_at: null })
    .eq("id", phaseId)
  if (error) throw error
}

export async function updateRepoLink(number: number, url: string) {
  const phaseId = await getPhaseId(number)
  const { error } = await supabase.from("contract_phases").update({ dev_repo_link: url }).eq("id", phaseId)
  if (error) throw error
}

export async function updatePrototypeLink(number: number, url: string) {
  const phaseId = await getPhaseId(number)
  const { error } = await supabase
    .from("contract_phases")
    .update({ dev_prototype_link: url })
    .eq("id", phaseId)
  if (error) throw error
}

export async function updateNotes(number: number, text: string) {
  const phaseId = await getPhaseId(number)
  const { error } = await supabase.from("contract_phases").update({ dev_updates: text }).eq("id", phaseId)
  if (error) throw error
}

export async function addTask(number: number, label: string) {
  const phaseId = await getPhaseId(number)
  const { error } = await supabase.from("phase_tasks").insert({ phase_id: phaseId, label, done: false })
  if (error) throw error
}

export async function completeTask(taskId: string) {
  const { data, error: fetchErr } = await supabase
    .from("phase_tasks")
    .select("done")
    .eq("id", taskId)
    .single()
  if (fetchErr || !data) throw fetchErr ?? new Error("Task not found")

  const { error } = await supabase.from("phase_tasks").update({ done: !data.done }).eq("id", taskId)
  if (error) throw error
}

export async function addComment(number: number, text: string, role: CommentRole) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("Message cannot be empty")

  const me = getCachedAuthProfile()
  if (!me) throw new Error("Not signed in")

  const m = requireMeta()
  const phaseId = await getPhaseId(number)

  const { error } = await supabase.from("phase_comments").insert({
    phase_id: phaseId,
    author_id: me.id,
    author_name: me.name,
    role,
    body: trimmed,
  })
  if (error) throw error

  if (role !== "developer") {
    await notify(m.studentId, role === "client" ? "info" : "warning", `Message from ${me.name}: "${trimmed}"`)
  } else {
    await notify(m.enterpriseId, "info", `Message from ${me.name}: "${trimmed}"`)
  }
}

// ─── Actions (enterprise / "client" side) ───────────────────────────────────

function formatPeso(n: number): string {
  return `₱${n.toLocaleString("en-US")}`
}

export async function approvePhase(number: number, score = 5) {
  const m = requireMeta()
  const phaseId = await getPhaseId(number)

  const { error: phaseErr } = await supabase
    .from("contract_phases")
    .update({ status: "completed", approved_at: new Date().toISOString(), score })
    .eq("id", phaseId)
  if (phaseErr) throw phaseErr

  const newPaidToDate = m.paidToDate + m.phasePayout
  const { error: contractErr } = await supabase
    .from("contracts")
    .update({ paid_to_date: newPaidToDate })
    .eq("id", m.contractId)
  if (contractErr) throw contractErr
  meta = { ...m, paidToDate: newPaidToDate }

  await notify(m.studentId, "success", `Milestone Approved: Client verified Phase ${number}. Phase score: ${score}/5.`)
  await notify(
    m.studentId,
    "success",
    `Contract Milestone Payment released for Sprint ${number}: ${formatPeso(m.phasePayout)} credited to your wallet.`,
  )
}

export async function disputePhase(number: number, note: string) {
  const m = requireMeta()
  const phaseId = await getPhaseId(number)

  const { error } = await supabase
    .from("contract_phases")
    .update({ status: "disputed", ...(note ? { revision_reason: note } : {}) })
    .eq("id", phaseId)
  if (error) throw error

  if (note) {
    await addComment(number, note, "client")
  }

  await notify(m.studentId, "warning", `Client flagged Sprint ${number} for dispute / revision. Review the feedback and resubmit.`)
}

// ─── Notifications (both sides) ─────────────────────────────────────────────

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id)
  if (error) throw error
}

export async function markAllNotificationsRead() {
  const me = getCachedAuthProfile()
  if (!me) return
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("recipient_id", me.id)
    .eq("read", false)
  if (error) throw error
}

// ─── Awarding a bid → creating the contract ─────────────────────────────────

export interface PendingBidRow {
  id: string
  projectId: string
  projectTitle: string
  projectTags: string[]
  studentId: string
  studentName: string
  amount: number
  placedAt: string
}

export async function fetchPendingBidsForEnterprise(): Promise<PendingBidRow[]> {
  const me = getCachedAuthProfile()
  if (!me || me.role !== "enterprise") return []

  const { data: myProjects, error: projErr } = await supabase
    .from("marketplace_projects")
    .select("id, title, tags")
    .eq("enterprise_id", me.id)
    .eq("status", "Open")
  if (projErr) throw projErr
  const projects = myProjects ?? []
  if (projects.length === 0) return []

  const { data: bids, error: bidsErr } = await supabase
    .from("bids")
    .select("id, project_id, student_id, amount, placed_at, status")
    .in(
      "project_id",
      projects.map((p) => p.id),
    )
    .eq("status", "Pending")
    .order("placed_at", { ascending: false })
  if (bidsErr) throw bidsErr

  const studentIds = [...new Set((bids ?? []).map((b) => b.student_id))]
  const { data: studentProfiles } = studentIds.length
    ? await supabase.from("profiles").select("id, name").in("id", studentIds)
    : { data: [] as { id: string; name: string }[] }

  const projectTitleById = new Map(projects.map((p) => [p.id, p.title]))
  const projectTagsById = new Map(projects.map((p) => [p.id, (p as { tags?: string[] }).tags ?? []]))
  const studentNameById = new Map((studentProfiles ?? []).map((p) => [p.id, p.name]))

  return (bids ?? []).map((b) => ({
    id: b.id,
    projectId: b.project_id,
    projectTitle: projectTitleById.get(b.project_id) || "Untitled Project",
    projectTags: projectTagsById.get(b.project_id) || [],
    studentId: b.student_id,
    studentName: studentNameById.get(b.student_id) || "Unknown Student",
    amount: b.amount,
    placedAt: formatDate(b.placed_at),
  }))
}

export async function awardBid(bidId: string): Promise<void> {
  const me = getCachedAuthProfile()
  if (!me || me.role !== "enterprise") {
    throw new Error("Only the posting enterprise can award a bid")
  }

  const { data: bid, error: bidErr } = await supabase
    .from("bids")
    .select("id, project_id, student_id, amount")
    .eq("id", bidId)
    .single()
  if (bidErr || !bid) throw bidErr ?? new Error("Bid not found")

  const { data: project, error: projErr } = await supabase
    .from("marketplace_projects")
    .select("id, phases, deadline, enterprise_id, milestones")
    .eq("id", bid.project_id)
    .single()
  if (projErr || !project) throw projErr ?? new Error("Project not found")
  if (project.enterprise_id !== me.id) throw new Error("You don't own this project's listing")

  const totalPhases = Math.max(1, project.phases || 1)
  const phaseAmount = Math.round(bid.amount / totalPhases)

  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .insert({
      project_id: project.id,
      student_id: bid.student_id,
      bid_id: bid.id,
      contract_type: "Fixed Price",
      total_budget: bid.amount,
      phase_budget: phaseAmount,
      phase_payout: phaseAmount,
      paid_to_date: 0,
      total_phases: totalPhases,
      started: new Date().toISOString().slice(0, 10),
      deadline: project.deadline,
      platform: "StartupMatch",
    })
    .select("id")
    .single()
  if (contractErr || !contract) throw contractErr ?? new Error("Failed to create contract")

  const milestones = (project as { milestones?: { title?: string; dueDate?: string }[] }).milestones ?? []
  const phaseRows = Array.from({ length: totalPhases }, (_, i) => {
    const m = milestones[i]
    return {
      contract_id: contract.id,
      number: i + 1,
      status: i === 0 ? "active" : "upcoming",
      dev_title: m?.title || null,
      dev_deadline: m?.dueDate || null,
      client_title: m?.title || null,
      client_deadline: m?.dueDate || null,
    }
  })
  const { error: phasesErr } = await supabase.from("contract_phases").insert(phaseRows)
  if (phasesErr) throw phasesErr

  const { error: awardErr } = await supabase.from("bids").update({ status: "Awarded" }).eq("id", bidId)
  if (awardErr) throw awardErr

  await supabase
    .from("bids")
    .update({ status: "Declined" })
    .eq("project_id", project.id)
    .eq("status", "Pending")
    .neq("id", bidId)

  const { error: projStatusErr } = await supabase
    .from("marketplace_projects")
    .update({ status: "Awarded" })
    .eq("id", project.id)
  if (projStatusErr) throw projStatusErr

  await notify(bid.student_id, "success", `Your bid was awarded! The project is now an active contract.`)
}
