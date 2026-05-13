// Pure helpers used by the seed script. Kept in their own module (rather than
// inlined into seed.ts) so they can be unit-tested without executing the seed.

// Quote-aware CSV cell parser — handles "embedded, commas" and doubled "" escapes.
export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { cell += c }
    } else if (c === ',') {
      cells.push(cell); cell = ''
    } else if (c === '"' && cell.length === 0) {
      inQuotes = true
    } else {
      cell += c
    }
  }
  cells.push(cell)
  return cells.map((s) => s.trim())
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']))
  })
}

export function parseBool(s: string | undefined): boolean {
  return (s ?? '').trim().toUpperCase() === 'TRUE'
}

export function parseStatusActive(s: string | undefined): boolean {
  return (s ?? '').trim().toLowerCase() === 'active'
}

export function blankToNull(s: string | undefined): string | null {
  const v = (s ?? '').trim()
  return v.length === 0 ? null : v
}

// Accepts "M/D/YY" or "M/D/YYYY". Returns null for blank/invalid input.
// 2-digit years are interpreted as 2000-2099.
export function parseDate(s: string | undefined): Date | null {
  const v = (s ?? '').trim()
  if (!v) return null
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  let year = parseInt(m[3], 10)
  if (year < 100) year += 2000
  return new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10))
}
