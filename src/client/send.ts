import type { Step } from '../game/rules'

export interface AnswerBody {
  id: string
  deviceId: string
  date: string
  steps: Array<Step>
}

/** What the server says about an answer. */
export interface ServerResult {
  points: number
  exact: boolean
  waysTotal: number
}

export type Outcome =
  | { kind: 'saved'; result: ServerResult }
  | { kind: 'refused'; error: string }
  | { kind: 'offline' }

/** Posts an answer. Safe to repeat: the server keys answers by their id. */
export async function postAnswer(body: AnswerBody): Promise<Outcome> {
  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
    // 409: this phone already sent a different answer today; the stored one counts.
    if (res.ok || res.status === 409) return { kind: 'saved', result: await res.json() }
    if (res.status >= 500 || res.status === 429) return { kind: 'offline' }
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { kind: 'refused', error: data.error ?? 'refused' }
  } catch {
    return { kind: 'offline' }
  }
}
