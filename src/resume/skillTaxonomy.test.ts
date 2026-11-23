import { describe, it, expect } from "vitest"
import { ROLE_SKILL_TAXONOMY, DEV_ROLES, SKILL_CANONICAL_LOOKUP, ROLE_SEMANTIC_PROFILES } from "./skillTaxonomy"

// Guards the resume-matching feature's core data table: every role must be
// fully specified, or computeHybridMatch's scoring silently divides by zero
// / scores everyone identically for that role.

describe("ROLE_SKILL_TAXONOMY", () => {
  it("defines core and supporting skills for every declared dev role", () => {
    for (const role of DEV_ROLES) {
      const profile = ROLE_SKILL_TAXONOMY[role]
      expect(profile, `missing taxonomy for role ${role}`).toBeDefined()
      expect(profile.core.length, `${role} has no core skills`).toBeGreaterThan(0)
    }
  })

  it("has a semantic profile sentence for every role (used to embed against a resume)", () => {
    for (const role of DEV_ROLES) {
      expect(ROLE_SEMANTIC_PROFILES[role]?.length, `missing semantic profile for ${role}`).toBeGreaterThan(0)
    }
  })
})

describe("SKILL_CANONICAL_LOOKUP", () => {
  it("every taxonomy skill name is reachable via at least one lookup pattern", () => {
    const canonicalTargets = new Set(Object.values(SKILL_CANONICAL_LOOKUP))
    for (const role of DEV_ROLES) {
      for (const skill of [...ROLE_SKILL_TAXONOMY[role].core, ...ROLE_SKILL_TAXONOMY[role].supporting]) {
        expect(canonicalTargets.has(skill), `"${skill}" (role ${role}) has no regex pattern mapping to it`).toBe(true)
      }
    }
  })
})
