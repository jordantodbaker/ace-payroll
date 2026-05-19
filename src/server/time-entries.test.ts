import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'
import { Prisma, type PrismaClient, type TimeEntry, type User } from '@prisma/client'

// --- Mocks ------------------------------------------------------------------
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({ handler: (fn: unknown) => fn }),
    handler: (fn: unknown) => fn,
  }),
}))
vi.mock('#/lib/prisma', () => ({ prisma: mockDeep<PrismaClient>() }))
vi.mock('#/server/auth-helpers', () => ({
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
}))

// --- Imports under test -----------------------------------------------------
import { prisma } from '#/lib/prisma'
import { requireAdmin, requireUser } from '#/server/auth-helpers'
import {
  approveAllTimeEntries,
  createTimeEntry,
  deleteTimeEntry,
  updateTimeEntry,
} from './time-entries'

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
const requireUserMock = vi.mocked(requireUser)
const requireAdminMock = vi.mocked(requireAdmin)

// --- Helpers ----------------------------------------------------------------
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    clerkId: 'clerk_u1',
    name: 'Alice',
    email: 'alice@example.com',
    role: 'EMPLOYEE',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e1',
    userId: 'u1',
    taskId: null,
    taskName: 'ACE_Administration',
    weekEnding: null,
    workDate: new Date(2026, 4, 4, 12),
    totalHours: new Prisma.Decimal(4),
    workDescription: null,
    approved: false,
    flagged: false,
    createdAt: new Date('2026-05-04'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReset(prismaMock)
})

// ---------------------------------------------------------------------------

describe('createTimeEntry', () => {
  it('derives weekEnding as the Sunday on or after workDate', async () => {
    requireUserMock.mockResolvedValue(makeUser())
    prismaMock.timeEntry.create.mockResolvedValue(makeEntry())

    await (createTimeEntry as unknown as (i: { data: { taskName: string; hours: number; workDate: string } }) => Promise<unknown>)({
      data: { taskName: 'Test', hours: 4, workDate: '2026-05-04' },
    })

    const callArg = prismaMock.timeEntry.create.mock.calls[0][0]
    const weekEnding = (callArg.data as { weekEnding: Date }).weekEnding
    expect(weekEnding.getDay()).toBe(0)
    expect(weekEnding.getDate()).toBe(10)
    expect(weekEnding.getMonth()).toBe(4)
  })

  it('sets totalHours from the hours input', async () => {
    requireUserMock.mockResolvedValue(makeUser())
    prismaMock.timeEntry.create.mockResolvedValue(makeEntry())

    await (createTimeEntry as unknown as (i: { data: { taskName: string; hours: number; workDate: string } }) => Promise<unknown>)({
      data: { taskName: 'Test', hours: 7.5, workDate: '2026-05-04' },
    })

    expect(prismaMock.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalHours: 7.5 }),
      }),
    )
  })
})

describe('updateTimeEntry', () => {
  it('rejects when an employee tries to edit an approved entry they own', async () => {
    requireUserMock.mockResolvedValue(makeUser({ id: 'u1', role: 'EMPLOYEE' }))
    prismaMock.timeEntry.findFirst.mockResolvedValue(makeEntry({ userId: 'u1', approved: true }))

    await expect(
      (updateTimeEntry as unknown as (i: { data: { id: string; hours?: number } }) => Promise<unknown>)({
        data: { id: 'e1', hours: 5 },
      }),
    ).rejects.toThrow(/cannot edit/i)
  })

  it("rejects when an employee tries to edit another employee's entry", async () => {
    requireUserMock.mockResolvedValue(makeUser({ id: 'me', role: 'EMPLOYEE' }))
    prismaMock.timeEntry.findFirst.mockResolvedValue(makeEntry({ userId: 'other', approved: false }))

    await expect(
      (updateTimeEntry as unknown as (i: { data: { id: string } }) => Promise<unknown>)({
        data: { id: 'e1' },
      }),
    ).rejects.toThrow(/cannot edit/i)
  })

  it('allows an admin to edit an approved entry', async () => {
    requireUserMock.mockResolvedValue(makeUser({ id: 'admin', role: 'ADMIN' }))
    prismaMock.timeEntry.findFirst.mockResolvedValue(makeEntry({ userId: 'someone-else', approved: true }))
    prismaMock.timeEntry.update.mockResolvedValue(makeEntry())

    await (updateTimeEntry as unknown as (i: { data: { id: string; hours?: number } }) => Promise<unknown>)({
      data: { id: 'e1', hours: 6 },
    })

    expect(prismaMock.timeEntry.update).toHaveBeenCalled()
  })

  it('recomputes weekEnding when workDate changes', async () => {
    requireUserMock.mockResolvedValue(makeUser({ id: 'u1', role: 'EMPLOYEE' }))
    prismaMock.timeEntry.findFirst.mockResolvedValue(makeEntry({ userId: 'u1', approved: false }))
    prismaMock.timeEntry.update.mockResolvedValue(makeEntry())

    await (updateTimeEntry as unknown as (i: { data: { id: string; workDate?: string } }) => Promise<unknown>)({
      data: { id: 'e1', workDate: '2026-05-06' },
    })

    const callArg = prismaMock.timeEntry.update.mock.calls[0][0]
    const weekEnding = (callArg.data as { weekEnding: Date }).weekEnding
    expect(weekEnding.getDay()).toBe(0)
    expect(weekEnding.getDate()).toBe(10)
  })

  it('leaves weekEnding undefined when workDate is not provided', async () => {
    requireUserMock.mockResolvedValue(makeUser({ id: 'u1', role: 'EMPLOYEE' }))
    prismaMock.timeEntry.findFirst.mockResolvedValue(makeEntry({ userId: 'u1', approved: false }))
    prismaMock.timeEntry.update.mockResolvedValue(makeEntry())

    await (updateTimeEntry as unknown as (i: { data: { id: string; hours?: number } }) => Promise<unknown>)({
      data: { id: 'e1', hours: 9 },
    })

    const callArg = prismaMock.timeEntry.update.mock.calls[0][0]
    expect((callArg.data as { weekEnding: Date | undefined }).weekEnding).toBeUndefined()
  })
})

