import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Clock, Menu } from 'lucide-react'
import { syncUser } from '#/server/users'
import { Sidebar } from '#/components/layout/Sidebar'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    try {
      const user = await syncUser()
      return { user }
    } catch (e) {
      // Only redirect to sign-in for genuine auth failures. Other errors
      // (DB unreachable, Clerk API error) must surface in the error UI —
      // otherwise we'd loop: sign-in sees a signed-in user and bounces
      // straight back to /dashboard.
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.toLowerCase().includes('unauthorized')) {
        throw redirect({ to: '/sign-in' })
      }
      throw e
    }
  },
  component: DashboardLayout,
  errorComponent: DashboardError,
})

function DashboardLayout() {
  const { user } = Route.useRouteContext()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <Sidebar role={user.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile top bar — hidden on lg+ where the sidebar is permanent */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 bg-white border-b border-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-md text-gray-700 hover:bg-gray-100"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          <span className="font-semibold text-gray-900">ACE Time</span>
        </div>
        <div className="w-9" aria-hidden="true" />
      </header>

      <main className="lg:ml-64 min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}

function DashboardError({ error }: { error: Error }) {
  const msg = error.message ?? String(error)
  const looksLikeDbError =
    msg.includes("Can't reach database") ||
    msg.includes('ECONNREFUSED') ||
    msg.toLowerCase().includes('prisma') ||
    msg.includes('does not exist')

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-600 mb-4 wrap-break-word">{msg}</p>
        {looksLikeDbError && (
          <div className="text-sm bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="font-medium text-yellow-900 mb-1">Looks like a database issue.</p>
            <ul className="list-disc list-inside text-yellow-800 space-y-1">
              <li>Is Postgres running?</li>
              <li>Does <code className="bg-yellow-100 px-1 rounded">DATABASE_URL</code> in <code className="bg-yellow-100 px-1 rounded">.env</code> point to a valid database?</li>
              <li>Have you run <code className="bg-yellow-100 px-1 rounded">npm run db:push</code>?</li>
            </ul>
          </div>
        )}
        <button
          onClick={() => window.location.reload()}
          className="text-indigo-600 hover:underline text-sm"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
