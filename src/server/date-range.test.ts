import { describe, expect, it } from 'vitest'
import { timeEntryDateRangeWhere } from './date-range'

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
