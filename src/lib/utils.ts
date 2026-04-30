export function cn(...inputs: (string | undefined | null | false | 0)[]) {
  return inputs.filter(Boolean).join(' ')
}

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—'
  return `${hours.toFixed(2)}h`
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatElapsed(startTime: Date | string): string {
  const start = new Date(startTime).getTime()
  const now = Date.now()
  const diffMs = now - start
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}

export function calcHours(start: Date | string, end: Date | string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.max(0, ms / (1000 * 60 * 60))
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
