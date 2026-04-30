import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Flag, CheckCircle } from 'lucide-react'
import { Button } from '#/components/ui/Button'
import { Badge } from '#/components/ui/Badge'
import { Modal } from '#/components/ui/Modal'
import { TimeEntryForm } from '#/components/time-tracking/TimeEntryForm'
import { deleteTimeEntry, approveTimeEntry, flagTimeEntry } from '#/server/time-entries'
import { formatDateTime, formatHours } from '#/lib/utils'
import type { AppTimeEntry } from '#/lib/types'

interface TimeEntryListProps {
  entries: AppTimeEntry[]
  isAdmin?: boolean
  showUser?: boolean
  userMap?: Record<string, string>
}

export function TimeEntryList({ entries, isAdmin = false, showUser = false, userMap = {} }: TimeEntryListProps) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AppTimeEntry | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTimeEntry({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myTimeEntries'] })
      qc.invalidateQueries({ queryKey: ['allTimeEntries'] })
      setConfirmDelete(null)
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      approveTimeEntry({ data: { id, approved } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allTimeEntries'] }),
  })

  const flagMutation = useMutation({
    mutationFn: ({ id, flagged }: { id: string; flagged: boolean }) =>
      flagTimeEntry({ data: { id, flagged } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['allTimeEntries'] }),
  })

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No time entries yet.</p>
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              {showUser && <th className="pb-3 pr-4">Employee</th>}
              <th className="pb-3 pr-4">Task</th>
              <th className="pb-3 pr-4">Start</th>
              <th className="pb-3 pr-4">End</th>
              <th className="pb-3 pr-4">Hours</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                {showUser && (
                  <td className="py-3 pr-4 font-medium text-gray-900">
                    {userMap[entry.userId] ?? entry.userId}
                  </td>
                )}
                <td className="py-3 pr-4 text-gray-900">{entry.taskName}</td>
                <td className="py-3 pr-4 text-gray-600">{formatDateTime(entry.startTime)}</td>
                <td className="py-3 pr-4 text-gray-600">
                  {entry.endTime ? formatDateTime(entry.endTime) : (
                    <Badge variant="green">Active</Badge>
                  )}
                </td>
                <td className="py-3 pr-4 tabular-nums text-gray-900">
                  {entry.endTime ? formatHours(entry.totalHours) : '—'}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex gap-1 flex-wrap">
                    {entry.approved && <Badge variant="green">Approved</Badge>}
                    {entry.flagged && <Badge variant="red">Flagged</Badge>}
                    {!entry.approved && !entry.flagged && <Badge variant="gray">Pending</Badge>}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    {entry.endTime && (!entry.approved || isAdmin) && (
                      <button
                        onClick={() => setEditing(entry)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate({ id: entry.id, approved: !entry.approved })}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600"
                          title={entry.approved ? 'Unapprove' : 'Approve'}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => flagMutation.mutate({ id: entry.id, flagged: !entry.flagged })}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-yellow-600"
                          title={entry.flagged ? 'Unflag' : 'Flag'}
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setConfirmDelete(entry.id)}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Time Entry">
        {editing && (
          <TimeEntryForm
            entry={editing}
            onSuccess={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Entry" size="sm">
        <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this time entry?</p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </>
  )
}
