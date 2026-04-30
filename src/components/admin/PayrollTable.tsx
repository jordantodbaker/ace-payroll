import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { formatCurrency, formatHours } from '#/lib/utils'
import type { PayrollSummary } from '#/server/payroll'

export function PayrollTable({ summary }: { summary: PayrollSummary }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
            <th className="pb-3 pr-4">Employee</th>
            <th className="pb-3 pr-4 text-right">Total Hours</th>
            <th className="pb-3 pr-4 text-right">Hourly Rate</th>
            <th className="pb-3 text-right">Gross Pay</th>
          </tr>
        </thead>
        <tbody>
          {summary.employees.map((emp) => (
            <>
              <tr
                key={emp.id}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => toggle(emp.id)}
              >
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {expanded.has(emp.id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 text-right tabular-nums font-medium">
                  {formatHours(emp.totalHours)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-gray-600">
                  {formatCurrency(emp.hourlyRate)}/hr
                </td>
                <td className="py-3 text-right tabular-nums font-semibold text-gray-900">
                  {formatCurrency(emp.grossPay)}
                </td>
              </tr>
              {expanded.has(emp.id) && emp.breakdown.map((task) => (
                <tr key={`${emp.id}-${task.taskName}`} className="bg-gray-50 border-b border-gray-100">
                  <td className="py-2 pr-4 pl-10 text-gray-600">{task.taskName}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-gray-600">
                    {formatHours(task.hours)}
                  </td>
                  <td className="py-2 pr-4" />
                  <td className="py-2 text-right tabular-nums text-gray-600">
                    {formatCurrency(task.pay)}
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-900 bg-gray-50">
            <td className="py-3 pr-4 font-bold text-gray-900">Total</td>
            <td className="py-3 pr-4 text-right tabular-nums font-bold">
              {formatHours(summary.totalHours)}
            </td>
            <td className="py-3 pr-4" />
            <td className="py-3 text-right tabular-nums font-bold text-gray-900">
              {formatCurrency(summary.totalGrossPay)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
