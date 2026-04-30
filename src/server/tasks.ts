import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'
import type { AppTask } from '#/lib/types'

async function requireAuth() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  return userId
}

async function requireAdmin() {
  const clerkId = await requireAuth()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user || user.role !== 'ADMIN') throw new Error('Forbidden: admin only')
  return user
}

export const getTasks = createServerFn().handler(async (): Promise<AppTask[]> => {
  await requireAuth()
  return prisma.task.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
})

export const getAllTasks = createServerFn().handler(async (): Promise<AppTask[]> => {
  await requireAdmin()
  return prisma.task.findMany({ orderBy: { name: 'asc' } })
})

export const createTask = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ name: z.string().min(1), description: z.string().optional(), poNumber: z.string().optional() }))
  .handler(async ({ data }): Promise<AppTask> => {
    await requireAdmin()
    return prisma.task.create({ data: { name: data.name, description: data.description, poNumber: data.poNumber } })
  })

export const updateTask = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    id: z.string(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    poNumber: z.string().optional(),
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
