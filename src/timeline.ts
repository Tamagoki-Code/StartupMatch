const DAY_MS = 86_400_000

function dateOnly(value: string): Date | null {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`
}

// Calendar months, then leftover days: Jan 15 → Mar 20 is "2 months 5 days",
// Jan 31 → Feb 28 is "28 days" (a month isn't complete until the same day-of-month).
export function projectDuration(start: string, end: string): string | null {
  const a = dateOnly(start)
  const b = dateOnly(end)
  if (!a || !b || b < a) return null

  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) months--
  const anchorMonthDays = new Date(a.getFullYear(), a.getMonth() + months + 1, 0).getDate()
  const anchor = new Date(a.getFullYear(), a.getMonth() + months, Math.min(a.getDate(), anchorMonthDays))
  const days = Math.round((b.getTime() - anchor.getTime()) / DAY_MS)

  if (months === 0) return days === 0 ? "Same day" : plural(days, "day")
  return days === 0 ? plural(months, "month") : `${plural(months, "month")} ${plural(days, "day")}`
}

// "Nov 1 – Nov 30, 2026", or both years when the range crosses one.
export function projectTimeline(start: string, end: string): string | null {
  const a = dateOnly(start)
  const b = dateOnly(end)
  if (!a || !b || b < a) return null
  const md = { month: "short", day: "numeric" } as const
  const mdy = { ...md, year: "numeric" } as const
  const from = a.toLocaleDateString("en-US", a.getFullYear() === b.getFullYear() ? md : mdy)
  return `${from} – ${b.toLocaleDateString("en-US", mdy)}`
}
