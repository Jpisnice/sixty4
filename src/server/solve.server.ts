// Server only: the solution list is the answer key and must never reach the browser.
import { combine, kindsCount, leaf } from '../game/rules'
import type { Expr } from '../game/rules'

/** Marker the budget check looks for in browser chunks. */
export const SOLVER_MARK = '__SOLVER__'

export interface Solution {
  /** Standard form. */
  c: string
  /** Points before the rarity bonus. */
  points: number
  /** Tiles needed. */
  tiles: number
}

/**
 * Lists every different non-wasted way to reach the target. Dynamic
 * programming over tile subsets, keeping one expression per standard form.
 */
export function solve(tiles: ReadonlyArray<number>, target: number, cap = 20_000) {
  const size = 1 << tiles.length
  const table: Array<Map<string, Expr>> = []
  for (let i = 0; i < tiles.length; i++) {
    const e = leaf(tiles[i])
    table[1 << i] = new Map([[e.c, e]])
  }

  const masks = Array.from({ length: size - 1 }, (_, i) => i + 1).sort(
    (a, b) => popcount(a) - popcount(b),
  )
  for (const m of masks) {
    if (table[m]) continue
    const out = new Map<string, Expr>()
    const add = (e: Expr | null) => {
      if (e && e.v <= cap && !e.w && !out.has(e.c)) out.set(e.c, e)
    }
    const low = m & -m
    for (let s = (m - 1) & m; s > 0; s = (s - 1) & m) {
      if (!(s & low)) continue
      const left = table[s]
      const right = table[m ^ s]
      for (const x of left.values()) {
        for (const y of right.values()) {
          add(combine(x, '+', y))
          add(combine(x, '*', y))
          if (x.v > y.v) add(combine(x, '-', y))
          else if (y.v > x.v) add(combine(y, '-', x))
          if (x.v % y.v === 0) add(combine(x, '/', y))
          if (y.v % x.v === 0 && x.v !== y.v) add(combine(y, '/', x))
        }
      }
    }
    table[m] = out
  }

  const found = new Map<string, Solution>()
  for (let m = 1; m < size; m++) {
    for (const e of table[m].values()) {
      if (e.v !== target || found.has(e.c)) continue
      found.set(e.c, { c: e.c, points: 10 * e.t + 10 * kindsCount(e.o), tiles: e.t })
    }
  }
  return [...found.values()]
}

function popcount(n: number) {
  let c = 0
  for (; n; n &= n - 1) c++
  return c
}
