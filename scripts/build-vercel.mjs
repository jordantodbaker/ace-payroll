// Adapt the TanStack Start Vite build (dist/) into Vercel's Build Output API v3
// (.vercel/output/). Run after `vite build`.
//
// Layout produced:
//   .vercel/output/
//   ├─ config.json              ← routing: filesystem first, then catch-all to /_ssr
//   ├─ static/                  ← contents of dist/client (served from CDN)
//   └─ functions/_ssr.func/
//      ├─ .vc-config.json       ← runtime config (Node 20)
//      ├─ index.mjs             ← thin wrapper that calls server.fetch(request)
//      └─ server/               ← copied dist/server (the SSR bundle)

import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
const out = path.join(root, '.vercel', 'output')
const fn = path.join(out, 'functions', '_ssr.func')

if (!existsSync(path.join(dist, 'server', 'server.js'))) {
  throw new Error('dist/server/server.js not found — run `vite build` first')
}

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

// 1) Static assets ← dist/client
await cp(path.join(dist, 'client'), path.join(out, 'static'), { recursive: true })

// 2) SSR function ← dist/server
await mkdir(fn, { recursive: true })
await cp(path.join(dist, 'server'), path.join(fn, 'server'), { recursive: true })

// 3) Vercel function config
await writeFile(
  path.join(fn, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs20.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
)

// 4) Function entry — TanStack Start exports a default with a Web Fetch handler
await writeFile(
  path.join(fn, 'index.mjs'),
  `import server from './server/server.js'

export default async function handler(request) {
  return server.fetch(request)
}
`,
)

// 5) Routing — serve static files first, fall through to SSR for everything else
await writeFile(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/_ssr' },
      ],
    },
    null,
    2,
  ),
)

console.log('✓ Wrote .vercel/output/ for Vercel Build Output API v3')
