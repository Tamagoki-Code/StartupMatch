import { useSyncExternalStore } from "react"

import { getDevSnapshot } from "./devProfile"

import { clientIdentity } from "./clientProfile"

import { getCachedAuthProfile } from "./supabaseAuth"

import * as realContracts from "./contracts"

export * from "./contractTypes"

import type {
  CommentRole,
  PhaseComment,
  ProjectPhase,
  SprintNotification,
  SprintNotifType,
  SprintProject,
} from "./contractTypes"

// ─── Seed data ────────────────────────────────────────────────────────────────

// Shared by phase NUMBER across the developer (Sprint Dashboard) and client

// (Milestone Tracking) screens. Each screen keeps its own title/content via the

// `dev` / `client` views; workflow status is shared and synced cross-screen.

//

// Status bridge seed:

//   Phase 1 → completed   (both screens agree)

//   Phase 2 → active      (dev: "Active Sprint"; client: "Ready for Review")

//   Phase 3 → disputed    (client flagged; dev: "Needs Revision" + resubmit)

//   Phase 4 → upcoming

const COMMENT_CLIENT: Pick<PhaseComment, "avatar" | "avatarBg"> = {
  avatar: "ED",
  avatarBg: ["#ECFDF5", "#065F46"],
}

const COMMENT_ADMIN: Pick<PhaseComment, "avatar" | "avatarBg"> = {
  avatar: "JA",
  avatarBg: ["#F5F3FF", "#5B21B6"],
}

const seedComments: PhaseComment[] = [
  {
    id: "f1",
    author: "Ernesto Dela Vega",
    role: "client",
    time: "Aug 3 · 4:05 PM",
    text: "The POS flow looks great! One concern — the receipt layout cuts off product names longer than 18 characters. Can we adjust the font size or truncation logic?",
    ...COMMENT_CLIENT,
  },

  {
    id: "f2",
    author: "Marco Ramirez",
    role: "developer",
    time: "Aug 3 · 5:12 PM",
    text: "Noted! I'll update the receipt template to use dynamic truncation with a tooltip on hover. Will push the fix tonight.",
    avatar: "MR",
    avatarBg: ["#DBEAFE", "#1D4ED8"],
  },

  {
    id: "f3",
    author: "Ernesto Dela Vega",
    role: "client",
    time: "Aug 4 · 9:30 AM",
    text: "Also, the inventory table doesn't load on Safari iOS. Can you check compatibility?",
    ...COMMENT_CLIENT,
  },

  {
    id: "f4",
    author: "Juanita Arceo",
    role: "admin",
    time: "Aug 4 · 10:00 AM",
    text: "Flagging this for the audit log. Developer please confirm browser compatibility in the next update.",
    ...COMMENT_ADMIN,
  },
]

