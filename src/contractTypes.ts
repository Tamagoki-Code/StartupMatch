// Shared types for the sprint/milestone contract system. Split out from
// projectStore.ts so both the mock store and the real Supabase-backed
// contracts.ts can depend on the same shapes without a circular import.

export type SprintPhaseStatus = "completed" | "active" | "in_review" | "disputed" | "revision" | "upcoming"

export type SprintNotifType = "warning" | "success" | "info"

export type CommentRole = "developer" | "client" | "admin"

export interface PhaseTask {
  id: string

  label: string

  done: boolean
}

export interface PhaseComment {
  id: string

  author: string

  authorId?: string

  role: CommentRole

  avatar: string

  avatarBg: [string, string]

  time: string

  text: string
}

export interface PhaseView {
  title: string

  deadline: string

  daysLeft: number

  description: string

  repoLink: string

  prototypeLink?: string

  updates: string
}

export interface ProjectPhase {
  number: number

  status: SprintPhaseStatus

  submittedAt: string | null

  approvedAt: string | null

  score: number | null

  revisionReason?: string

  dev: PhaseView

  client: PhaseView

  tasks: PhaseTask[]

  comments: PhaseComment[]
}

export interface SprintNotification {
  id: string

  type: SprintNotifType

  time: string

  text: string

  read: boolean
}

export interface SprintProject {
  id: string

  project: string

  client: string

  developer: string

  totalPhases: number

  deadline: string

  daysLeft: number

  contractType: string

  totalBudget: number

  phaseBudget: number

  phasePayout: number

  paidToDate: number

  started: string

  platform: string

  phases: ProjectPhase[]

  notifications: SprintNotification[]
}
