import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '#/lib/utils'

interface AccordionSectionProps {
  title: string
  description?: string
  icon?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

// A self-contained collapsible section. Stack several to form an accordion;
// each toggles independently.
export function AccordionSection({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {icon}
          <span className="min-w-0">
            <span className="block font-semibold text-gray-900">{title}</span>
            {description && (
              <span className="block text-sm text-gray-500 truncate">{description}</span>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn('w-5 h-5 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="border-t border-gray-200 p-4 sm:p-6">{children}</div>}
    </div>
  )
}
