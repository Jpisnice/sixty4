import { solve } from './solve.server'
import type { Solution } from './solve.server'

export interface MadePuzzle {
  date: string
  tiles: Array<number>
  target: number
  solutions: Array<Solution>
  /** How many draws it took to find a good puzzle. */
  draws: number
}

const BIG = [25, 50, 75, 100]
const MAX_DRAWS = 50

/**
 * Makes the puzzle for an India date (YYYY-MM-DD). The same date always gives
 * the same puzzle. A draw is kept when it has 10 to 300 different ways and
 * none that uses only 2 tiles; otherwise the next draw comes from the same seed.
 */
export function makePuzzle(date: string): MadePuzzle {
  const rand = mulberry32(cyrb53(date))
  const int = (n: number) => Math.floor(rand() * n)
  for (let draws = 1; draws <= MAX_DRAWS; draws++) {
    const bigCount = rand() < 0.5 ? 1 : 2
    const big = shuffle(BIG.slice(), int).slice(0, bigCount)
    const small = Array.from({ length: 6 - bigCount }, () => 1 + int(10))
    const tiles = shuffle([...big, ...small], int)
    const target = 101 + int(899)
    const solutions = solve(tiles, target)
    const ok =
      solutions.length >= 10 &&
      solutions.length <= 300 &&
      solutions.every((s) => s.tiles > 2)
    if (ok) return { date, tiles, target, solutions, draws }
  }
  throw new Error(`No good puzzle for ${date} in ${MAX_DRAWS} draws`)
}

function shuffle<T>(list: Array<T>, int: (n: number) => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = int(i + 1)
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** A fast 53-bit string hash; the low 32 bits seed the generator. */
function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0) * 4294967296 + (h1 >>> 0)
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
