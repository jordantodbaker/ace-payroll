import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'
import { requireAdmin, requireUser } from '#/server/auth-helpers'
import { parseWorkDate } from '#/server/date-range'
import type { AppPayPeriodConfig } from '#/lib/types'

// AppConfig is a singleton — always this one row id.
const SINGLETON_ID = 'singleton'

// Used when no AppConfig row exists yet: the pay period is bi-weekly, with the
// most recent period ending Friday 2026-05-15.
const DEFAULT_ANCHOR = new Date(2026, 4, 15, 12)
const DEFAULT_WEEKS = 2

// Server-side helper (not a server fn). Reads the pay-period config, falling
// back to defaults when the singleton row hasn't been created yet.
export async function loadPayPeriodConfig(): Promise<AppPayPeriodConfig> {
  const existing = await prisma.appConfig.findUnique({ where: { id: SINGLETON_ID } })
  return {
    payPeriodAnchor: existing?.payPeriodAnchor ?? DEFAULT_ANCHOR,
    payPeriodWeeks: existing?.payPeriodWeeks ?? DEFAULT_WEEKS,
  }
}

export const getPayPeriodConfig = createServerFn().handler(async (): Promise<AppPayPeriodConfig> => {
  await requireUser()
  return loadPayPeriodConfig()
})

export const updatePayPeriodConfig = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
    weeks: z.number().int().min(1).max(8),
  }))
  .handler(async ({ data }): Promise<AppPayPeriodConfig> => {
    await requireAdmin()
    const anchor = parseWorkDate(data.anchor)
    const updated = await prisma.appConfig.upsert({
      where: { id: SINGLETON_ID },
      update: { payPeriodAnchor: anchor, payPeriodWeeks: data.weeks },
      create: { id: SINGLETON_ID, payPeriodAnchor: anchor, payPeriodWeeks: data.weeks },
    })
    return { payPeriodAnchor: updated.payPeriodAnchor, payPeriodWeeks: updated.payPeriodWeeks }
  })
