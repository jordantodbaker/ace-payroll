import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, LogOut } from 'lucide-react'
import { Button } from '#/components/ui/Button'
import { Select } from '#/components/ui/Select'
import { Input } from '#/components/ui/Input'
import { Timer } from '#/components/time-tracking/Timer'
import { clockIn, clockOut, getActiveEntry } from '#/server/time-entries'
import { getTasks } from '#/server/tasks'
import type { AppTimeEntry, AppTask } from '#/lib/types'

export function ClockInOut() {
  const qc = useQueryClient()
  const [customTask, setCustomTask] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [notes, setNotes] = useState('')

  const { data: activeEntry, isLoading: loadingEntry } = useQuery<AppTimeEntry | null>({
    queryKey: ['activeEntry'],
    queryFn: () => getActiveEntry(),
    refetchInterval: 60_000,
  })

  const { data: tasks = [] } = useQuery<AppTask[]>({
    queryKey: ['tasks'],
    queryFn: () => getTasks(),
  })

  const clockInMutation = useMutation({
    mutationFn: (input: { taskId?: string; taskName: string }) => clockIn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activeEntry'] })
      qc.invalidateQueries({ queryKey: ['myTimeEntries'] })
      setCustomTask('')
      setSelectedTaskId('')
    },
  })

  const clockOutMutation = useMutation({
    mutationFn: () => clockOut({ data: { entryId: activeEntry!.id, notes } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activeEntry'] })
      qc.invalidateQueries({ queryKey: ['myTimeEntries'] })
      setNotes('')
    },
  })

  if (loadingEntry) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />
  }

  if (activeEntry) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-green-700">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold uppercase tracking-wide">Clocked In</span>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Task: <strong>{activeEntry.taskName}</strong></p>
          <Timer startTime={activeEntry.startTime} />
        </div>
        <Input
          placeholder="Optional notes before clocking out..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Button
          variant="danger"
          onClick={() => clockOutMutation.mutate()}
          loading={clockOutMutation.isPending}
          className="w-full"
        >
          <LogOut className="w-4 h-4" />
          Clock Out
        </Button>
        {clockOutMutation.isError && (
          <p className="text-sm text-red-600">{String(clockOutMutation.error)}</p>
        )}
      </div>
    )
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId)
  const taskName = selectedTaskId === '__custom' ? customTask : (selectedTask?.name ?? '')
  const canClockIn = taskName.trim().length > 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <Clock className="w-5 h-5 text-indigo-600" />
        Clock In
      </h3>
      <Select
        label="Select Task"
        value={selectedTaskId}
        onChange={(e) => setSelectedTaskId(e.target.value)}
      >
        <option value="">Choose a task...</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
        <option value="__custom">Custom task...</option>
      </Select>
      {selectedTaskId === '__custom' && (
        <Input
          placeholder="Describe the task"
          value={customTask}
          onChange={(e) => setCustomTask(e.target.value)}
        />
      )}
      <Button
        onClick={() =>
          clockInMutation.mutate({
            taskId: selectedTaskId !== '__custom' ? selectedTaskId : undefined,
            taskName,
          })
        }
        loading={clockInMutation.isPending}
        disabled={!canClockIn}
        className="w-full"
      >
        <Clock className="w-4 h-4" />
        Clock In
      </Button>
      {clockInMutation.isError && (
        <p className="text-sm text-red-600">{String(clockInMutation.error)}</p>
      )}
    </div>
  )
}
