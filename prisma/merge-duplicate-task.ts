// Merge a duplicate Task. Reassigns every TimeEntry from the FROM task's row
// to the TO task's row (also syncs taskName), then deletes the now-empty FROM
// row.
//
// Usage: npx tsx prisma/merge-duplicate-task.ts <from-poLine> <to-poLine>
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const [fromPoLine, toPoLine] = process.argv.slice(2)
  if (!fromPoLine || !toPoLine) {
    throw new Error('Usage: tsx prisma/merge-duplicate-task.ts <from-poLine> <to-poLine>')
  }

  const fromTask = await prisma.task.findUnique({ where: { poLine: fromPoLine } })
  const toTask = await prisma.task.findUnique({ where: { poLine: toPoLine } })

  if (!fromTask) throw new Error(`No task found with poLine ${fromPoLine}`)
  if (!toTask) throw new Error(`No task found with poLine ${toPoLine}`)
  if (fromTask.id === toTask.id) throw new Error('Both poLines resolve to the same task — nothing to merge')

  const count = await prisma.timeEntry.count({ where: { taskId: fromTask.id } })
  console.log(`Source: ${fromTask.name} (poLine=${fromPoLine}) — ${count} time entries`)
  console.log(`Target: ${toTask.name} (poLine=${toPoLine})`)

  const result = await prisma.timeEntry.updateMany({
    where: { taskId: fromTask.id },
    data: { taskId: toTask.id, taskName: toTask.name },
  })
  console.log(`✔ Reassigned ${result.count} time entries`)

  await prisma.task.delete({ where: { id: fromTask.id } })
  console.log(`✔ Deleted duplicate task (poLine=${fromPoLine})`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
