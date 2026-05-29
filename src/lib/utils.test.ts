import { describe, expect, it } from 'vitest'
import { cn, entryDate, formatDate, formatHours, formatNameLastFirst } from './utils'

describe('cn', () => {
  it('joins string classes with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })
  it('filters falsy values', () => {
    expect(cn('a', undefined, 'b', null, false, 0, 'c')).toBe('a b c')
  })
  it('returns empty string when all inputs are falsy', () => {
    expect(cn(undefined, null, false)).toBe('')
  })
})

describe('formatHours', () => {
  it('formats positive numbers to 1 decimal with h suffix', () => {
    expect(formatHours(8)).toBe('8.0h')
    expect(formatHours(8.5)).toBe('8.5h')
    expect(formatHours(8.25)).toBe('8.3h')
  })
  it('returns em dash for null/undefined', () => {
    expect(formatHours(null)).toBe('—')
    expect(formatHours(undefined)).toBe('—')
  })
  it('handles 0 as a real value, not null', () => {
    expect(formatHours(0)).toBe('0.0h')
  })
})

describe('formatDate', () => {
  it('renders a YYYY-MM-DD string as the local calendar day', () => {
    // Anchors to noon local, so it shouldn't shift in negative-UTC zones.
    expect(formatDate('2026-05-11')).toBe('May 11, 2026')
  })
  it('accepts long month option', () => {
    expect(formatDate('2026-05-11', { month: 'long' })).toBe('May 11, 2026')
  })
  it('renders a Date object', () => {
    const d = new Date(2026, 4, 11, 12)
    expect(formatDate(d)).toBe('May 11, 2026')
  })
})

describe('formatNameLastFirst', () => {
  it('flips a two-part name', () => {
    expect(formatNameLastFirst('Pete Allred')).toBe('Allred, Pete')
    expect(formatNameLastFirst('Jordan Baker')).toBe('Baker, Jordan')
  })
  it('keeps the trailing word as the surname for 3+ word names', () => {
    expect(formatNameLastFirst('Mary Ann Smith')).toBe('Smith, Mary Ann')
  })
  it('returns single-word names unchanged', () => {
    expect(formatNameLastFirst('Cher')).toBe('Cher')
  })
  it('returns empty string for null/undefined/empty', () => {
    expect(formatNameLastFirst(null)).toBe('')
    expect(formatNameLastFirst(undefined)).toBe('')
    expect(formatNameLastFirst('')).toBe('')
  })
  it('trims surrounding whitespace', () => {
    expect(formatNameLastFirst('  Pete Allred  ')).toBe('Allred, Pete')
  })
})

describe('entryDate', () => {
  it('returns workDate when present', () => {
    const workDate = new Date('2026-05-08T12:00:00')
    const createdAt = new Date('2026-05-11T08:00:00')
    expect(entryDate({ workDate, createdAt })).toEqual(workDate)
  })
  it('falls back to createdAt when workDate is null', () => {
    const createdAt = new Date('2026-05-11T08:00:00')
    expect(entryDate({ workDate: null, createdAt })).toEqual(createdAt)
  })
  it('accepts ISO strings (the wire format from server serialization)', () => {
    const result = entryDate({ workDate: '2026-05-08T12:00:00.000Z', createdAt: '2026-05-11T00:00:00.000Z' })
    expect(result.toISOString()).toBe('2026-05-08T12:00:00.000Z')
  })
})
