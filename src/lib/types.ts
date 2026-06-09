// Serializable versions of Prisma models (Decimal → number, safe to send over the wire)

export type UserRole = 'ADMIN' | 'EMPLOYEE'

export interface AppUser {
  id: string
  clerkId: string
  name: string
  firstName: string | null
  lastName: string | null
  email: string
  role: UserRole
  createdAt: Date
}

export interface AppTask {
  id: string
  clientJobNum: string | null
  poLine: string
  poNumber: string | null
  name: string
  description: string | null
  client: string | null
  approver: string | null
  type: string | null
  timesheetSubmit: string | null
  active: boolean
  createdAt: Date
}

export interface AppTimeEntry {
  id: string
  userId: string
  taskId: string | null
  taskName: string
  weekEnding: Date | null
  payPeriodEnding: Date | null
  workDate: Date | null
  totalHours: number
  workDescription: string | null
  createdAt: Date
}

export interface AppPayPeriodConfig {
  payPeriodAnchor: Date
  payPeriodWeeks: number
}

export interface AppTimeEntryWithUser extends AppTimeEntry {
  user: { name: string; email: string }
  task: { name: string; poNumber: string | null; poLine: string } | null
}

export interface AppTimeEntryWithTask extends AppTimeEntry {
  task: { name: string } | null
}
