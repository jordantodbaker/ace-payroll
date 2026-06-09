export function cn(...inputs: (string | undefined | null | false | 0)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—'
  return `${hours.toFixed(1)}h`
}

// Display name as "Last, First". The DB stores names in "First Last" order
// (e.g. "Pete Allred"); this normalizes display + CSV + PDF output. Names
// with no whitespace are returned unchanged.
export function formatNameLastFirst(name: string | null | undefined): string {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name.trim()
  const last = parts[parts.length - 1]
  const first = parts.slice(0, -1).join(' ')
  return `${last}, ${first}`
}

// Display a user as "Last, First" — the app-wide name format. Precedence:
//   1. structured firstName + lastName (whichever subset is present)
//   2. legacy `name` field, comma-flipped via formatNameLastFirst
//   3. email as last-resort identifier
//
// Used everywhere a user is rendered: tables, dropdowns, CSV/PDF exports.
export function displayName(
  user: {
    firstName?: string | null
    lastName?: string | null
    name?: string | null
    email?: string | null
  },
): string {
  const first = user.firstName?.trim() || ''
  const last = user.lastName?.trim() || ''
  if (first && last) return `${last}, ${first}`
  if (last) return last
  if (first) return first
  if (user.name?.trim()) return formatNameLastFirst(user.name)
  return user.email ?? ''
}

// Build the userId → display-name map used by every page that renders a
// time-entry list or filters by employee.
export function buildUserMap(
  users: {
    id: string
    name: string
    firstName?: string | null
    lastName?: string | null
    email?: string | null
  }[],
): Record<string, string> {
  return Object.fromEntries(users.map((u) => [u.id, displayName(u)]))
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
