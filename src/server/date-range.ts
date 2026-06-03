// Build the time-entry where clause for a [startDate, endDate] inclusive range.
// startDate/endDate are 'YYYY-MM-DD' strings interpreted in the server's local
// timezone. Filters by workDate so a row counts in the period the work was
// performed, not the period it was logged. Entries without a workDate are
// excluded — we don't know when they happened, so they can't be in any range.
export function timeEntryDateRangeWhere(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  end.setHours(23, 59, 59, 999)
  return {
    workDate: { gte: start, lte: end },
  } as const
}

function parseLocalDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  return new Date(y, m - 1, d)
}
