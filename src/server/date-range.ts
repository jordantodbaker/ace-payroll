// Build the time-entry where clause for a [startDate, endDate] inclusive range.
// startDate/endDate are 'YYYY-MM-DD' strings interpreted in the server's local
// timezone. We filter by createdAt — the moment the entry was logged — since
// individual entries no longer carry their own start/end timestamps.
export function timeEntryDateRangeWhere(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  end.setHours(23, 59, 59, 999)
  return {
    createdAt: { gte: start, lte: end },
  } as const
}

function parseLocalDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  return new Date(y, m - 1, d)
}
