import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getAllTasks, createTask, updateTask, deleteTask } from '#/server/tasks'
import { Button } from '#/components/ui/Button'
import { Input } from '#/components/ui/Input'
import { Modal } from '#/components/ui/Modal'
import { Badge } from '#/components/ui/Badge'
import { formatDate } from '#/lib/utils'
import type { AppTask } from '#/lib/types'

export const Route = createFileRoute('/dashboard/admin/tasks')({
  component: TasksPage,
})

interface TaskFormState {
  name: string
  clientJobNum: string
  description: string
  poNumber: string
  client: string
  approver: string
}

const emptyForm: TaskFormState = {
  name: '',
  clientJobNum: '',
  description: '',
  poNumber: '',
  client: '',
  approver: '',
}

function toFormState(task: AppTask): TaskFormState {
  return {
    name: task.name,
    clientJobNum: task.clientJobNum ?? '',
    description: task.description ?? '',
    poNumber: task.poNumber ?? '',
    client: task.client ?? '',
    approver: task.approver ?? '',
  }
}

function toPayload(form: TaskFormState) {
  return {
    name: form.name,
    clientJobNum: form.clientJobNum || undefined,
    description: form.description || undefined,
    poNumber: form.poNumber || undefined,
    client: form.client || undefined,
    approver: form.approver || undefined,
  }
}

function TasksPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<AppTask | null>(null)
  const [form, setForm] = useState<TaskFormState>(emptyForm)
  const [error, setError] = useState('')

  const { data: tasks = [], isLoading } = useQuery<AppTask[]>({
    queryKey: ['allTasks'],
    queryFn: () => getAllTasks(),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['allTasks'] })
    qc.invalidateQueries({ queryKey: ['tasks'] })
  }

  const createMutation = useMutation({
    mutationFn: () => createTask({ data: toPayload(form) }),
    onSuccess: () => {
      invalidate()
      setShowAdd(false)
      setForm(emptyForm)
    },
    onError: (e) => setError(String(e)),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTask({ data: { id: editing!.id, ...toPayload(form) } }),
    onSuccess: () => {
      invalidate()
      setEditing(null)
    },
    onError: (e) => setError(String(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask({ data: { id } }),
    onSuccess: invalidate,
  })

  function openAdd() {
    setForm(emptyForm)
    setError('')
    setShowAdd(true)
  }
  function openEdit(task: AppTask) {
    setEditing(task)
    setForm(toFormState(task))
    setError('')
  }

  function setField<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const canSubmit = form.name.trim().length > 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="flex items-center justify-between gap-3 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">Manage predefined task categories</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Task</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No tasks yet. Add one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Job #</th>
                  <th className="pb-3 pr-4">Client</th>
                  <th className="pb-3 pr-4">PO Number</th>
                  <th className="pb-3 pr-4">Approver</th>
                  <th className="pb-3 pr-4">Description</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Created</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{task.name}</td>
                    <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{task.clientJobNum ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-500">{task.client ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{task.poNumber ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-500">{task.approver ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-500">{task.description ?? '—'}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={task.active ? 'green' : 'gray'}>
                        {task.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{formatDate(task.createdAt)}</td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(task)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {task.active && (
                          <button onClick={() => deleteMutation.mutate(task.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Task" size="md">
        <TaskForm
          form={form}
          setField={setField}
          error={error}
          loading={createMutation.isPending}
          disabled={!canSubmit}
          onCancel={() => setShowAdd(false)}
          onSubmit={() => createMutation.mutate()}
          submitLabel="Add Task"
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Task" size="md">
        <TaskForm
          form={form}
          setField={setField}
          error={error}
          loading={updateMutation.isPending}
          disabled={!canSubmit}
          onCancel={() => setEditing(null)}
          onSubmit={() => updateMutation.mutate()}
          submitLabel="Save"
        />
      </Modal>
    </div>
  )
}

interface TaskFormProps {
  form: TaskFormState
  setField: <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => void
  error: string
  loading: boolean
  disabled: boolean
  onCancel: () => void
  onSubmit: () => void
  submitLabel: string
}

function TaskForm({ form, setField, error, loading, disabled, onCancel, onSubmit, submitLabel }: TaskFormProps) {
  return (
    <div className="space-y-4">
      <Input label="Task name" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Client job #" value={form.clientJobNum} onChange={(e) => setField('clientJobNum', e.target.value)} />
        <Input label="PO Number" value={form.poNumber} onChange={(e) => setField('poNumber', e.target.value)} />
        <Input label="Client" value={form.client} onChange={(e) => setField('client', e.target.value)} />
        <Input label="Approver" value={form.approver} onChange={(e) => setField('approver', e.target.value)} />
      </div>
      <Input label="Description" value={form.description} onChange={(e) => setField('description', e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button loading={loading} disabled={disabled} onClick={onSubmit}>{submitLabel}</Button>
      </div>
    </div>
  )
}
