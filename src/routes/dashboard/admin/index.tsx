import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Users, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { getAllUsers } from '#/server/users'
import { getAllTimeEntries } from '#/server/time-entries'
import { TimeEntryList } from '#/components/time-tracking/TimeEntryList'
import { formatHours } from '#/lib/utils'
import type { AppUser, AppTimeEntryWithUser } from '#/lib/types'

export const Route = createFileRoute('/dashboard/admin/')({
  component: AdminOverview,
})

function AdminOverview() {
  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ['allUsers'],
    queryFn: () => getAllUsers(),
  })

  const { data: entries = [], isLoading } = useQuery<AppTimeEntryWithUser[]>({
    queryKey: ['allTimeEntries', 'recent'],
    queryFn: () => getAllTimeEntries({ data: { limit: 50 } }),
  })

  const pendingEntries = entries.filter((e) => !e.approved && !e.flagged && e.endTime)
  const flaggedEntries = entries.filter((e) => e.flagged)
  const totalHours = entries.reduce((s, e) => s + (e.totalHours ?? 0), 0)
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Team summary and recent activity</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 lg:mb-8">
        <StatCard
          label="Employees"
          value={String(users.filter((u) => u.role === 'EMPLOYEE').length)}
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
        <h2 className="font-semibold text-gray-900 mb-4">Recent Time Entries</h2>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : (
          <TimeEntryList entries={entries.slice(0, 10)} isAdmin showUser userMap={userMap} />
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
