import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers"

import {
  DEV_ROLES,
  ROLE_SEMANTIC_PROFILES,
  ROLE_SKILL_TAXONOMY,
  SKILL_CANONICAL_LOOKUP,
  type DevRole,
} from "./skillTaxonomy"

// ─── ML model (loaded once, cached across calls) ────────────────────────────
// Same model as the Python prototype (Sentence-BERT "all-MiniLM-L6-v2"),
// run fully client-side via transformers.js/ONNX — no server, no Python.

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null

function getExtractor(onProgress?: (pct: number) => void): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      progress_callback: (p: { status: string; progress?: number }) => {
        if (p.status === "progress" && typeof p.progress === "number") onProgress?.(p.progress)
      },
    }) as unknown as Promise<FeatureExtractionPipeline>
  }
  return extractorPromise
}

// Preloads the model so the UI can show a one-time "downloading AI model…"
// step before the user starts uploading resumes.
export function preloadMatchModel(onProgress?: (pct: number) => void): Promise<void> {
  return getExtractor(onProgress).then(() => undefined)
}

async function embed(text: string, model: FeatureExtractionPipeline): Promise<Float32Array> {
  const output = await model(text, { pooling: "mean", normalize: true })
  return output.data as Float32Array
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  // Both vectors are already L2-normalized (normalize: true above), so
  // cosine similarity reduces to a plain dot product.
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

// ─── Skill extraction (regex-based, ported 1:1 from the Python prototype) ──

export function extractSkillsCanonical(text: string): Set<string> {
  const found = new Set<string>()
  const clean = text.toLowerCase()
  const patterns = Object.keys(SKILL_CANONICAL_LOOKUP).sort((a, b) => b.length - a.length)

  for (const pattern of patterns) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp(`(?:\\b|^)${escaped}(?:\\b|$)`, "i")
    if (re.test(clean)) found.add(SKILL_CANONICAL_LOOKUP[pattern])
  }

  return found
}

export function extractProjectDepth(text: string): { count: number; multiplier: number } {
  const matches = text.match(/(?:project\s*\d+|github\.com\/|built\s+a|developed\s+a)/gi)
  const count = matches ? matches.length : 0
  const multiplier = count === 0 ? 0.25 : count === 1 ? 0.55 : count === 2 ? 0.8 : 1.0
  return { count, multiplier }
}

// ─── Hybrid match score ──────────────────────────────────────────────────────

export type MatchTier = "Strong Match" | "Medium Match" | "Weak Match"

export interface HybridMatchResult {
  role: DevRole
  finalScore: number
  structuredScore: number
  semanticScore: number
  tier: MatchTier
  recommendation: string
  summary: string
  matchedCore: string[]
  missingCore: string[]
  matchedSupp: string[]
  missingSupp: string[]
  coreCountStr: string
  corePct: number
  suppCountStr: string
  suppPct: number
  projectCount: number
  depthScore: number
}

export async function computeHybridMatch(
  resumeText: string,
  targetRole: DevRole,
  model: FeatureExtractionPipeline,
  roleEmbeddings: Map<DevRole, Float32Array>,
  customListingText = "",
): Promise<HybridMatchResult> {
  const extractedSkills = extractSkillsCanonical(resumeText)
  const profile = ROLE_SKILL_TAXONOMY[targetRole]
  const coreReqs = new Set(profile.core)
  const suppReqs = new Set(profile.supporting)

  const matchedCore = [...extractedSkills].filter((s) => coreReqs.has(s)).sort()
  const missingCore = [...coreReqs].filter((s) => !extractedSkills.has(s)).sort()
  const matchedSupp = [...extractedSkills].filter((s) => suppReqs.has(s)).sort()
  const missingSupp = [...suppReqs].filter((s) => !extractedSkills.has(s)).sort()

  const corePct = coreReqs.size ? matchedCore.length / coreReqs.size : 0
  const suppPct = suppReqs.size ? matchedSupp.length / suppReqs.size : 0
  const { count: projectCount, multiplier: depthScore } = extractProjectDepth(resumeText)

  const structuredScore = (corePct * 0.6 + suppPct * 0.25 + depthScore * 0.15) * 100

  const resumeEmb = await embed(resumeText, model)
  const targetEmb = roleEmbeddings.get(targetRole)!
  const baselineSemantic = Math.max(0, cosineSim(resumeEmb, targetEmb)) * 100

  let finalSemanticScore = baselineSemantic
  if (customListingText.trim()) {
    const listingEmb = await embed(customListingText, model)
    const listingSemantic = Math.max(0, cosineSim(resumeEmb, listingEmb)) * 100
    finalSemanticScore = baselineSemantic * 0.5 + listingSemantic * 0.5
  }

  const finalScore = Math.round((structuredScore * 0.7 + finalSemanticScore * 0.3) * 10) / 10

  let tier: MatchTier
  let recommendation: string
  let summary: string

  if (finalScore >= 70) {
    tier = "Strong Match"
    recommendation = "Interview Immediately"
    summary = `Highly compatible profile for '${customListingText || targetRole}'.`
  } else if (finalScore >= 45) {
    tier = "Medium Match"
    recommendation = "Secondary Candidate"
    summary = "Solid foundational knowledge, with a few addressable skill gaps."
  } else {
    tier = "Weak Match"
    recommendation = "Filter Out"
    summary = "Limited overlap with core requirements for this listing."
  }

  return {
    role: targetRole,
    finalScore,
    structuredScore: Math.round(structuredScore * 10) / 10,
    semanticScore: Math.round(finalSemanticScore * 10) / 10,
    tier,
    recommendation,
    summary,
    matchedCore,
    missingCore,
    matchedSupp,
    missingSupp,
    coreCountStr: coreReqs.size ? `${matchedCore.length}/${coreReqs.size}` : "0/0",
    corePct: Math.round(corePct * 100),
    suppCountStr: suppReqs.size ? `${matchedSupp.length}/${suppReqs.size}` : "0/0",
    suppPct: Math.round(suppPct * 100),
    projectCount,
    depthScore,
  }
}

// Evaluates a resume against all six roles at once (the Student Portal's
// "Auto-Match" mode) and returns them sorted best-first.
export async function computeAllRoleMatches(
  resumeText: string,
  onProgress?: (pct: number) => void,
): Promise<HybridMatchResult[]> {
  const model = await getExtractor(onProgress)
  const roleEmbeddings = new Map<DevRole, Float32Array>()
  for (const role of DEV_ROLES) {
    roleEmbeddings.set(role, await embed(ROLE_SEMANTIC_PROFILES[role], model))
  }

  const results: HybridMatchResult[] = []
  for (const role of DEV_ROLES) {
    results.push(await computeHybridMatch(resumeText, role, model, roleEmbeddings))
  }

  return results.sort((a, b) => b.finalScore - a.finalScore)
}

export async function computeSingleRoleMatch(
  resumeText: string,
  targetRole: DevRole,
  customListingText = "",
  onProgress?: (pct: number) => void,
): Promise<HybridMatchResult> {
  const model = await getExtractor(onProgress)
  const roleEmbeddings = new Map<DevRole, Float32Array>()
  roleEmbeddings.set(targetRole, await embed(ROLE_SEMANTIC_PROFILES[targetRole], model))
  return computeHybridMatch(resumeText, targetRole, model, roleEmbeddings, customListingText)
}