describe('deleteTimeEntry', () => {
  it('rejects when an employee tries to delete an approved entry they own', async () => {
    requireUserMock.mockResolvedValue(makeUser({ id: 'u1', role: 'EMPLOYEE' }))
    prismaMock.timeEntry.findFirst.mockResolvedValue(makeEntry({ userId: 'u1', approved: true }))

    await expect(
      (deleteTimeEntry as unknown as (i: { data: { id: string } }) => Promise<unknown>)({
        data: { id: 'e1' },
      }),
    ).rejects.toThrow(/cannot delete/i)
  })

  it("rejects when an employee tries to delete someone else's entry", async () => {
    requireUserMock.mockResolvedValue(makeUser({ id: 'me', role: 'EMPLOYEE' }))
    prismaMock.timeEntry.findFirst.mockResolvedValue(makeEntry({ userId: 'other', approved: false }))

    await expect(
      (deleteTimeEntry as unknown as (i: { data: { id: string } }) => Promise<unknown>)({
        data: { id: 'e1' },
      }),
    ).rejects.toThrow(/cannot delete/i)
  })

  it('allows an admin to delete any entry', async () => {
    requireUserMock.mockResolvedValue(makeUser({ id: 'admin', role: 'ADMIN' }))
    prismaMock.timeEntry.findFirst.mockResolvedValue(makeEntry({ userId: 'someone', approved: true }))

    const result = await (deleteTimeEntry as unknown as (i: { data: { id: string } }) => Promise<{ success: boolean }>)({
      data: { id: 'e1' },
    })

    expect(result).toEqual({ success: true })
    expect(prismaMock.timeEntry.delete).toHaveBeenCalledWith({ where: { id: 'e1' } })
  })

  it('allows an employee to delete their own pending entry', async () => {
    requireUserMock.mockResolvedValue(makeUser({ id: 'u1', role: 'EMPLOYEE' }))
    prismaMock.timeEntry.findFirst.mockResolvedValue(makeEntry({ userId: 'u1', approved: false }))

    const result = await (deleteTimeEntry as unknown as (i: { data: { id: string } }) => Promise<{ success: boolean }>)({
      data: { id: 'e1' },
    })

    expect(result).toEqual({ success: true })
  })
})

describe('approveAllTimeEntries', () => {
  it('only flips pending entries — scopes updateMany to the ids AND approved:false', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ role: 'ADMIN' }))
    prismaMock.timeEntry.updateMany.mockResolvedValue({ count: 2 })

    await (approveAllTimeEntries as unknown as (i: { data: { ids: string[] } }) => Promise<unknown>)({
      data: { ids: ['e1', 'e2', 'e3'] },
    })

    expect(prismaMock.timeEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['e1', 'e2', 'e3'] }, approved: false },
      data: { approved: true },
    })
  })

  it('returns the count of rows actually updated', async () => {
    requireAdminMock.mockResolvedValue(makeUser({ role: 'ADMIN' }))
    // Three ids passed, but only 2 were pending — updateMany reports 2.
    prismaMock.timeEntry.updateMany.mockResolvedValue({ count: 2 })

    const result = await (approveAllTimeEntries as unknown as (i: { data: { ids: string[] } }) => Promise<{ count: number }>)({
      data: { ids: ['e1', 'e2', 'e3'] },
    })

    expect(result).toEqual({ count: 2 })
  })

  it('requires admin', async () => {
    requireAdminMock.mockRejectedValue(new Error('Forbidden: admin only'))

    await expect(
      (approveAllTimeEntries as unknown as (i: { data: { ids: string[] } }) => Promise<unknown>)({
        data: { ids: ['e1'] },
      }),
    ).rejects.toThrow(/admin only/i)

    expect(prismaMock.timeEntry.updateMany).not.toHaveBeenCalled()
  })
})
