import { describe, expect, it } from 'vitest'
import { makePuzzle } from './makePuzzle.server'

const november = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)

describe('makePuzzle', () => {
  const puzzles = november.map(makePuzzle)

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
