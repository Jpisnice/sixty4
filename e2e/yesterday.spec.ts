import { createClient } from '@libsql/client'
import { expect, test } from '@playwright/test'

test('restores yesterday and the grid from the server after storage is cleared', async ({ page }) => {
  // Learn today's India date from the page itself.
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  const today = await page.evaluate(
    () => Object.keys(localStorage).find((k) => k.startsWith('mtn:steps:'))!.slice(10),
  )
  const number = Number(
    (await page.getByRole('heading', { level: 1 }).textContent())!.replace(/\D+/g, ''),
  )
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 864e5).toISOString().slice(0, 10)

  // Yesterday: 3 players, 2 found the same way as this phone, 1 found a rare way.
  const me = crypto.randomUUID()
  const db = createClient({ url: 'file:data/e2e.db' })
  await db.execute({
    sql: `INSERT OR IGNORE INTO puzzles (date, number, tiles, target, solutions, ways_total)
          VALUES (?, ?, '[1,2,3,4,5,100]', 500, '[]', 12)`,
    args: [yesterday, number - 1],
  })
  const answer = (id: string, device: string, canonical: string) =>
    db.execute({
      sql: `INSERT INTO answers (id, device_id, date, steps, canonical, exact, points, created_at)
            VALUES (?, ?, ?, '[]', ?, 1, 80, ?)`,
      args: [id, device, yesterday, canonical, Date.now()],
    })
  await answer(crypto.randomUUID(), me, 'common')
  await answer(crypto.randomUUID(), crypto.randomUUID(), 'common')
  await answer(crypto.randomUUID(), crypto.randomUUID(), 'rare')
  db.close()

  // A phone whose storage was cleared, apart from its ID.
  await page.evaluate((id) => {
    localStorage.clear()
    localStorage.setItem('mtn:device', JSON.stringify(id))
  }, me)
  await page.reload()

  // 2 of 3 exact solvers found this way: p = 2/3, bonus = round(25 × log10(1.5)) = 4.
  await expect(page.locator('.yday')).toHaveText('Yesterday: 2 of 3 players found your way, +4')
  await expect(page.locator('.head span')).toHaveText(/^(Days this week: 1)?$/)
})
