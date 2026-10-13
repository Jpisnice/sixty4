import { setResponseHeader } from '@tanstack/react-start/server'
import type { TodayPuzzle } from '../game/puzzle'
import { secondsUntilMidnightIST, todayIST } from './ist'
import { getPuzzle, warmUp } from './puzzles.server'

export async function loadToday(): Promise<TodayPuzzle> {
  const date = todayIST()
  const p = await getPuzzle(date)
  warmUp(date)
  // The game page is the same for everyone until midnight India time.
  setResponseHeader(
    'Cache-Control',
    `public, max-age=0, s-maxage=${secondsUntilMidnightIST()}, stale-while-revalidate=60`,
  )
  return { date, number: p.number, tiles: p.tiles, target: p.target, waysTotal: p.waysTotal }
}