const seedPhases: ProjectPhase[] = [
  {
    number: 1,

    status: "completed",

    submittedAt: "Jun 18, 2026 · 11:42 AM",

    approvedAt: "Jun 21, 2026 · 9:15 AM",

    score: 5,

    dev: {
      title: "UI/UX Wireframing & Prototyping",

      deadline: "Jun 20, 2026",
      daysLeft: 0,

      description:
        "Deliver high-fidelity Figma prototype covering all primary user flows: product catalog, inventory management, and POS checkout.",

      repoLink:
        "https://github.com/marcoramirez-dev/apokon-ecommerce/releases/tag/v1.0-wireframes",

      prototypeLink: "https://www.figma.com/proto/apokon-v1",

      updates:
        "All 18 screens delivered via Figma. Client approved with minor color palette revisions on Jun 18.",
    },

    client: {
      title: "Database Schema & Authentication",

      deadline: "Jun 20, 2026",
      daysLeft: 0,

      description:
        "PostgreSQL schema + JWT authentication for the E-Commerce Inventory Portal.",

      repoLink:
        "https://github.com/marcoramirez-dev/apokon-ecommerce/tree/sprint-1-auth",

      updates:
        "Completed all authentication flows (JWT + refresh tokens), PostgreSQL schema for Users, Products, Inventory, and Transactions. Deployed to Railway staging. All endpoints documented in Postman collection linked in README.",
    },

    tasks: [
      { id: "t1a", label: "Design system & UI tokens", done: true },

      { id: "t1b", label: "Catalog & inventory flows", done: true },

      { id: "t1c", label: "POS checkout flow", done: true },

      { id: "t1d", label: "Client review & sign-off", done: true },
    ],

    comments: [],
  },

  {
    number: 2,

    status: "active",

    submittedAt: null,

    approvedAt: null,

    score: null,

    dev: {
      title: "Backend Auth & Database Schema",

      deadline: "Aug 5, 2026",
      daysLeft: 3,

      description:
        "Implement JWT-based authentication (login, role management for admin/cashier/inventory), PostgreSQL schema for products, stock levels, and transactions. Deploy to staging environment on Railway.",

      repoLink: "",

      prototypeLink: "https://apokon-ecommerce.vercel.app",

      updates: "",
    },

    client: {
      title: "Core Frontend UI Implementation",

      deadline: "Aug 5, 2026",
      daysLeft: 3,

      description: "All 12 frontend screens using Next.js + Tailwind CSS.",

      repoLink:
        "https://github.com/marcoramirez-dev/apokon-ecommerce/tree/sprint-2-frontend",

      prototypeLink: "https://apokon-ecommerce.vercel.app",

      updates:
        "All 12 frontend screens implemented using Next.js + Tailwind CSS. Includes product catalog, inventory table with search/filter, POS checkout flow, and admin role management. Staging preview deployed at apokon-ecommerce.vercel.app — credentials in README. Awaiting client review for color palette and typography sign-off before proceeding to API integration.",
    },

    tasks: [
      { id: "t2a", label: "JWT auth + role middleware", done: true },

      { id: "t2b", label: "Products & stock schema", done: true },

      { id: "t2c", label: "Railway staging deploy", done: false },
    ],

    comments: seedComments,
  },

  {
    number: 3,

    status: "disputed",

    submittedAt: null,

    approvedAt: null,

    score: null,

    revisionReason:
      "API contract mismatches reported by client during staging integration.",

    dev: {
      title: "Inventory CRUD & POS Module",

      deadline: "Aug 18, 2026",
      daysLeft: -2,

      description:
        "Build the full inventory CRUD interface, barcode scanner integration, and POS transaction flow with receipt generation.",

      repoLink: "",

      prototypeLink: "",

      updates: "",
    },

    client: {
      title: "API Integration & Backend Services",

      deadline: "Aug 18, 2026",
      daysLeft: -2,

      description:
        "Connect the frontend to the backend API and wire up backend services.",

      repoLink: "",

      prototypeLink: "",

      updates: "",
    },

    tasks: [
      { id: "t3a", label: "REST endpoints contract", done: true },

      { id: "t3b", label: "Frontend API wiring", done: false },
    ],

    comments: [],
  },

  {
    number: 4,

    status: "upcoming",

    submittedAt: null,

    approvedAt: null,

    score: null,

    dev: {
      title: "Reports, Testing & Deployment",

      deadline: "Aug 28, 2026",
      daysLeft: 25,

      description:
        "Generate sales and inventory reports (PDF export), conduct UAT with client, deploy to production on Vercel + Supabase.",

      repoLink: "",

      prototypeLink: "",

      updates: "",
    },

    client: {
      title: "Testing, Reports & Production Deployment",

      deadline: "Aug 28, 2026",
      daysLeft: 25,

      description: "System testing, reports and production deployment.",

      repoLink: "",

      prototypeLink: "",

      updates: "",
    },

    tasks: [
      { id: "t4a", label: "Sales & inventory reports", done: false },

      { id: "t4b", label: "UAT with client", done: false },
    ],

    comments: [],
  },
]

