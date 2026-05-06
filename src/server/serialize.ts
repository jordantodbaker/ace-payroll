import type { Prisma, User, TimeEntry } from '@prisma/client'
import type { AppUser, AppTimeEntry } from '#/lib/types'

export function decimalToNumber(d: Prisma.Decimal): number
export function decimalToNumber(d: Prisma.Decimal | null): number | null
export function decimalToNumber(d: Prisma.Decimal | null): number | null {
  return d == null ? null : d.toNumber()
}

export function toAppUser(u: User): AppUser {
  return u
}

export function toAppTimeEntry(e: TimeEntry): AppTimeEntry {
  return { ...e, totalHours: decimalToNumber(e.totalHours) }
}
