import type { MeBody } from '../game/puzzle'
import { deviceId, read, write } from './storage'
import type { History } from './storage'

/**
 * Fetches this phone's results from the server, at most once a day, and merges
 * them into local history. Restores the grid when storage was cleared.
 */
export async function syncHistory(today: string, yesterday: string): Promise<History | null> {
  if (read('me', '') === today) return null
  try {
    const res = await fetch(`/api/me?deviceId=${deviceId()}`)
    if (!res.ok) return null
    const body = (await res.json()) as MeBody
    const history = { ...read<History>('history', {}) }
    for (const [date, points, bonus] of body.days) {
      history[date] = { ...history[date], points, bonus }
    }
    if (body.yesterday) {
      const { points, bonus, same, players } = body.yesterday
      history[yesterday] = { points, bonus, same, players }
    }
    write('history', history)
    write('me', today)
    return history
  } catch {
    return null
  }
}
