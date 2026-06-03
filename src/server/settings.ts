import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '#/lib/prisma'
import { requireAdmin, requireUser } from '#/server/auth-helpers'
import {
  DEFAULT_PAY_PERIOD_ANCHOR,
  DEFAULT_PAY_PERIOD_WEEKS,
  parseWorkDate,
  payPeriodEndingFor,
} from '#/lib/date-utils'
import type { AppPayPeriodConfig } from '#/lib/types'

// AppConfig is a singleton — always this one row id.
const SINGLETON_ID = 'singleton'

// Server-side helper (not a server fn). Reads the pay-period config, falling
// back to defaults when the singleton row hasn't been created yet.
export async function loadPayPeriodConfig(): Promise<AppPayPeriodConfig> {
  const existing = await prisma.appConfig.findUnique({ where: { id: SINGLETON_ID } })
  return {
    payPeriodAnchor: existing?.payPeriodAnchor ?? DEFAULT_PAY_PERIOD_ANCHOR,
    payPeriodWeeks: existing?.payPeriodWeeks ?? DEFAULT_PAY_PERIOD_WEEKS,
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
  .handler(async ({ data }): Promise<{ payPeriodAnchor: Date; payPeriodWeeks: number; recomputed: number }> => {
    await requireAdmin()
    const anchor = parseWorkDate(data.anchor)
    const updated = await prisma.appConfig.upsert({
      where: { id: SINGLETON_ID },
      update: { payPeriodAnchor: anchor, payPeriodWeeks: data.weeks },
      create: { id: SINGLETON_ID, payPeriodAnchor: anchor, payPeriodWeeks: data.weeks },
    })
    // The new anchor/weeks make every entry's stored payPeriodEnding stale.
    // Recompute over all entries with a workDate so the data stays consistent
    // with the saved schedule.
    const recomputed = await recomputePayPeriodEndings(updated.payPeriodAnchor, updated.payPeriodWeeks)
    return {
      payPeriodAnchor: updated.payPeriodAnchor,
      payPeriodWeeks: updated.payPeriodWeeks,
      recomputed,
    }
  })

// Walks every time entry with a workDate and recomputes its payPeriodEnding
// from the given anchor + weeks. Returns the number of rows updated. Issues
// every update over a single $transaction so we get one DB session round-trip
// instead of one per row.
async function recomputePayPeriodEndings(anchor: Date, weeks: number): Promise<number> {
  const entries = await prisma.timeEntry.findMany({
    where: { workDate: { not: null } },
    select: { id: true, workDate: true },
  })
  if (entries.length === 0) return 0
  await prisma.$transaction(
    entries.map((e) =>
      prisma.timeEntry.update({
        where: { id: e.id },
        data: { payPeriodEnding: payPeriodEndingFor(e.workDate!, anchor, weeks) },
      }),
    ),
  )
  return entries.length
}
