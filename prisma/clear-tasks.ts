// One-off script: clear the Task table so db:push can add the required poLine
// column. TimeEntry rows reference tasks via onDelete:SetNull, so their taskId
// columns become null but the rows survive — seed reconciles taskId from
// taskName on the next seed run.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const r = await prisma.task.deleteMany()
  console.log(`Deleted ${r.count} tasks. Time-entry taskIds set to null.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
