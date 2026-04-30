import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'

async function requireAdmin() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user || user.role !== 'ADMIN') throw new Error('Forbidden: admin only')
  return user
}

const RangeSchema = z.object({ startDate: z.string(), endDate: z.string(), poNumber: z.string().optional() })

export type PayrollEmployee = {
  id: string
  name: string
  email: string
  hourlyRate: number
  totalHours: number
  grossPay: number
  breakdown: { taskName: string; hours: number; pay: number }[]
}

export type PayrollSummary = {
  employees: PayrollEmployee[]
  totalHours: number
  totalGrossPay: number
  periodStart: string
  periodEnd: string
}

export const getPayrollSummary = createServerFn({ method: 'POST' })
  .inputValidator(RangeSchema)
  .handler(async ({ data }): Promise<PayrollSummary> => {
    await requireAdmin()
    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    end.setHours(23, 59, 59, 999)

    const entries = await prisma.timeEntry.findMany({
      where: {
        startTime: { gte: start },
        endTime: { lte: end, not: null },
        totalHours: { not: null },
        ...(data.poNumber ? { task: { poNumber: data.poNumber } } : {}),
      },
      include: { user: true },
      orderBy: { startTime: 'asc' },
    })

    const byEmployee = new Map<string, typeof entries>()
    for (const entry of entries) {
      const list = byEmployee.get(entry.userId) ?? []
      list.push(entry)
      byEmployee.set(entry.userId, list)
    }

    const employees: PayrollEmployee[] = []
    for (const [, userEntries] of byEmployee) {
      const user = userEntries[0].user
      const rate = Number(user.hourlyRate)
      const byTask = new Map<string, number>()
      let totalHours = 0
      for (const e of userEntries) {
        const h = Number(e.totalHours ?? 0)
        totalHours += h
        byTask.set(e.taskName, (byTask.get(e.taskName) ?? 0) + h)
      }
      employees.push({
        id: user.id,
        name: user.name,
        email: user.email,
        hourlyRate: rate,
        totalHours,
        grossPay: totalHours * rate,
        breakdown: Array.from(byTask.entries()).map(([taskName, hours]) => ({
          taskName,
          hours,
          pay: hours * rate,
        })),
      })
    }

    employees.sort((a, b) => a.name.localeCompare(b.name))

    return {
      employees,
      totalHours: employees.reduce((s, e) => s + e.totalHours, 0),
      totalGrossPay: employees.reduce((s, e) => s + e.grossPay, 0),
      periodStart: data.startDate,
      periodEnd: data.endDate,
    }
  })

export const getMyPaySummary = createServerFn({ method: 'POST' })
  .inputValidator(RangeSchema)
  .handler(async ({ data }): Promise<{ totalHours: number; hourlyRate: number; estimatedPay: number }> => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (!user) throw new Error('User not found')

    const start = new Date(data.startDate)
    const end = new Date(data.endDate)
    end.setHours(23, 59, 59, 999)

    const entries = await prisma.timeEntry.findMany({
      where: {
        userId: user.id,
        startTime: { gte: start },
        endTime: { lte: end, not: null },
        totalHours: { not: null },
      },
    })

    const totalHours = entries.reduce((s, e) => s + Number(e.totalHours ?? 0), 0)
    const rate = Number(user.hourlyRate)
    return { totalHours, hourlyRate: rate, estimatedPay: totalHours * rate }
  })
