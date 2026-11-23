import { useEffect, useMemo, useState } from "react"

import { fetchApplicantsForProject, type ApplicantResume } from "./applicantRanking"
import { computeSingleRoleMatch, type HybridMatchResult } from "./matchEngine"
import { DEV_ROLES, ROLE_SKILL_TAXONOMY, type DevRole } from "./skillTaxonomy"

interface RankedRow {
  applicant: ApplicantResume
  result: HybridMatchResult | null
}

function guessRoleFromTags(tags: string[]): DevRole {
  const lower = tags.map((t) => t.toLowerCase())
  let best: DevRole = "Full Stack Developer"
  let bestScore = -1
  for (const role of DEV_ROLES) {
    const skills = [...ROLE_SKILL_TAXONOMY[role].core, ...ROLE_SKILL_TAXONOMY[role].supporting]
    const score = skills.filter((s) => lower.includes(s.toLowerCase())).length
    if (score > bestScore) {
      bestScore = score
      best = role
    }
  }
  return best
}

function TierBadge({ result }: { result: HybridMatchResult }) {
  const colors =
    result.tier === "Strong Match"
      ? { bg: "#F0FDF4", border: "#BBF7D0", color: "#16A34A" }
      : result.tier === "Medium Match"
        ? { bg: "#FFFBEB", border: "#FDE68A", color: "#D97706" }
        : { bg: "#FEF2F2", border: "#FECACA", color: "#DC2626" }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 99,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        fontSize: 11.5,
        fontWeight: 700,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.color }} />
      {result.tier}
    </span>
  )
}

export default function ApplicantRankingPanel({
  projectId,
  projectTitle,
  projectTags,
  onClose,
}: {
  projectId: string
  projectTitle: string
  projectTags: string[]
  onClose: () => void
}) {
  const [applicants, setApplicants] = useState<ApplicantResume[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [targetRole, setTargetRole] = useState<DevRole>(() => guessRoleFromTags(projectTags))
  const [listingText, setListingText] = useState(projectTitle)
  const [stage, setStage] = useState<"idle" | "loading-model" | "ranking" | "done">("idle")
  const [modelProgress, setModelProgress] = useState(0)
  const [rankProgress, setRankProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState<RankedRow[] | null>(null)

  useEffect(() => {
    fetchApplicantsForProject(projectId)
      .then(setApplicants)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load applicants"))
  }, [projectId])

  const withResume = useMemo(() => (applicants ?? []).filter((a) => a.resumeText), [applicants])
  const withoutResume = useMemo(() => (applicants ?? []).filter((a) => !a.resumeText), [applicants])

  async function runRanking() {
    if (!applicants) return
    setStage("loading-model")
    setModelProgress(0)
    setRankProgress({ done: 0, total: withResume.length })

    const onProgress = (pct: number) => setModelProgress(pct)
    const ranked: RankedRow[] = []

    for (const applicant of withResume) {
      const result = await computeSingleRoleMatch(applicant.resumeText!, targetRole, listingText, onProgress)
      ranked.push({ applicant, result })
      setStage("ranking")
      setRankProgress((p) => ({ ...p, done: p.done + 1 }))
    }

    ranked.sort((a, b) => (b.result?.finalScore ?? 0) - (a.result?.finalScore ?? 0))
    for (const applicant of withoutResume) {
      ranked.push({ applicant, result: null })
    }

    setResults(ranked)
    setStage("done")
  }

  const busy = stage === "loading-model" || stage === "ranking"

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.48)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 20px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 720,
          boxShadow: "0px 8px 24px rgba(0,0,0,0.16)",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Rank Applicants</div>
            <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>{projectTitle}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20 }}
          >
            ×
          </button>
        </div>

        {loadError && <div style={{ fontSize: 12.5, color: "#DC2626", marginBottom: 12 }}>{loadError}</div>}

        {applicants && applicants.length === 0 && !loadError && (
          <div style={{ fontSize: 13, color: "#94A3B8", padding: "20px 0" }}>No bids on this project yet.</div>
        )}

        {applicants && applicants.length > 0 && stage === "idle" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Target Developer Category
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as DevRole)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #E2E8F0",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                  color: "#0F172A",
                }}
              >
                {DEV_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>
                Job Listing Context (used for semantic matching)
              </label>
              <textarea
                value={listingText}
                onChange={(e) => setListingText(e.target.value)}
                rows={2}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #E2E8F0",
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                  color: "#0F172A",
                  resize: "vertical",
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>
              {withResume.length} of {applicants.length} bidder(s) have a resume on file.
            </div>
            <button
              onClick={runRanking}
              disabled={withResume.length === 0}
              style={{
                padding: "11px 16px",
                borderRadius: 8,
                border: "none",
                background: withResume.length === 0 ? "#94A3B8" : "#2563EB",
                color: "#fff",
                fontSize: 13.5,
                fontWeight: 700,
                cursor: withResume.length === 0 ? "default" : "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Rank Applicants
            </button>
          </div>
        )}

        {busy && (
          <div style={{ padding: "30px 0", textAlign: "center", fontSize: 13, color: "#64748B" }}>
            {stage === "loading-model"
              ? modelProgress > 0
                ? `Downloading AI model (first time only)… ${Math.round(modelProgress)}%`
                : "Preparing AI model…"
              : `Analyzing resumes… ${rankProgress.done}/${rankProgress.total}`}
          </div>
        )}

        {stage === "done" && results && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
              Candidate Ranking ({results.length} applicant{results.length === 1 ? "" : "s"})
            </div>
            {results.map((row, i) => (
              <div
                key={row.applicant.bidId}
                style={{
                  border: "1px solid #E2E8F0",
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8", flexShrink: 0 }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                      {row.applicant.studentName}
                    </span>
                    {row.result ? (
                      <TierBadge result={row.result} />
                    ) : (
                      <span style={{ fontSize: 11.5, color: "#94A3B8" }}>No resume on file</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                    Bid ₱{row.applicant.amount.toLocaleString("en-US")} · {row.applicant.placedAt}
                  </div>
                  {row.result && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 5, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${row.result.finalScore}%`,
                            height: "100%",
                            background: "#2563EB",
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>
                        Core: {row.result.coreCountStr} · Semantic fit: {row.result.semanticScore}%
                      </div>
                    </div>
                  )}
                </div>
                {row.result && (
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", flexShrink: 0 }}>
                    {row.result.finalScore}%
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
