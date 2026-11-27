// Real inbox / direct messages — independent of any contract or sprint
// phase. See supabase/migrations/20260907100000_messaging_inbox.sql for the
// schema (conversations / conversation_participants / messages).
//
// No websocket subscription here — plain polling while a hook is mounted.
// Simple, and plenty responsive for a two-person chat at this scale.

import { useCallback, useEffect, useState } from "react"
import { supabase } from "./lib/supabaseClient"
import { getCachedAuthProfile } from "./supabaseAuth"

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    return sameDay
      ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return iso
  }
}

export interface ConversationRow {
  id: string
  otherProfileId: string
  otherName: string
  otherRole: string
  otherInitials: string
  otherAvatarUrl: string | null
  lastMessagePreview: string
  lastMessageAt: string
  unreadCount: number
}

export interface MessageRow {
  id: string
  senderId: string
  senderName: string
  body: string
  time: string
  isMine: boolean
}

export interface MessageableProfile {
  id: string
  name: string
  role: string
  initials: string
  avatarUrl: string | null
}

async function fetchConversations(myId: string): Promise<ConversationRow[]> {
  const { data: myParticipation, error: e1 } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("profile_id", myId)
  if (e1) throw e1

  const convIds = (myParticipation ?? []).map((p) => p.conversation_id)
  if (convIds.length === 0) return []

  const lastReadByConv = new Map((myParticipation ?? []).map((p) => [p.conversation_id, p.last_read_at]))

  const [otherPartsRes, convsRes, messagesRes] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("conversation_id, profile_id")
      .in("conversation_id", convIds)
      .neq("profile_id", myId),
    supabase.from("conversations").select("id, last_message_at").in("id", convIds),
    supabase
      .from("messages")
      .select("conversation_id, sender_id, body, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false }),
  ])
  if (otherPartsRes.error) throw otherPartsRes.error
  if (convsRes.error) throw convsRes.error
  if (messagesRes.error) throw messagesRes.error

  const otherIdByConv = new Map(otherPartsRes.data.map((p) => [p.conversation_id, p.profile_id]))
  const otherIds = [...new Set(otherPartsRes.data.map((p) => p.profile_id))]

  const { data: otherProfiles } = otherIds.length
    ? await supabase.from("profiles").select("id, name, role, avatar_url").in("id", otherIds)
    : { data: [] as { id: string; name: string; role: string; avatar_url: string | null }[] }
  const profileById = new Map((otherProfiles ?? []).map((p) => [p.id, p]))

  const lastMsgByConv = new Map<string, { body: string; created_at: string }>()
  const unreadByConv = new Map<string, number>()
  for (const m of messagesRes.data ?? []) {
    if (!lastMsgByConv.has(m.conversation_id)) lastMsgByConv.set(m.conversation_id, m)
    const lastRead = lastReadByConv.get(m.conversation_id)
    if (m.sender_id !== myId && (!lastRead || new Date(m.created_at) > new Date(lastRead))) {
      unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1)
    }
  }

  const lastMessageAtByConv = new Map((convsRes.data ?? []).map((c) => [c.id, c.last_message_at]))

  return convIds
    .map((id) => {
      const otherId = otherIdByConv.get(id)
      const profile = otherId ? profileById.get(otherId) : undefined
      const lastMsg = lastMsgByConv.get(id)
      return {
        id,
        otherProfileId: otherId ?? "",
        otherName: profile?.name ?? "Unknown User",
        otherRole: profile?.role ?? "",
        otherInitials: initialsFrom(profile?.name ?? "?"),
        otherAvatarUrl: profile?.avatar_url ?? null,
        lastMessagePreview: lastMsg?.body ?? "No messages yet",
        lastMessageAt: lastMessageAtByConv.get(id) ?? "",
        unreadCount: unreadByConv.get(id) ?? 0,
      }
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    const me = getCachedAuthProfile()
    if (!me) {
      setConversations([])
      setLoading(false)
      return
    }
    fetchConversations(me.id)
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  return { conversations, loading, refresh }
}

async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  const me = getCachedAuthProfile()
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
  if (error) throw error

  const senderIds = [...new Set((data ?? []).map((m) => m.sender_id))]
  const { data: senders } = senderIds.length
    ? await supabase.from("profiles").select("id, name").in("id", senderIds)
    : { data: [] as { id: string; name: string }[] }
  const nameById = new Map((senders ?? []).map((s) => [s.id, s.name]))

  return (data ?? []).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    senderName: nameById.get(m.sender_id) ?? "Unknown",
    body: m.body,
    time: formatTimestamp(m.created_at),
    isMine: m.sender_id === me?.id,
  }))
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }
    fetchMessages(conversationId)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [conversationId])

  useEffect(() => {
    setLoading(true)
    refresh()
    if (!conversationId) return
    const interval = setInterval(refresh, 4000)
    return () => clearInterval(interval)
  }, [refresh, conversationId])

  return { messages, loading, refresh }
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  const me = getCachedAuthProfile()
  if (!me) throw new Error("Not signed in")
  const trimmed = body.trim()
  if (!trimmed) return

  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: me.id, body: trimmed })
  if (error) throw error
}

export async function startConversationWith(otherProfileId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    other_profile_id: otherProfileId,
  })
  if (error) throw error
  return data as string
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const me = getCachedAuthProfile()
  if (!me) return
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", me.id)
}

// Contacts only, not the whole user directory: a student sees the businesses
// whose projects they bid on, a business sees the students who bid on its
// projects. Moderators are reached through Help (support tickets) instead.
// shortcut: enforced in the UI only — get_or_create_conversation still accepts
// any profile id; move this rule into that function if it must be strict.
async function fetchContactIds(me: { id: string; role: string }): Promise<string[]> {
  if (me.role === "student") {
    const { data, error } = await supabase
      .from("bids")
      .select("marketplace_projects(enterprise_id)")
      .eq("student_id", me.id)
    if (error) throw error
    return (data as unknown as { marketplace_projects: { enterprise_id: string } | null }[])
      .map((b) => b.marketplace_projects?.enterprise_id ?? "")
  }
  if (me.role === "enterprise") {
    const { data, error } = await supabase
      .from("bids")
      .select("student_id, marketplace_projects!inner(enterprise_id)")
      .eq("marketplace_projects.enterprise_id", me.id)
    if (error) throw error
    return (data as unknown as { student_id: string }[]).map((b) => b.student_id)
  }
  return []
}

export async function searchMessageableProfiles(query: string): Promise<MessageableProfile[]> {
  const me = getCachedAuthProfile()
  if (!me) return []
  const ids = [...new Set(await fetchContactIds(me))].filter((id) => id && id !== me.id)
  if (ids.length === 0) return []

  let q = supabase
    .from("profiles")
    .select("id, name, role, avatar_url")
    .in("id", ids)
    .order("name")
    .limit(20)
  if (query.trim()) q = q.ilike("name", `%${query.trim()}%`)

  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    initials: initialsFrom(p.name),
    avatarUrl: p.avatar_url ?? null,
  }))
}
