import { describe, expect, it } from 'vitest'
import { solve } from './solve.server'

describe('solve', () => {
  it('finds the 21 standard forms of the 612 puzzle', () => {
    const ways = solve([3, 2, 100, 10, 2, 7], 612)
    expect(ways).toHaveLength(21)
    const byPoints: Record<number, number> = {}
    for (const w of ways) byPoints[w.points] = (byPoints[w.points] ?? 0) + 1
    expect(byPoints).toEqual({ 60: 1, 70: 1, 80: 5, 90: 10, 100: 4 })
  })
})
