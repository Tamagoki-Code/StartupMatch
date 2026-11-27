import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { getCachedAuthProfile } from "./supabaseAuth"
import {
  TICKET_CATEGORIES,
  TICKET_STATUS_LABEL,
  createTicket,
  fetchTicketMessages,
  fetchTickets,
  replyToTicket,
  setTicketStatus,
} from "./support"
import type { Ticket, TicketMessage, TicketStatus } from "./support"

const FONT = "Inter, sans-serif"

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #E2E8F0",
  borderRadius: 8,
  fontFamily: FONT,
  fontSize: 13,
  color: "#334155",
  outline: "none",
  boxSizing: "border-box",
  background: "#fff",
}

const primaryButton: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "#2563EB",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: FONT,
}

const secondaryButton: CSSProperties = {
  ...primaryButton,
  background: "#fff",
  color: "#475569",
  border: "1.5px solid #E2E8F0",
}

const STATUS_COLORS: Record<TicketStatus, { bg: string; fg: string; border: string }> = {
  open: { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" },
  in_progress: { bg: "#FFFBEB", fg: "#B45309", border: "#FDE68A" },
  resolved: { bg: "#F0FDF4", fg: "#15803D", border: "#BBF7D0" },
}

const ROLE_LABEL: Record<string, string> = { student: "Student", enterprise: "Business", admin: "Moderator" }

function StatusPill({ status }: { status: TicketStatus }) {
  const c = STATUS_COLORS[status]
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 99,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {TICKET_STATUS_LABEL[status]}
    </span>
  )
}

function Note({ text, tone = "muted" }: { text: string; tone?: "muted" | "error" }) {
  return (
    <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: tone === "error" ? "#B91C1C" : "#94A3B8" }}>
      {text}
    </div>
  )
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback
}

function TicketList({
  tickets,
  activeId,
  onSelect,
  showOwner,
}: {
  tickets: Ticket[]
  activeId: string | null
  onSelect: (id: string) => void
  showOwner: boolean
}) {
  return (
    <div>
      {tickets.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "12px 16px",
            border: "none",
            borderBottom: "1px solid #F1F5F9",
            background: t.id === activeId ? "#EFF6FF" : "#fff",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: FONT,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#0F172A",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {t.subject}
            </span>
            <StatusPill status={t.status} />
          </div>
          <span style={{ fontSize: 11.5, color: "#64748B" }}>
            {showOwner ? `${t.createdByName} · ${ROLE_LABEL[t.createdByRole] ?? t.createdByRole} · ` : ""}
            {t.category} · {t.updatedAt}
          </span>
        </button>
      ))}
    </div>
  )
}

