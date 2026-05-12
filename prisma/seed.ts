import { PrismaClient, Role } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const prisma = new PrismaClient()
const here = dirname(fileURLToPath(import.meta.url))

// Quote-aware CSV cell parser — handles "embedded, commas" and doubled "" escapes.
function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') { inQuotes = false }
      else { cell += c }
    } else if (c === ',') {
      cells.push(cell); cell = ''
    } else if (c === '"' && cell.length === 0) {
      inQuotes = true
    } else {
      cell += c
    }
  }
  cells.push(cell)
  return cells.map((s) => s.trim())
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']))
  })
}

function parseBool(s: string | undefined): boolean {
  return (s ?? '').trim().toUpperCase() === 'TRUE'
}

function parseStatusActive(s: string | undefined): boolean {
  return (s ?? '').trim().toLowerCase() === 'active'
}

function blankToNull(s: string | undefined): string | null {
  const v = (s ?? '').trim()
  return v.length === 0 ? null : v
}

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

// Accepts "M/D/YY" or "M/D/YYYY". Returns null for blank/invalid input.
function parseDate(s: string | undefined): Date | null {
  const v = (s ?? '').trim()
  if (!v) return null
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  let year = parseInt(m[3], 10)
  if (year < 100) year += 2000
  return new Date(year, parseInt(m[1], 10) - 1, parseInt(m[2], 10))
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

async function main() {
  await seedUsers()
  await seedTasks()
  await seedTimeEntries()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
