import { describe, expect, it } from 'vitest'
import {
  blankToNull,
  parseBool,
  parseCsv,
  parseCsvLine,
  parseDate,
  parseStatusActive,
} from './seed-helpers'

describe('parseCsvLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })
  it('preserves commas inside quoted cells', () => {
    expect(parseCsvLine('a,"b, c",d')).toEqual(['a', 'b, c', 'd'])
  })
  it('treats "" inside quoted cells as a literal "', () => {
    expect(parseCsvLine('a,"he said ""hi""",b')).toEqual(['a', 'he said "hi"', 'b'])
  })
  it('handles empty cells', () => {
    expect(parseCsvLine('a,,b')).toEqual(['a', '', 'b'])
    expect(parseCsvLine(',a,')).toEqual(['', 'a', ''])
  })
  it('trims whitespace from each cell', () => {
    expect(parseCsvLine(' a , b , c ')).toEqual(['a', 'b', 'c'])
  })
})

describe('parseCsv', () => {
  it('parses headers then rows as keyed objects', () => {
    const csv = 'name,age\nAlice,30\nBob,25'
    expect(parseCsv(csv)).toEqual([
      { name: 'Alice', age: '30' },
      { name: 'Bob', age: '25' },
    ])
  })
  it('returns empty array on empty input', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('\n\n')).toEqual([])
  })
  it('handles \\r\\n line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n3,4')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })
  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n\n3,4\n')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })
  it('handles quoted commas in real CSV data shapes', () => {
    const csv = 'task,desc\nA,"work, more work"\nB,plain'
    expect(parseCsv(csv)).toEqual([
      { task: 'A', desc: 'work, more work' },
      { task: 'B', desc: 'plain' },
    ])
  })
})

describe('parseBool', () => {
  it('is true only for "TRUE" (case-insensitive)', () => {
    expect(parseBool('TRUE')).toBe(true)
    expect(parseBool('true')).toBe(true)
    expect(parseBool('True')).toBe(true)
  })
  it('is false for anything else', () => {
    expect(parseBool('FALSE')).toBe(false)
    expect(parseBool('false')).toBe(false)
    expect(parseBool('yes')).toBe(false)
    expect(parseBool('')).toBe(false)
    expect(parseBool(undefined)).toBe(false)
  })
  it('trims whitespace before comparing', () => {
    expect(parseBool('  TRUE  ')).toBe(true)
  })
})

describe('parseStatusActive', () => {
  it('is true for "Active" (case-insensitive)', () => {
    expect(parseStatusActive('Active')).toBe(true)
    expect(parseStatusActive('active')).toBe(true)
    expect(parseStatusActive('ACTIVE')).toBe(true)
  })
  it('is false for "Inactive" or anything else', () => {
    expect(parseStatusActive('Inactive')).toBe(false)
    expect(parseStatusActive('')).toBe(false)
    expect(parseStatusActive(undefined)).toBe(false)
  })
})

describe('blankToNull', () => {
  it('returns null for blank/whitespace/undefined', () => {
    expect(blankToNull('')).toBeNull()
    expect(blankToNull('  ')).toBeNull()
    expect(blankToNull(undefined)).toBeNull()
  })
  it('returns trimmed value otherwise', () => {
    expect(blankToNull(' x ')).toBe('x')
    expect(blankToNull('hello')).toBe('hello')
  })
})

describe('parseDate', () => {
  it('parses M/D/YYYY', () => {
    const d = parseDate('5/11/2026')
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(4)
    expect(d!.getDate()).toBe(11)
  })
  it('parses M/D/YY by adding 2000', () => {
    const d = parseDate('5/3/26')
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(4)
    expect(d!.getDate()).toBe(3)
  })
  it('returns null for blank/invalid input', () => {
    expect(parseDate('')).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('not a date')).toBeNull()
    expect(parseDate('2026-05-11')).toBeNull() // wrong format
  })
  it('handles single-digit days and months', () => {
    const d = parseDate('1/2/26')
    expect(d!.getMonth()).toBe(0)
    expect(d!.getDate()).toBe(2)
  })
})
