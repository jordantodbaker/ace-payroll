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

// 'YYYY-MM-DD' from a <input type="date">. Anchor to noon local time so the
// stored DateTime renders as the same calendar day regardless of viewer TZ.
export function parseWorkDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

// A "week" is Mon–Sun, so weekEnding is the Sunday on or after the workDate.
// Sunday workDate maps to itself (it's already the last day of its week).
export function weekEndingFor(workDate: Date): Date {
  const sunday = new Date(workDate)
  const day = sunday.getDay() // 0 = Sun, 6 = Sat
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  sunday.setDate(sunday.getDate() + daysUntilSunday)
  return sunday
}
