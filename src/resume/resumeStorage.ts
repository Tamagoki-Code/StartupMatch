import { supabase } from "../lib/supabaseClient"
import { getCachedAuthProfile } from "../supabaseAuth"
import type { HybridMatchResult } from "./matchEngine"

// Saves the uploaded PDF to the private `resumes` storage bucket and records
// the parsed result in the `resumes` table. No-ops (returns null) for mock/
// demo accounts — there's no real student_profiles row to attach it to.
export async function saveResumeResult(
  file: File,
  allResults: HybridMatchResult[],
  resumeText: string,
): Promise<{ filePath: string } | null> {
  const me = getCachedAuthProfile()
  if (!me || me.role === "enterprise") return null

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const filePath = `${me.id}/${Date.now()}-${safeName}`

  const { error: uploadErr } = await supabase.storage.from("resumes").upload(filePath, file, {
    contentType: "application/pdf",
    upsert: false,
  })
  if (uploadErr) throw uploadErr

  const best = allResults[0]
  const { error: insertErr } = await supabase.from("resumes").insert({
    student_id: me.id,
    file_path: filePath,
    // Kept so an enterprise can re-rank this resume against a NEW job
    // listing later (see ApplicantRankingPanel) — the cached per-role
    // scores below can't be re-derived for arbitrary listing text.
    resume_text: resumeText,
    parsed_skills: {
      bestRole: best?.role,
      results: allResults.map((r) => ({
        role: r.role,
        score: r.finalScore,
        tier: r.tier,
        matchedCore: r.matchedCore,
        matchedSupp: r.matchedSupp,
      })),
    },
    match_score: best?.finalScore ?? null,
  })
  if (insertErr) throw insertErr

  return { filePath }
}
