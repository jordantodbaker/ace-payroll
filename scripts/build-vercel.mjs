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

// 4) Function entry — bridges Vercel's Node (req, res) to TanStack Start's
//    Web Fetch handler. The server module is imported dynamically so import
//    errors surface in the response instead of crashing the whole function.
await writeFile(
  path.join(fn, 'index.mjs'),
  `import { Buffer } from 'node:buffer'

let serverPromise
function loadServer() {
  if (!serverPromise) {
    serverPromise = import('./server/server.js').then((m) => m.default)
  }
  return serverPromise
}

export default async function handler(req, res) {
  let server
  try {
    server = await loadServer()
  } catch (err) {
    console.error('Failed to load SSR module:', err)
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(
      'SSR module failed to load\\n\\n' +
        (err && err.stack ? err.stack : String(err)),
    )
    return
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https'
    const host = req.headers['x-forwarded-host'] || req.headers.host
    const url = protocol + '://' + host + req.url

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue
      if (Array.isArray(value)) for (const v of value) headers.append(key, v)
      else headers.set(key, value)
    }

    let body
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      body = Buffer.concat(chunks)
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body,
      duplex: 'half',
    })

    const response = await server.fetch(request)

    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))

    if (response.body) {
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
    }
    res.end()
  } catch (err) {
    console.error('SSR handler crashed:', err)
    res.statusCode = 500
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.end(
      'SSR handler crashed\\n\\n' +
        (err && err.stack ? err.stack : String(err)),
    )
  }
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
