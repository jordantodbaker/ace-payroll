import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

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

// --- Imports (resolve to the mocked modules) --------------------------------
import { prisma } from '#/lib/prisma'
import { requireAdmin, requireUser } from '#/server/auth-helpers'
import { getPayPeriodConfig, updatePayPeriodConfig } from './settings'

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>
const requireUserMock = vi.mocked(requireUser)
const requireAdminMock = vi.mocked(requireAdmin)

beforeEach(() => {
  vi.clearAllMocks()
  mockReset(prismaMock)
  // updatePayPeriodConfig's recompute pass uses prisma.$transaction([...promises]).
  // Mock both the callback form (in case it's used elsewhere) and the array
  // form, so the underlying timeEntry.update calls actually execute.
  prismaMock.$transaction.mockImplementation(async (cb: unknown) => {
    if (typeof cb === 'function') return cb(prismaMock)
    return Promise.all(cb as Promise<unknown>[])
  })
})

// ---------------------------------------------------------------------------

describe('getPayPeriodConfig', () => {
  it('requires a signed-in user', async () => {
    requireUserMock.mockRejectedValue(new Error('Unauthorized'))

    await expect(
      (getPayPeriodConfig as () => Promise<unknown>)(),
    ).rejects.toThrow(/unauthorized/i)

    expect(prismaMock.appConfig.findUnique).not.toHaveBeenCalled()
  })

  it('returns the DB row when the singleton exists', async () => {
    requireUserMock.mockResolvedValue({} as never)
    const customAnchor = new Date(2026, 5, 12, 12) // 2026-06-12
    prismaMock.appConfig.findUnique.mockResolvedValue({
      id: 'singleton',
      payPeriodAnchor: customAnchor,
      payPeriodWeeks: 3,
      updatedAt: new Date(),
    } as never)

    const result = await (getPayPeriodConfig as () => Promise<{ payPeriodAnchor: Date; payPeriodWeeks: number }>)()

    expect(result.payPeriodAnchor).toEqual(customAnchor)
    expect(result.payPeriodWeeks).toBe(3)
  })

  it('falls back to defaults (2026-05-15, 2 weeks) when no row exists', async () => {
    requireUserMock.mockResolvedValue({} as never)
    prismaMock.appConfig.findUnique.mockResolvedValue(null)

    const result = await (getPayPeriodConfig as () => Promise<{ payPeriodAnchor: Date; payPeriodWeeks: number }>)()

    expect(result.payPeriodWeeks).toBe(2)
    expect(result.payPeriodAnchor.getFullYear()).toBe(2026)
    expect(result.payPeriodAnchor.getMonth()).toBe(4) // May (0-indexed)
    expect(result.payPeriodAnchor.getDate()).toBe(15)
  })
})

