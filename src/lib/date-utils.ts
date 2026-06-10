// Pure date helpers — safe to import from both server and client code.
// (Anything that builds a Prisma where-clause lives in src/server/date-range.ts.)
import { endOfWeek, startOfWeek, subWeeks } from 'date-fns'

// Bi-weekly pay period anchored on Friday 2026-05-15. Single source of truth
// for both the seed (initial AppConfig row) and the runtime fallback when no
// AppConfig row has been created yet.
export const DEFAULT_PAY_PERIOD_ANCHOR = new Date(2026, 4, 15, 12)
export const DEFAULT_PAY_PERIOD_WEEKS = 2

// 'YYYY-MM-DD' from a <input type="date">. Anchor to noon local time so the
// stored DateTime renders as the same calendar day regardless of viewer TZ.
export function parseWorkDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

// Format a Date (or ISO string) as 'YYYY-MM-DD' for a <input type="date">.
export function toInputDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// A "week" is Mon–Sun, so weekEnding is the Sunday on or after the workDate.
// Sunday workDate maps to itself (it's already the last day of its week).
export function weekEndingFor(workDate: Date): Date {
  const sunday = new Date(workDate)
  const day = sunday.getDay() // 0 = Sun, 6 = Sat
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  sunday.setDate(sunday.getDate() + daysUntilSunday)
  return sunday
}

const DAY_MS = 86_400_000

// The pay period ending for a workDate, given a known pay-period-end `anchor`
// date and a period length in `weeks` (bi-weekly = 2). Returns the earliest
// period-end on or after workDate. Work done on a period-end date belongs to
// that period. The result keeps the anchor's time-of-day.
export function payPeriodEndingFor(workDate: Date, anchor: Date, weeks: number): Date {
  const periodDays = weeks * 7
  // Whole-day delta; rounding keeps it correct across DST shifts.
  const days = Math.round((workDate.getTime() - anchor.getTime()) / DAY_MS)
  const periods = Math.ceil(days / periodDays)
  const result = new Date(anchor)
  result.setDate(result.getDate() + periods * periodDays)
  return result
}

// Mon–Sun week boundaries for the week containing `now` and the previous week.
// `weekStartsOn: 1` (Monday) matches the rest of the app's week convention
// (see weekEndingFor). Used by the personal dashboard and admin overview.
export function getThisAndLastWeek(now: Date): {
  thisWeekStart: Date
  thisWeekEnd: Date
  lastWeekStart: Date
  lastWeekEnd: Date
} {
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const ref = subWeeks(now, 1)
  const lastWeekStart = startOfWeek(ref, { weekStartsOn: 1 })
  const lastWeekEnd = endOfWeek(ref, { weekStartsOn: 1 })
  return { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd }
}

// Normalize a weekEnding Date|string|null into a YYYY-MM-DD bucket key. Used
// for dropdown option keys and filter matching on the admin pages. Returns
// null when the input is missing.
export function weekEndingKey(d: Date | string | null | undefined): string | null {
  if (!d) return null
  return new Date(d).toISOString().slice(0, 10)
}
