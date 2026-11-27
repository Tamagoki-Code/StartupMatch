import { describe, it, expect } from "vitest"
import { projectDuration, projectTimeline } from "./timeline"

describe("projectDuration", () => {
  it("counts days under a month", () => {
    expect(projectDuration("Nov 1, 2026", "Nov 30, 2026")).toBe("29 days")
    expect(projectDuration("Nov 1, 2026", "Nov 2, 2026")).toBe("1 day")
    expect(projectDuration("Nov 1, 2026", "Nov 1, 2026")).toBe("Same day")
  })

  it("counts calendar months and leftover days", () => {
    expect(projectDuration("Jan 15, 2026", "Mar 20, 2026")).toBe("2 months 5 days")
    expect(projectDuration("Jan 15, 2026", "Feb 15, 2026")).toBe("1 month")
    expect(projectDuration("Dec 10, 2026", "Jan 12, 2027")).toBe("1 month 2 days")
  })

  it("handles month-end starts", () => {
    expect(projectDuration("Jan 31, 2026", "Feb 28, 2026")).toBe("28 days")
    expect(projectDuration("Jan 31, 2026", "Mar 31, 2026")).toBe("2 months")
  })

  it("accepts an ISO timestamp start and ignores the time of day", () => {
    expect(projectDuration("2026-11-01T23:30:00", "Nov 30, 2026")).toBe("29 days")
  })

  it("returns null for missing, invalid or reversed dates", () => {
    expect(projectDuration("—", "Nov 30, 2026")).toBeNull()
    expect(projectDuration("Nov 30, 2026", "Nov 1, 2026")).toBeNull()
  })
})

describe("projectTimeline", () => {
  it("shows the year once within a year and twice across years", () => {
    expect(projectTimeline("Nov 1, 2026", "Nov 30, 2026")).toBe("Nov 1 – Nov 30, 2026")
    expect(projectTimeline("Dec 10, 2026", "Jan 12, 2027")).toBe("Dec 10, 2026 – Jan 12, 2027")
  })
})
