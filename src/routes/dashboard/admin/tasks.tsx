import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { getAllTasks, createTask, updateTask, deleteTask } from '#/server/tasks'
import { getMe } from '#/server/users'
import { Button } from '#/components/ui/Button'
import { Input } from '#/components/ui/Input'
import { Modal } from '#/components/ui/Modal'
import { Badge } from '#/components/ui/Badge'
import { formatDate } from '#/lib/utils'
import type { AppTask } from '#/lib/types'

export const Route = createFileRoute('/dashboard/admin/tasks')({
  beforeLoad: async () => {
    const me = await getMe()
    if (!me) throw redirect({ to: '/sign-in' })
    if (me.role !== 'ADMIN') throw redirect({ to: '/dashboard/employee' })
  },
  component: TasksPage,
})

function TasksPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<AppTask | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [po, setPo] = useState('')
  const [error, setError] = useState('')

  const { data: tasks = [], isLoading } = useQuery<AppTask[]>({
    queryKey: ['allTasks'],
    queryFn: () => getAllTasks(),
  })

  const createMutation = useMutation({
    mutationFn: () => createTask({ data: { name, description: desc || undefined, poNumber: po || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allTasks'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setShowAdd(false)
      setName('')
      setDesc('')
      setPo('')
    },
    onError: (e) => setError(String(e)),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTask({ data: { id: editing!.id, name, description: desc || undefined, poNumber: po || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allTasks'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setEditing(null)
    },
    onError: (e) => setError(String(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allTasks'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  function openAdd() {
    setName(''); setDesc(''); setPo(''); setError(''); setShowAdd(true)
  }
  function openEdit(task: AppTask) {
    setEditing(task); setName(task.name); setDesc(task.description ?? ''); setPo(task.poNumber ?? ''); setError('')
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">Manage predefined task categories</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No tasks yet. Add one to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Description</th>
                <th className="pb-3 pr-4">PO Number</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Created</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="py-3 pr-4 font-medium text-gray-900">{task.name}</td>
                  <td className="py-3 pr-4 text-gray-500">{task.description ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{task.poNumber ?? '—'}</td>
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
        )}
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Task" size="sm">
        <div className="space-y-4">
          <Input label="Task name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Input label="PO Number (optional)" value={po} onChange={(e) => setPo(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button loading={createMutation.isPending} disabled={!name.trim()} onClick={() => createMutation.mutate()}>
              Add Task
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Task" size="sm">
        <div className="space-y-4">
          <Input label="Task name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Input label="PO Number (optional)" value={po} onChange={(e) => setPo(e.target.value)} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={updateMutation.isPending} disabled={!name.trim()} onClick={() => updateMutation.mutate()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
