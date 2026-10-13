import { describe, expect, it } from 'vitest'
import { FULL_FROM, makePuzzle, rampFor } from './makePuzzle.server'
import { LAUNCH_DATE, addDays } from './ist'

const november = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)

describe('makePuzzle at full difficulty', () => {
  const puzzles = november.map((d) => makePuzzle(d, FULL_FROM + 100))

  it('makes a valid puzzle every day of November 2026 in at most 4 draws', () => {
    for (const p of puzzles) {
      expect(p.tiles).toHaveLength(6)
      const big = p.tiles.filter((t) => t > 10)
      expect(big.length === 1 || big.length === 2).toBe(true)
      expect(big.every((t) => [25, 50, 75, 100].includes(t))).toBe(true)
      expect(p.target).toBeGreaterThanOrEqual(101)
      expect(p.target).toBeLessThanOrEqual(999)
      expect(p.solutions.length).toBeGreaterThanOrEqual(10)
      expect(p.solutions.length).toBeLessThanOrEqual(300)
      expect(p.solutions.every((s) => s.tiles > 2)).toBe(true)
      expect(p.draws).toBeLessThanOrEqual(4)
    }
  })

  it('has a median of about 21 ways', () => {
    const ways = puzzles.map((p) => p.solutions.length).sort((a, b) => a - b)
    const median = (ways[14] + ways[15]) / 2
    console.log('ways', ways.join(' '), 'draws', puzzles.map((p) => p.draws).join(''))
    expect(median).toBeGreaterThanOrEqual(12)
    expect(median).toBeLessThanOrEqual(35)
  })

  it('gives the same puzzle for the same date', () => {
    const a = makePuzzle('2026-11-07')
    const b = makePuzzle('2026-11-07')
    expect(b).toEqual(a)
    expect(makePuzzle('2026-11-08')).not.toEqual(a)
  })
})

describe('the first 30 days ramp up', () => {
  it('starts at two-digit targets and reaches 101 to 999 by puzzle #30', () => {
    expect(rampFor(1)).toEqual({ minTarget: 20, maxTarget: 99, minWays: 40 })
    expect(rampFor(FULL_FROM)).toEqual({ minTarget: 101, maxTarget: 999, minWays: 10 })
    expect(rampFor(FULL_FROM + 200)).toEqual(rampFor(FULL_FROM))
    for (let n = 2; n <= FULL_FROM; n++) {
      expect(rampFor(n).maxTarget).toBeGreaterThanOrEqual(rampFor(n - 1).maxTarget)
      expect(rampFor(n).minWays).toBeLessThanOrEqual(rampFor(n - 1).minWays)
    }
  })

  const first = Array.from({ length: FULL_FROM }, (_, i) => makePuzzle(addDays(LAUNCH_DATE, i), i + 1))

  it('keeps every early puzzle inside its ramp', () => {
    first.forEach((p, i) => {
      const r = rampFor(i + 1)
      expect(p.target).toBeGreaterThanOrEqual(r.minTarget)
      expect(p.target).toBeLessThanOrEqual(r.maxTarget)
      expect(p.solutions.length).toBeGreaterThanOrEqual(r.minWays)
      expect(p.solutions.length).toBeLessThanOrEqual(300)
      expect(p.solutions.every((s) => s.tiles > 2)).toBe(true)
    })
    console.log('targets', first.map((p) => p.target).join(' '))
    console.log('ways', first.map((p) => p.solutions.length).join(' '))
    console.log('draws', first.map((p) => p.draws).join(' '))
  })

  it('gets harder week by week', () => {
    const mean = (from: number, to: number) =>
      first.slice(from, to).reduce((s, p) => s + p.target, 0) / (to - from)
    expect(mean(0, 7)).toBeLessThan(100)
    expect(mean(0, 7)).toBeLessThan(mean(7, 14))
    expect(mean(7, 14)).toBeLessThan(mean(21, 30))
  })
})
