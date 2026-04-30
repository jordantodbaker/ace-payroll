import { useEffect, useState } from 'react'
import { formatElapsed } from '#/lib/utils'

export function Timer({ startTime }: { startTime: Date | string }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startTime))

  useEffect(() => {
    const id = setInterval(() => setElapsed(formatElapsed(startTime)), 1000)
    return () => clearInterval(id)
  }, [startTime])

  return (
    <span className="font-mono text-2xl font-bold text-indigo-600 tabular-nums">{elapsed}</span>
  )
}
