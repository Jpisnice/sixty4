import { applySteps, calc } from '../src/game/rules'
import type { Op, Step } from '../src/game/rules'

/** Finds a step list that makes the target exactly without waste (depth-first). */
export function findSteps(tiles: ReadonlyArray<number>, target: number): Array<Step> | null {
  const ops: Array<Op> = ['*', '+', '-', '/']
  const walk = (steps: Array<Step>): Array<Step> | null => {
    const board = applySteps(tiles, steps)
    if (board.last && !board.last.w && board.last.v === target) return steps
    if (board.last?.w || steps.length === 5) return null
    const free = board.slots.map((_, i) => i).filter((i) => !board.used.has(i))
    for (const a of free)
      for (const b of free)
        for (const op of ops) {
          if (a === b || !calc(board.slots[a].v, op, board.slots[b].v)) continue
          const found = walk([...steps, { a, op, b }])
          if (found) return found
        }
    return null
  }
  return walk([])
}
