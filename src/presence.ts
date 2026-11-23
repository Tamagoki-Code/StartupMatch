// Live Activity / presence: a heartbeat updates profiles.last_seen_at while a
// real signed-in user has the app open. "Online" is derived from recency of
// that timestamp rather than a separate explicit online/offline flag — a
// closed tab can't reliably fire an "I'm leaving" event, but it reliably
// stops sending heartbeats, so recency alone is enough.
import { useEffect } from "react"
import { supabase } from "./lib/supabaseClient"
import { getCachedAuthProfile } from "./supabaseAuth"

const HEARTBEAT_MS = 25_000
const ONLINE_THRESHOLD_MS = 60_000

// Call once near the app root. No-ops for demo/unauthenticated sessions.
export function useLiveActivityHeartbeat() {
  useEffect(() => {
    // Checked fresh on every tick, not just at mount: the cached auth
    // profile may not be populated yet on first render (restoreSession()
    // resolves asynchronously), so gating once here would permanently skip
    // the heartbeat for a user whose session restore just hasn't landed yet.
    const beat = () => {
      const me = getCachedAuthProfile()
      if (!me) return
      supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", me.id).then(undefined, () => {})
    }
    beat()
    const id = setInterval(beat, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [])
}

export function isRecentlyActive(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
}
