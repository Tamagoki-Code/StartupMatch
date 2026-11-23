import { supabase } from "./lib/supabaseClient"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SupabaseRole = "student" | "enterprise" | "admin"

export interface AuthedProfile {
  id: string
  role: SupabaseRole
  name: string
  email: string
  initials: string | null
  verificationStatus: "Verified" | "Pending Review" | "Under Review" | "Rejected"
  // student-only
  title?: string | null
  school?: string | null
  chapter?: string | null
  academicId?: string | null
  // enterprise-only
  business?: string | null
  barangay?: string | null
  permit?: string | null
}

// ─── In-memory cache ───────────────────────────────────────────────────────────
// Populated on sign-in/sign-up so devProfile.ts / clientProfile.ts / roleAccess.ts
// can overlay real Supabase-backed identity onto the mock stores without a
// larger rewrite of App.tsx's role-resolution flow.

let cachedProfile: AuthedProfile | null = null

export function getCachedAuthProfile(): AuthedProfile | null {
  return cachedProfile
}

function setCachedAuthProfile(profile: AuthedProfile | null) {
  cachedProfile = profile
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

async function loadProfile(userId: string): Promise<AuthedProfile | null> {
  const { data: base, error } = await supabase
    .from("profiles")
    .select("id, role, name, email, initials, verification_status")
    .eq("id", userId)
    .maybeSingle()

  if (error || !base) return null

  const profile: AuthedProfile = {
    id: base.id,
    role: base.role,
    name: base.name,
    email: base.email,
    initials: base.initials,
    verificationStatus: base.verification_status,
  }

  if (base.role === "enterprise") {
    const { data: ent } = await supabase
      .from("enterprise_profiles")
      .select("business, barangay, permit")
      .eq("profile_id", userId)
      .maybeSingle()
    if (ent) Object.assign(profile, ent)
  } else {
    const { data: stu } = await supabase
      .from("student_profiles")
      .select("title, school, chapter, academic_id")
      .eq("profile_id", userId)
      .maybeSingle()
    if (stu) Object.assign(profile, { ...stu, academicId: stu.academic_id })
  }

  return profile
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SignUpInput {
  fullName: string
  businessName?: string // required for role "enterprise"
  email: string
  password: string
  role: SupabaseRole
  idNumber: string // academic ID / DTI permit no. / faculty ID depending on role
  documentUrl?: string // uploaded ID/permit photo, hosted on Cloudinary
  establishmentPhotoUrl?: string // enterprise-only: exterior photo of the business premises
}

// Row creation happens server-side via the `on_auth_user_created` trigger
// (see supabase/migrations) — this just passes the chosen role/name/permit
// through as auth user metadata.
export async function signUpUser(input: SignUpInput): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        role: input.role,
        name: input.fullName.trim(),
        initials: initialsFrom(input.fullName),
        ...(input.role === "enterprise"
          ? { permit: input.idNumber.trim(), business: (input.businessName ?? "").trim() }
          : input.role === "student"
            ? { academic_id: input.idNumber.trim() }
            : {}),
        ...(input.documentUrl ? { document_url: input.documentUrl } : {}),
        ...(input.establishmentPhotoUrl ? { establishment_photo_url: input.establishmentPhotoUrl } : {}),
      },
    },
  })

  if (error) throw error

  // If email confirmation is required, Supabase returns a user but no session.
  const needsEmailConfirmation = !data.session

  if (data.session && data.user) {
    setCachedAuthProfile(await loadProfile(data.user.id))
  }

  return { needsEmailConfirmation }
}

export interface SignInInput {
  email: string
  password: string
}

export async function signInUser(input: SignInInput): Promise<AuthedProfile> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  })

  if (error) {
    // Best-effort: a failed login has no session/profile to log it from, so
    // this is a direct anon-callable RPC rather than the usual audit path.
    supabase.rpc("log_failed_login", { p_email: input.email.trim() }).then(undefined, () => {})
    throw error
  }
  if (!data.user) throw new Error("Sign-in succeeded but no user was returned")

  const profile = await loadProfile(data.user.id)
  if (!profile) throw new Error("Signed in, but no profile record was found for this account")

  setCachedAuthProfile(profile)
  return profile
}

// Restores a profile from an existing browser session (e.g. on page reload).
export async function restoreSession(): Promise<AuthedProfile | null> {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return null

  const profile = await loadProfile(user.id)
  setCachedAuthProfile(profile)
  return profile
}

export async function signOutUser(): Promise<void> {
  await supabase.auth.signOut()
  setCachedAuthProfile(null)
}

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// Sends a password-reset email. Supabase redirects the user back to this
// app's own origin with a recovery session already attached to the URL —
// App.tsx listens for the "PASSWORD_RECOVERY" auth event and swaps in a
// "set new password" screen that calls changePassword() above.
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  })
  if (error) throw error
}
