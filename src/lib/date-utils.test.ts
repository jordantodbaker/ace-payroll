import { describe, expect, it } from 'vitest'
import {
  getThisAndLastWeek,
  parseWorkDate,
  payPeriodEndingFor,
  toInputDate,
  weekEndingFor,
  weekEndingKey,
} from './date-utils'

describe('parseWorkDate', () => {
  it('parses YYYY-MM-DD to a Date anchored at local noon', () => {
    const d = parseWorkDate('2026-05-11')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // May, 0-indexed
    expect(d.getDate()).toBe(11)
    expect(d.getHours()).toBe(12)
  })
  it('handles different days correctly', () => {
    expect(parseWorkDate('2026-01-01').getDate()).toBe(1)
    expect(parseWorkDate('2026-12-31').getMonth()).toBe(11)
  })
})

describe('toInputDate', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toInputDate(new Date(2026, 4, 11, 12))).toBe('2026-05-11')
  })
  it('zero-pads single-digit months and days', () => {
    expect(toInputDate(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
  it('accepts an ISO string', () => {
    expect(toInputDate('2026-05-11T12:00:00')).toBe('2026-05-11')
  })
})

describe('weekEndingFor', () => {
  // 2026-05-04 is a Monday, 2026-05-10 is a Sunday.
  it('returns the next Sunday for a Monday', () => {
    const monday = new Date(2026, 4, 4, 12)
    const we = weekEndingFor(monday)
    expect(we.getFullYear()).toBe(2026)
    expect(we.getMonth()).toBe(4)
    expect(we.getDate()).toBe(10)
    expect(we.getDay()).toBe(0) // Sunday
  })
  it('returns the next Sunday for a Friday', () => {
    const friday = new Date(2026, 4, 8, 12)
    expect(weekEndingFor(friday).getDate()).toBe(10)
  })
  it('returns the same day when given a Sunday', () => {
    const sunday = new Date(2026, 4, 10, 12)
    const we = weekEndingFor(sunday)
    expect(we.getDate()).toBe(10)
    expect(we.getDay()).toBe(0)
  })
  it('returns next day when given a Saturday', () => {
    const saturday = new Date(2026, 4, 9, 12)
    expect(weekEndingFor(saturday).getDate()).toBe(10)
  })
  it('crosses month boundaries', () => {
    // 2026-04-30 is a Thursday → next Sunday is 2026-05-03.
    const thursday = new Date(2026, 3, 30, 12)
    const we = weekEndingFor(thursday)
    expect(we.getMonth()).toBe(4) // May
    expect(we.getDate()).toBe(3)
  })
  it('does not mutate the input date', () => {
    const monday = new Date(2026, 4, 4, 12)
    const before = monday.getTime()
    weekEndingFor(monday)
    expect(monday.getTime()).toBe(before)
  })
})

describe('payPeriodEndingFor', () => {
  // Bi-weekly schedule anchored on Friday 2026-05-15.
  const anchor = new Date(2026, 4, 15, 12)
  const weeks = 2

  it('maps the anchor date to itself', () => {
    const r = payPeriodEndingFor(new Date(2026, 4, 15, 12), anchor, weeks)
    expect(r.getMonth()).toBe(4)
    expect(r.getDate()).toBe(15)
  })

  it('rolls a date just after the anchor into the next period', () => {
    // 2026-05-16 → next period ends 2026-05-29.
    const r = payPeriodEndingFor(new Date(2026, 4, 16, 12), anchor, weeks)
    expect(r.getMonth()).toBe(4)
    expect(r.getDate()).toBe(29)
  })

  it('keeps a date within the anchor period on the anchor end', () => {
    // 2026-05-02 is inside the period 2026-05-02..2026-05-15.
    const r = payPeriodEndingFor(new Date(2026, 4, 2, 12), anchor, weeks)
    expect(r.getDate()).toBe(15)
  })

  it('maps the prior period-end to itself', () => {
    // 2026-05-01 is exactly one period before the anchor.
    const r = payPeriodEndingFor(new Date(2026, 4, 1, 12), anchor, weeks)
    expect(r.getMonth()).toBe(4)
    expect(r.getDate()).toBe(1)
  })

  it('handles dates several periods before the anchor, crossing months', () => {
    // 2026-04-30 → period ending 2026-05-01.
    const r = payPeriodEndingFor(new Date(2026, 3, 30, 12), anchor, weeks)
    expect(r.getMonth()).toBe(4)
    expect(r.getDate()).toBe(1)
  })

  it('lands every result on the same weekday as the anchor (Friday)', () => {
    const anchorDay = anchor.getDay()
    for (const d of [new Date(2026, 4, 20, 12), new Date(2026, 5, 3, 12), new Date(2026, 3, 10, 12)]) {
      expect(payPeriodEndingFor(d, anchor, weeks).getDay()).toBe(anchorDay)
    }
  })

  it('does not mutate the anchor', () => {
    const before = anchor.getTime()
    payPeriodEndingFor(new Date(2026, 6, 1, 12), anchor, weeks)
    expect(anchor.getTime()).toBe(before)
  })
})

describe('getThisAndLastWeek', () => {
  // 2026-06-09 is a Tuesday. Its Mon–Sun week is 2026-06-08 .. 2026-06-14.
  // Previous week is 2026-06-01 .. 2026-06-07.
  const tuesday = new Date(2026, 5, 9, 12)

  it("returns Monday as this week's start", () => {
    const { thisWeekStart } = getThisAndLastWeek(tuesday)
    expect(thisWeekStart.getDay()).toBe(1) // Monday
    expect(thisWeekStart.getDate()).toBe(8)
  })

  it("returns Sunday as this week's end", () => {
    const { thisWeekEnd } = getThisAndLastWeek(tuesday)
    expect(thisWeekEnd.getDay()).toBe(0) // Sunday
    expect(thisWeekEnd.getDate()).toBe(14)
  })

  it("places last week's range 7 days before this week's", () => {
    const { thisWeekStart, lastWeekStart, lastWeekEnd } = getThisAndLastWeek(tuesday)
    expect(lastWeekStart.getDate()).toBe(1)
    expect(lastWeekEnd.getDate()).toBe(7)
    // 7-day shift
    expect(thisWeekStart.getTime() - lastWeekStart.getTime()).toBe(7 * 86_400_000)
  })

  it('treats Monday as the same week (it IS the week start)', () => {
    const monday = new Date(2026, 5, 8, 12)
    const { thisWeekStart } = getThisAndLastWeek(monday)
    expect(thisWeekStart.getDate()).toBe(8)
  })

  it('treats Sunday as still in this week (it IS the week end)', () => {
    const sunday = new Date(2026, 5, 14, 12)
    const { thisWeekStart, thisWeekEnd } = getThisAndLastWeek(sunday)
    expect(thisWeekStart.getDate()).toBe(8)
    expect(thisWeekEnd.getDate()).toBe(14)
  })
})

describe('weekEndingKey', () => {
  it('returns YYYY-MM-DD for a Date', () => {
    // ISO slice is UTC; for noon-local dates that stays on the same calendar day.
    expect(weekEndingKey(new Date(2026, 4, 10, 12))).toMatch(/^2026-05-1[01]$/)
  })

  it('accepts an ISO string', () => {
    expect(weekEndingKey('2026-05-10T12:00:00.000Z')).toBe('2026-05-10')
  })

  it('returns null for null/undefined', () => {
    expect(weekEndingKey(null)).toBeNull()
    expect(weekEndingKey(undefined)).toBeNull()
  })

  it('produces the same key for equal dates (round-trip stable)', () => {
    const a = weekEndingKey('2026-05-10T12:00:00.000Z')
    const b = weekEndingKey('2026-05-10T12:00:00.000Z')
    expect(a).toBe(b)
  })
})
