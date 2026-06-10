import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { getAllTimeEntries } from '#/server/time-entries'
import { getAllUsers } from '#/server/users'
import { TimeEntryList } from '#/components/time-tracking/TimeEntryList'
import { Select } from '#/components/ui/Select'
import { Button } from '#/components/ui/Button'
import { buildUserMap, displayName, downloadCsv, entryDate, formatDate, formatHours, formatNameLastFirst } from '#/lib/utils'
import { weekEndingKey } from '#/lib/date-utils'
import type { AppUser, AppTimeEntryWithUser } from '#/lib/types'

export const Route = createFileRoute('/dashboard/admin/time-entries')({
  component: AllTimeEntriesPage,
})

const NO_WEEK = '__none__'
const NO_PO = '__none__'

function AllTimeEntriesPage() {
  const [weekEnding, setWeekEnding] = useState('')
  const [userId, setUserId] = useState('')
  const [taskName, setTaskName] = useState('')
  const [poNumber, setPoNumber] = useState('')
  const [poLine, setPoLine] = useState('')
  const [pdfPending, setPdfPending] = useState(false)

  const { data: entries = [], isLoading } = useQuery<AppTimeEntryWithUser[]>({
    queryKey: ['allTimeEntries', 'full'],
    queryFn: () => getAllTimeEntries({ data: { limit: 500 } }),
  })

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ['allUsers'],
    queryFn: () => getAllUsers(),
    staleTime: 5 * 60_000,
  })

  const userMap = useMemo(() => buildUserMap(users), [users])

  // Filter options derived from the loaded entries so the dropdowns only show
  // values that actually appear in the data. Avoids dead options like "filter by
  // a week with no entries."
  const weekOptions = useMemo(() => {
    const set = new Set<string>()
    let hasNoWeek = false
    for (const e of entries) {
      const key = weekEndingKey(e.weekEnding)
      if (key) set.add(key)
      else hasNoWeek = true
    }
    const sorted = [...set].sort().reverse()
    return { weeks: sorted, hasNoWeek }
  }, [entries])

  const taskOptions = useMemo(() => {
    return [...new Set(entries.map((e) => e.taskName))].sort()
  }, [entries])

  const userOptions = useMemo(() => {
    const ids = new Set(entries.map((e) => e.userId))
    return users.filter((u) => ids.has(u.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [entries, users])

  // PO + PO Line come from the linked task. Entries with no linked task fall
  // into the "(none)" bucket which only appears when at least one such entry
  // is present.
  const poOptions = useMemo(() => {
    const set = new Set<string>()
    let hasNone = false
    for (const e of entries) {
      if (e.task?.poNumber) set.add(e.task.poNumber)
      else hasNone = true
    }
    return { values: [...set].sort(), hasNone }
  }, [entries])

  const poLineOptions = useMemo(() => {
    // Scope the PO Line options to the currently-selected PO so users don't
    // see lines from other POs.
    const set = new Set<string>()
    let hasNone = false
    for (const e of entries) {
      if (poNumber === NO_PO) {
        if (e.task?.poNumber) continue
      } else if (poNumber && e.task?.poNumber !== poNumber) {
        continue
      }
      if (e.task?.poLine) set.add(e.task.poLine)
      else hasNone = true
    }
    return { values: [...set].sort(), hasNone }
  }, [entries, poNumber])

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (userId && e.userId !== userId) return false
      if (taskName && e.taskName !== taskName) return false
      if (weekEnding) {
        if (weekEnding === NO_WEEK) {
          if (e.weekEnding) return false
        } else if (weekEndingKey(e.weekEnding) !== weekEnding) {
          return false
        }
      }
      if (poNumber) {
        if (poNumber === NO_PO) {
          if (e.task?.poNumber) return false
        } else if (e.task?.poNumber !== poNumber) return false
      }
      if (poLine && e.task?.poLine !== poLine) return false
      return true
    })
  }, [entries, userId, taskName, weekEnding, poNumber, poLine])

  const totalHours = useMemo(
    () => filtered.reduce((s, e) => s + e.totalHours, 0),
    [filtered],
  )

  const activeFilters = !!(userId || taskName || weekEnding || poNumber || poLine)

  function clearFilters() {
    setWeekEnding(''); setUserId(''); setTaskName(''); setPoNumber(''); setPoLine('')
  }

  // Changing PO invalidates any PO Line that doesn't belong to it — clear it
  // alongside the PO change so the UI never shows a stale-line selection.
  function handlePoChange(next: string) {
    setPoNumber(next)
    setPoLine('')
  }

  // Filter snapshot used by both exports — keeps CSV/PDF/filename consistent.
  const exportFilters = {
    weekEnding: weekEnding && weekEnding !== NO_WEEK ? formatDate(weekEnding) : weekEnding === NO_WEEK ? '(no week ending)' : undefined,
    employeeName: userId ? userMap[userId] : undefined,
    taskName: taskName || undefined,
    poNumber: poNumber === NO_PO ? '(no PO)' : poNumber || undefined,
    poLine: poLine || undefined,
  }

  function handleExportCsv() {
    if (filtered.length === 0) return
    const rows: string[][] = [
      ['Date', 'EmployeeName', 'PO_Line', 'WorkDescription', 'Hours'],
      ...filtered.map((e) => [
        formatDate(entryDate(e)),
        userMap[e.userId] ?? formatNameLastFirst(e.user?.name) ?? '',
        e.task?.poLine ?? '',
        e.workDescription ?? '',
        e.totalHours.toFixed(1),
      ]),
    ]
    const suffix = [
      exportFilters.weekEnding && `week-${weekEnding}`,
      exportFilters.employeeName && exportFilters.employeeName.replace(/[,\s]+/g, '-'),
    ].filter(Boolean).join('_')
    downloadCsv(`time-entries${suffix ? `-${suffix}` : ''}.csv`, rows)
  }

  async function handleExportPdf() {
    if (filtered.length === 0) return
    setPdfPending(true)
    try {
      // jspdf is ~250KB; only pay for it when an admin actually exports a PDF.
      const { exportTimeEntriesPdf } = await import('#/lib/timeEntriesPdf')
      exportTimeEntriesPdf(filtered, userMap, exportFilters)
    } finally {
      setPdfPending(false)
    }
  }

  const canExport = !isLoading && filtered.length > 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 lg:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Time Entries</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading ? (
              'Loading…'
            ) : (
              <>
                {filtered.length} of {entries.length} entries
                {' · '}
                <span className="font-semibold text-gray-900">{formatHours(totalHours)}</span>
                {' total'}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportCsv} disabled={!canExport}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
          <Button variant="secondary" onClick={handleExportPdf} loading={pdfPending} disabled={!canExport}>
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Select label="Week ending" value={weekEnding} onChange={(e) => setWeekEnding(e.target.value)}>
            <option value="">All weeks</option>
            {weekOptions.weeks.map((w) => (
              <option key={w} value={w}>{formatDate(w)}</option>
            ))}
            {weekOptions.hasNoWeek && <option value={NO_WEEK}>(no week ending)</option>}
          </Select>
          <Select label="Employee" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">All employees</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>{displayName(u)}</option>
            ))}
          </Select>
          <Select label="Task" value={taskName} onChange={(e) => setTaskName(e.target.value)}>
            <option value="">All tasks</option>
            {taskOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Select label="PO" value={poNumber} onChange={(e) => handlePoChange(e.target.value)}>
            <option value="">All POs</option>
            {poOptions.values.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            {poOptions.hasNone && <option value={NO_PO}>(no PO)</option>}
          </Select>
          <Select label="PO Line" value={poLine} onChange={(e) => setPoLine(e.target.value)}>
            <option value="">All PO Lines</option>
            {poLineOptions.values.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
        </div>
        {activeFilters && (
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            {entries.length === 0 ? 'No time entries yet.' : 'No entries match the selected filters.'}
          </p>
        ) : (
          <TimeEntryList entries={filtered} showUser userMap={userMap} />
        )}
      </div>
    </div>
  )
}
