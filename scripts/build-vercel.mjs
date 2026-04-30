// Adapt the TanStack Start Vite build (dist/) into Vercel's Build Output API v3
// (.vercel/output/). Run after `vite build`.
//
// Vercel's Build Output API does NOT auto-trace dependencies for functions
// with launcherType: "Nodejs" — we use @vercel/nft to trace from the SSR
// entry and copy only the files actually imported into the function bundle.
//
// Layout produced:
//   .vercel/output/
//   ├─ config.json
//   ├─ static/                     ← contents of dist/client (CDN)
//   └─ functions/_ssr.func/
//      ├─ .vc-config.json
//      ├─ index.mjs                ← Node ↔ Web Fetch bridge
//      ├─ server/                  ← copied dist/server (the SSR bundle)
//      └─ <traced node_modules + relative deps preserved at original paths>

import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { nodeFileTrace } from '@vercel/nft'

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

// 2) SSR function dir
await mkdir(fn, { recursive: true })
await cp(path.join(dist, 'server'), path.join(fn, 'server'), { recursive: true })

// 3) Trace dependencies from the SSR entry (in its original dist/ location)
//    and copy node_modules deps into the function bundle. At runtime, when
//    <fn>/server/server.js imports 'react', Node walks up the dir tree and
//    finds <fn>/node_modules/react.
console.log('Tracing SSR dependencies with @vercel/nft…')
const entry = path.join(root, 'dist', 'server', 'server.js')
const trace = await nodeFileTrace([entry], {
  base: root,
  processCwd: root,
})

if (trace.warnings.size > 0) {
  for (const w of trace.warnings) console.warn('nft warning:', w.message ?? w)
}

let copied = 0
for (const file of trace.fileList) {
  // Skip files we've already placed in the function dir.
  if (file.startsWith('dist/')) continue
  if (file.startsWith('.vercel/')) continue
  const src = path.join(root, file)
  if (!existsSync(src)) continue
  const dest = path.join(fn, file)
  await mkdir(path.dirname(dest), { recursive: true })
  await cp(src, dest, { recursive: true, dereference: true })
  copied++
}
console.log(`Copied ${copied} traced dependency file(s) into the function bundle`)

// 4) Vercel function config
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

// 5) Function entry — bridges Vercel's Node (req, res) to TanStack Start's
//    Web Fetch handler. Dynamic import so module-load errors surface in the
//    response instead of crashing silently.
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

// 6) Routing — serve static files first, fall through to SSR for everything else
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