const seedNotifications: SprintNotification[] = [
  {
    id: "n1",
    type: "warning",
    time: "2 hours ago",
    read: false,
    text: "Deadline Reminder: Sprint 2 deliverable is due in 48 hours. Submit your GitHub repository link before Aug 5.",
  },

  {
    id: "n2",
    type: "success",
    time: "Jul 29",
    read: false,
    text: "Milestone Approved: Client verified Phase 1 — UI/UX Wireframing submission. Phase score: 5/5.",
  },

  {
    id: "n3",
    type: "info",
    time: "Jul 27",
    read: false,
    text: 'Message from Client: "Looking forward to the backend demo. Please confirm staging URL by Aug 3."',
  },

  {
    id: "n4",
    type: "warning",
    time: "Jul 26",
    read: true,
    text: "Sprint 2 progress is at 60%. Automated check suggests 2 remaining tasks before submission.",
  },

  {
    id: "n5",
    type: "success",
    time: "Jun 21",
    read: true,
    text: "Contract Milestone Payment released for Sprint 1: ₱4,500 credited to your wallet.",
  },
]

const seedProject: SprintProject = {
  id: "proj-apokon",

  project: "E-Commerce Inventory Portal",

  client: "Apokon Hardware MSME",

  developer: "Marco Ramirez",

  totalPhases: 4,

  deadline: "Aug 28, 2026",

  daysLeft: 25,

  contractType: "Fixed Price",

  totalBudget: 20000,

  phaseBudget: 5000,

  phasePayout: 4500,

  paidToDate: 4500,

  started: "Jun 2, 2026",

  platform: "StartupMatch v2",

  phases: seedPhases,

  notifications: seedNotifications,
}

// ─── Store ─────────────────────────────────────────────────────────────────────

let project: SprintProject = JSON.parse(
  JSON.stringify(seedProject),
) as SprintProject

// True once a real Supabase-backed contract has been loaded into `project`.
// While false, every action below falls through to the local mock mutation
// logic (unchanged from the original demo behavior).
let realActive = false

// False until a load has actually resolved (success or "no contract found").
// Lets callers tell "haven't checked yet" apart from "checked, genuinely
// nothing there" — without this, a slow/racy first fetch right after sign-in
// could be mistaken for "no contract" and never get retried.
let contractLoadAttempted = false

export function isUsingRealContract(): boolean {
  return realActive
}

export function hasAttemptedContractLoad(): boolean {
  return contractLoadAttempted
}

// Every contract this user is party to (id/title/status), for the Active
// Contract switcher. fetchActiveContract only ever loads one contract's full
// detail at a time — this is the list to pick from.
let contractSummaries: realContracts.ContractSummary[] = []

export function getContractSummaries(): realContracts.ContractSummary[] {
  return contractSummaries
}

export function useContractSummaries(): realContracts.ContractSummary[] {
  return useSyncExternalStore(subscribeProjectStore, getContractSummaries)
}

// Remembers which contract the user picked so a later refresh (after
// approving a phase, adding a comment, etc.) reloads that same one instead
// of silently reverting to the newest — refreshRealProject() with no
// argument means "whatever's currently selected," not "always newest."
let selectedContractId: string | undefined

async function refreshRealProject(contractId?: string) {
  if (contractId) selectedContractId = contractId

  try {
    const sp = await realContracts.fetchActiveContract(contractId ?? selectedContractId)
    if (sp) {
      realActive = true
      project = sp
      selectedContractId = sp.id
    } else {
      realActive = false
    }
  } catch {
    realActive = false
  }
  contractLoadAttempted = true

  if (realActive) {
    // Best-effort, non-blocking: the switcher list shouldn't delay or break
    // loading the contract itself.
    realContracts
      .fetchMyContractSummaries()
      .then((list) => {
        contractSummaries = list
        emit()
      })
      .catch(() => {})
  } else {
    contractSummaries = []
  }

  emit()
}

// Switches the loaded contract to a specific one from the summaries list
// (e.g. the Active Contract dropdown) rather than always the newest.
export function selectContract(contractId: string) {
  void refreshRealProject(contractId)
}

// Call after sign-in (or on demand) to load/refresh the current user's real
// contract. Safe to call for demo/mock accounts too — it just resolves to
// null and leaves the mock store in place.
export function loadRealContractForCurrentUser() {
  void refreshRealProject()
}