function TicketThread({
  ticket,
  moderator,
  onChanged,
}: {
  ticket: Ticket
  moderator: boolean
  onChanged: () => void
}) {
  const [messages, setMessages] = useState<TicketMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoadError(null)
    fetchTicketMessages(ticket.id)
      .then(setMessages)
      .catch((e) => setLoadError(errorText(e, "Could not load this request")))
      .finally(() => setLoading(false))
  }, [ticket.id])

  useEffect(() => {
    setLoading(true)
    setDraft("")
    setActionError(null)
    load()
  }, [load])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" })
  }, [messages.length])

  async function send() {
    if (!draft.trim()) return
    setBusy(true)
    setActionError(null)
    try {
      await replyToTicket(ticket.id, draft)
      setDraft("")
      load()
      onChanged()
    } catch (e) {
      setActionError(errorText(e, "Failed to send — please retry"))
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(status: TicketStatus) {
    setActionError(null)
    try {
      await setTicketStatus(ticket.id, status)
      onChanged()
    } catch (e) {
      setActionError(errorText(e, "Could not update the status"))
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{ticket.subject}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#64748B" }}>
          {moderator ? (
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Status
              <select
                value={ticket.status}
                onChange={(e) => changeStatus(e.target.value as TicketStatus)}
                style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 12 }}
              >
                {(Object.keys(TICKET_STATUS_LABEL) as TicketStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {TICKET_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <StatusPill status={ticket.status} />
          )}
          <span>
            {moderator ? `${ticket.createdByName} (${ROLE_LABEL[ticket.createdByRole] ?? ticket.createdByRole}) · ` : ""}
            {ticket.category}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10, background: "#F8FAFC" }}>
        {loading ? (
          <Note text="Loading…" />
        ) : loadError ? (
          <Note text={loadError} tone="error" />
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ alignSelf: m.isMine ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 3, textAlign: m.isMine ? "right" : "left" }}>
                {m.isMine ? "You" : m.fromModerator ? `${m.authorName} · PSITS Moderator` : m.authorName} · {m.time}
              </div>
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  background: m.isMine ? "#2563EB" : "#fff",
                  color: m.isMine ? "#fff" : "#0F172A",
                  border: m.isMine ? "none" : "1px solid #E2E8F0",
                }}
              >
                {m.body}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div style={{ padding: 12, borderTop: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 8 }}>
        {!moderator && ticket.status === "resolved" && (
          <div style={{ fontSize: 12, color: "#64748B" }}>
            This request is marked resolved. If you still need help, reply and a moderator will see it.
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            aria-label="Reply"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={4000}
            rows={2}
            placeholder={moderator ? "Reply to the user…" : "Write a reply…"}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <button onClick={send} disabled={busy || !draft.trim()} style={{ ...primaryButton, opacity: busy || !draft.trim() ? 0.6 : 1, alignSelf: "flex-end" }}>
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
        {actionError && <div role="alert" style={{ fontSize: 12, color: "#B91C1C" }}>{actionError}</div>}
      </div>
    </div>
  )
}

function NewTicketForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [category, setCategory] = useState<string>(TICKET_CATEGORIES[0])
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = subject.trim().length > 0 && body.trim().length > 0

  async function submit() {
    if (!ready) return
    setBusy(true)
    setError(null)
    try {
      onCreated(await createTicket(subject, category, body))
    } catch (e) {
      setError(errorText(e, "Could not send your request — please retry"))
      setBusy(false)
    }
  }

  const label: CSSProperties = { fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6, display: "block" }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
      <div>
        <label style={label} htmlFor="ticket-category">Topic</label>
        <select id="ticket-category" value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={label} htmlFor="ticket-subject">Subject</label>
        <input
          id="ticket-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
          placeholder="e.g. My account is still pending verification"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={label} htmlFor="ticket-body">Describe the problem</label>
        <textarea
          id="ticket-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          rows={5}
          placeholder="Include what you were doing and what happened."
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>
      {error && <div role="alert" style={{ fontSize: 12.5, color: "#B91C1C" }}>{error}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={secondaryButton}>Cancel</button>
        <button onClick={submit} disabled={busy || !ready} style={{ ...primaryButton, opacity: busy || !ready ? 0.6 : 1 }}>
          {busy ? "Sending…" : "Send to Support"}
        </button>
      </div>
    </div>
  )
}

