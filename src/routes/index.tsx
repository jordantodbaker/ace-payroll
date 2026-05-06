import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/tanstack-react-start'
import { useEffect } from 'react'
import { Clock } from 'lucide-react'

export const Route = createFileRoute('/')({ component: Landing })

function Landing() {
  const { isLoaded, isSignedIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate({ to: '/dashboard' })
    }
  }, [isLoaded, isSignedIn, navigate])

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 to-white flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="bg-indigo-600 p-3 rounded-2xl">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ACE Time</h1>
        </div>
        <p className="text-lg text-gray-600 mb-8">
          Simple time tracking for small teams.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            to="/sign-in"
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Sign In
          </Link>
          <Link
            to="/sign-up"
            className="bg-white text-indigo-600 border border-indigo-200 px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  )
}
