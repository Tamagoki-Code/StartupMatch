// The signed-in user's profile photo (profiles.avatar_url), shared so every
// avatar on screen updates as soon as a new photo is saved in Settings.

import { useEffect, useState } from "react"
import { supabase } from "./lib/supabaseClient"
import { getCachedAuthProfile } from "./supabaseAuth"

let cache: { userId: string; url: string | null } | null = null
const listeners = new Set<() => void>()

function current(): string | null {
  const me = getCachedAuthProfile()
  return me && cache?.userId === me.id ? cache.url : null
}

async function load(userId: string) {
  const { data } = await supabase.from("profiles").select("avatar_url").eq("id", userId).single()
  cache = { userId, url: (data?.avatar_url as string | null) ?? null }
  listeners.forEach((l) => l())
}

export function useMyAvatarUrl(): string | null {
  const [url, setUrl] = useState(current)
  useEffect(() => {
    const update = () => setUrl(current())
    listeners.add(update)
    const me = getCachedAuthProfile()
    if (me && cache?.userId !== me.id) load(me.id).catch(() => {})
    else update()
    return () => {
      listeners.delete(update)
    }
  }, [])
  return url
}

export async function setMyAvatarUrl(url: string | null): Promise<void> {
  const me = getCachedAuthProfile()
  if (!me) throw new Error("Please sign in to change your photo")
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", me.id)
  if (error) throw error
  cache = { userId: me.id, url }
  listeners.forEach((l) => l())
}
