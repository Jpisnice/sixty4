import { and, eq } from 'drizzle-orm'
import { OPS, applySteps, score } from '../game/rules'
import type { Op, Step } from '../game/rules'
import { getDb } from './db/client.server'
import { answers, devices } from './db/schema'
import { clientIp, json } from './http'
import { todayIST } from './ist'
import { getPuzzle, warmUp } from './puzzles.server'
import { perDevice, perDeviceReset, perIp } from './rateLimit.server'

interface AnswerBody {
  id: string
  deviceId: string
  date: string
  steps: Array<Step>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const isSlot = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 11

/** Hand-written check of the request body. Returns null when it is malformed. */
export function parseAnswer(body: unknown): AnswerBody | null {
  if (!body || typeof body !== 'object') return null
  const { id, deviceId, date, steps } = body as Record<string, unknown>
  if (typeof id !== 'string' || !UUID.test(id)) return null
  if (typeof deviceId !== 'string' || !UUID.test(deviceId)) return null
  if (typeof date !== 'string' || !DATE.test(date)) return null
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 5) return null
  const clean: Array<Step> = []
  for (const s of steps) {
    if (!s || typeof s !== 'object') return null
    const { a, op, b } = s as Record<string, unknown>
    if (!isSlot(a) || !isSlot(b) || !OPS.includes(op as Op)) return null
    clean.push({ a, op: op as Op, b })
  }
  return { id: id.toLowerCase(), deviceId: deviceId.toLowerCase(), date, steps: clean }
}

/** POST /api/answer: replays the steps with the shared rules and saves the answer once. */
export async function handleAnswer(request: Request): Promise<Response> {
  const answer = parseAnswer(await request.json().catch(() => null))
  if (!answer) return json(400, { error: 'bad' })
  if (!perDevice.take(answer.deviceId) || !perIp.take(clientIp(request))) {
    return json(429, { error: 'limit' })
  }

  const today = todayIST()
  if (answer.date !== today) return json(422, { error: 'day' })
  const puzzle = await getPuzzle(today)
  warmUp(today)

  const db = await getDb()
  const stored = () =>
    db
      .select()
      .from(answers)
      .where(and(eq(answers.deviceId, answer.deviceId), eq(answers.date, today)))
      .get()
  const reply = (row: typeof answers.$inferSelect) =>
    json(row.id === answer.id ? 200 : 409, {
      points: row.points,
      exact: row.exact,
      waysTotal: puzzle.waysTotal,
    })

  // One answer per phone per day: a retry gets the same reply, a new answer is refused.
  const before = await stored()
  if (before) return reply(before)

  const board = applySteps(puzzle.tiles, answer.steps)
  if (board.error || !board.last) return json(422, { error: 'step' })
  if (board.last.w) return json(422, { error: 'wasted' })
  const s = score(board.last, puzzle.target)
  if (s.distance > 9) return json(422, { error: 'far' })

  const now = new Date()
  await db
    .insert(answers)
    .values({
      id: answer.id,
      deviceId: answer.deviceId,
      date: today,
      steps: answer.steps,
      canonical: board.last.c,
      exact: s.exact,
      points: s.points,
      createdAt: now,
    })
    .onConflictDoNothing()
  await db.insert(devices).values({ deviceId: answer.deviceId, createdAt: now }).onConflictDoNothing()

  const after = await stored()
  // The id was already used by another phone.
  if (!after) return json(409, { error: 'id' })
  return reply(after)
}

/**
 * DELETE /api/answer?deviceId=: forgets this phone's answer for today, so the debug
 * menu can replay the day for real. Only today: past days are never touched.
 */
export async function handleReset(request: Request): Promise<Response> {
  const deviceId = new URL(request.url).searchParams.get('deviceId')?.toLowerCase() ?? ''
  if (!UUID.test(deviceId)) return json(400, { error: 'bad' })
  if (!perDeviceReset.take(deviceId) || !perIp.take(clientIp(request))) {
    return json(429, { error: 'limit' })
  }
  const db = await getDb()
  const gone = await db
    .delete(answers)
    .where(and(eq(answers.deviceId, deviceId), eq(answers.date, todayIST())))
    .returning({ id: answers.id })
  return json(200, { deleted: gone.length })
}
