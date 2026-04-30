// Build the time-entry where clause for a [startDate, endDate] inclusive range.
// startDate/endDate are 'YYYY-MM-DD' strings interpreted in the server's local
// timezone — startTime is gte midnight on startDate, endTime is lte 23:59:59.999
// on endDate. We construct dates in local time so the boundary aligns with how
// users perceive "the day" rather than UTC midnight.
export function timeEntryDateRangeWhere(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  end.setHours(23, 59, 59, 999)
  return {
    startTime: { gte: start },
    endTime: { lte: end, not: null },
    totalHours: { not: null },
  } as const
}

function parseLocalDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  return new Date(y, m - 1, d)
}
