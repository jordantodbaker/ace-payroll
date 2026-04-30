import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { TimeEntryList } from '#/components/time-tracking/TimeEntryList'
import { TimeEntryForm } from '#/components/time-tracking/TimeEntryForm'
import { Modal } from '#/components/ui/Modal'
import { Button } from '#/components/ui/Button'
import { getMyTimeEntries } from '#/server/time-entries'
import type { AppTimeEntryWithTask } from '#/lib/types'

export const Route = createFileRoute('/dashboard/employee/time-log')({ component: TimeLog })

function TimeLog() {
  const [showAdd, setShowAdd] = useState(false)

  const { data: entries = [], isLoading } = useQuery<AppTimeEntryWithTask[]>({
    queryKey: ['myTimeEntries'],
    queryFn: () => getMyTimeEntries(),
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Time Log</h1>
          <p className="text-sm text-gray-500 mt-1">{entries.length} total entries</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Entry</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : (
          <TimeEntryList entries={entries} />
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Time Entry" size="md">
        <TimeEntryForm onSuccess={() => setShowAdd(false)} onCancel={() => setShowAdd(false)} />
      </Modal>
    </div>
  )
}
