import { describe, it, expect } from "vitest"
import { resolveRole, isPageAllowed, getAllowedPages, isPendingVerification } from "./roleAccess"

// Covers the role-gating logic involved in the admin privilege-escalation
// fix: resolveRole must never grant "admin" just because an unknown email
// looks special, and isPageAllowed must deny guests everything.

describe("resolveRole", () => {
  it("defaults an unknown email/role to student", () => {
    expect(resolveRole("random@example.com", "student")).toBe("student")
  })

  it("grants admin only via the selected role or the psits.org.ph domain, never by guessing", () => {
    expect(resolveRole("someone@psits.org.ph", "student")).toBe("admin")
    expect(resolveRole("someone@gmail.com", "admin")).toBe("admin")
    expect(resolveRole("someone@gmail.com", "student")).toBe("student")
  })

  it("fails closed to student on a malformed email", () => {
    expect(resolveRole("not-an-email", "student")).toBe("student")
  })
})

describe("isPageAllowed / getAllowedPages", () => {
  it("denies every page to a guest", () => {
    expect(isPageAllowed("developer", "guest")).toBe(false)
    expect(getAllowedPages("guest")).toEqual([])
  })

  it("keeps student and enterprise pages disjoint (strict separation)", () => {
    expect(isPageAllowed("milestone", "student")).toBe(false)
    expect(isPageAllowed("sprint", "enterprise")).toBe(false)
    expect(isPageAllowed("sprint", "student")).toBe(true)
    expect(isPageAllowed("milestone", "enterprise")).toBe(true)
  })

  it("never exposes the auth page via the switcher", () => {
    expect(isPageAllowed("auth", "admin")).toBe(false)
  })
})

describe("isPendingVerification", () => {
  it("never gates admin or guest", () => {
    expect(isPendingVerification("admin", "Pending Review")).toBe(false)
    expect(isPendingVerification("guest", "Pending Review")).toBe(false)
  })

  it("gates any non-Verified status for student/enterprise", () => {
    expect(isPendingVerification("student", "Pending Review")).toBe(true)
    expect(isPendingVerification("student", "Verified")).toBe(false)
  })
})
