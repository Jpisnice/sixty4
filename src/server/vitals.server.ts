import { getDb } from './db/client.server'
import { vitals } from './db/schema'
import { clientIp, json } from './http'
import { todayIST } from './ist'
import { TokenBucket } from './rateLimit.server'

const NAMES = new Set(['LCP', 'INP', 'CLS'])
const RATINGS = new Set(['good', 'needs-improvement', 'poor'])
const perIp = new TokenBucket(200, 24 * 60 * 60 * 1000)

/** POST /api/vitals: one field metric from sendBeacon. */
export async function handleVitals(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = JSON.parse(await request.text())
  } catch {
    return json(400, { error: 'bad' })
  }
  // Valid JSON can still be null, a number or a string.
  if (!body || typeof body !== 'object') return json(400, { error: 'bad' })
  const { name, value, rating, target } = body as Record<string, unknown>
  const ok =
    typeof name === 'string' &&
    NAMES.has(name) &&
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    typeof rating === 'string' &&
    RATINGS.has(rating) &&
    (target === undefined || (typeof target === 'string' && target.length <= 100))
  if (!ok) return json(400, { error: 'bad' })
  if (!perIp.take(clientIp(request))) return new Response(null, { status: 429 })
  const db = await getDb()
  await db.insert(vitals).values({ name, value, rating, target: target ?? null, date: todayIST() })
  return new Response(null, { status: 204 })
}
