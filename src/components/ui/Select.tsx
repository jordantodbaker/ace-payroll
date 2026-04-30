import { cn } from '#/lib/utils'
import { type SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, children, ...props },
  ref,
) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select
        ref={ref}
        {...props}
        className={cn(
          'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm bg-white',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
          'disabled:bg-gray-50 disabled:text-gray-500',
          error && 'border-red-500 focus:ring-red-500',
          className,
        )}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
})
