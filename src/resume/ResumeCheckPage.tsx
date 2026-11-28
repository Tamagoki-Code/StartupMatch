import { useRef, useState } from "react"

import { extractTextFromPdf } from "./pdfText"
import { computeAllRoleMatches, computeSingleRoleMatch, type HybridMatchResult } from "./matchEngine"
import { DEV_ROLES, type DevRole } from "./skillTaxonomy"
import { saveResumeResult } from "./resumeStorage"
import { getCachedAuthProfile } from "../supabaseAuth"

type Mode = "auto" | "targeted"
type Stage = "idle" | "loading-model" | "analyzing" | "done" | "error"

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E2E8F0",
  borderRadius: 12,
  boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
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
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.color }} />
      {result.tier}
    </span>
  )
}

function SkillPills({ skills, empty }: { skills: string[]; empty: string }) {
  if (skills.length === 0) {
    return <span style={{ fontSize: 12.5, color: "#94A3B8" }}>{empty}</span>
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {skills.map((s) => (
        <span
          key={s}
          style={{
            padding: "3px 10px",
            borderRadius: 99,
            background: "#F1F5F9",
            color: "#334155",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {s}
        </span>
      ))}
    </div>
  )
}

function RoleResultCard({ result, rank }: { result: HybridMatchResult; rank?: number }) {
  const [open, setOpen] = useState(rank === 1)

  return (
    <div style={{ ...CARD, padding: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {rank && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>#{rank}</span>
          )}
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{result.role}</span>
          <TierBadge result={result} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{result.finalScore}%</span>
          <span style={{ fontSize: 12, color: "#94A3B8" }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                width: `${result.finalScore}%`,
                height: "100%",
                background: "#2563EB",
                borderRadius: 3,
              }}
            />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{result.summary}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 6 }}>
                Core Skills ({result.coreCountStr})
              </div>
              <SkillPills skills={result.matchedCore} empty="No core skills detected" />
              {result.missingCore.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>Missing:</div>
                  <SkillPills skills={result.missingCore} empty="" />
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 6 }}>
                Supporting Skills ({result.suppCountStr})
              </div>
              <SkillPills skills={result.matchedSupp} empty="No supporting skills detected" />
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            Detected projects: {result.projectCount} · Neural semantic fit: {result.semanticScore}%
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResumeCheckPage() {
  const [mode, setMode] = useState<Mode>("auto")
  const [targetRole, setTargetRole] = useState<DevRole>("Web Developer")
  const [stage, setStage] = useState<Stage>("idle")
  const [modelProgress, setModelProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [allResults, setAllResults] = useState<HybridMatchResult[] | null>(null)
  const [singleResult, setSingleResult] = useState<HybridMatchResult | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isRealStudent = getCachedAuthProfile()?.role === "student"

  async function handleFile(file: File) {
    setError(null)
    setSavedNote(null)
    setAllResults(null)
    setSingleResult(null)
    setStage("loading-model")
    setModelProgress(0)

    try {
      const text = await extractTextFromPdf(file)
      if (!text.trim()) {
        setError("Could not extract text from this PDF. Try a different file.")
        setStage("error")
        return
      }

      setStage("analyzing")
      const onProgress = (pct: number) => {
        setStage("loading-model")
        setModelProgress(pct)
      }

      if (mode === "auto") {
        const results = await computeAllRoleMatches(text, onProgress)
        setStage("done")
        setAllResults(results)
        try {
          const saved = await saveResumeResult(file, results, text)
          setSavedNote(saved ? "Saved to your profile." : null)
        } catch {
          setSavedNote("Analyzed, but couldn't save to your profile — try again later.")
        }
      } else {
        const result = await computeSingleRoleMatch(text, targetRole, "", onProgress)
        setStage("done")
        setSingleResult(result)
        try {
          const saved = await saveResumeResult(file, [result], text)
          setSavedNote(saved ? "Saved to your profile." : null)
        } catch {
          setSavedNote("Analyzed, but couldn't save to your profile — try again later.")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong analyzing this resume.")
      setStage("error")
    }
  }

  const busy = stage === "loading-model" || stage === "analyzing"
  const [dragging, setDragging] = useState(false)
  const touchScreen = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.03em" }}>
          Resume Match Check
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "#64748B" }}>
          Upload your resume to see your compatibility score against real developer roles — powered by
          the same AI matching engine enterprises use to rank bids. Runs entirely in your browser; your
          resume is never sent to a server for this analysis.
        </p>
      </div>

      <div style={{ ...CARD, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          role="tablist"
          aria-label="Check type"
          style={{ display: "flex", gap: 4, padding: 4, background: "#F1F5F9", borderRadius: 10 }}
        >
          {([
            ["auto", "Auto-Match", "Find the role you fit best"],
            ["targeted", "Targeted Check", "Score against one role"],
          ] as const).map(([id, title, sub]) => {
            const on = mode === id
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => setMode(id)}
                style={{
                  flex: 1,
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: on ? "#fff" : "transparent",
                  boxShadow: on ? "0 1px 3px rgba(15,23,42,0.1)" : "none",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: on ? "#1D4ED8" : "#334155" }}>{title}</div>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: "#64748B", marginTop: 1 }}>{sub}</div>
              </button>
            )
          })}
        </div>

        {mode === "targeted" && (
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value as DevRole)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1.5px solid #E2E8F0",
              fontSize: 13,
              fontFamily: "Inter, sans-serif",
              color: "#0F172A",
              background: "#fff",
            }}
          >
            {DEV_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
          }}
        />
        <button
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f && !busy) void handleFile(f)
          }}
          style={{
            padding: "28px 16px",
            borderRadius: 12,
            border: `1.5px dashed ${dragging ? "#2563EB" : "#CBD5E1"}`,
            background: dragging ? "#EFF6FF" : "#F8FAFC",
            color: "#475569",
            cursor: busy ? "default" : "pointer",
            fontFamily: "Inter, sans-serif",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#fff",
              border: "1px solid #E2E8F0",
              color: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13V3.5M6.5 7L10 3.5 13.5 7" />
              <path d="M3 13.5V15a2 2 0 002 2h10a2 2 0 002-2v-1.5" />
            </svg>
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>
            {stage === "loading-model" ? "Preparing the matching model…" : stage === "analyzing" ? "Analyzing your resume…" : "Upload your resume"}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "#64748B" }}>
            {busy
              ? "This stays in your browser."
              : touchScreen
                ? "Tap to choose a PDF"
                : "Drop a PDF here or click to choose one"}
          </span>
        </button>

        {stage === "loading-model" && (
          <div role="status" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ height: 6, borderRadius: 99, background: "#E2E8F0", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(4, Math.round(modelProgress))}%`,
                  background: "#2563EB",
                  borderRadius: 99,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#64748B" }}>
              {modelProgress > 0
                ? `Downloading the AI model (first time only) — ${Math.round(modelProgress)}%`
                : "Starting the AI model…"}
            </div>
          </div>
        )}
        {error && <div role="alert" style={{ fontSize: 12.5, color: "#B91C1C", fontWeight: 500 }}>{error}</div>}
        {savedNote && <div style={{ fontSize: 12.5, color: "#16A34A" }}>{savedNote}</div>}
        {!isRealStudent && stage === "done" && (
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            Sign in with a real student account to save this result to your profile.
          </div>
        )}
      </div>

      {stage === "done" && mode === "auto" && allResults && (
        <>
          <div style={{ ...CARD, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 8 }}>
              Your Best-Fit Freelance Role
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#0F172A" }}>{allResults[0].role}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#2563EB" }}>{allResults[0].finalScore}%</span>
              <TierBadge result={allResults[0]} />
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#475569" }}>{allResults[0].summary}</p>
            {allResults[0].missingCore.length > 0 ? (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#D97706" }}>
                Next skill to learn: build a mini-project featuring{" "}
                <strong>{allResults[0].missingCore.slice(0, 2).join(", ")}</strong> to reach maximum match
                strength.
              </p>
            ) : (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#16A34A" }}>
                Ready to bid! You have full core skill coverage for this role.
              </p>
            )}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 10 }}>
              Role Compatibility Leaderboard
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {allResults.map((r, i) => (
                <RoleResultCard key={r.role} result={r} rank={i + 1} />
              ))}
            </div>
          </div>
        </>
      )}

      {stage === "done" && mode === "targeted" && singleResult && (
        <div style={{ ...CARD, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>
              Compatibility Report: {singleResult.role}
            </span>
            <TierBadge result={singleResult} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Overall Match", value: `${singleResult.finalScore}%` },
              { label: "Core Coverage", value: singleResult.coreCountStr },
              { label: "Supporting Coverage", value: singleResult.suppCountStr },
              { label: "Neural Semantic Fit", value: `${singleResult.semanticScore}%` },
            ].map((s) => (
              <div key={s.label} style={{ padding: 12, background: "#F8FAFC", borderRadius: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{ width: `${singleResult.finalScore}%`, height: "100%", background: "#2563EB", borderRadius: 3 }}
            />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{singleResult.summary}</p>
          {singleResult.missingCore.length > 0 && (
            <p style={{ margin: 0, fontSize: 12.5, color: "#D97706" }}>
              Follow a tutorial and build a GitHub project demonstrating{" "}
              <strong>{singleResult.missingCore.slice(0, 2).join(", ")}</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
