// Work that waits until the page is idle after first paint.

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
