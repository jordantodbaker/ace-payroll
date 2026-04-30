import { createFileRoute, redirect } from '@tanstack/react-router'
import type { AppUser } from '#/lib/types'

export const Route = createFileRoute('/dashboard/')({
  beforeLoad: async ({ context }) => {
    const user = (context as { user: AppUser }).user
    throw redirect({ to: user.role === 'ADMIN' ? '/dashboard/admin' : '/dashboard/employee' })
  },
  component: () => null,
})
