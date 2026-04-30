import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, TrendingUp } from 'lucide-react'
import { ClockInOut } from '#/components/time-tracking/ClockInOut'
import { TimeEntryList } from '#/components/time-tracking/TimeEntryList'
import { TimeEntryForm } from '#/components/time-tracking/TimeEntryForm'
import { Modal } from '#/components/ui/Modal'
import { Button } from '#/components/ui/Button'
import { getMyTimeEntries } from '#/server/time-entries'
import { getMyPaySummary } from '#/server/payroll'
import { formatCurrency, formatHours } from '#/lib/utils'
import type { AppTimeEntryWithTask } from '#/lib/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export const Route = createFileRoute('/dashboard/employee/')({ component: EmployeeDashboard })

function EmployeeDashboard() {
  const [showAddEntry, setShowAddEntry] = useState(false)
  const now = new Date()
  const periodStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const periodEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const { data: entries = [], isLoading } = useQuery<AppTimeEntryWithTask[]>({
    queryKey: ['myTimeEntries'],
    queryFn: () => getMyTimeEntries(),
  })

  const { data: paySummary } = useQuery({
    queryKey: ['myPaySummary', periodStart, periodEnd],
    queryFn: () => getMyPaySummary({ data: { startDate: periodStart, endDate: periodEnd } }),
  })

  const completedEntries = entries.filter((e) => e.endTime)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{format(now, 'MMMM yyyy')} pay period</p>
        </div>
        <Button onClick={() => setShowAddEntry(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Entry</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 lg:mb-8">
        <StatCard
          label="Hours This Month"
          value={formatHours(paySummary?.totalHours ?? 0)}
          icon={<TrendingUp className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          label="Estimated Pay"
          value={formatCurrency(paySummary?.estimatedPay ?? 0)}
          sub={`at ${formatCurrency(paySummary?.hourlyRate ?? 0)}/hr`}
        />
        <StatCard
          label="Entries This Month"
          value={String(completedEntries.length)}
          sub="completed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 lg:mb-8">
        <div className="lg:col-span-1">
          <ClockInOut />
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Time Entries</h2>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
            </div>
          ) : (
            <TimeEntryList entries={entries.slice(0, 5)} />
          )}
        </div>
      </div>

      <Modal open={showAddEntry} onClose={() => setShowAddEntry(false)} title="Add Time Entry" size="md">
        <TimeEntryForm onSuccess={() => setShowAddEntry(false)} onCancel={() => setShowAddEntry(false)} />
      </Modal>
    </div>
  )
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
