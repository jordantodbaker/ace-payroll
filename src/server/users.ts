import { createServerFn } from '@tanstack/react-start'
import { auth, clerkClient } from '@clerk/tanstack-react-start/server'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'
import type { AppUser } from '#/lib/types'

function toAppUser(u: { id: string; clerkId: string; name: string; email: string; role: 'ADMIN' | 'EMPLOYEE'; hourlyRate: { toNumber(): number } | number; createdAt: Date }): AppUser {
  return { ...u, hourlyRate: typeof u.hourlyRate === 'number' ? u.hourlyRate : u.hourlyRate.toNumber() }
}

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

export const syncUser = createServerFn({ method: 'POST' }).handler(async (): Promise<AppUser> => {
  const clerkId = await requireAuth()
  const clerk = clerkClient()
  const clerkUser = await clerk.users.getUser(clerkId)
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email

  const existing = await prisma.user.findUnique({ where: { clerkId } })
  if (existing) {
    const updated = await prisma.user.update({ where: { clerkId }, data: { name, email } })
    return toAppUser(updated)
  }

  const count = await prisma.user.count()
  const created = await prisma.user.create({
    data: { clerkId, name, email, role: count === 0 ? 'ADMIN' : 'EMPLOYEE' },
  })
  return toAppUser(created)
})

export const getMe = createServerFn().handler(async (): Promise<AppUser | null> => {
  const { userId } = await auth()
  if (!userId) return null
  const user = await prisma.user.findUnique({ where: { clerkId: userId } })
  return user ? toAppUser(user) : null
})

export const getAllUsers = createServerFn().handler(async (): Promise<AppUser[]> => {
  await requireAdmin()
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } })
  return users.map(toAppUser)
})

export const updateHourlyRate = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ userId: z.string(), hourlyRate: z.number().min(0) }))
  .handler(async ({ data }): Promise<AppUser> => {
    await requireAdmin()
    const user = await prisma.user.update({
      where: { id: data.userId },
      data: { hourlyRate: data.hourlyRate },
    })
    return toAppUser(user)
  })

export const updateUserRole = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ userId: z.string(), role: z.enum(['ADMIN', 'EMPLOYEE']) }))
  .handler(async ({ data }): Promise<AppUser> => {
    await requireAdmin()
    const user = await prisma.user.update({ where: { id: data.userId }, data: { role: data.role } })
    return toAppUser(user)
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin()
    await prisma.user.delete({ where: { id: data.userId } })
    return { success: true }
  })
