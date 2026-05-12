// Smart cleanup for time entries left orphaned by the task migration.
// For each orphan (taskId=null with an old "HASK: …"-style taskName):
//   - If a non-orphan entry exists for the same user/date/hours → orphan is
//     a duplicate of a previously-reconciled row, delete it.
//   - Otherwise → rewrite its taskName to the current project name and link
//     it to the matching task via the same map the seed uses.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Same map used by seed.ts. Keep these in sync if either is changed.
const OLD_TO_NEW: Record<string, string> = {
  'Chuckanut': '208',
  'HASK: Change Log Web App': '19693_007',
  'HASK: Estimate Web App': '19693_006',
  'HASK: Schedule Portfolio': '19693_005',
  'HASK: CBS': '19693_004',
  'HASK: Controls Management': '19693_003',
  'HASK: Procedures': '19693_008',
  'HASK: Incentives': '19693_009',
  'MPC Planning': '4900732819',
  'HFS FGRU Artesia': '4513164387',
  'ACE_OH Training': '1030',
  'Grand Sierra': 'GS',
  'ACE_Unpaid Time Away': 'ACE_UP',
}

async function main() {
  const tasks = await prisma.task.findMany({ select: { id: true, poLine: true, name: true } })
  const taskByPoLine = new Map(tasks.map((t) => [t.poLine, t]))

  const orphans = await prisma.timeEntry.findMany({
    where: { taskId: null },
    select: { id: true, userId: true, workDate: true, totalHours: true, taskName: true },
  })

  let deleted = 0
  let relinked = 0
  let leftAlone = 0

  for (const o of orphans) {
    // Look for a sibling: same user + workDate + hours but with a non-null taskId.
    const sibling = await prisma.timeEntry.findFirst({
      where: {
        userId: o.userId,
        workDate: o.workDate,
        totalHours: o.totalHours,
        NOT: { id: o.id },
      },
    })

    if (sibling) {
      await prisma.timeEntry.delete({ where: { id: o.id } })
      console.log(`  delete dup  ${o.taskName.padEnd(35)} ${(o.workDate ?? new Date(0)).toISOString().slice(0, 10)}  ${Number(o.totalHours)}h`)
      deleted++
      continue
    }

    const poLine = OLD_TO_NEW[o.taskName]
    const task = poLine ? taskByPoLine.get(poLine) : undefined
    if (task) {
      await prisma.timeEntry.update({
        where: { id: o.id },
        data: { taskId: task.id, taskName: task.name },
      })
      console.log(`  relink      ${o.taskName.padEnd(35)} → ${task.name} (${poLine})`)
      relinked++
    } else {
      console.log(`  leave alone ${o.taskName.padEnd(35)} (no mapping)`)
      leftAlone++
    }
  }

  console.log(`\nDone. deleted=${deleted}  relinked=${relinked}  leftAlone=${leftAlone}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
