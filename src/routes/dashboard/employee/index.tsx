import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, TrendingUp, Clock } from 'lucide-react'
import { TimeEntryList } from '#/components/time-tracking/TimeEntryList'
import { TimeEntryForm } from '#/components/time-tracking/TimeEntryForm'
import { Modal } from '#/components/ui/Modal'
import { Button } from '#/components/ui/Button'
import { getMyTimeEntries } from '#/server/time-entries'
import { entryDate, formatHours } from '#/lib/utils'
import type { AppTimeEntryWithTask } from '#/lib/types'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks } from 'date-fns'

export const Route = createFileRoute('/dashboard/employee/')({ component: EmployeeDashboard })

function EmployeeDashboard() {
  const [showAddEntry, setShowAddEntry] = useState(false)
  const now = new Date()
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const { data: entries = [], isLoading } = useQuery<AppTimeEntryWithTask[]>({
    queryKey: ['myTimeEntries'],
    queryFn: () => getMyTimeEntries(),
  })

  // Week boundaries are Mon–Sun, matching how `weekEndingFor` defines a week.
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const lastWeekRef = subWeeks(now, 1)
  const lastWeekStart = startOfWeek(lastWeekRef, { weekStartsOn: 1 })
  const lastWeekEnd = endOfWeek(lastWeekRef, { weekStartsOn: 1 })

  const monthEntries = entries.filter((e) => {
    const date = entryDate(e)
    return date >= monthStart && date <= monthEnd
  })
  const sortedMonthEntries = [...monthEntries].sort(
    (a, b) => entryDate(b).getTime() - entryDate(a).getTime(),
  )

  const thisWeekHours = entries.reduce((s, e) => {
    const d = entryDate(e)
    return d >= thisWeekStart && d <= thisWeekEnd ? s + e.totalHours : s
  }, 0)
  const lastWeekEntryCount = entries.filter((e) => {
    const d = entryDate(e)
    return d >= lastWeekStart && d <= lastWeekEnd
  }).length

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{format(now, 'MMMM yyyy')}</p>
        </div>
        <Button onClick={() => setShowAddEntry(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Entry</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 lg:mb-8">
        <StatCard
          label="Hours This Week"
          value={formatHours(thisWeekHours)}
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          label="Entries Last Week"
          value={String(lastWeekEntryCount)}
          icon={<Clock className="w-5 h-5 text-indigo-600" />}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6 lg:mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">This Month's Time Entries</h2>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : (
          <TimeEntryList entries={sortedMonthEntries} />
        )}
      </div>

      <Modal open={showAddEntry} onClose={() => setShowAddEntry(false)} title="Add Time Entry" size="md">
        <TimeEntryForm onSuccess={() => setShowAddEntry(false)} onCancel={() => setShowAddEntry(false)} />
      </Modal>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
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
