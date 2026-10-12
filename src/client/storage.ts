// Everything personal lives on the phone. Every access is guarded: storage can
// be missing, full or blocked.
import type { Step } from '../game/rules'

const P = 'mtn:'

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(P + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(P + key, JSON.stringify(value))
  } catch {}
}

export function remove(key: string) {
  try {
    localStorage.removeItem(P + key)
  } catch {}
}

export function deviceId(): string {
  let id = read<string>('device', '')
  if (!id) {
    id = uuid()
    write('device', id)
  }
  return id
}

export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** The answer sent today, with the result shown to the player. */
export interface Sent {
  id: string
  date: string
  steps: Array<Step>
  points: number
  exact: boolean
  tiles: number
  kinds: number
  distance: number
  ops: string
  waysTotal: number
  /** 'saved' once the server has it; 'refused' if it was turned down. */
  state: 'local' | 'saved' | 'refused'
}

/** Points per India date, kept for the 5-week grid. */
export type History = Partial<
  Record<string, { points: number; bonus?: number; same?: number; players?: number }>
>

export const progressKey = (date: string) => `steps:${date}`
export const sentKey = (date: string) => `sent:${date}`

/** Drops in-progress steps and sent answers from past days. */
export function tidy(today: string) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i) ?? ''
      const m = /^mtn:(?:steps|sent):(\d{4}-\d{2}-\d{2})$/.exec(key)
      if (m && m[1] < today) localStorage.removeItem(key)
    }
  } catch {}
}
