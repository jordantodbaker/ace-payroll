import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Users, Clock } from 'lucide-react'
import { getAllUsers } from '#/server/users'
import { getAllTimeEntries } from '#/server/time-entries'
import { TimeEntryList } from '#/components/time-tracking/TimeEntryList'
import { Select } from '#/components/ui/Select'
import { buildUserMap, displayName, entryDate, formatDate, formatHours } from '#/lib/utils'
import { getThisAndLastWeek, weekEndingKey } from '#/lib/date-utils'
import type { AppUser, AppTimeEntryWithUser } from '#/lib/types'

export const Route = createFileRoute('/dashboard/admin/')({
  component: AdminOverview,
})

const NO_WEEK = '__none__'

function AdminOverview() {
  const [weekEnding, setWeekEnding] = useState('')

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ['allUsers'],
    queryFn: () => getAllUsers(),
    staleTime: 5 * 60_000,
  })

  const { data: entries = [], isLoading } = useQuery<AppTimeEntryWithUser[]>({
    queryKey: ['allTimeEntries', 'overview'],
    queryFn: () => getAllTimeEntries({ data: { limit: 500 } }),
  })

  // Dropdown options derived from loaded entries — no dead options for weeks
  // with no data.
  const weekOptions = useMemo(() => {
    const set = new Set<string>()
    let hasNoWeek = false
    for (const e of entries) {
      const key = weekEndingKey(e.weekEnding)
      if (key) set.add(key)
      else hasNoWeek = true
    }
    return { weeks: [...set].sort().reverse(), hasNoWeek }
  }, [entries])

  const filteredEntries = useMemo(() => {
    if (!weekEnding) return entries
    return entries.filter((e) => {
      if (weekEnding === NO_WEEK) return !e.weekEnding
      return weekEndingKey(e.weekEnding) === weekEnding
    })
  }, [entries, weekEnding])

  const totalHours = filteredEntries.reduce((s, e) => s + e.totalHours, 0)
  const activeEmployeeCount = new Set(filteredEntries.map((e) => e.userId)).size
  const userMap = buildUserMap(users)

  // Per-employee weekly totals — always Mon–Sun, regardless of the week-ending
  // filter above (that filter scopes the entries list, not the weekly summary).
  const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = getThisAndLastWeek(new Date())

  const userWeeklyHours = new Map<string, { thisWeek: number; lastWeek: number }>()
  for (const u of users) userWeeklyHours.set(u.id, { thisWeek: 0, lastWeek: 0 })
  for (const e of entries) {
    const bucket = userWeeklyHours.get(e.userId)
    if (!bucket) continue
    const d = entryDate(e)
    if (d >= thisWeekStart && d <= thisWeekEnd) bucket.thisWeek += e.totalHours
    else if (d >= lastWeekStart && d <= lastWeekEnd) bucket.lastWeek += e.totalHours
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Team summary and recent activity
          {weekEnding && ` — week of ${weekEnding === NO_WEEK ? '(no week ending)' : formatDate(weekEnding)}`}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 max-w-xs">
            <Select label="Week ending" value={weekEnding} onChange={(e) => setWeekEnding(e.target.value)}>
              <option value="">All weeks</option>
              {weekOptions.weeks.map((w) => (
                <option key={w} value={w}>{formatDate(w)}</option>
              ))}
              {weekOptions.hasNoWeek && <option value={NO_WEEK}>(no week ending)</option>}
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 lg:mb-8">
        <StatCard
          label="Active Employees"
          value={String(activeEmployeeCount)}
          icon={<Users className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          label="Total Hours Logged"
          value={formatHours(totalHours)}
          icon={<Clock className="w-5 h-5 text-green-600" />}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Weekly Hours by Employee</h2>
        {users.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No team members yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="pb-3 pr-4">Employee</th>
                  <th className="pb-3 pr-4 text-right">Hours This Week</th>
                  <th className="pb-3 text-right">Hours Last Week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const hrs = userWeeklyHours.get(u.id) ?? { thisWeek: 0, lastWeek: 0 }
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900">{displayName(u)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-gray-900">{formatHours(hrs.thisWeek)}</td>
                      <td className="py-3 text-right tabular-nums text-gray-900">{formatHours(hrs.lastWeek)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          {weekEnding ? "Week's Time Entries" : 'Time Entries'}
        </h2>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : filteredEntries.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No time entries{weekEnding ? ' for the selected week' : ''} yet.
          </p>
        ) : (
          <TimeEntryList entries={filteredEntries} showUser userMap={userMap} />
        )}
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon,
}: {
  label: string; value: string; icon?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
