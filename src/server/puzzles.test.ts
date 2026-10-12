import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type * as Puzzles from './puzzles.server'

process.env.DATABASE_URL = `file:${join(tmpdir(), `sixty4-test-${process.pid}-${Date.now()}.db`)}`

const days = Array.from({ length: 7 }, (_, i) => `2026-12-0${i + 1}`)

describe('getPuzzle', () => {
  let mod: typeof Puzzles
  beforeAll(async () => {
    mod = await import('./puzzles.server')
  })

  it('makes and stores 7 days, and gives the same rows when run again', async () => {
    const first = await Promise.all(days.map((d) => mod.getPuzzle(d)))
    for (const d of days) mod.forgetPuzzle(d)
    const again = await Promise.all(days.map((d) => mod.getPuzzle(d)))
    expect(again).toEqual(first)
    expect(new Set(first.map((p) => p.number)).size).toBe(7)
    for (const p of first) expect(p.waysTotal).toBe(p.solutions.length)
  })

  it('makes a date only once when asked many times at once', async () => {
    const rows = await Promise.all(Array.from({ length: 5 }, () => mod.getPuzzle('2026-12-24')))
    expect(new Set(rows).size).toBe(1)
  })
})