function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refresh = useCallback(() => {
    setError(null)
    fetchTickets()
      .then(setTickets)
      .catch((e) => setError(errorText(e, "Could not load support requests")))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  return { tickets, loading, error, refresh }
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const { tickets, loading, error, refresh } = useTickets()
  const [view, setView] = useState<"list" | "new" | string>("list")
  const active = tickets.find((t) => t.id === view) ?? null

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onClose])

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.48)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 560,
          height: "min(640px, 90vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0px 8px 24px rgba(0,0,0,0.16)",
          fontFamily: FONT,
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10 }}>
          {view !== "list" && (
            <button onClick={() => setView("list")} style={{ ...secondaryButton, padding: "4px 10px", fontSize: 12 }}>
              Back
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="help-title" style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
              {view === "new" ? "New Support Request" : "Help & Support"}
            </div>
            {view === "list" && (
              <div style={{ fontSize: 12, color: "#64748B" }}>Send a request to the PSITS moderators. You'll be notified when they reply.</div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close help" style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20, lineHeight: 1 }}>
            ×
          </button>
        </div>

        {view === "new" ? (
          <NewTicketForm
            onCancel={() => setView("list")}
            onCreated={(id) => {
              refresh()
              setView(id)
            }}
          />
        ) : active ? (
          <TicketThread ticket={active} moderator={false} onChanged={refresh} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
            <div style={{ padding: 16, borderBottom: "1px solid #F1F5F9" }}>
              <button onClick={() => setView("new")} style={{ ...primaryButton, width: "100%" }}>
                Contact Support
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {loading ? (
                <Note text="Loading…" />
              ) : error ? (
                <Note text={error} tone="error" />
              ) : tickets.length === 0 ? (
                <Note text="You haven't sent any support requests yet." />
              ) : (
                <TicketList tickets={tickets} activeId={null} onSelect={setView} showOwner={false} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Top-bar entry point for students and businesses; moderators work tickets
// from the Support Tickets page instead.
export function HelpButton() {
  const [open, setOpen] = useState(false)
  const role = getCachedAuthProfile()?.role
  if (!role || role === "admin") return null
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Help and support"
        title="Help & Support"
        style={{
          background: "none",
          border: "1px solid #E2E8F0",
          borderRadius: 8,
          padding: "6px 8px",
          cursor: "pointer",
          color: "#64748B",
          lineHeight: 0,
        }}
      >
        <svg width={16} height={16} viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7.6 7.6a2.5 2.5 0 014.8 1c0 1.7-2.4 2-2.4 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="14.6" r="0.9" fill="currentColor" />
        </svg>
      </button>
      {open && <HelpModal onClose={() => setOpen(false)} />}
    </>
  )
}

const FILTERS: { id: "active" | TicketStatus | "all"; label: string }[] = [
  { id: "active", label: "Needs Attention" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
]

export function SupportTicketsPage({ isMobile }: { isMobile: boolean }) {
  const { tickets, loading, error, refresh } = useTickets()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active")
  const [activeId, setActiveId] = useState<string | null>(null)

  const shown = tickets.filter((t) =>
    filter === "all" ? true : filter === "active" ? t.status !== "resolved" : t.status === filter,
  )
  const active = tickets.find((t) => t.id === activeId) ?? null
  const openCount = tickets.filter((t) => t.status === "open").length
  const showList = !isMobile || !active
  const showThread = !isMobile || !!active

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>
      <div>
        <h1 style={{ margin: "0 0 6px", fontSize: isMobile ? 20 : 24, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.03em" }}>
          Support Tickets
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "#64748B" }}>
          Help requests from students and businesses. {openCount} new {openCount === 1 ? "request" : "requests"}.
        </p>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              ...secondaryButton,
              padding: "6px 12px",
              fontSize: 12.5,
              background: filter === f.id ? "#EFF6FF" : "#fff",
              color: filter === f.id ? "#1D4ED8" : "#475569",
              borderColor: filter === f.id ? "#BFDBFE" : "#E2E8F0",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #E2E8F0",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          height: 560,
        }}
      >
        {showList && (
          <div style={{ width: isMobile ? "100%" : 300, flexShrink: 0, borderRight: isMobile ? "none" : "1px solid #F1F5F9", overflowY: "auto" }}>
            {loading ? (
              <Note text="Loading…" />
            ) : error ? (
              <Note text={error} tone="error" />
            ) : shown.length === 0 ? (
              <Note text="No requests here." />
            ) : (
              <TicketList tickets={shown} activeId={activeId} onSelect={setActiveId} showOwner />
            )}
          </div>
        )}
        {showThread && (
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {active ? (
              <>
                {isMobile && (
                  <button onClick={() => setActiveId(null)} style={{ ...secondaryButton, margin: "10px 12px 0", alignSelf: "flex-start", padding: "4px 10px", fontSize: 12 }}>
                    Back to tickets
                  </button>
                )}
                <TicketThread ticket={active} moderator onChanged={refresh} />
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Note text="Select a request to read and reply." />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
