import { auth } from '@clerk/tanstack-react-start/server'
import { prisma } from '#/lib/prisma'
import type { User } from '@prisma/client'

export async function requireClerkUserId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  return userId
}

export async function requireUser(): Promise<User> {
  const clerkId = await requireClerkUserId()
  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) throw new Error('User not found — please reload the dashboard')
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') throw new Error('Forbidden: admin only')
  return user
}
