import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Download } from 'lucide-react'
import { getAllTasks, createTask, updateTask, deleteTask } from '#/server/tasks'
import { Button } from '#/components/ui/Button'
import { Input } from '#/components/ui/Input'
import { Modal } from '#/components/ui/Modal'
import { Badge } from '#/components/ui/Badge'
import { downloadCsv, formatDate } from '#/lib/utils'
import type { AppTask } from '#/lib/types'

interface TaskFormState {
  name: string
  poLine: string
  clientJobNum: string
  poNumber: string
  client: string
  approver: string
  type: string
  timesheetSubmit: string
  description: string
}

const emptyForm: TaskFormState = {
  name: '',
  poLine: '',
  clientJobNum: '',
  poNumber: '',
  client: '',
  approver: '',
  type: '',
  timesheetSubmit: '',
  description: '',
}

function toFormState(task: AppTask): TaskFormState {
  return {
    name: task.name,
    poLine: task.poLine,
    clientJobNum: task.clientJobNum ?? '',
    poNumber: task.poNumber ?? '',
    client: task.client ?? '',
    approver: task.approver ?? '',
    type: task.type ?? '',
    timesheetSubmit: task.timesheetSubmit ?? '',
    description: task.description ?? '',
  }
}

function toPayload(form: TaskFormState) {
  return {
    name: form.name,
    poLine: form.poLine,
    clientJobNum: form.clientJobNum || undefined,
    poNumber: form.poNumber || undefined,
    client: form.client || undefined,
    approver: form.approver || undefined,
    type: form.type || undefined,
    timesheetSubmit: form.timesheetSubmit || undefined,
    description: form.description || undefined,
  }
}

// Tasks management panel — the body of the former /dashboard/admin/tasks page,
// now hosted inside the Settings accordion.
export function TasksManager() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<AppTask | null>(null)
  const [form, setForm] = useState<TaskFormState>(emptyForm)
  const [error, setError] = useState('')

  const { data: tasks = [], isLoading } = useQuery<AppTask[]>({
    queryKey: ['allTasks'],
    queryFn: () => getAllTasks(),
    staleTime: 5 * 60_000,
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

  const canSubmit = form.name.trim().length > 0 && form.poLine.trim().length > 0

  function handleExportCsv() {
    if (tasks.length === 0) return
    const rows: string[][] = [
      ['Project', 'PO Line', 'Client Job #', 'PO', 'Client', 'Approver', 'Type', 'Timesheet Submit', 'Description', 'Status', 'Created'],
      ...tasks.map((t) => [
        t.name,
        t.poLine,
        t.clientJobNum ?? '',
        t.poNumber ?? '',
        t.client ?? '',
        t.approver ?? '',
        t.type ?? '',
        t.timesheetSubmit ?? '',
        t.description ?? '',
        t.active ? 'Active' : 'Inactive',
        formatDate(t.createdAt),
      ]),
    ]
    downloadCsv('tasks.csv', rows)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-gray-500">Manage predefined task categories</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportCsv} disabled={tasks.length === 0}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Task</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

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
                <th className="pb-3 pr-4">Project</th>
                <th className="pb-3 pr-4">PO Line</th>
                <th className="pb-3 pr-4">Description</th>
                <th className="pb-3 pr-4">Client</th>
                <th className="pb-3 pr-4">PO</th>
                <th className="pb-3 pr-4">Approver</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Submit</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{task.name}</td>
                  <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{task.poLine}</td>
                  <td className="py-3 pr-4 text-gray-500">{task.description ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-500">{task.client ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{task.poNumber ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-500">{task.approver ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-500">{task.type ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-500">{task.timesheetSubmit ?? '—'}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={task.active ? 'green' : 'gray'}>
                      {task.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Project" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
        <Input label="PO Line (unique)" value={form.poLine} onChange={(e) => setField('poLine', e.target.value)} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Client job #" value={form.clientJobNum} onChange={(e) => setField('clientJobNum', e.target.value)} />
        <Input label="PO" value={form.poNumber} onChange={(e) => setField('poNumber', e.target.value)} />
        <Input label="Client" value={form.client} onChange={(e) => setField('client', e.target.value)} />
        <Input label="Approver" value={form.approver} onChange={(e) => setField('approver', e.target.value)} />
        <Input label="Type (Reg / PTO)" value={form.type} onChange={(e) => setField('type', e.target.value)} />
        <Input label="Timesheet submit" value={form.timesheetSubmit} onChange={(e) => setField('timesheetSubmit', e.target.value)} />
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
