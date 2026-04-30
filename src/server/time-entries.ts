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
    orderBy: { startTime: 'desc' },
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
      orderBy: { startTime: 'desc' },
      take: data?.limit ?? 100,
      include: {
        user: { select: { name: true, email: true } },
        task: { select: { name: true } },
      },
    })
    return entries.map((e) => ({ ...toAppTimeEntry(e), user: e.user, task: e.task }))
  })

export const getActiveEntry = createServerFn().handler(async (): Promise<AppTimeEntry | null> => {
  const user = await requireUser()
  const entry = await prisma.timeEntry.findFirst({
    where: { userId: user.id, endTime: null },
    orderBy: { startTime: 'desc' },
  })
  return entry ? toAppTimeEntry(entry) : null
})

export const clockIn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ taskId: z.string().optional(), taskName: z.string().min(1) }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    const user = await requireUser()
    await prisma.timeEntry.updateMany({
      where: { userId: user.id, endTime: null },
      data: { endTime: new Date(), totalHours: 0 },
    })
    const entry = await prisma.timeEntry.create({
      data: { userId: user.id, taskId: data.taskId, taskName: data.taskName, startTime: new Date() },
    })
    return toAppTimeEntry(entry)
  })

export const clockOut = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ entryId: z.string(), notes: z.string().optional() }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    const user = await requireUser()
    const entry = await prisma.timeEntry.findFirst({ where: { id: data.entryId, userId: user.id } })
    if (!entry || entry.endTime) throw new Error('No active entry found')
    const endTime = new Date()
    const totalHours = (endTime.getTime() - entry.startTime.getTime()) / (1000 * 60 * 60)
    const updated = await prisma.timeEntry.update({
      where: { id: data.entryId },
      data: { endTime, totalHours, notes: data.notes },
    })
    return toAppTimeEntry(updated)
  })

export const createTimeEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    taskId: z.string().optional(),
    taskName: z.string().min(1),
    startTime: z.string(),
    endTime: z.string(),
    notes: z.string().optional(),
  }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    const user = await requireUser()
    const start = new Date(data.startTime)
    const end = new Date(data.endTime)
    if (end <= start) throw new Error('End time must be after start time')
    const totalHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    const entry = await prisma.timeEntry.create({
      data: {
        userId: user.id,
        taskId: data.taskId,
        taskName: data.taskName,
        startTime: start,
        endTime: end,
        totalHours,
        notes: data.notes,
      },
    })
    return toAppTimeEntry(entry)
  })

export const updateTimeEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    id: z.string(),
    taskId: z.string().optional(),
    taskName: z.string().min(1).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    notes: z.string().optional(),
  }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    const user = await requireUser()
    const existing = await prisma.timeEntry.findFirst({ where: { id: data.id } })
    if (!existing) throw new Error('Entry not found')
    if (user.role !== 'ADMIN' && (existing.userId !== user.id || existing.approved)) {
      throw new Error('Cannot edit this entry')
    }
    const start = data.startTime ? new Date(data.startTime) : existing.startTime
    const end = data.endTime ? new Date(data.endTime) : existing.endTime
    const totalHours = end ? (end.getTime() - start.getTime()) / (1000 * 60 * 60) : null
    const updated = await prisma.timeEntry.update({
      where: { id: data.id },
      data: {
        taskId: data.taskId,
        taskName: data.taskName,
        startTime: start,
        endTime: end ?? undefined,
        totalHours: totalHours ?? undefined,
        notes: data.notes,
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
