// Help / support tickets between users and PSITS moderators. Row Level
// Security scopes reads: a user gets only their own tickets, a moderator
// (admin) gets all of them. Notifications are sent by a database trigger.
// Schema: supabase/migrations/20260908260000_support_tickets_and_avatars.sql

import { supabase } from "./lib/supabaseClient"
import { getCachedAuthProfile } from "./supabaseAuth"

export const TICKET_CATEGORIES = [
  "General",
  "Account & Verification",
  "Projects & Bids",
  "Milestones & Payments",
  "Report a Problem",
] as const

export type TicketStatus = "open" | "in_progress" | "resolved"

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
}

export interface Ticket {
  id: string
  subject: string
  category: string
  status: TicketStatus
  updatedAt: string
  createdByName: string
  createdByRole: string
}

export interface TicketMessage {
  id: string
  body: string
  time: string
  authorName: string
  fromModerator: boolean
  isMine: boolean
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

type ProfileJoin = { name: string; role: string } | null

export async function fetchTickets(): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, subject, category, status, updated_at, profiles(name, role)")
    .order("updated_at", { ascending: false })
  if (error) throw error
  return (data as unknown as { id: string; subject: string; category: string; status: TicketStatus; updated_at: string; profiles: ProfileJoin }[])
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      category: t.category,
      status: t.status,
      updatedAt: formatDateTime(t.updated_at),
      createdByName: t.profiles?.name ?? "Unknown user",
      createdByRole: t.profiles?.role ?? "",
    }))
}

export async function fetchTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const me = getCachedAuthProfile()
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("id, body, created_at, author_id, profiles(name, role)")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data as unknown as { id: string; body: string; created_at: string; author_id: string; profiles: ProfileJoin }[])
    .map((m) => ({
      id: m.id,
      body: m.body,
      time: formatDateTime(m.created_at),
      authorName: m.profiles?.name ?? "Unknown user",
      fromModerator: m.profiles?.role === "admin",
      isMine: m.author_id === me?.id,
    }))
}

export async function createTicket(subject: string, category: string, body: string): Promise<string> {
  const me = getCachedAuthProfile()
  if (!me) throw new Error("Please sign in to contact support")
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({ created_by: me.id, subject: subject.trim(), category })
    .select("id")
    .single()
  if (error) throw error
  await replyToTicket(data.id as string, body)
  return data.id as string
}

export async function replyToTicket(ticketId: string, body: string): Promise<void> {
  const me = getCachedAuthProfile()
  if (!me) throw new Error("Please sign in to contact support")
  const { error } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticketId, author_id: me.id, body: body.trim() })
  if (error) throw error
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId)
  if (error) throw error
}
