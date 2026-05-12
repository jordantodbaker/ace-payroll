import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'
import { requireAdmin, requireClerkUserId } from '#/server/auth-helpers'
import type { AppTask } from '#/lib/types'

export const getTasks = createServerFn().handler(async (): Promise<AppTask[]> => {
  await requireClerkUserId()
  return prisma.task.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
})

export const getAllTasks = createServerFn().handler(async (): Promise<AppTask[]> => {
  await requireAdmin()
  return prisma.task.findMany({ orderBy: { name: 'asc' } })
})

const TaskFieldsSchema = z.object({
  clientJobNum: z.string().optional(),
  description: z.string().optional(),
  poNumber: z.string().optional(),
  client: z.string().optional(),
  approver: z.string().optional(),
  type: z.string().optional(),
  timesheetSubmit: z.string().optional(),
})

export const createTask = createServerFn({ method: 'POST' })
  .inputValidator(TaskFieldsSchema.extend({
    name: z.string().min(1),
    poLine: z.string().min(1),
  }))
  .handler(async ({ data }): Promise<AppTask> => {
    await requireAdmin()
    return prisma.task.create({ data })
  })

export const updateTask = createServerFn({ method: 'POST' })
  .inputValidator(TaskFieldsSchema.extend({
    id: z.string(),
    name: z.string().min(1).optional(),
    poLine: z.string().min(1).optional(),
    active: z.boolean().optional(),
  }))
  .handler(async ({ data }): Promise<AppTask> => {
    await requireAdmin()
    const { id, ...rest } = data
    return prisma.task.update({ where: { id }, data: rest })
  })

export const deleteTask = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin()
    await prisma.task.update({ where: { id: data.id }, data: { active: false } })
    return { success: true }
  })
