import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PayrollSummary } from '#/server/payroll'

export function exportPayrollPdf(summary: PayrollSummary, poNumber?: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20

  // — Header —
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('Payroll Report', margin, 22)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100)

  const start = formatDate(summary.periodStart)
  const end = formatDate(summary.periodEnd)
  doc.text(`Period: ${start} – ${end}`, margin, 30)
  if (poNumber) doc.text(`PO Number: ${poNumber}`, margin, 36)
  const genY = poNumber ? 42 : 36
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, genY)

  doc.setTextColor(0)

  // — Table body rows —
  const body: (string | { content: string; styles: object })[][] = []

  for (const emp of summary.employees) {
    // Employee header row
    body.push([
      {
        content: `${emp.name}\n${emp.email}`,
        styles: { fontStyle: 'bold', fillColor: [240, 242, 255] },
      },
      { content: '', styles: { fillColor: [240, 242, 255] } },
      { content: '', styles: { fillColor: [240, 242, 255] } },
      { content: '', styles: { fillColor: [240, 242, 255] } },
      { content: '', styles: { fillColor: [240, 242, 255] } },
    ])

    // Task breakdown rows
    for (const task of emp.breakdown) {
      body.push([
        `    ${task.taskName}`,
        '',
        formatHours(task.hours),
        formatCurrency(emp.hourlyRate),
        formatCurrency(task.pay),
      ])
    }

    // Employee subtotal row
    body.push([
      { content: '    Subtotal', styles: { fontStyle: 'bold' } },
      { content: '', styles: {} },
      { content: formatHours(emp.totalHours), styles: { fontStyle: 'bold' } },
      { content: '', styles: {} },
      { content: formatCurrency(emp.grossPay), styles: { fontStyle: 'bold' } },
    ])
  }

  autoTable(doc, {
    startY: genY + 8,
    head: [['Employee / Task', '', 'Hours', 'Rate', 'Gross Pay']],
    body,
    foot: [[
      { content: 'Grand Total', styles: { fontStyle: 'bold' } },
      '',
      { content: formatHours(summary.totalHours), styles: { fontStyle: 'bold' } },
      '',
      { content: formatCurrency(summary.totalGrossPay), styles: { fontStyle: 'bold' } },
    ]],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: [243, 244, 246], textColor: 0, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 0 },   // hidden spacer
      2: { halign: 'right', cellWidth: 28 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 34 },
    },
    margin: { left: margin, right: margin },
  })

  // — Signature section —
  const finalY = (doc as any).lastAutoTable.finalY as number
  const sigY = Math.min(finalY + 20, doc.internal.pageSize.getHeight() - 50)

  // Add a new page if the table ran too close to the bottom
  if (finalY + 55 > doc.internal.pageSize.getHeight()) {
    doc.addPage()
  }

  const actualSigY = finalY + 55 > doc.internal.pageSize.getHeight()
    ? 30
    : finalY + 22

  doc.setDrawColor(150)
  doc.setFontSize(9)
  doc.setTextColor(80)

  const col1X = margin
  const col2X = pageW / 2 + 10
  const lineW = pageW / 2 - margin - 10

  // Signature line 1 — Prepared by
  doc.text('Prepared by', col1X, actualSigY)
  doc.line(col1X, actualSigY + 8, col1X + lineW, actualSigY + 8)
  doc.setFontSize(8)
  doc.text('Signature', col1X, actualSigY + 13)
  doc.setFontSize(9)

  // Date line 1
  doc.text('Date', col2X, actualSigY)
  doc.line(col2X, actualSigY + 8, col2X + lineW, actualSigY + 8)

  // Signature line 2 — Approved by
  const sig2Y = actualSigY + 26
  doc.text('Approved by', col1X, sig2Y)
  doc.line(col1X, sig2Y + 8, col1X + lineW, sig2Y + 8)
  doc.setFontSize(8)
  doc.text('Signature', col1X, sig2Y + 13)
  doc.setFontSize(9)

  // Date line 2
  doc.text('Date', col2X, sig2Y)
  doc.line(col2X, sig2Y + 8, col2X + lineW, sig2Y + 8)

  doc.setTextColor(0)

  const suffix = poNumber ? `-PO-${poNumber}` : ''
  doc.save(`payroll-${summary.periodStart}-to-${summary.periodEnd}${suffix}.pdf`)
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatHours(n: number) {
  return `${n.toFixed(2)} hrs`
}

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}
