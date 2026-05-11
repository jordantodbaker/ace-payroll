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

function blankToNull(s: string | undefined): string | null {
  const v = (s ?? '').trim()
  return v.length === 0 ? null : v
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
  const csvPath = join(here, 'data', 'tasks.csv')
  const rows = parseCsv(readFileSync(csvPath, 'utf-8'))

  for (const row of rows) {
    if (!row.name) {
      console.warn(`skipping task row missing name: ${JSON.stringify(row)}`)
      continue
    }
    const data = {
      clientJobNum: blankToNull(row.clientJobNum),
      description: blankToNull(row.description),
      poNumber: blankToNull(row.poNum),
      client: blankToNull(row.client),
      approver: blankToNull(row.approver),
      active: parseBool(row.active),
    }
    await prisma.task.upsert({
      where: { name: row.name },
      update: data,
      create: { name: row.name, ...data },
    })
    console.log(`✔ task  ${row.name}`)
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
  const taskByName = new Map(tasks.map((t) => [t.name, t.id]))

  let inserted = 0
  let updated = 0
  let skipped = 0

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
    const taskId = taskByName.get(projectName) ?? null
    const data = {
      userId,
      taskId,
      taskName: projectName,
      weekEnding,
      workDate,
      totalHours,
      workDescription: blankToNull(row.workDescription),
      approved: true,
    }

    // Match by user + workDate + taskName + hours. If found, sync the CSV-driven
    // fields onto the existing row; otherwise insert a new one.
    const existing = await prisma.timeEntry.findFirst({
      where: { userId, workDate, taskName: projectName, totalHours },
    })
    if (existing) {
      await prisma.timeEntry.update({ where: { id: existing.id }, data })
      updated++
    } else {
      await prisma.timeEntry.create({ data })
      inserted++
    }
  }
  console.log(`✔ time entries  inserted=${inserted}  updated=${updated}  skipped=${skipped}`)
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
