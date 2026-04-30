// Serializable versions of Prisma models (Decimal → number, safe to send over the wire)

export type UserRole = 'ADMIN' | 'EMPLOYEE'

export interface AppUser {
  id: string
  clerkId: string
  name: string
  email: string
  role: UserRole
  hourlyRate: number
  createdAt: Date
}

export interface AppTask {
  id: string
  name: string
  description: string | null
  poNumber: string | null
  active: boolean
  createdAt: Date
}

export interface AppTimeEntry {
  id: string
  userId: string
  taskId: string | null
  taskName: string
  startTime: Date
  endTime: Date | null
  totalHours: number | null
  notes: string | null
  approved: boolean
  flagged: boolean
  createdAt: Date
}

export interface AppTimeEntryWithUser extends AppTimeEntry {
  user: { name: string; email: string }
  task: { name: string } | null
}

export interface AppTimeEntryWithTask extends AppTimeEntry {
  task: { name: string } | null
}
