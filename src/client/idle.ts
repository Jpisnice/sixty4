// Work that waits until the page is idle after first paint.
import { read } from './storage'

export interface InstallPrompt extends Event {
  prompt: () => Promise<void>
}

export interface SwAnswer {
  type: 'answer'
  id: string
  status: number
  data: { points?: number; exact?: boolean; waysTotal?: number; error?: string }
}

interface Handlers {
  onInstallable: (e: InstallPrompt) => void
  onAnswer: (msg: SwAnswer) => void
}

/** The mounted game screen's handlers. Null until the first start. */
let current: Handlers | null = null

/**
 * Starts the idle work once per page load. The game screen remounts when practice
 * mode starts or ends, so later calls only swap in the new screen's handlers.
 */
export function start(opts: Handlers) {
  const first = !current
  current = opts
  if (!first) return
  // Field Web Vitals from a 25% sample; the rest never load the library.
  if (Math.random() < 0.25 || read<string>('vitals', '') === 'all') {
    void import('./vitals').then((m) => m.startVitals())
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    current?.onInstallable(e as InstallPrompt)
  })
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent<{ type?: string }>) => {
      if (e.data.type === 'answer') current?.onAnswer(e.data as SwAnswer)
    })
  }
}
