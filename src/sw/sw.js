// Sixty4 service worker. Kept small on purpose; the build injects
// the hashed asset list and a version.
const ASSETS = __ASSETS__.map((f) => '/assets/' + f)
// The version is written into the name: a separate top-level const would stay in the minified file.
const STATIC = 'static-__VERSION__'
const PAGES = 'pages'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(ASSETS)).then(() => skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      await registration.navigationPreload?.enable()
      for (const k of await caches.keys()) if (k !== STATIC && k !== PAGES) await caches.delete(k)
      await clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (e) => {
  const r = e.request
  const url = new URL(r.url)
  if (r.method !== 'GET' || url.origin !== location.origin) return
  if (r.mode === 'navigate') e.respondWith(page(e, url.pathname))
  else if (url.pathname.startsWith('/assets/'))
    e.respondWith(caches.match(r).then((hit) => hit || fetch(r)))
})

// Pages: network first with a 2 s limit, then the saved copy.
async function page(e, key) {
  const cache = await caches.open(PAGES)
  const net = (async () => {
    let res = (await e.preloadResponse) || (await fetch(e.request))
    // Once a page's cache time ends at India midnight, the CDN still serves its old copy to
    // the next visitor while it makes a new one. That copy has yesterday's puzzle: ask the
    // CDN to make today's now (pragma: no-cache) and wait for it.
    if (old(res))
      res = await fetch(key, { headers: { pragma: 'no-cache' }, cache: 'no-store' }).then(
        (fresh) => (fresh.ok ? fresh : res),
        () => res,
      )
    // Saving must not hold the page back, and an old copy must not replace a good one.
    if (res.ok && !old(res)) e.waitUntil(cache.put(key, res.clone()))
    return res
  })()
  try {
    return await Promise.race([net, new Promise((_, no) => setTimeout(no, 2000))])
  } catch {
    const hit = await cache.match(key)
    if (!hit) return net
    // A copy from an earlier India day has yesterday's puzzle: on a slow network,
    // wait for today's page, and use the old copy only if the network fails.
    if (day(made(hit)) !== day()) return net.catch(() => hit)
    e.waitUntil(net.catch(() => {}))
    return hit
  }
}

// When a response was made, from its Date header. A CDN keeps that on its copies and adds Age.
const made = (res) => Date.parse(res.headers.get('date'))
// The India day (UTC+5:30) of a time, or of now.
const day = (t = Date.now()) => Math.floor((t + 198e5) / 864e5)
// A CDN copy made on an earlier India day than the one it is served on. Only the server's
// and the CDN's clocks count, so a wrong phone clock can't set this off.
const old = (res, t = made(res)) => day(t) < day(t + res.headers.get('age') * 1e3)

// Answers sent while offline wait in IndexedDB until the phone is online.
self.addEventListener('sync', (e) => {
  if (e.tag === 'answers') e.waitUntil(flush())
})

function store(mode) {
  return new Promise((ok, fail) => {
    const req = indexedDB.open('mtn', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'id' })
    req.onsuccess = () => ok(req.result.transaction('queue', mode).objectStore('queue'))
    req.onerror = () => fail(req.error)
  })
}

const done = (req) => new Promise((ok, fail) => ((req.onsuccess = () => ok(req.result)), (req.onerror = fail)))

async function flush() {
  const items = await done((await store('readonly')).getAll())
  for (const body of items) {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    // Server busy: throw so the browser tries the sync again later.
    if (res.status >= 500 || res.status === 429) throw new Error('retry')
    const data = await res.json().catch(() => ({}))
    await done((await store('readwrite')).delete(body.id))
    for (const c of await clients.matchAll())
      c.postMessage({ type: 'answer', id: body.id, status: res.status, data })
  }
}
