import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getAllUsers } from '#/server/users'
import { EmployeeTable } from '#/components/admin/EmployeeTable'
import type { AppUser } from '#/lib/types'

export const Route = createFileRoute('/dashboard/admin/employees')({
  component: EmployeesPage,
})

function EmployeesPage() {
  const { user: me } = Route.useRouteContext() as { user: AppUser }

  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ['allUsers'],
    queryFn: () => getAllUsers(),
  })

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} team members</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
          </div>
        ) : (
          <EmployeeTable employees={users} currentUserId={me.id} />
        )}
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-800">
          <strong>Adding employees:</strong> Team members sign up via{' '}
          <code className="bg-blue-100 px-1 rounded">/sign-up</code> and are automatically created as
          employees on first dashboard access. Set their hourly rate and role here.
        </p>
      </div>
    </div>
  )
}
