import { createServerFn } from '@tanstack/react-start'
import { clerkClient } from '@clerk/tanstack-react-start/server'
import { Prisma } from '@prisma/client'
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
  const clerkFirst = clerkUser.firstName ?? null
  const clerkLast = clerkUser.lastName ?? null
  const name = [clerkFirst, clerkLast].filter(Boolean).join(' ') || email

  // ADMIN_EMAILS is authoritative: any email listed there is ADMIN on every
  // sync, regardless of what the DB currently says. This prevents accidental
  // demotions and guarantees admin access after DB resets / fresh deploys.
  // For emails NOT in the list, the DB role is preserved.
  const adminEmails = getAdminEmails()
  const isListedAdmin = adminEmails.includes(email.toLowerCase())

  // firstName/lastName: only backfill when DB still has nulls. Once an admin
  // sets them via the Settings UI, we never overwrite with Clerk's values.
  function structuredBackfill(current: { firstName: string | null; lastName: string | null }) {
    return {
      firstName: current.firstName ?? clerkFirst,
      lastName: current.lastName ?? clerkLast,
    }
  }

  const existing = await prisma.user.findUnique({ where: { clerkId } })
  if (existing) {
    const targetRole = isListedAdmin ? 'ADMIN' : existing.role
    const backfill = structuredBackfill(existing)
    if (
      existing.name === name &&
      existing.email === email &&
      existing.role === targetRole &&
      existing.firstName === backfill.firstName &&
      existing.lastName === backfill.lastName
    ) {
      return toAppUser(existing)
    }
    const updated = await prisma.user.update({
      where: { clerkId },
      data: { name, email, role: targetRole, ...backfill },
    })
    return toAppUser(updated)
  }

  // Email is unique in our schema, so if a row with this email already exists
  // under a different clerkId (e.g. a stale Clerk session from earlier dev),
  // reclaim it by updating its clerkId rather than failing the email constraint.
  const byEmail = await prisma.user.findUnique({ where: { email } })
  if (byEmail) {
    const targetRole = isListedAdmin ? 'ADMIN' : byEmail.role
    const backfill = structuredBackfill(byEmail)
    const updated = await prisma.user.update({
      where: { id: byEmail.id },
      data: { clerkId, name, role: targetRole, ...backfill },
    })
    return toAppUser(updated)
  }

  const role = isListedAdmin ? 'ADMIN' : 'EMPLOYEE'
  const created = await prisma.user.create({
    data: { clerkId, name, email, role, firstName: clerkFirst, lastName: clerkLast },
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
  // Sort by lastName then firstName so the displayed "Last, First" list reads
  // alphabetically. Users without a lastName fall back to `name`.
  const users = await prisma.user.findMany({
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { name: 'asc' }],
  })
  return users.map(toAppUser)
})

export const updateUserName = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    userId: z.string(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
  }))
  .handler(async ({ data }): Promise<AppUser> => {
    await requireAdmin()
    const firstName = data.firstName?.trim() || null
    const lastName = data.lastName?.trim() || null
    // Keep the legacy `name` field in sync with the structured fields so any
    // callsite that still reads `name` (e.g. Clerk-bound Sidebar) shows the
    // admin-edited value too. Falls back to the existing name when both are
    // cleared.
    const existing = await prisma.user.findUnique({ where: { id: data.userId } })
    if (!existing) throw new Error('User not found')
    const combined = [firstName, lastName].filter(Boolean).join(' ')
    const updated = await prisma.user.update({
      where: { id: data.userId },
      data: {
        firstName,
        lastName,
        name: combined || existing.name,
      },
    })
    return toAppUser(updated)
  })

export const updateUserRole = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ userId: z.string(), role: z.enum(['ADMIN', 'EMPLOYEE']) }))
  .handler(async ({ data }): Promise<AppUser> => {
    await requireAdmin()

    // Serializable so the "last admin" check and the role change happen atomically;
    // otherwise two concurrent demotes could each read adminCount=2 and both succeed,
    // leaving zero admins. Under contention this can throw P2034 — the caller retries.
    const user = await prisma.$transaction(async (tx) => {
      if (data.role === 'EMPLOYEE') {
        const target = await tx.user.findUnique({ where: { id: data.userId } })
        if (target?.role === 'ADMIN') {
          const adminCount = await tx.user.count({ where: { role: 'ADMIN' } })
          if (adminCount <= 1) throw new Error('Cannot demote the last remaining admin')
        }
      }
      return tx.user.update({ where: { id: data.userId }, data: { role: data.role } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return toAppUser(user)
  })

export const deleteUser = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ userId: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const me = await requireAdmin()
    if (me.id === data.userId) throw new Error('You cannot delete your own account')

    // Same atomicity story as updateUserRole — see comment there.
    await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: data.userId } })
      if (target?.role === 'ADMIN') {
        const adminCount = await tx.user.count({ where: { role: 'ADMIN' } })
        if (adminCount <= 1) throw new Error('Cannot delete the last remaining admin')
      }
      await tx.user.delete({ where: { id: data.userId } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { success: true }
  })
