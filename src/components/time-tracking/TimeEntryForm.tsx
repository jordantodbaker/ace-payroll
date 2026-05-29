import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '#/components/ui/Button'
import { Input } from '#/components/ui/Input'
import { Select } from '#/components/ui/Select'
import { createTimeEntry, updateTimeEntry } from '#/server/time-entries'
import { getTasks } from '#/server/tasks'
import { entryDate } from '#/lib/utils'
import type { AppTask, AppTimeEntry } from '#/lib/types'

interface TimeEntryFormProps {
  entry?: AppTimeEntry
  onSuccess: () => void
  onCancel: () => void
}

function toInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function TimeEntryForm({ entry, onSuccess, onCancel }: TimeEntryFormProps) {
  const qc = useQueryClient()

  const [taskId, setTaskId] = useState(entry?.taskId ?? '')
  const [customTask, setCustomTask] = useState('')
  const [hours, setHours] = useState(entry ? String(entry.totalHours) : '')
  const [workDate, setWorkDate] = useState(() =>
    toInputDate(entry ? entryDate(entry) : new Date()),
  )
  const [workDescription, setWorkDescription] = useState(entry?.workDescription ?? '')
  const [error, setError] = useState('')

  const { data: tasks = [] } = useQuery<AppTask[]>({ queryKey: ['tasks'], queryFn: () => getTasks() })

  const selectedTask = tasks.find((t) => t.id === taskId)
  const taskName = taskId === '__custom' ? customTask : (entry?.taskName ?? selectedTask?.name ?? '')
  const hoursNumber = parseFloat(hours)

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
          hours: hoursNumber,
          workDate,
          workDescription,
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
          hours: hoursNumber,
          workDate,
          workDescription,
        },
      }),
    onSuccess: () => { invalidate(); onSuccess() },
    onError: (e) => setError(String(e)),
  })

  const isEditing = !!entry
  const isPending = createMutation.isPending || updateMutation.isPending
  const canSubmit =
    taskName.trim() &&
    Number.isFinite(hoursNumber) &&
    hoursNumber > 0 &&
    workDescription.trim().length > 0

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
          <option key={t.id} value={t.id}>
            {t.description ? `${t.name} — ${t.description}` : t.name}
          </option>
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
        label="Date"
        type="date"
        value={workDate}
        onChange={(e) => setWorkDate(e.target.value)}
        required
      />
      <Input
        label="Hours"
        type="number"
        min="0"
        step="0.25"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        placeholder="e.g. 4.5"
        required
      />
      <Input
        label="Work description"
        value={workDescription}
        onChange={(e) => setWorkDescription(e.target.value)}
        placeholder="What did you work on?"
        required
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
