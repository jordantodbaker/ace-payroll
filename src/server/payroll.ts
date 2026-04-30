import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'
import { requireAdmin, requireUser } from '#/server/auth-helpers'
import { timeEntryDateRangeWhere } from '#/server/date-range'

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

    const entries = await prisma.timeEntry.findMany({
      where: {
        ...timeEntryDateRangeWhere(data.startDate, data.endDate),
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
  .inputValidator(z.object({ startDate: z.string(), endDate: z.string() }))
  .handler(async ({ data }): Promise<{ totalHours: number; hourlyRate: number; estimatedPay: number }> => {
    const user = await requireUser()

    const entries = await prisma.timeEntry.findMany({
      where: {
        ...timeEntryDateRangeWhere(data.startDate, data.endDate),
        userId: user.id,
      },
    })

    const totalHours = entries.reduce((s, e) => s + Number(e.totalHours ?? 0), 0)
    const rate = Number(user.hourlyRate)
    return { totalHours, hourlyRate: rate, estimatedPay: totalHours * rate }
  })
