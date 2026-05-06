import { Link } from '@tanstack/react-router'
import { UserButton, useUser } from '@clerk/tanstack-react-start'
import {
  Clock,
  LayoutDashboard,
  Users,
  ListChecks,
  ClipboardList,
  X,
} from 'lucide-react'
import { cn } from '#/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  exact?: boolean
}

interface SidebarProps {
  role: 'ADMIN' | 'EMPLOYEE'
  open: boolean
  onClose: () => void
}

const adminNav: NavItem[] = [
  { to: '/dashboard/admin', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" />, exact: true },
  { to: '/dashboard/admin/employees', label: 'Employees', icon: <Users className="w-5 h-5" /> },
  { to: '/dashboard/admin/tasks', label: 'Tasks', icon: <ListChecks className="w-5 h-5" /> },
]

const employeeNav: NavItem[] = [
  { to: '/dashboard/employee', label: 'My Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, exact: true },
  { to: '/dashboard/employee/time-log', label: 'Time Log', icon: <ClipboardList className="w-5 h-5" /> },
]

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const { user } = useUser()
  const nav = role === 'ADMIN' ? adminNav : employeeNav

  return (
    <>
      {/* Backdrop — only shows on mobile when open */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-900 text-white transition-transform',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Sidebar navigation"
      >
        <div className="flex items-center justify-between gap-2 px-6 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-400" />
            <span className="text-lg font-bold">ACE Time</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-white p-1 -mr-1"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              activeOptions={item.exact ? { exact: true } : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                'text-gray-300 hover:bg-gray-800 hover:text-white',
                '[&.active]:bg-indigo-600 [&.active]:text-white',
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-700 flex items-center gap-3">
          <UserButton />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
            <p className="text-xs text-gray-400 truncate">{role === 'ADMIN' ? 'Admin' : 'Employee'}</p>
          </div>
        </div>
      </aside>
    </>
  )
}
