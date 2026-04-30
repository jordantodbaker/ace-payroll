import { cn } from '#/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, ...props },
  ref,
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        ref={ref}
        {...props}
        className={cn(
          'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm',
          'placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
          'disabled:bg-gray-50 disabled:text-gray-500',
          error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
          className,
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
})
