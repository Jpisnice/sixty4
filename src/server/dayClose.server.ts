import { getClient } from './db/client.server'
import { forgetPuzzle } from './puzzles.server'
import { rarityBonus } from './rarity'

/**
 * Closes every past day that is still open: counts exact answers by standard
 * form and writes each answer's rarity bonus. One write transaction per day,
 * and the open-day check inside it makes the close run once.
 */
export async function closePastDays(today: string) {
  const client = await getClient()
  const open = await client.execute({
    sql: 'SELECT date FROM puzzles WHERE closed_at IS NULL AND date < ? ORDER BY date',
    args: [today],
  })
  for (const row of open.rows) await closeDay(String(row.date))
}

export async function closeDay(date: string) {
  const client = await getClient()
  const tx = await client.transaction('write')
  try {
    const puzzle = await tx.execute({
      sql: 'SELECT 1 FROM puzzles WHERE date = ? AND closed_at IS NULL',
      args: [date],
    })
    if (!puzzle.rows.length) return false

    const counts = await tx.execute({
      sql: 'SELECT canonical, COUNT(*) AS n FROM answers WHERE date = ? AND exact = 1 GROUP BY canonical',
      args: [date],
    })
    const total = counts.rows.reduce((s, r) => s + Number(r.n), 0)
    if (total) {
      const args: Array<string | number> = []
      for (const r of counts.rows) args.push(String(r.canonical), rarityBonus(Number(r.n) / total))
      await tx.execute({
        sql: `UPDATE answers SET rarity_bonus = CASE canonical ${counts.rows
          .map(() => 'WHEN ? THEN ?')
          .join(' ')} ELSE 0 END WHERE date = ? AND exact = 1`,
        args: [...args, date],
      })
    }
    await tx.execute({
      sql: 'UPDATE answers SET rarity_bonus = 0 WHERE date = ? AND exact = 0',
      args: [date],
    })
    await tx.execute({
      sql: 'UPDATE puzzles SET closed_at = ? WHERE date = ? AND closed_at IS NULL',
      args: [Date.now(), date],
    })
    await tx.commit()
    forgetPuzzle(date)
    return true
  } finally {
    tx.close()
  }
}
