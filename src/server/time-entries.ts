import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'
import { requireAdmin, requireUser } from '#/server/auth-helpers'
import { toAppTimeEntry } from '#/server/serialize'
import { timeEntryDateRangeWhere } from '#/server/date-range'
import type { AppTimeEntry, AppTimeEntryWithUser, AppTimeEntryWithTask } from '#/lib/types'

export const getMyTimeEntries = createServerFn().handler(async (): Promise<AppTimeEntryWithTask[]> => {
  const user = await requireUser()
  const entries = await prisma.timeEntry.findMany({
    where: { userId: user.id },
    // Sort by workDate (the work day) primarily; createdAt is the tiebreaker
    // and the fallback for legacy rows that have no workDate.
    orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    include: { task: { select: { name: true } } },
  })
  return entries.map((e) => ({ ...toAppTimeEntry(e), task: e.task }))
})

const ListAllSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
}).optional()

export const getAllTimeEntries = createServerFn({ method: 'POST' })
  .inputValidator(ListAllSchema)
  .handler(async ({ data }): Promise<AppTimeEntryWithUser[]> => {
    await requireAdmin()
    const where = data?.startDate && data?.endDate
      ? timeEntryDateRangeWhere(data.startDate, data.endDate)
      : {}
    const entries = await prisma.timeEntry.findMany({
      where,
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
      take: data?.limit ?? 100,
      include: {
        user: { select: { name: true, email: true } },
        task: { select: { name: true, poNumber: true, poLine: true } },
      },
    })
    return entries.map((e) => ({ ...toAppTimeEntry(e), user: e.user, task: e.task }))
  })

// 'YYYY-MM-DD' from a <input type="date">. Anchor to noon local time so the
// stored DateTime renders as the same calendar day regardless of viewer TZ.
const WorkDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
function parseWorkDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

// A "week" is Mon–Sun, so weekEnding is the Sunday on or after the workDate.
// Sunday workDate maps to itself (it's already the last day of its week).
function weekEndingFor(workDate: Date): Date {
  const sunday = new Date(workDate)
  const day = sunday.getDay() // 0 = Sun, 6 = Sat
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  sunday.setDate(sunday.getDate() + daysUntilSunday)
  return sunday
}

export const createTimeEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    taskId: z.string().optional(),
    taskName: z.string().min(1),
    hours: z.number().positive(),
    workDate: WorkDateSchema,
    workDescription: z.string().optional(),
  }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    const user = await requireUser()
    const workDate = parseWorkDate(data.workDate)
    const entry = await prisma.timeEntry.create({
      data: {
        userId: user.id,
        taskId: data.taskId,
        taskName: data.taskName,
        totalHours: data.hours,
        workDate,
        weekEnding: weekEndingFor(workDate),
        workDescription: data.workDescription,
      },
    })
    return toAppTimeEntry(entry)
  })

export const updateTimeEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    id: z.string(),
    taskId: z.string().optional(),
    taskName: z.string().min(1).optional(),
    hours: z.number().positive().optional(),
    workDate: WorkDateSchema.optional(),
    workDescription: z.string().optional(),
  }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    const user = await requireUser()
    const existing = await prisma.timeEntry.findFirst({ where: { id: data.id } })
    if (!existing) throw new Error('Entry not found')
    if (user.role !== 'ADMIN' && (existing.userId !== user.id || existing.approved)) {
      throw new Error('Cannot edit this entry')
    }
    const newWorkDate = data.workDate ? parseWorkDate(data.workDate) : undefined
    const updated = await prisma.timeEntry.update({
      where: { id: data.id },
      data: {
        taskId: data.taskId,
        taskName: data.taskName,
        totalHours: data.hours,
        workDate: newWorkDate,
        // Recompute weekEnding only when workDate actually changed, to avoid
        // overwriting a manually-set weekEnding (e.g. seeded data).
        weekEnding: newWorkDate ? weekEndingFor(newWorkDate) : undefined,
        workDescription: data.workDescription,
      },
    })
    return toAppTimeEntry(updated)
  })

export const deleteTimeEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const user = await requireUser()
    const entry = await prisma.timeEntry.findFirst({ where: { id: data.id } })
    if (!entry) throw new Error('Entry not found')
    if (user.role !== 'ADMIN' && (entry.userId !== user.id || entry.approved)) {
      throw new Error('Cannot delete this entry')
    }
    await prisma.timeEntry.delete({ where: { id: data.id } })
    return { success: true }
  })

export const approveTimeEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), approved: z.boolean() }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    await requireAdmin()
    const entry = await prisma.timeEntry.update({ where: { id: data.id }, data: { approved: data.approved } })
    return toAppTimeEntry(entry)
  })

export const flagTimeEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), flagged: z.boolean() }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    await requireAdmin()
    const entry = await prisma.timeEntry.update({ where: { id: data.id }, data: { flagged: data.flagged } })
    return toAppTimeEntry(entry)
  })
