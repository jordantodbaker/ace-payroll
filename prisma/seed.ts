import { PrismaClient, Role } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  blankToNull,
  parseBool,
  parseCsv,
  parseDate,
  parseStatusActive,
} from './seed-helpers'

const prisma = new PrismaClient()
const here = dirname(fileURLToPath(import.meta.url))

// Maps old project names referenced by time-entries-5-10.csv → new task poLine
// in tasks-updated.csv. Time entries CSV predates the new task schema where one
// project (e.g. "Haskell OH PC Improvements") spans multiple poLines.
const TIME_ENTRY_PROJECT_TO_PO_LINE: Record<string, string> = {
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

async function seedUsers() {
  const csvPath = join(here, 'data', 'users.csv')
  const rows = parseCsv(readFileSync(csvPath, 'utf-8'))

  for (const row of rows) {
    if (!row.email || !row.clerkId) {
      console.warn(`skipping row missing email/clerkId: ${JSON.stringify(row)}`)
      continue
    }
    const role: Role = row.role === 'ADMIN' ? Role.ADMIN : Role.EMPLOYEE
    await prisma.user.upsert({
      where: { email: row.email },
      update: { name: row.name, role, clerkId: row.clerkId },
      create: { clerkId: row.clerkId, name: row.name, email: row.email, role },
    })
    console.log(`✔ user  ${row.email} (${role})`)
  }
}

async function seedTasks() {
  const csvPath = join(here, 'data', 'tasks-updated.csv')
  const rows = parseCsv(readFileSync(csvPath, 'utf-8'))

  for (const row of rows) {
    const project = row.Project
    const poLine = row.PO_Line
    if (!project || !poLine) {
      console.warn(`skipping task row missing Project or PO_Line: ${JSON.stringify(row)}`)
      continue
    }
    const data = {
      clientJobNum: blankToNull(row.ClientJobNo),
      poNumber: blankToNull(row.PO),
      client: blankToNull(row.Client),
      approver: blankToNull(row.Approver),
      type: blankToNull(row.Type),
      timesheetSubmit: blankToNull(row.TimesheetSubmit),
      description: blankToNull(row.description),
      active: parseStatusActive(row.Status),
    }
    await prisma.task.upsert({
      where: { poLine },
      update: { name: project, ...data },
      create: { poLine, name: project, ...data },
    })
    console.log(`✔ task  ${poLine}  ${project}${row.description ? `: ${row.description}` : ''}`)
  }
}

async function seedTimeEntries() {
  const csvPath = join(here, 'migrations', 'time-entries-5-10.csv')
  const rows = parseCsv(readFileSync(csvPath, 'utf-8'))

  // The CSV `userId` column holds each user's clerkId (e.g. "pete", "noel", "jordan").
  // That keeps the data unambiguous when two users share a first name.
  const users = await prisma.user.findMany()
  const userByClerkId = new Map(users.map((u) => [u.clerkId, u.id]))
  const tasks = await prisma.task.findMany()
  const taskByPoLine = new Map(tasks.map((t) => [t.poLine, t]))

  let inserted = 0
  let updated = 0
  let skipped = 0
  let unmappedTasks = 0

  for (const row of rows) {
    const clerkId = row.userId
    const projectName = row['Project Name']
    const userId = clerkId ? userByClerkId.get(clerkId) : undefined
    if (!userId) {
      console.warn(`skip — unknown userId "${clerkId}" (employee "${row['Employee Name']}")`)
      skipped++
      continue
    }
    const workDate = parseDate(row.Date)
    const weekEnding = parseDate(row.Weekending)
    const totalHours = parseFloat(row.totalHours)
    if (!Number.isFinite(totalHours) || totalHours <= 0) {
      console.warn(`skip — bad totalHours "${row.totalHours}" for ${clerkId} on ${row.Date}`)
      skipped++
      continue
    }

    // Translate old project names in the time-entries CSV to the new task's
    // poLine. If the project name has no mapping or the task no longer exists,
    // record the entry with taskId=null but preserve the original projectName.
    const poLine = TIME_ENTRY_PROJECT_TO_PO_LINE[projectName]
    const task = poLine ? taskByPoLine.get(poLine) : undefined
    const taskId = task?.id ?? null
    const taskName = task?.name ?? projectName
    if (!task) {
      console.warn(`time-entry project "${projectName}" has no matching task — entry stored with taskId=null`)
      unmappedTasks++
    }

    const data = {
      userId,
      taskId,
      taskName,
      weekEnding,
      workDate,
      totalHours,
      workDescription: blankToNull(row.workDescription),
      approved: true,
    }

    // Match existing rows by user + workDate + totalHours and EITHER the old
    // CSV project name or the new task name. Necessary because previously-
    // seeded rows carry the old name; after this run they'll carry the new one.
    const candidateTaskNames = [projectName]
    if (task && task.name !== projectName) candidateTaskNames.push(task.name)
    const existing = await prisma.timeEntry.findFirst({
      where: { userId, workDate, totalHours, taskName: { in: candidateTaskNames } },
    })
    if (existing) {
      await prisma.timeEntry.update({ where: { id: existing.id }, data })
      updated++
    } else {
      await prisma.timeEntry.create({ data })
      inserted++
    }
  }
  console.log(`✔ time entries  inserted=${inserted}  updated=${updated}  skipped=${skipped}  unmappedTasks=${unmappedTasks}`)
}

// Re-link time entries whose taskId got nulled (e.g. by an `onDelete: SetNull`
// cascade during a schema migration). For each orphan:
//   1. Sibling-dedup: if another non-orphan row has same userId/workDate/hours,
//      this is a stale duplicate of a reconciled row — delete it.
//   2. Try the explicit old→new mapping (handles renamed projects like
//      "HASK: Schedule Portfolio" → poLine 19693_005).
//   3. Fall back to exact taskName match, but only when unambiguous (one task).
async function reconcileTimeEntryTasks() {
  const tasks = await prisma.task.findMany({ select: { id: true, name: true, poLine: true } })
  const taskByPoLine = new Map(tasks.map((t) => [t.poLine, t]))
  const tasksByName = new Map<string, typeof tasks>()
  for (const t of tasks) {
    const list = tasksByName.get(t.name) ?? []
    list.push(t)
    tasksByName.set(t.name, list)
  }

  const orphans = await prisma.timeEntry.findMany({
    where: { taskId: null },
    select: { id: true, userId: true, workDate: true, totalHours: true, taskName: true },
  })

  let deleted = 0
  let relinked = 0
  let leftAlone = 0

  for (const o of orphans) {
    // Step 1 — sibling dedup. Only count siblings that are themselves linked
    // (taskId != null), so two orphans don't cannibalize each other.
    const sibling = await prisma.timeEntry.findFirst({
      where: {
        userId: o.userId,
        workDate: o.workDate,
        totalHours: o.totalHours,
        NOT: { id: o.id },
        taskId: { not: null },
      },
      select: { id: true },
    })
    if (sibling) {
      await prisma.timeEntry.delete({ where: { id: o.id } })
      deleted++
      continue
    }

    // Step 2 — explicit migration mapping.
    const poLine = TIME_ENTRY_PROJECT_TO_PO_LINE[o.taskName]
    let task = poLine ? taskByPoLine.get(poLine) : undefined

    // Step 3 — exact-name fallback (unambiguous matches only).
    if (!task) {
      const candidates = tasksByName.get(o.taskName) ?? []
      if (candidates.length === 1) task = candidates[0]
    }

    if (task) {
      await prisma.timeEntry.update({
        where: { id: o.id },
        data: { taskId: task.id, taskName: task.name },
      })
      relinked++
    } else {
      leftAlone++
    }
  }
  console.log(`✔ reconcile taskIds  deleted=${deleted}  relinked=${relinked}  leftAlone=${leftAlone}`)
}

async function main() {
  await seedUsers()
  await seedTasks()
  await seedTimeEntries()
  await reconcileTimeEntryTasks()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
