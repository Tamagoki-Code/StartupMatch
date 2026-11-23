import { useSyncExternalStore } from "react"

import { getCachedAuthProfile } from "./supabaseAuth"
import { supabase } from "./lib/supabaseClient"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ClientIdentity {
  name: string

  initials: string

  avatarColors: [string, string]

  business: string

  barangay: string

  permit: string

  email: string

  verificationStatus: VerificationStatus
}

export type VerificationStatus = "Verified" | "Pending Review" | "Under Review" | "Rejected"

// ─── Mock data ─────────────────────────────────────────────────────────────────

const DEFAULT_CLIENT: ClientIdentity = {
  name: "Ernesto Dela Vega",

  initials: "ED",

  avatarColors: ["#ECFDF5", "#065F46"],

  business: "Apokon Hardware MSME",

  barangay: "Apokon",

  permit: "DTI-REG-2024-08812",

  email: "ernesto@apokonhardware.com.ph",

  verificationStatus: "Verified",
}

const MOCK_CLIENTS: Record<string, ClientIdentity> = {
  "ernesto@apokonhardware.com.ph": {
    name: "Ernesto Dela Vega",
    initials: "ED",
    avatarColors: ["#ECFDF5", "#065F46"],

    business: "Apokon Hardware MSME",
    barangay: "Apokon",

    permit: "DTI-REG-2024-08812",
    email: "ernesto@apokonhardware.com.ph",

    verificationStatus: "Verified",
  },

  "rvillanueva@davaofrutis.com.ph": {
    name: "Ramon Villanueva",
    initials: "RV",
    avatarColors: ["#EFF6FF", "#1E40AF"],

    business: "Davao Fruits Corp.",
    barangay: "Magugpo West",

    permit: "DTI-REG-2024-08813",
    email: "rvillanueva@davaofrutis.com.ph",

    verificationStatus: "Pending Review",
  },

  "rcamacho@citymalltagum.com": {
    name: "Rowena Camacho",
    initials: "RC",
    avatarColors: ["#F5F3FF", "#5B21B6"],

    business: "CityMall Tagum",
    barangay: "Magugpo West",

    permit: "DTI-REG-2022-11140",
    email: "rcamacho@citymalltagum.com",

    verificationStatus: "Verified",
  },
}

// ─── Store ─────────────────────────────────────────────────────────────────────

let state: ClientIdentity = { ...DEFAULT_CLIENT }

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function subscribeClientStore(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getClientSnapshot(): ClientIdentity {
  return state
}

export function useClientProfile(): ClientIdentity {
  return useSyncExternalStore(subscribeClientStore, getClientSnapshot)
}

export function clientIdentity(): ClientIdentity {
  return state
}

export function signInAsClient(email?: string) {
  const key = email?.trim().toLowerCase()

  // Real Supabase-backed account takes precedence over the mock roster.
  const cached = getCachedAuthProfile()
  const authIdentity: ClientIdentity | undefined =
    cached && cached.role === "enterprise" && cached.email.trim().toLowerCase() === key
      ? {
          name: cached.name,
          initials: cached.initials || cached.name.slice(0, 2).toUpperCase(),
          avatarColors: ["#ECFDF5", "#065F46"],
          business: cached.business || "",
          barangay: cached.barangay || "",
          permit: cached.permit || "",
          email: cached.email,
          verificationStatus: cached.verificationStatus,
        }
      : undefined

  const identity = authIdentity ?? (key ? MOCK_CLIENTS[key] : undefined)

  state = identity ? { ...DEFAULT_CLIENT, ...identity } : { ...DEFAULT_CLIENT }

  emit()
}

// Editable identity fields (Settings page) — name/business/barangay.
// No-op writes for demo/mock accounts; real accounts write straight to
// Supabase (no separate "real" flag needed — a mock client never has a
// cached real auth profile to check against).
export function updateClientIdentity(patch: { name?: string; business?: string; barangay?: string }) {
  const allowed: Partial<ClientIdentity> = {}
  if (typeof patch.name === "string" && patch.name.trim()) allowed.name = patch.name.trim()
  if (typeof patch.business === "string") allowed.business = patch.business.trim()
  if (typeof patch.barangay === "string") allowed.barangay = patch.barangay.trim()
  if (Object.keys(allowed).length === 0) return

  if (allowed.name) {
    const parts = allowed.name.split(/\s+/).filter(Boolean)
    allowed.initials =
      parts.length === 0
        ? state.initials
        : parts.length === 1
          ? parts[0].slice(0, 2).toUpperCase()
          : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  state = { ...state, ...allowed }
  emit()

  const me = getCachedAuthProfile()
  if (!me || me.role !== "enterprise") return

  if (allowed.name) {
    supabase.from("profiles").update({ name: allowed.name, initials: allowed.initials }).eq("id", me.id).then(undefined, () => {})
  }
  const entPatch: Record<string, unknown> = {}
  if (allowed.business !== undefined) entPatch.business = allowed.business
  if (allowed.barangay !== undefined) entPatch.barangay = allowed.barangay
  if (Object.keys(entPatch).length > 0) {
    supabase.from("enterprise_profiles").update(entPatch).eq("profile_id", me.id).then(undefined, () => {})
  }
}
