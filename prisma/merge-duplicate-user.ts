// Merge a duplicate User. Reassigns every TimeEntry from the FROM user's row to
// the TO user's row, then deletes the now-empty FROM row.
//
// Usage: npx tsx prisma/merge-duplicate-user.ts <from-email> <to-email>
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [fromEmail, toEmail] = process.argv.slice(2)
  if (!fromEmail || !toEmail) {
    throw new Error('Usage: tsx prisma/merge-duplicate-user.ts <from-email> <to-email>')
  }

  const fromUser = await prisma.user.findUnique({ where: { email: fromEmail } })
  const toUser = await prisma.user.findUnique({ where: { email: toEmail } })

  if (!fromUser) throw new Error(`No user found with email ${fromEmail}`)
  if (!toUser) throw new Error(`No user found with email ${toEmail}`)
  if (fromUser.id === toUser.id) throw new Error('Both emails resolve to the same user — nothing to merge')

  const count = await prisma.timeEntry.count({ where: { userId: fromUser.id } })
  console.log(`Source: ${fromUser.name} <${fromEmail}> — ${count} time entries`)
  console.log(`Target: ${toUser.name} <${toEmail}>`)

  const result = await prisma.timeEntry.updateMany({
    where: { userId: fromUser.id },
    data: { userId: toUser.id },
  })
  console.log(`✔ Reassigned ${result.count} time entries`)

  await prisma.user.delete({ where: { id: fromUser.id } })
  console.log(`✔ Deleted duplicate user <${fromEmail}>`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
