import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Search } from 'lucide-react'
import { getPayrollSummary } from '#/server/payroll'
import { getMe } from '#/server/users'
import { getAllTasks } from '#/server/tasks'
import { PayrollTable } from '#/components/admin/PayrollTable'
import { Button } from '#/components/ui/Button'
import { Input } from '#/components/ui/Input'
import { Select } from '#/components/ui/Select'
import { downloadCsv, formatCurrency, formatHours } from '#/lib/utils'
import { exportPayrollPdf } from '#/lib/payrollPdf'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import type { PayrollSummary } from '#/server/payroll'
import type { AppTask } from '#/lib/types'

export const Route = createFileRoute('/dashboard/admin/payroll')({
  beforeLoad: async () => {
    const me = await getMe()
    if (!me) throw redirect({ to: '/sign-in' })
    if (me.role !== 'ADMIN') throw redirect({ to: '/dashboard/employee' })
  },
  component: PayrollPage,
})

function PayrollPage() {
  const now = new Date()
  const [startDate, setStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'))
  const [selectedPo, setSelectedPo] = useState('')
  const [queried, setQueried] = useState({ start: startDate, end: endDate, poNumber: '' })

  const { data: tasks = [] } = useQuery<AppTask[]>({
    queryKey: ['allTasks'],
    queryFn: () => getAllTasks(),
  })

  const poNumbers = useMemo(() => {
    const seen = new Set<string>()
    for (const t of tasks) {
      if (t.poNumber) seen.add(t.poNumber)
    }
    return Array.from(seen).sort()
  }, [tasks])

  const { data: summary, isLoading, error } = useQuery<PayrollSummary>({
    queryKey: ['payrollSummary', queried.start, queried.end, queried.poNumber],
    queryFn: () => getPayrollSummary({
      data: { startDate: queried.start, endDate: queried.end, poNumber: queried.poNumber || undefined },
    }),
  })

  function handleCalculate() {
    setQueried({ start: startDate, end: endDate, poNumber: selectedPo })
  }

  function handleExport() {
    if (!summary) return
    const rows: string[][] = [
      ['Employee', 'Email', 'Task', 'Hours', 'Hourly Rate', 'Pay'],
    ]
    for (const emp of summary.employees) {
      for (const task of emp.breakdown) {
        rows.push([
          emp.name,
          emp.email,
          task.taskName,
          task.hours.toFixed(4),
          emp.hourlyRate.toFixed(2),
          task.pay.toFixed(2),
        ])
      }
      rows.push([emp.name, emp.email, 'TOTAL', emp.totalHours.toFixed(4), emp.hourlyRate.toFixed(2), emp.grossPay.toFixed(2)])
    }
    const suffix = queried.poNumber ? `-PO-${queried.poNumber}` : ''
    downloadCsv(`payroll-${queried.start}-to-${queried.end}${suffix}.csv`, rows)
  }

  function setPreset(months: number) {
    const ref = months === 0 ? now : subMonths(now, months - 1)
    setStartDate(format(startOfMonth(ref), 'yyyy-MM-dd'))
    setEndDate(format(endOfMonth(months === 0 ? now : subMonths(now, 0)), 'yyyy-MM-dd'))
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-sm text-gray-500 mt-1">Calculate and export payroll for any period</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={!summary || summary.employees.length === 0}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => summary && exportPayrollPdf(summary, queried.poNumber || undefined)}
            disabled={!summary || summary.employees.length === 0}
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Date range + PO filter controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-auto"
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto"
          />
          <Select
            label="PO Number"
            value={selectedPo}
            onChange={(e) => setSelectedPo(e.target.value)}
            className="w-48"
            disabled={poNumbers.length === 0}
          >
            <option value="">All POs</option>
            {poNumbers.map((po) => (
              <option key={po} value={po}>{po}</option>
            ))}
          </Select>
          <Button onClick={handleCalculate} loading={isLoading}>
            <Search className="w-4 h-4" />
            Calculate
          </Button>
        </div>
        <div className="flex gap-2 mt-3">
          {(['This Month', 'Last Month', 'Last 3 Months'] as const).map((label, i) => (
            <button
              key={label}
              onClick={() => setPreset(i)}
              className="text-xs text-indigo-600 hover:underline"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Active PO filter badge */}
      {queried.poNumber && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500">Filtered by PO:</span>
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-3 py-0.5 text-sm font-medium">
            {queried.poNumber}
            <button
              onClick={() => { setSelectedPo(''); setQueried((q) => ({ ...q, poNumber: '' })) }}
              className="text-indigo-400 hover:text-indigo-700 leading-none"
              aria-label="Clear PO filter"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Summary totals */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Total Hours</p>
            <p className="text-2xl font-bold text-gray-900">{formatHours(summary.totalHours)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Total Gross Pay</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalGrossPay)}</p>
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 text-center py-8">{String(error)}</p>
        ) : !summary || summary.employees.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No completed time entries found for the selected period{queried.poNumber ? ` and PO ${queried.poNumber}` : ''}.
          </p>
        ) : (
          <PayrollTable summary={summary} />
        )}
      </div>
    </div>
  )
}
