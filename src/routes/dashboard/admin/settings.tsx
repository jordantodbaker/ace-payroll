import { createFileRoute } from '@tanstack/react-router'
import { Users, ListChecks, CalendarClock } from 'lucide-react'
import { AccordionSection } from '#/components/ui/Accordion'
import { EmployeesManager } from '#/components/admin/EmployeesManager'
import { TasksManager } from '#/components/admin/TasksManager'
import { PayPeriodManager } from '#/components/admin/PayPeriodManager'
import type { AppUser } from '#/lib/types'

export const Route = createFileRoute('/dashboard/admin/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { user: me } = Route.useRouteContext() as { user: AppUser }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage employees and tasks</p>
      </div>

      <div className="space-y-3">
        <AccordionSection
          title="Employees"
          description="Team members and their roles"
          icon={<Users className="w-5 h-5 text-indigo-600" />}
          defaultOpen
        >
          <EmployeesManager currentUserId={me.id} />
        </AccordionSection>

        <AccordionSection
          title="Tasks"
          description="Predefined task categories"
          icon={<ListChecks className="w-5 h-5 text-indigo-600" />}
        >
          <TasksManager />
        </AccordionSection>

        <AccordionSection
          title="Pay Period"
          description="Bi-weekly pay period schedule"
          icon={<CalendarClock className="w-5 h-5 text-indigo-600" />}
        >
          <PayPeriodManager />
        </AccordionSection>
      </div>
    </div>
  )
}
