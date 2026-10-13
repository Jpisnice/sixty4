import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { rarityBonus } from './rarity'

process.env.DATABASE_URL = `file:${join(tmpdir(), `sixty4-close-${process.pid}-${Date.now()}.db`)}`

describe('rarityBonus', () => {
  it('gives +25 at 10%, +50 at 1%, and never more than 50', () => {
    expect(rarityBonus(0.1)).toBe(25)
    expect(rarityBonus(0.01)).toBe(50)
    expect(rarityBonus(0.001)).toBe(50)
    expect(rarityBonus(1)).toBe(0)
  })
})

describe('closeDay', () => {
  it('writes every rarity bonus once', async () => {
    const { getDb } = await import('./db/client.server')
    const { answers, puzzles } = await import('./db/schema')
    const { getPuzzle } = await import('./puzzles.server')
    const { closeDay, closePastDays } = await import('./dayClose.server')
    const date = '2026-12-01'
    await getPuzzle(date)
    const db = await getDb()
    const row = (i: number, canonical: string, exact: boolean) => ({
      id: `id-${i}`,
      deviceId: `device-${i}`,
      date,
      steps: [],
      canonical,
      exact,
      points: exact ? 80 : 21,
      createdAt: new Date(),
    })
    await db.insert(answers).values([
      ...Array.from({ length: 9 }, (_, i) => row(i, 'common', true)),
      row(9, 'rare', true),
      row(10, 'near', false),
    ])

    await closePastDays('2026-12-02')
    const bonus = Object.fromEntries(
      (await db.select().from(answers)).map((a) => [a.id, a.rarityBonus]),
    )
    expect(bonus['id-0']).toBe(rarityBonus(0.9))
    expect(bonus['id-9']).toBe(25)
    expect(bonus['id-10']).toBe(0)

    const closed = await db.select().from(puzzles)
    expect(closed[0].closedAt).toBeInstanceOf(Date)
    expect(await closeDay(date)).toBe(false)
  })
})
