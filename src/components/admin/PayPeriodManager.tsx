import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getPayPeriodConfig, updatePayPeriodConfig } from '#/server/settings'
import { payPeriodEndingFor } from '#/server/date-range'
import { Button } from '#/components/ui/Button'
import { Input } from '#/components/ui/Input'
import { formatDate } from '#/lib/utils'
import type { AppPayPeriodConfig } from '#/lib/types'

function toInputDate(d: Date | string): string {
  const date = new Date(d)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function PayPeriodManager() {
  const { data: config, isLoading } = useQuery<AppPayPeriodConfig>({
    queryKey: ['payPeriodConfig'],
    queryFn: () => getPayPeriodConfig(),
  })

  if (isLoading || !config) {
    return <div className="animate-pulse h-32 bg-gray-100 rounded" />
  }
  // Mount the form once config is loaded so its inputs initialize from it.
  return <PayPeriodForm config={config} />
}

function PayPeriodForm({ config }: { config: AppPayPeriodConfig }) {
  const qc = useQueryClient()
  const [anchor, setAnchor] = useState(toInputDate(config.payPeriodAnchor))
  const [weeks, setWeeks] = useState(String(config.payPeriodWeeks))
  const [error, setError] = useState('')

  const weeksNumber = parseInt(weeks, 10)
  const anchorValid = /^\d{4}-\d{2}-\d{2}$/.test(anchor)
  const weeksValid = Number.isInteger(weeksNumber) && weeksNumber >= 1 && weeksNumber <= 8
  const canSubmit = anchorValid && weeksValid

  const mutation = useMutation({
    mutationFn: () => updatePayPeriodConfig({ data: { anchor, weeks: weeksNumber } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payPeriodConfig'] })
      setError('')
    },
    onError: (e) => setError(String(e)),
  })

  // Preview: which pay period today falls into under the current inputs.
  let preview: string | null = null
  if (canSubmit) {
    const [y, m, d] = anchor.split('-').map(Number)
    const end = payPeriodEndingFor(new Date(), new Date(y, m - 1, d, 12), weeksNumber)
    preview = formatDate(end)
  }

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-gray-500">
        Pay periods are computed from a known period-end date and repeat on the
        chosen interval. Saved here, then stored on each time entry as it's
        created or edited.
      </p>

      <Input
        label="Most recent pay period end date"
        type="date"
        value={anchor}
        onChange={(e) => setAnchor(e.target.value)}
        required
      />
      <Input
        label="Pay period length (weeks)"
        type="number"
        min="1"
        max="8"
        step="1"
        value={weeks}
        onChange={(e) => setWeeks(e.target.value)}
        required
      />

      {preview && (
        <p className="text-sm text-gray-600">
          Today falls in the pay period ending{' '}
          <span className="font-medium text-gray-900">{preview}</span>.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {mutation.isSuccess && !mutation.isPending && (
        <p className="text-sm text-green-600">Pay period settings saved.</p>
      )}

      <div className="flex justify-end">
        <Button
          loading={mutation.isPending}
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
