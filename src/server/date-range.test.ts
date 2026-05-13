import { describe, expect, it } from 'vitest'
import { parseWorkDate, timeEntryDateRangeWhere, weekEndingFor } from './date-range'

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

describe('timeEntryDateRangeWhere', () => {
  it('filters by workDate, not createdAt', () => {
    const where = timeEntryDateRangeWhere('2026-05-04', '2026-05-10')
    expect('workDate' in where).toBe(true)
    expect('createdAt' in where).toBe(false)
  })
  it('uses inclusive gte start and lte end-of-day', () => {
    const where = timeEntryDateRangeWhere('2026-05-04', '2026-05-10')
    expect(where.workDate.gte.getHours()).toBe(0)
    expect(where.workDate.lte.getHours()).toBe(23)
    expect(where.workDate.lte.getMinutes()).toBe(59)
    expect(where.workDate.lte.getSeconds()).toBe(59)
    expect(where.workDate.lte.getMilliseconds()).toBe(999)
  })
  it('produces a single-day range when start and end match', () => {
    const where = timeEntryDateRangeWhere('2026-05-11', '2026-05-11')
    expect(where.workDate.gte.getDate()).toBe(11)
    expect(where.workDate.lte.getDate()).toBe(11)
  })
})