export function clearRealContract() {
  contractLoadAttempted = false
  realActive = false
  contractSummaries = []
  selectedContractId = undefined
  realContracts.clearActiveContract()
  project = JSON.parse(JSON.stringify(seedProject)) as SprintProject
  emit()
}

const listeners = new Set<() => void>()

function emit() {
  // Error handling: one bad listener should not break others — best practice for external store
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      // ignore
    }
  })
}

export function subscribeProjectStore(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getProjectSnapshot(): SprintProject {
  return project
}

export function useProjectStore() {
  return useSyncExternalStore(subscribeProjectStore, getProjectSnapshot)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Defense-in-depth: a real signed-in user must never silently mutate the
// shared demo/mock `project` object — the UI already gates every mutator
// behind an active real contract, but the store itself should refuse too,
// not rely solely on that gating (unlike marketplace.ts's writes, which
// check this themselves). Only a true demo session (no cached auth profile)
// may fall through to the mock mutation path below.
function mockMutationAllowed(): boolean {
  return !getCachedAuthProfile()
}

function patchPhase(
  number: number,
  updater: (phase: ProjectPhase) => ProjectPhase,
) {
  // Error handling: guard against corrupted project.phases being non-array
  try {
    if (!mockMutationAllowed()) return
    if (!Array.isArray(project?.phases)) return
    if (typeof number !== "number" || !Number.isFinite(number)) return
    project = {
      ...project,

      phases: project.phases.map((p) => (p.number === number ? updater(p) : p)),
    }

    emit()
  } catch {
    // fail silently — best practice for store mutation
  }
}

// Optimistic counterpart to patchPhase for a real (Supabase-backed) contract:
// applies the same shape of local patch immediately so the UI responds on
// the keystroke/click instead of waiting on a network round trip, while the
// real write happens in the background. Unlike patchPhase, this is the only
// mutator allowed to touch `project` while realActive — callers still fire
// the real write themselves and should resync (refreshRealProject) on error.
function patchRealPhase(
  number: number,
  updater: (phase: ProjectPhase) => ProjectPhase,
) {
  try {
    if (!realActive) return
    if (!Array.isArray(project?.phases)) return
    if (typeof number !== "number" || !Number.isFinite(number)) return
    project = {
      ...project,
      phases: project.phases.map((p) => (p.number === number ? updater(p) : p)),
    }
    emit()
  } catch {
    // ignore
  }
}

function pushNotification(type: SprintNotifType, text: string) {
  // Error handling: guard against empty text or corrupted project
  try {
    if (!mockMutationAllowed()) return
    if (!text || typeof text !== "string") return
    const n: SprintNotification = {
      id: `n${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,

      type,
      text,
      time: "Just now",
      read: false,
    }

    // Edge: notifications may be non-array after corrupted load
    const existing = Array.isArray(project?.notifications) ? project.notifications : []
    project = { ...project, notifications: [n, ...existing] }

    emit()
  } catch {
    // ignore
  }
}

const DEV_NOW = "Just now"

function devIdentity() {
  const profile = getDevSnapshot().profile

  return {
    author: profile.name,

    avatar: profile.initials,

    avatarBg: profile.avatarColors,
  }
}

const CLIENT_IDENTITY = () => {
  const c = clientIdentity()

  return { author: c.name, avatar: c.initials, avatarBg: c.avatarColors }
}

const ADMIN_IDENTITY = {
  author: "Juanita Arceo",
  avatar: "JA",
  avatarBg: ["#F5F3FF", "#5B21B6"] as [string, string],
}

export function formatPeso(n: number) {
  // Error handling: guard non-number input (e.g., NaN from corrupted budget)
  try {
    const val = typeof n === "number" && Number.isFinite(n) ? n : 0
    return `₱${val.toLocaleString("en-US")}`
  } catch {
    return "₱0"
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export function submitPhase(number: number, repoLink: string, notes: string) {
  if (realActive) {
    realContracts.submitPhase(number, repoLink, notes).then(() => refreshRealProject()).catch(() => {})
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,

    status: "in_review" as const,

    submittedAt: DEV_NOW,

    dev: {
      ...phase.dev,

      repoLink: repoLink || phase.dev.repoLink,

      updates: notes || phase.dev.updates,
    },
  }))

  pushNotification(
    "info",
    `Sprint ${number} submitted for verification. Awaiting client review.`,
  )
}

export function resubmitPhase(number: number, repoLink: string, notes: string) {
  if (realActive) {
    realContracts.resubmitPhase(number, repoLink, notes).then(() => refreshRealProject()).catch(() => {})
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,

    status: "in_review" as const,

    submittedAt: DEV_NOW,

    revisionReason: undefined,

    dev: {
      ...phase.dev,

      repoLink: repoLink || phase.dev.repoLink,

      updates: notes || phase.dev.updates,
    },
  }))

  pushNotification(
    "info",
    `Sprint ${number} resubmitted after revision. Ready for client re-review.`,
  )
}

export function reviseSubmission(number: number) {
  if (realActive) {
    realContracts.reviseSubmission(number).then(() => refreshRealProject()).catch(() => {})
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,

    status: "active" as const,

    submittedAt: null,
  }))
}

// Debounced background writer for the three dev-side text fields below: an
// un-debounced write-per-keystroke was hitting Supabase on every character,
// and the eventual refreshRealProject() replaying over local state while the
// user kept typing is what made characters appear dropped/reordered. Each
// field gets its own timer (keyed by phase+field) so edits to different
// fields/phases don't cancel each other.
const pendingFieldWrites = new Map<string, ReturnType<typeof setTimeout>>()
const FIELD_WRITE_DEBOUNCE_MS = 700

function writeFieldDebounced(key: string, write: () => Promise<unknown>) {
  const existing = pendingFieldWrites.get(key)
  if (existing) clearTimeout(existing)
  pendingFieldWrites.set(
    key,
    setTimeout(() => {
      pendingFieldWrites.delete(key)
      // Best-effort: on failure we don't refetch, since that would overwrite
      // whatever the user has typed since — the next edit's debounced write
      // will retry with the latest value anyway.
      write().catch(() => {})
    }, FIELD_WRITE_DEBOUNCE_MS),
  )
}

export function updateRepoLink(number: number, url: string) {
  if (realActive) {
    patchRealPhase(number, (phase) => ({
      ...phase,
      dev: { ...phase.dev, repoLink: url },
    }))
    writeFieldDebounced(`repoLink:${number}`, () => realContracts.updateRepoLink(number, url))
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,
    dev: { ...phase.dev, repoLink: url },
  }))
}

export function updatePrototypeLink(number: number, url: string) {
  if (realActive) {
    patchRealPhase(number, (phase) => ({
      ...phase,
      dev: { ...phase.dev, prototypeLink: url },
    }))
    writeFieldDebounced(`prototypeLink:${number}`, () => realContracts.updatePrototypeLink(number, url))
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,
    dev: { ...phase.dev, prototypeLink: url },
  }))
}

export function updateNotes(number: number, text: string) {
  if (realActive) {
    patchRealPhase(number, (phase) => ({
      ...phase,
      dev: { ...phase.dev, updates: text },
    }))
    writeFieldDebounced(`notes:${number}`, () => realContracts.updateNotes(number, text))
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,
    dev: { ...phase.dev, updates: text },
  }))
}

export function addTask(number: number, label: string) {
  if (realActive) {
    const tempId = `t${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    patchRealPhase(number, (phase) => ({
      ...phase,
      tasks: [...phase.tasks, { id: tempId, label, done: false }],
    }))
    // Reconciles the temp id with the real one once the write lands — UI
    // already reflects the add, so this refresh is invisible either way.
    realContracts.addTask(number, label).then(() => refreshRealProject()).catch(() => void refreshRealProject())
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,

    tasks: [
      ...phase.tasks,
      {
        id: `t${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        done: false,
      },
    ],
  }))
}

export function completeTask(number: number, taskId: string) {
  if (realActive) {
    patchRealPhase(number, (phase) => ({
      ...phase,
      tasks: phase.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
    }))
    // Only resync on failure (rollback) — on success the optimistic state
    // above already matches the server, so no refetch is needed.
    realContracts.completeTask(taskId).catch(() => void refreshRealProject())
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,

    tasks: phase.tasks.map((t) =>
      t.id === taskId ? { ...t, done: !t.done } : t,
    ),
  }))
}

export function addComment(number: number, text: string, role: CommentRole) {
  // Error handling: validate inputs — throw so caller can surface inline error per Clarification 2
  // Edge: empty or whitespace-only text should throw
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Message cannot be empty")
  }
  if (typeof number !== "number" || !Number.isFinite(number)) {
    throw new Error("Invalid phase number")
  }

  if (realActive) {
    realContracts.addComment(number, text, role).then(() => refreshRealProject()).catch(() => {})
    return
  }

  const identity =
    role === "developer"
      ? devIdentity()
      : role === "client"
        ? CLIENT_IDENTITY()
        : ADMIN_IDENTITY

  const comment: PhaseComment = {
    id: `c${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,

    role,

    time: DEV_NOW,

    text: text.trim(),

    ...identity,
  }

  patchPhase(number, (phase) => ({
    ...phase,
    comments: [...(Array.isArray(phase.comments) ? phase.comments : []), comment],
  }))

  if (role !== "developer") {
    pushNotification(
      role === "client" ? "info" : "warning",
      `Message from ${identity.author}: "${text.trim()}"`,
    )
  }
}

export function deleteComment(number: number, commentId: string) {
  if (realActive) {
    patchRealPhase(number, (phase) => ({
      ...phase,
      comments: phase.comments.filter((c) => c.id !== commentId),
    }))
    // Rollback via resync if the server refuses the delete (e.g. not the
    // author) — RLS is the real guard, the UI just reflects the outcome.
    realContracts.deleteComment(commentId).catch(() => void refreshRealProject())
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,
    comments: phase.comments.filter((c) => c.id !== commentId),
  }))
}

export function approvePhase(number: number, score = 5) {
  if (realActive) {
    realContracts.approvePhase(number, score).then(() => refreshRealProject()).catch(() => {})
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,

    status: "completed" as const,

    approvedAt: DEV_NOW,

    score,
  }))

  project = { ...project, paidToDate: project.paidToDate + project.phasePayout }

  emit()

  pushNotification(
    "success",
    `Milestone Approved: Client verified Phase ${number}. Phase score: ${score}/5.`,
  )

  pushNotification(
    "success",
    `Contract Milestone Payment released for Sprint ${number}: ${formatPeso(project.phasePayout)} credited to your wallet.`,
  )
}

export function disputePhase(number: number, note: string) {
  if (realActive) {
    realContracts.disputePhase(number, note).then(() => refreshRealProject()).catch(() => {})
    return
  }

  patchPhase(number, (phase) => ({
    ...phase,

    status: "disputed" as const,

    revisionReason: note || phase.revisionReason,
  }))

  if (note) {
    addComment(number, note, "client")
  }

  pushNotification(
    "warning",
    `Client flagged Sprint ${number} for dispute / revision. Review the feedback and resubmit.`,
  )
}

export function markNotificationRead(id: string) {
  if (realActive) {
    realContracts.markNotificationRead(id).then(() => refreshRealProject()).catch(() => {})
    return
  }
  if (!mockMutationAllowed()) return

  project = {
    ...project,

    notifications: project.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n,
    ),
  }

  emit()
}

export function markAllNotificationsRead() {
  if (realActive) {
    realContracts.markAllNotificationsRead().then(() => refreshRealProject()).catch(() => {})
    return
  }
  if (!mockMutationAllowed()) return

  project = {
    ...project,
    notifications: project.notifications.map((n) => ({ ...n, read: true })),
  }

  emit()
}

export function resetDemo() {
  if (realActive) return // resetting the demo has no meaning for a real contract

  project = (JSON.parse(JSON.stringify(seedProject)) as SprintProject)

  emit()
}
