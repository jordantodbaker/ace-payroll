import { cn } from '#/lib/utils'

type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray'

const colors: Record<BadgeVariant, string> = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800',
}

export function Badge({
  variant = 'gray',
  children,
  className,
}: {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[variant], className)}>
      {children}
    </span>
  )
}
