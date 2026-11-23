import { supabase } from "../lib/supabaseClient"

export interface ApplicantResume {
  bidId: string
  studentId: string
  studentName: string
  amount: number
  placedAt: string
  resumeText: string | null
}

function formatDate(d: string | null): string {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return d
  }
}

// One row per bidder on this listing, with their most recently uploaded
// resume's text attached (null if they haven't uploaded one via Resume
// Check yet). RLS scopes resume access to bidders on the calling
// enterprise's own listings — see migration resume_text_and_enterprise_access.
export async function fetchApplicantsForProject(projectId: string): Promise<ApplicantResume[]> {
  const { data: bids, error: bidsErr } = await supabase
    .from("bids")
    .select("id, student_id, amount, placed_at")
    .eq("project_id", projectId)
    .order("placed_at", { ascending: false })
  if (bidsErr) throw bidsErr
  if (!bids || bids.length === 0) return []

  const studentIds = [...new Set(bids.map((b) => b.student_id))]

  const [{ data: profiles }, { data: resumes }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", studentIds),
    supabase
      .from("resumes")
      .select("student_id, resume_text, uploaded_at")
      .in("student_id", studentIds)
      .order("uploaded_at", { ascending: false }),
  ])

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]))

  // resumes is ordered newest-first, so the first hit per student is their
  // latest upload.
  const latestResumeByStudent = new Map<string, string | null>()
  for (const r of resumes ?? []) {
    if (!latestResumeByStudent.has(r.student_id)) {
      latestResumeByStudent.set(r.student_id, r.resume_text)
    }
  }

  return bids.map((b) => ({
    bidId: b.id,
    studentId: b.student_id,
    studentName: nameById.get(b.student_id) || "Unknown Student",
    amount: b.amount,
    placedAt: formatDate(b.placed_at),
    resumeText: latestResumeByStudent.get(b.student_id) ?? null,
  }))
}
