import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient, User } from '@prisma/client'

// --- Mocks ------------------------------------------------------------------
// Factories run lazily when the mocked module is first imported. They must NOT
// reference any local variables (TDZ at hoist time); inline the mock creation
// instead and access the mock via the regular import below.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
    handler: (fn: unknown) => fn,
  }),
}))
vi.mock('#/lib/prisma', () => ({ prisma: mockDeep<PrismaClient>() }))
vi.mock('@clerk/tanstack-react-start/server', () => {
  // Stable reference so test config + system-under-test share the same mocks.
  const stable = { users: { getUser: vi.fn() } }
  return {
    auth: vi.fn(),
    clerkClient: () => stable,
  }
})
vi.mock('#/server/auth-helpers', () => ({
  requireClerkUserId: vi.fn(),
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
}))

// --- Imports (resolve to the mocked modules) --------------------------------
import { prisma } from '#/lib/prisma'
import { clerkClient } from '@clerk/tanstack-react-start/server'
import { requireAdmin, requireClerkUserId } from '#/server/auth-helpers'
import { deleteUser, syncUser, updateUserName, updateUserRole } from './users'

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
const getUserMock = vi.mocked(clerkClient().users.getUser)
const requireClerkUserIdMock = vi.mocked(requireClerkUserId)
const requireAdminMock = vi.mocked(requireAdmin)

// --- Helpers ----------------------------------------------------------------
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    clerkId: 'clerk_u1',
    name: 'Alice',
    firstName: null,
    lastName: null,
    email: 'alice@example.com',
    role: 'EMPLOYEE',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReset(prismaMock)
  // updateUserRole/deleteUser wrap their checks in $transaction. The mock client
  // doesn't implement transactions, so route the callback to the same mock so
  // findUnique/count/update/delete calls inside the transaction still hit our
  // configured return values.
  prismaMock.$transaction.mockImplementation(async (cb: unknown) => {
    if (typeof cb === 'function') return cb(prismaMock)
    return Promise.all(cb as Promise<unknown>[])
  })
})

// ---------------------------------------------------------------------------

describe('syncUser', () => {
  it('returns existing user unchanged when name/email/role/structured-fields already match', async () => {
    requireClerkUserIdMock.mockResolvedValue('clerk_u1')
    getUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'alice@example.com' }],
      firstName: 'Alice',
      lastName: null,
    } as never)
    const existing = makeUser({ name: 'Alice', email: 'alice@example.com', firstName: 'Alice' })
    prismaMock.user.findUnique.mockResolvedValue(existing)

    const result = await (syncUser as () => Promise<User>)()

    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.user.create).not.toHaveBeenCalled()
    expect(result.id).toBe('u1')
  })

  it('backfills firstName/lastName from Clerk when DB still has nulls', async () => {
    requireClerkUserIdMock.mockResolvedValue('clerk_u1')
    getUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'alice@example.com' }],
      firstName: 'Alice',
      lastName: 'Wonderland',
    } as never)
    // Existing row has matching name + email + role, but no structured fields yet.
    prismaMock.user.findUnique.mockResolvedValue(makeUser({
      name: 'Alice Wonderland',
      firstName: null,
      lastName: null,
    }))
    prismaMock.user.update.mockResolvedValue(makeUser({ firstName: 'Alice', lastName: 'Wonderland' }))

    await (syncUser as () => Promise<User>)()

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firstName: 'Alice', lastName: 'Wonderland' }),
      }),
    )
  })

  it('does NOT clobber admin-edited firstName/lastName on subsequent syncs', async () => {
    requireClerkUserIdMock.mockResolvedValue('clerk_u1')
    getUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'alice@example.com' }],
      firstName: 'Clerk Says Alice',
      lastName: 'Clerk Says Smith',
    } as never)
    // Admin already set firstName/lastName. Clerk's values must not overwrite them.
    prismaMock.user.findUnique.mockResolvedValue(makeUser({
      name: 'Admin Edited',
      firstName: 'Admin Edited First',
      lastName: 'Admin Edited Last',
    }))

    await (syncUser as () => Promise<User>)()

    // Sync may update `name` but the structured fields stay.
    const updateCalls = prismaMock.user.update.mock.calls
    for (const call of updateCalls) {
      const data = call[0]?.data as { firstName?: string | null; lastName?: string | null } | undefined
      if (data?.firstName !== undefined) expect(data.firstName).toBe('Admin Edited First')
      if (data?.lastName !== undefined) expect(data.lastName).toBe('Admin Edited Last')
    }
  })

  it('updates the existing user when name has changed', async () => {
    requireClerkUserIdMock.mockResolvedValue('clerk_u1')
    getUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'alice@example.com' }],
      firstName: 'Alice',
      lastName: 'Smith',
    } as never)
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ name: 'Alice' }))
    prismaMock.user.update.mockResolvedValue(makeUser({ name: 'Alice Smith' }))

    await (syncUser as () => Promise<User>)()

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Alice Smith' }),
      }),
    )
  })

  it('reclaims an email-matched row when clerkId does not match (email collision fallback)', async () => {
    requireClerkUserIdMock.mockResolvedValue('clerk_new')
    getUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'alice@example.com' }],
      firstName: 'Alice',
      lastName: null,
    } as never)
    // No row found by clerkId, but a row with the same email exists under an old clerkId.
    prismaMock.user.findUnique.mockResolvedValueOnce(null)
    prismaMock.user.findUnique.mockResolvedValueOnce(makeUser({ clerkId: 'clerk_old' }))
    prismaMock.user.update.mockResolvedValue(makeUser({ clerkId: 'clerk_new' }))

    await (syncUser as () => Promise<User>)()

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clerkId: 'clerk_new' }),
      }),
    )
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it('creates a fresh user when neither clerkId nor email match', async () => {
    requireClerkUserIdMock.mockResolvedValue('clerk_new')
    getUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'newuser@example.com' }],
      firstName: 'New',
      lastName: 'User',
    } as never)
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue(makeUser({ email: 'newuser@example.com', name: 'New User' }))

    await (syncUser as () => Promise<User>)()

    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: 'clerk_new',
          email: 'newuser@example.com',
          name: 'New User',
          role: 'EMPLOYEE',
        }),
      }),
    )
  })

  it('promotes a listed ADMIN_EMAILS address to ADMIN on every sync', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com'
    requireClerkUserIdMock.mockResolvedValue('clerk_admin')
    getUserMock.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'admin@example.com' }],
      firstName: 'Admin',
      lastName: null,
    } as never)
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ email: 'admin@example.com', role: 'EMPLOYEE' }))
    prismaMock.user.update.mockResolvedValue(makeUser({ email: 'admin@example.com', role: 'ADMIN' }))

    await (syncUser as () => Promise<User>)()

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'ADMIN' }),
      }),
    )
  })
})

