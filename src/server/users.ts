import { createServerFn } from '@tanstack/react-start'
import { clerkClient } from '@clerk/tanstack-react-start/server'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'
import { requireAdmin, requireClerkUserId, requireUser } from '#/server/auth-helpers'
import { toAppUser } from '#/server/serialize'
import type { AppUser } from '#/lib/types'

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

export const syncUser = createServerFn({ method: 'POST' }).handler(async (): Promise<AppUser> => {
  const clerkId = await requireClerkUserId()
  const clerk = clerkClient()
  const clerkUser = await clerk.users.getUser(clerkId)
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email

  const existing = await prisma.user.findUnique({ where: { clerkId } })
  if (existing) {
    if (existing.name === name && existing.email === email) {
      return toAppUser(existing)
    }
    const updated = await prisma.user.update({ where: { clerkId }, data: { name, email } })
    return toAppUser(updated)
  }

  const adminEmails = getAdminEmails()
  const role = adminEmails.includes(email.toLowerCase()) ? 'ADMIN' : 'EMPLOYEE'
  const created = await prisma.user.create({
    data: { clerkId, name, email, role },
  })
  return toAppUser(created)
})

export const getMe = createServerFn().handler(async (): Promise<AppUser | null> => {
  try {
    const user = await requireUser()
    return toAppUser(user)
  } catch {
    return null
  }
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

    if (data.role === 'EMPLOYEE') {
      const target = await prisma.user.findUnique({ where: { id: data.userId } })
      if (target?.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
        if (adminCount <= 1) throw new Error('Cannot demote the last remaining admin')
      }
    }

    const user = await prisma.user.update({ where: { id: data.userId }, data: { role: data.role } })
    return toAppUser(user)
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const me = await requireAdmin()
    if (me.id === data.userId) throw new Error('You cannot delete your own account')

    const target = await prisma.user.findUnique({ where: { id: data.userId } })
    if (target?.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
      if (adminCount <= 1) throw new Error('Cannot delete the last remaining admin')
    }

    await prisma.user.delete({ where: { id: data.userId } })
    return { success: true }
  })