describe('updatePayPeriodConfig', () => {
  it('requires admin', async () => {
    requireAdminMock.mockRejectedValue(new Error('Forbidden: admin only'))

    await expect(
      (updatePayPeriodConfig as unknown as (i: { data: { anchor: string; weeks: number } }) => Promise<unknown>)({
        data: { anchor: '2026-05-22', weeks: 2 },
      }),
    ).rejects.toThrow(/admin only/i)

    expect(prismaMock.appConfig.upsert).not.toHaveBeenCalled()
    expect(prismaMock.timeEntry.findMany).not.toHaveBeenCalled()
  })

  it('parses the anchor to noon-local and upserts the singleton', async () => {
    requireAdminMock.mockResolvedValue({} as never)
    const newAnchor = new Date(2026, 4, 22, 12) // 2026-05-22, noon local
    prismaMock.appConfig.upsert.mockResolvedValue({
      id: 'singleton',
      payPeriodAnchor: newAnchor,
      payPeriodWeeks: 2,
      updatedAt: new Date(),
    } as never)
    prismaMock.timeEntry.findMany.mockResolvedValue([])

    await (updatePayPeriodConfig as unknown as (i: { data: { anchor: string; weeks: number } }) => Promise<unknown>)({
      data: { anchor: '2026-05-22', weeks: 2 },
    })

    expect(prismaMock.appConfig.upsert).toHaveBeenCalledTimes(1)
    const upsertCall = prismaMock.appConfig.upsert.mock.calls[0][0] as {
      where: { id: string }
      update: { payPeriodAnchor: Date; payPeriodWeeks: number }
      create: { id: string; payPeriodAnchor: Date; payPeriodWeeks: number }
    }
    expect(upsertCall.where).toEqual({ id: 'singleton' })
    expect(upsertCall.update.payPeriodAnchor.getFullYear()).toBe(2026)
    expect(upsertCall.update.payPeriodAnchor.getMonth()).toBe(4)
    expect(upsertCall.update.payPeriodAnchor.getDate()).toBe(22)
    expect(upsertCall.update.payPeriodAnchor.getHours()).toBe(12) // noon-local anchor
    expect(upsertCall.update.payPeriodWeeks).toBe(2)
  })

  it('recomputes payPeriodEnding on every entry using the NEW anchor (not the cached one)', async () => {
    requireAdminMock.mockResolvedValue({} as never)
    // Admin saves a new anchor of 2026-05-22 (Friday). Bi-weekly periods become
    // …, 2026-05-22, 2026-06-05, ….
    const newAnchor = new Date(2026, 4, 22, 12)
    prismaMock.appConfig.upsert.mockResolvedValue({
      id: 'singleton',
      payPeriodAnchor: newAnchor,
      payPeriodWeeks: 2,
      updatedAt: new Date(),
    } as never)
    prismaMock.timeEntry.findMany.mockResolvedValue([
      { id: 'e1', workDate: new Date(2026, 4, 22, 12) }, // on the anchor → 2026-05-22
      { id: 'e2', workDate: new Date(2026, 4, 23, 12) }, // day after → next period 2026-06-05
    ] as never)
    prismaMock.timeEntry.update.mockResolvedValue({} as never)

    await (updatePayPeriodConfig as unknown as (i: { data: { anchor: string; weeks: number } }) => Promise<unknown>)({
      data: { anchor: '2026-05-22', weeks: 2 },
    })

    expect(prismaMock.timeEntry.update).toHaveBeenCalledTimes(2)

    type UpdateCallArg = { where: { id: string }; data: { payPeriodEnding: Date } }
    const calls = prismaMock.timeEntry.update.mock.calls.map((c) => c[0] as UpdateCallArg)

    const e1 = calls.find((c) => c.where.id === 'e1')!
    expect(e1.data.payPeriodEnding.getMonth()).toBe(4) // May
    expect(e1.data.payPeriodEnding.getDate()).toBe(22)

    const e2 = calls.find((c) => c.where.id === 'e2')!
    expect(e2.data.payPeriodEnding.getMonth()).toBe(5) // June
    expect(e2.data.payPeriodEnding.getDate()).toBe(5)
  })

  it('returns the recomputed count alongside the saved config', async () => {
    requireAdminMock.mockResolvedValue({} as never)
    const newAnchor = new Date(2026, 4, 22, 12)
    prismaMock.appConfig.upsert.mockResolvedValue({
      id: 'singleton',
      payPeriodAnchor: newAnchor,
      payPeriodWeeks: 3,
      updatedAt: new Date(),
    } as never)
    prismaMock.timeEntry.findMany.mockResolvedValue([
      { id: 'e1', workDate: new Date(2026, 4, 22, 12) },
      { id: 'e2', workDate: new Date(2026, 4, 23, 12) },
      { id: 'e3', workDate: new Date(2026, 4, 30, 12) },
    ] as never)
    prismaMock.timeEntry.update.mockResolvedValue({} as never)

    const result = await (updatePayPeriodConfig as unknown as (i: { data: { anchor: string; weeks: number } }) => Promise<{ payPeriodAnchor: Date; payPeriodWeeks: number; recomputed: number }>)({
      data: { anchor: '2026-05-22', weeks: 3 },
    })

    expect(result).toEqual({
      payPeriodAnchor: newAnchor,
      payPeriodWeeks: 3,
      recomputed: 3,
    })
  })

  it('skips the transaction entirely when there are no entries to recompute', async () => {
    requireAdminMock.mockResolvedValue({} as never)
    prismaMock.appConfig.upsert.mockResolvedValue({
      id: 'singleton',
      payPeriodAnchor: new Date(2026, 4, 22, 12),
      payPeriodWeeks: 2,
      updatedAt: new Date(),
    } as never)
    prismaMock.timeEntry.findMany.mockResolvedValue([])

    const result = await (updatePayPeriodConfig as unknown as (i: { data: { anchor: string; weeks: number } }) => Promise<{ recomputed: number }>)({
      data: { anchor: '2026-05-22', weeks: 2 },
    })

    expect(result.recomputed).toBe(0)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.timeEntry.update).not.toHaveBeenCalled()
  })
})
