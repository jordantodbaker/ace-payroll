// Lists time entries that still have no linked task (taskId=null).
// Group by taskName so we can see how many orphans share each name.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const orphans = await prisma.timeEntry.findMany({
    where: { taskId: null },
    select: {
      taskName: true,
      workDate: true,
      totalHours: true,
      user: { select: { name: true } },
    },
    orderBy: [{ taskName: 'asc' }, { workDate: 'desc' }],
  })

  if (orphans.length === 0) {
    console.log('No orphans — every time entry has a linked task.')
    return
  }

  const byName = new Map<string, typeof orphans>()
  for (const e of orphans) {
    const list = byName.get(e.taskName) ?? []
    list.push(e)
    byName.set(e.taskName, list)
  }

  console.log(`${orphans.length} time entries with no linked task, grouped by taskName:\n`)
  for (const [name, list] of [...byName.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  "${name}" — ${list.length} entr${list.length === 1 ? 'y' : 'ies'}`)
    for (const e of list) {
      const date = e.workDate ? new Date(e.workDate).toISOString().slice(0, 10) : '—'
      console.log(`    · ${date}  ${e.user.name}  ${Number(e.totalHours)}h`)
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
