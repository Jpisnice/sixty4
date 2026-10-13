// Checks the build output against the performance budgets.
// Usage: pnpm build && node scripts/check-budgets.mjs
// Starts the built Node server, fetches `/`, and measures what a first visit loads.
import { spawn } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const KB = 1024
const BUDGETS = {
  firstLoadJs: 130 * KB, // the bare Start skeleton is 108 KB gzip; this leaves room for the game
  gameJs: 15 * KB,
  inlineCss: 6 * KB, // raw bytes
  html: 8 * KB,
  htmlSoft: 4.5 * KB, // keeps a new-day repeat visit near 5 KB
  serviceWorker: 2 * KB, // raw, minified, without the injected asset list
}
// Strings that must never appear in browser code.
const SERVER_SENTINELS = ['drizzle', 'libsql', '__SOLVER__', 'better-sqlite', 'solutions']

const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const publicDir = join(root, '.output/public')
const gz = (buf) => gzipSync(buf, { level: 9 }).length
const fmt = (n) => `${(n / KB).toFixed(1)} KB`

const port = 4000 + Math.floor(Math.random() * 1000)
const server = spawn(process.execPath, [join(root, '.output/server/index.mjs')], {
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
})

let failed = false
const report = (name, value, limit, soft = false) => {
  const ok = value <= limit
  if (!ok && !soft) failed = true
  const mark = ok ? 'ok  ' : soft ? 'warn' : 'FAIL'
  console.log(`${mark} ${name.padEnd(28)} ${fmt(value).padStart(9)} / ${fmt(limit)}`)
}

try {
  const html = await fetchWhenReady(`http://localhost:${port}/`)

  const jsUrls = new Set(
    [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(
      (m) => m[1],
    ),
  )
  const entry = html.match(/<script type="module"[^>]+src="(\/assets\/[^"]+\.js)"/)?.[1]
  let total = 0
  let game = 0
  for (const url of jsUrls) {
    const size = gz(readFileSync(join(publicDir, url)))
    total += size
    if (url !== entry) game += size
  }
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].reduce(
    (n, m) => n + Buffer.byteLength(m[1]),
    0,
  )

  report('First-load JS (gzip)', total, BUDGETS.firstLoadJs)
  report('Game JS on top (gzip)', game, BUDGETS.gameJs)
  report('Inline CSS (raw)', css, BUDGETS.inlineCss)
  report('HTML (gzip)', gz(Buffer.from(html)), BUDGETS.html)
  report('HTML soft target (gzip)', gz(Buffer.from(html)), BUDGETS.htmlSoft, true)
  const sw = readFileSync(join(publicDir, 'sw.js'), 'utf8')
  const swList = sw.match(/\[[^\]]*\]/)?.[0].length ?? 0
  report('Service worker code (raw)', sw.length - swList, BUDGETS.serviceWorker)

  if (/<link[^>]+rel="stylesheet"/.test(html)) {
    failed = true
    console.log('FAIL CSS is linked, not inlined')
  }
  if (/fonts\.googleapis|<img\s/.test(html)) {
    failed = true
    console.log('FAIL web fonts or images found in the HTML')
  }

  const leaks = []
  for (const file of readdirSync(join(publicDir, 'assets'))) {
    if (!file.endsWith('.js')) continue
    const src = readFileSync(join(publicDir, 'assets', file), 'utf8')
    for (const s of SERVER_SENTINELS) if (src.includes(s)) leaks.push(`${file}: ${s}`)
  }
  if (leaks.length) {
    failed = true
    console.log(`FAIL server code in browser chunks:\n  ${leaks.join('\n  ')}`)
  } else {
    console.log('ok   no server code in browser chunks')
  }
} finally {
  server.kill()
}
process.exit(failed ? 1 : 0)

async function fetchWhenReady(url) {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.text()
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Server did not answer at ${url}`)
}
