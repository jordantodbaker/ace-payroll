import { describe, expect, it } from 'vitest'
import { parseWorkDate, payPeriodEndingFor, toInputDate, weekEndingFor } from './date-utils'

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
