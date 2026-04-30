import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'
import type { AppTimeEntry, AppTimeEntryWithUser, AppTimeEntryWithTask } from '#/lib/types'

function toEntry(e: {
  id: string; userId: string; taskId: string | null; taskName: string
  startTime: Date; endTime: Date | null; totalHours: { toNumber(): number } | number | null
  notes: string | null; approved: boolean; flagged: boolean; createdAt: Date
}): AppTimeEntry {
  return { ...e, totalHours: e.totalHours != null ? (typeof e.totalHours === 'number' ? e.totalHours : e.totalHours.toNumber()) : null }
}

async function requireAuth() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  if (!user) throw new Error('User not found — please reload the dashboard')
  return user
}

async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== 'ADMIN') throw new Error('Forbidden: admin only')
  return user
}

export const getMyTimeEntries = createServerFn().handler(async (): Promise<AppTimeEntryWithTask[]> => {
  const user = await requireAuth()
  const entries = await prisma.timeEntry.findMany({
    where: { userId: user.id },
    orderBy: { startTime: 'desc' },
    include: { task: { select: { name: true } } },
  })
  return entries.map((e) => ({ ...toEntry(e), task: e.task }))
})

export const getAllTimeEntries = createServerFn().handler(async (): Promise<AppTimeEntryWithUser[]> => {
  await requireAdmin()
  const entries = await prisma.timeEntry.findMany({
    orderBy: { startTime: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
      task: { select: { name: true } },
    },
  })
  return entries.map((e) => ({ ...toEntry(e), user: e.user, task: e.task }))
})

export const getActiveEntry = createServerFn().handler(async (): Promise<AppTimeEntry | null> => {
  const user = await requireAuth()
  const entry = await prisma.timeEntry.findFirst({
    where: { userId: user.id, endTime: null },
    orderBy: { startTime: 'desc' },
  })
  return entry ? toEntry(entry) : null
})

export const clockIn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ taskId: z.string().optional(), taskName: z.string().min(1) }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    const user = await requireAuth()
    await prisma.timeEntry.updateMany({
      where: { userId: user.id, endTime: null },
      data: { endTime: new Date(), totalHours: 0 },
    })
    const entry = await prisma.timeEntry.create({
      data: { userId: user.id, taskId: data.taskId, taskName: data.taskName, startTime: new Date() },
    })
    return toEntry(entry)
  })

export const clockOut = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ entryId: z.string(), notes: z.string().optional() }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    const user = await requireAuth()
    const entry = await prisma.timeEntry.findFirst({ where: { id: data.entryId, userId: user.id } })
    if (!entry || entry.endTime) throw new Error('No active entry found')
    const endTime = new Date()
    const totalHours = (endTime.getTime() - entry.startTime.getTime()) / (1000 * 60 * 60)
    const updated = await prisma.timeEntry.update({
      where: { id: data.entryId },
      data: { endTime, totalHours, notes: data.notes },
    })
    return toEntry(updated)
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
    const user = await requireAuth()
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
    return toEntry(entry)
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
    const user = await requireAuth()
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
    return toEntry(updated)
  })

export const deleteTimeEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const user = await requireAuth()
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
    return toEntry(entry)
  })

export const flagTimeEntry = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), flagged: z.boolean() }))
  .handler(async ({ data }): Promise<AppTimeEntry> => {
    await requireAdmin()
    const entry = await prisma.timeEntry.update({ where: { id: data.id }, data: { flagged: data.flagged } })
    return toEntry(entry)
  })
