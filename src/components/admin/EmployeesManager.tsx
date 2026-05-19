import { useQuery } from '@tanstack/react-query'
import { getAllUsers } from '#/server/users'
import { EmployeeTable } from '#/components/admin/EmployeeTable'
import type { AppUser } from '#/lib/types'

interface EmployeesManagerProps {
  currentUserId: string
}

// Employees management panel — the body of the former /dashboard/admin/employees
// page, now hosted inside the Settings accordion.
export function EmployeesManager({ currentUserId }: EmployeesManagerProps) {
  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ['allUsers'],
    queryFn: () => getAllUsers(),
  })

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{users.length} team members</p>

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
        </div>
      ) : (
        <EmployeeTable employees={users} currentUserId={currentUserId} />
      )}

      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-800">
          <strong>Adding employees:</strong> Team members sign up via{' '}
          <code className="bg-blue-100 px-1 rounded">/sign-up</code> and are automatically created as
          employees on first dashboard access. Set their role here.
        </p>
      </div>
    </div>
  )
}
