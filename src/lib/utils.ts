export function cn(...inputs: (string | undefined | null | false | 0)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—'
  return `${hours.toFixed(1)}h`
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
