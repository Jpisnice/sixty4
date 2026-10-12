import { eq } from 'drizzle-orm'
import { getDb } from './db/client.server'
import { puzzles } from './db/schema'
import { addDays, puzzleNumber } from './ist'

export type PuzzleRow = typeof puzzles.$inferSelect

const cache = new Map<string, PuzzleRow>()
const inflight = new Map<string, Promise<PuzzleRow>>()

/**
 * Gets the puzzle for an India date: from memory, then the database, then by
 * making it. Making is deterministic and the insert ignores conflicts, so a
 * second process making the same day at once is harmless.
 */
export function getPuzzle(date: string): Promise<PuzzleRow> {
  const hit = cache.get(date)
  if (hit) return Promise.resolve(hit)
  let pending = inflight.get(date)
  if (!pending) {
    pending = load(date).finally(() => inflight.delete(date))
    inflight.set(date, pending)
  }
  return pending
}

async function load(date: string) {
  const db = await getDb()
  const find = () => db.select().from(puzzles).where(eq(puzzles.date, date)).get()
  let row = await find()
  if (!row) {
    const { makePuzzleOffThread } = await import('./solverWorker.server')
    const made = await makePuzzleOffThread(date)
    await db
      .insert(puzzles)
      .values({
        date,
        number: puzzleNumber(date),
        tiles: made.tiles,
        target: made.target,
        solutions: made.solutions,
        waysTotal: made.solutions.length,
      })
      .onConflictDoNothing()
    row = await find()
    if (!row) throw new Error(`Puzzle for ${date} was not saved`)
  }
  cache.set(date, row)
  // Keep a few days: yesterday, today, tomorrow.
  for (const key of cache.keys()) if (cache.size > 4) cache.delete(key)
  return row
}

/** Forgets cached rows, e.g. after the day close changes them. */
export function forgetPuzzle(date: string) {
  cache.delete(date)
}

let warmedFor = ''

/** On the first request of each India day, makes tomorrow's puzzle in the background. */
export function warmUp(today: string) {
  if (warmedFor === today) return
  warmedFor = today
  getPuzzle(addDays(today, 1)).catch((err) => console.error('Warming tomorrow failed', err))
}