describe('updateUserRole', () => {
  it('prevents demoting the last admin', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ role: 'ADMIN' }))
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ id: 'u1', role: 'ADMIN' }))
    prismaMock.user.count.mockResolvedValue(1)

    await expect(
      (updateUserRole as unknown as (i: { data: { userId: string; role: 'ADMIN' | 'EMPLOYEE' } }) => Promise<User>)({
        data: { userId: 'u1', role: 'EMPLOYEE' },
      }),
    ).rejects.toThrow(/last remaining admin/i)

    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('allows demoting an admin when other admins exist', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ role: 'ADMIN' }))
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ id: 'u1', role: 'ADMIN' }))
    prismaMock.user.count.mockResolvedValue(2)
    prismaMock.user.update.mockResolvedValue(makeUser({ id: 'u1', role: 'EMPLOYEE' }))

    await (updateUserRole as unknown as (i: { data: { userId: string; role: 'ADMIN' | 'EMPLOYEE' } }) => Promise<User>)({
      data: { userId: 'u1', role: 'EMPLOYEE' },
    })

    expect(prismaMock.user.update).toHaveBeenCalled()
  })
})

describe('deleteUser', () => {
  it('prevents self-delete', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ id: 'me', role: 'ADMIN' }))

    await expect(
      (deleteUser as unknown as (i: { data: { userId: string } }) => Promise<unknown>)({
        data: { userId: 'me' },
      }),
    ).rejects.toThrow(/cannot delete your own/i)

    expect(prismaMock.user.delete).not.toHaveBeenCalled()
  })

  it('prevents deleting the last admin', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ id: 'me', role: 'ADMIN' }))
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ id: 'other', role: 'ADMIN' }))
    prismaMock.user.count.mockResolvedValue(1)

    await expect(
      (deleteUser as unknown as (i: { data: { userId: string } }) => Promise<unknown>)({
        data: { userId: 'other' },
      }),
    ).rejects.toThrow(/last remaining admin/i)
  })

  it('deletes a non-admin user', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ id: 'me', role: 'ADMIN' }))
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ id: 'emp', role: 'EMPLOYEE' }))
    prismaMock.user.delete.mockResolvedValue(makeUser({ id: 'emp' }))

    const result = await (deleteUser as unknown as (i: { data: { userId: string } }) => Promise<{ success: boolean }>)({
      data: { userId: 'emp' },
    })
    expect(result).toEqual({ success: true })
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'emp' } })
  })
})

describe('updateUserName', () => {
  it('sets firstName + lastName and rebuilds the legacy name field', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ role: 'ADMIN' }))
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ id: 'u1', name: 'Old Name' }))
    prismaMock.user.update.mockResolvedValue(makeUser({ id: 'u1', firstName: 'Pete', lastName: 'Allred', name: 'Pete Allred' }))

    await (updateUserName as unknown as (i: { data: { userId: string; firstName?: string; lastName?: string } }) => Promise<unknown>)({
      data: { userId: 'u1', firstName: 'Pete', lastName: 'Allred' },
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { firstName: 'Pete', lastName: 'Allred', name: 'Pete Allred' },
    })
  })

  it('trims whitespace and stores nulls when fields are blank', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ role: 'ADMIN' }))
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ id: 'u1', name: 'Existing Name' }))
    prismaMock.user.update.mockResolvedValue(makeUser({ id: 'u1' }))

    await (updateUserName as unknown as (i: { data: { userId: string; firstName?: string; lastName?: string } }) => Promise<unknown>)({
      data: { userId: 'u1', firstName: '  ', lastName: '' },
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      // Both blank → null. Legacy name falls back to the existing value.
      data: { firstName: null, lastName: null, name: 'Existing Name' },
    })
  })

  it('preserves the existing legacy name when both structured fields are blank', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ role: 'ADMIN' }))
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ id: 'u1', name: 'pete@example.com' }))
    prismaMock.user.update.mockResolvedValue(makeUser({ id: 'u1' }))

    await (updateUserName as unknown as (i: { data: { userId: string; firstName?: string; lastName?: string } }) => Promise<unknown>)({
      data: { userId: 'u1' },
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { firstName: null, lastName: null, name: 'pete@example.com' },
    })
  })

  it('throws when the target user does not exist', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ role: 'ADMIN' }))
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(
      (updateUserName as unknown as (i: { data: { userId: string; firstName?: string } }) => Promise<unknown>)({
        data: { userId: 'missing', firstName: 'Pete' },
      }),
    ).rejects.toThrow(/user not found/i)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})
