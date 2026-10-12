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

export function start(opts: {
  onInstallable: (e: InstallPrompt) => void
  onAnswer: (msg: SwAnswer) => void
}) {
  // Field Web Vitals from a 25% sample; the rest never load the library.
  if (Math.random() < 0.25 || read<string>('vitals', '') === 'all') {
    void import('./vitals').then((m) => m.startVitals())
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    opts.onInstallable(e as InstallPrompt)
  })
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent<{ type?: string }>) => {
      if (e.data.type === 'answer') opts.onAnswer(e.data as SwAnswer)
    })
  }
}
