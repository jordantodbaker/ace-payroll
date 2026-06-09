import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, ShieldCheck, User as UserIcon } from 'lucide-react'
import { Button } from '#/components/ui/Button'
import { Input } from '#/components/ui/Input'
import { Select } from '#/components/ui/Select'
import { Badge } from '#/components/ui/Badge'
import { Modal } from '#/components/ui/Modal'
import { updateUserRole, updateUserName, deleteUser } from '#/server/users'
import { displayName, formatDate } from '#/lib/utils'
import type { AppUser } from '#/lib/types'

interface EmployeeTableProps {
  employees: AppUser[]
  currentUserId: string
}

export function EmployeeTable({ employees, currentUserId }: EmployeeTableProps) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [newRole, setNewRole] = useState<'ADMIN' | 'EMPLOYEE'>('EMPLOYEE')
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null)

  function openEdit(emp: AppUser) {
    setEditing(emp)
    setNewRole(emp.role)
    setNewFirst(emp.firstName ?? '')
    setNewLast(emp.lastName ?? '')
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return
      const tasks: Promise<unknown>[] = []
      const trimmedFirst = newFirst.trim()
      const trimmedLast = newLast.trim()
      if (trimmedFirst !== (editing.firstName ?? '') || trimmedLast !== (editing.lastName ?? '')) {
        tasks.push(updateUserName({
          data: {
            userId: editing.id,
            firstName: trimmedFirst || undefined,
            lastName: trimmedLast || undefined,
          },
        }))
      }
      if (newRole !== editing.role) {
        tasks.push(updateUserRole({ data: { userId: editing.id, role: newRole } }))
      }
      await Promise.all(tasks)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allUsers'] })
      // Name displays everywhere derive from the same user map, so any list
      // that shows an employee's name is now stale.
      qc.invalidateQueries({ queryKey: ['allTimeEntries'] })
      qc.invalidateQueries({ queryKey: ['myTimeEntries'] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['allUsers'] })
      setConfirmDelete(null)
    },
  })

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="pb-3 pr-4">Name</th>
              <th className="pb-3 pr-4">Email</th>
              <th className="pb-3 pr-4">Role</th>
              <th className="pb-3 pr-4">Since</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {emp.role === 'ADMIN' ? (
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900">{displayName(emp)}</span>
                    {emp.id === currentUserId && <Badge variant="blue">You</Badge>}
                  </div>
                </td>
                <td className="py-3 pr-4 text-gray-600">{emp.email}</td>
                <td className="py-3 pr-4">
                  <Badge variant={emp.role === 'ADMIN' ? 'blue' : 'gray'}>
                    {emp.role === 'ADMIN' ? 'Admin' : 'Employee'}
                  </Badge>
                </td>
                <td className="py-3 pr-4 text-gray-500">{formatDate(emp.createdAt)}</td>
                <td className="py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(emp)}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {emp.id !== currentUserId && (
                      <button
                        onClick={() => setConfirmDelete(emp)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                      >
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Employee">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{editing?.email}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="First name"
              value={newFirst}
              onChange={(e) => setNewFirst(e.target.value)}
              placeholder="First"
            />
            <Input
              label="Last name"
              value={newLast}
              onChange={(e) => setNewLast(e.target.value)}
              placeholder="Last"
            />
          </div>
          <Select
            label="Role"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as 'ADMIN' | 'EMPLOYEE')}
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="ADMIN">Admin</option>
          </Select>
          {updateMutation.isError && (
            <p className="text-sm text-red-600">{String(updateMutation.error)}</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove Employee" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Remove <strong>{confirmDelete && displayName(confirmDelete)}</strong>? This will delete all their time entries.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
          >
            Remove
          </Button>
        </div>
      </Modal>
    </>
  )
}
