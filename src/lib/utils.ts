export function cn(...inputs: (string | undefined | null | false | 0)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—'
  return `${hours.toFixed(1)}h`
}

// Authoritative "when did this work happen" for a time entry. Prefer workDate
// (the day work was performed); fall back to createdAt (when the entry was
// logged) for legacy rows that pre-date the workDate field.
export function entryDate(entry: {
  workDate: Date | string | null
  createdAt: Date | string
}): Date {
  return new Date(entry.workDate ?? entry.createdAt)
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function formatDate(date: Date | string, opts: { month?: 'short' | 'long' } = {}): string {
  // Date-only strings ('2026-04-01') would otherwise be parsed as UTC midnight,
  // which displays as the previous day in negative-UTC timezones. Anchor to noon
  // local time to keep the calendar day stable across zones.
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00`)
    : new Date(date)
  return d.toLocaleDateString('en-US', {
    month: opts.month ?? 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
