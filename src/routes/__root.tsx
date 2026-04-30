import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { ClerkProvider } from '@clerk/tanstack-react-start'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '#/lib/query'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'PayrollApp' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <QueryClientProvider client={queryClient}>
        <html lang="en">
          <head>
            <HeadContent />
          </head>
          <body className="bg-gray-50 text-gray-900 antialiased">
            {children}
            <Scripts />
          </body>
        </html>
      </QueryClientProvider>
    </ClerkProvider>
  )
}
