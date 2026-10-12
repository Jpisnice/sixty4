// The offline answer queue, shared with the service worker (see src/sw/sw.js).
import type { AnswerBody } from './send'

function store(mode: IDBTransactionMode) {
  return new Promise<IDBObjectStore>((ok, fail) => {
    const req = indexedDB.open('mtn', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { keyPath: 'id' })
    req.onsuccess = () => ok(req.result.transaction('queue', mode).objectStore('queue'))
    req.onerror = () => fail(req.error)
  })
}

function done(req: IDBRequest) {
  return new Promise<void>((ok, fail) => {
    req.onsuccess = () => ok()
    req.onerror = () => fail(req.error)
  })
}

interface SyncRegistration extends ServiceWorkerRegistration {
  sync?: { register: (tag: string) => Promise<void> }
}

/** Queues an answer and asks the browser to send it when it is online. */
export async function enqueue(body: AnswerBody) {
  try {
    await done((await store('readwrite')).put(body))
    if (!('serviceWorker' in navigator)) return
    const reg = (await navigator.serviceWorker.ready) as SyncRegistration
    await reg.sync?.register('answers')
  } catch {}
}

export async function dequeue(id: string) {
  try {
    await done((await store('readwrite')).delete(id))
  } catch {}
}
