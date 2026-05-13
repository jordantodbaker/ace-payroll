import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Separate config from vite.config.ts so vitest doesn't pull in the TanStack
// Start plugin (which expects an SSR pipeline that isn't running under test).
export default defineConfig({
  resolve: {
    alias: {
      '#': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
    globals: false,
  },
})
