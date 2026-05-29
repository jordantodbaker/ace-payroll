import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { getAllUsers } from '#/server/users'
import { getAllTimeEntries } from '#/server/time-entries'
import { TimeEntryList } from '#/components/time-tracking/TimeEntryList'
import { Select } from '#/components/ui/Select'
import { formatDate, formatHours, formatNameLastFirst } from '#/lib/utils'
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
      if (e.weekEnding) set.add(new Date(e.weekEnding).toISOString().slice(0, 10))
      else hasNoWeek = true
    }
    return { weeks: [...set].sort().reverse(), hasNoWeek }
  }, [entries])

  const filteredEntries = useMemo(() => {
    if (!weekEnding) return entries
    return entries.filter((e) => {
      if (weekEnding === NO_WEEK) return !e.weekEnding
      const we = e.weekEnding ? new Date(e.weekEnding).toISOString().slice(0, 10) : null
      return we === weekEnding
    })
  }, [entries, weekEnding])

  const pendingEntries = filteredEntries.filter((e) => !e.approved && !e.flagged)
  const flaggedEntries = filteredEntries.filter((e) => e.flagged)
  const totalHours = filteredEntries.reduce((s, e) => s + e.totalHours, 0)
  const activeEmployeeCount = new Set(filteredEntries.map((e) => e.userId)).size
  const userMap = Object.fromEntries(users.map((u) => [u.id, formatNameLastFirst(u.name)]))

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 lg:mb-8">
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
        <StatCard
          label="Pending Approval"
          value={String(pendingEntries.length)}
          icon={<CheckCircle className="w-5 h-5 text-yellow-600" />}
          highlight={pendingEntries.length > 0}
        />
        <StatCard
          label="Flagged Entries"
          value={String(flaggedEntries.length)}
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
          highlight={flaggedEntries.length > 0}
        />
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
          <TimeEntryList entries={filteredEntries} isAdmin showUser userMap={userMap} />
        )}
      </div>
    </div>
  )
}

function StatCard({
  label, value, icon, highlight = false,
}: {
  label: string; value: string; icon?: React.ReactNode; highlight?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border p-5 ${highlight ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
