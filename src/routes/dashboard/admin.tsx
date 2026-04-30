import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import type { AppUser } from '#/lib/types'

export const Route = createFileRoute('/dashboard/admin')({
  beforeLoad: ({ context }) => {
    const user = (context as { user?: AppUser }).user
    if (!user) throw redirect({ to: '/sign-in' })
    if (user.role !== 'ADMIN') throw redirect({ to: '/dashboard/employee' })
  },
  component: () => <Outlet />,
})
