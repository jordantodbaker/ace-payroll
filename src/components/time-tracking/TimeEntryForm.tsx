import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '#/components/ui/Button'
import { Input } from '#/components/ui/Input'
import { Select } from '#/components/ui/Select'
import { createTimeEntry, updateTimeEntry } from '#/server/time-entries'
import { getTasks } from '#/server/tasks'
import type { AppTask, AppTimeEntry } from '#/lib/types'

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface TimeEntryFormProps {
  entry?: AppTimeEntry
  onSuccess: () => void
  onCancel: () => void
}

export function TimeEntryForm({ entry, onSuccess, onCancel }: TimeEntryFormProps) {
  const qc = useQueryClient()
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const [taskId, setTaskId] = useState(entry?.taskId ?? '')
  const [customTask, setCustomTask] = useState('')
  const [startTime, setStartTime] = useState(
    entry ? toLocalDatetimeString(new Date(entry.startTime)) : toLocalDatetimeString(oneHourAgo),
  )
  const [endTime, setEndTime] = useState(
    entry?.endTime ? toLocalDatetimeString(new Date(entry.endTime)) : toLocalDatetimeString(now),
  )
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [error, setError] = useState('')

  const { data: tasks = [] } = useQuery<AppTask[]>({ queryKey: ['tasks'], queryFn: () => getTasks() })

  const selectedTask = tasks.find((t) => t.id === taskId)
  const taskName = taskId === '__custom' ? customTask : (entry?.taskName ?? selectedTask?.name ?? '')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['myTimeEntries'] })
    qc.invalidateQueries({ queryKey: ['allTimeEntries'] })
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createTimeEntry({
        data: {
          taskId: taskId !== '__custom' ? taskId : undefined,
          taskName,
          startTime,
          endTime,
          notes: notes || undefined,
        },
      }),
    onSuccess: () => { invalidate(); onSuccess() },
    onError: (e) => setError(String(e)),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTimeEntry({
        data: {
          id: entry!.id,
          taskId: taskId !== '__custom' ? taskId : undefined,
          taskName,
          startTime,
          endTime,
          notes: notes || undefined,
        },
      }),
    onSuccess: () => { invalidate(); onSuccess() },
    onError: (e) => setError(String(e)),
  })

  const isEditing = !!entry
  const isPending = createMutation.isPending || updateMutation.isPending
  const canSubmit = taskName.trim() && startTime && endTime

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (isEditing) updateMutation.mutate()
    else createMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Task"
        value={taskId}
        onChange={(e) => setTaskId(e.target.value)}
      >
        <option value="">Select task...</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
        <option value="__custom">Custom task...</option>
      </Select>
      {taskId === '__custom' && (
        <Input
          label="Task name"
          value={customTask}
          onChange={(e) => setCustomTask(e.target.value)}
          required
        />
      )}
      <Input
        label="Start time"
        type="datetime-local"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
        required
      />
      <Input
        label="End time"
        type="datetime-local"
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
        required
      />
      <Input
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Any additional notes..."
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={isPending} disabled={!canSubmit}>
          {isEditing ? 'Save changes' : 'Add entry'}
        </Button>
      </div>
    </form>
  )
}
