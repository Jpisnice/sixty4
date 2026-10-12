import { createHash } from 'node:crypto'
import type { MeBody } from '../game/puzzle'
import { getClient } from './db/client.server'
import { closePastDays } from './dayClose.server'
import { json } from './http'
import { addDays, todayIST } from './ist'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/me?deviceId=: yesterday's result and the last 35 days of points. */
export async function handleMe(request: Request): Promise<Response> {
  const deviceId = new URL(request.url).searchParams.get('deviceId')?.toLowerCase() ?? ''
  if (!UUID.test(deviceId)) return json(400, { error: 'bad' })

  const today = todayIST()
  const yesterday = addDays(today, -1)
  await closePastDays(today)
  const client = await getClient()

  const rows = await client.execute({
    sql: `SELECT date, points, rarity_bonus AS bonus FROM answers
          WHERE device_id = ? AND date >= ? ORDER BY date`,
    args: [deviceId, addDays(today, -34)],
  })
  const body: MeBody = {
    yesterday: null,
    days: rows.rows.map((r) => [String(r.date), Number(r.points), Number(r.bonus ?? 0)]),
  }

  const y = await client.execute({
    sql: `SELECT a.points, a.rarity_bonus AS bonus, a.exact,
            (SELECT COUNT(*) FROM answers s WHERE s.date = a.date AND s.canonical = a.canonical) AS same,
            (SELECT COUNT(*) FROM answers p WHERE p.date = a.date) AS players
          FROM answers a WHERE a.device_id = ? AND a.date = ?`,
    args: [deviceId, yesterday],
  })
  const r = y.rows[0] as Record<string, unknown> | undefined
  if (r) {
    body.yesterday = {
      points: Number(r.points),
      bonus: Number(r.bonus ?? 0),
      exact: Number(r.exact) === 1,
      same: Number(r.same),
      players: Number(r.players),
    }
  }

  const text = JSON.stringify(body)
  const etag = `"${createHash('sha1').update(text).digest('base64url').slice(0, 16)}"`
  const headers = { etag, 'cache-control': 'private, no-cache' }
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers })
  }
  return json(200, body, headers)
}
