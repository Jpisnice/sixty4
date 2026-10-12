// Make the Number service worker. Kept small on purpose; the build injects
// the hashed asset list and a version.
const V = '__VERSION__'
const ASSETS = __ASSETS__
const STATIC = 'static-' + V
const PAGES = 'pages'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
      for (const k of await caches.keys()) if (k !== STATIC && k !== PAGES) await caches.delete(k)
      await self.clients.claim()
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
    const res = (await e.preloadResponse) || (await fetch(e.request))
    if (res.ok) await cache.put(key, res.clone())
    return res
  })()
  try {
    return await Promise.race([net, new Promise((_, no) => setTimeout(no, 2000))])
  } catch {
    const hit = await cache.match(key)
    if (!hit) return net
    e.waitUntil(net.catch(() => {}))
    return hit
  }
}

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
    for (const c of await self.clients.matchAll())
      c.postMessage({ type: 'answer', id: body.id, status: res.status, data })
  }
}
