import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { entryDate, formatDate, formatHours, formatNameLastFirst } from '#/lib/utils'
import type { AppTimeEntryWithUser } from '#/lib/types'

export interface TimeEntriesPdfFilters {
  weekEnding?: string
  employeeName?: string
  taskName?: string
  poNumber?: string
  poLine?: string
  status?: string
}

function statusLabel(entry: AppTimeEntryWithUser): string {
  if (entry.approved) return 'Approved'
  if (entry.flagged) return 'Flagged'
  return 'Pending'
}

export function exportTimeEntriesPdf(
  entries: AppTimeEntryWithUser[],
  userMap: Record<string, string>,
  filters: TimeEntriesPdfFilters = {},
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const margin = 14

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Time Entries', margin, 18)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)

  const filterLines: string[] = []
  if (filters.weekEnding) filterLines.push(`Week ending: ${filters.weekEnding}`)
  if (filters.employeeName) filterLines.push(`Employee: ${filters.employeeName}`)
  if (filters.taskName) filterLines.push(`Task: ${filters.taskName}`)
  if (filters.poNumber) filterLines.push(`PO: ${filters.poNumber}`)
  if (filters.poLine) filterLines.push(`PO Line: ${filters.poLine}`)
  if (filters.status && filters.status !== 'all') filterLines.push(`Status: ${filters.status}`)
  filterLines.push(`Generated: ${formatDate(new Date())}`)
  filterLines.push(`Entries: ${entries.length}`)

  let y = 24
  for (const line of filterLines) {
    doc.text(line, margin, y)
    y += 4
  }

  doc.setTextColor(0)

  const totalHours = entries.reduce((s, e) => s + e.totalHours, 0)

  autoTable(doc, {
    startY: y + 4,
    head: [['Employee', 'Date', 'Week Ending', 'Task', 'Hours', 'Status', 'Description']],
    body: entries.map((e) => [
      userMap[e.userId] ?? formatNameLastFirst(e.user?.name) ?? '—',
      formatDate(entryDate(e)),
      e.weekEnding ? formatDate(e.weekEnding) : '—',
      e.taskName,
      formatHours(e.totalHours),
      statusLabel(e),
      e.workDescription ?? '',
    ]),
    foot: [['', '', '', 'Total', formatHours(totalHours), '', '']],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 50 },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 20 },
      6: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
  })

  const filenameSuffix = [
    filters.weekEnding && `week-${filters.weekEnding}`,
    filters.employeeName && `${filters.employeeName.replace(/[,\s]+/g, '-')}`,
    filters.status && filters.status !== 'all' && filters.status,
  ].filter(Boolean).join('_')

  doc.save(`time-entries${filenameSuffix ? `-${filenameSuffix}` : ''}.pdf`)
}
