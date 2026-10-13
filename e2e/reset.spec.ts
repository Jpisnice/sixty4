import { createClient } from '@libsql/client'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { findSteps } from './findSteps'

const OP_NAME = { '+': 'Add', '-': 'Take away', '*': 'Multiply', '/': 'Divide' } as const

/** Solves today's puzzle by tapping, and sends it. */
async function playAndSend(page: Page) {
  const tiles = (await page.locator('.tiles button').allTextContents()).map(Number)
  const target = Number(await page.locator('.target strong').textContent())
  const where = [0, 1, 2, 3, 4, 5]
  for (const [k, s] of findSteps(tiles, target)!.entries()) {
    await page.locator('.tiles button').nth(where.indexOf(s.a)).click()
    await page.getByRole('button', { name: OP_NAME[s.op] }).click()
    await page.locator('.tiles button').nth(where.indexOf(s.b)).click()
    where[where.indexOf(s.a)] = 6 + k
  }
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByRole('dialog').getByText('Saved')).toBeVisible()
}

/** Today's date and this phone's saved answer, from storage. */
const saved = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^mtn:sent:\d{4}-\d{2}-\d{2}$/.test(k))
    return {
      date: key?.slice(9) ?? '',
      id: key ? (JSON.parse(localStorage.getItem(key)!) as { id: string }).id : '',
      device: JSON.parse(localStorage.getItem('mtn:device') ?? '""') as string,
      history: JSON.parse(localStorage.getItem('mtn:history') ?? '{}') as Record<string, unknown>,
    }
  })

test('reset replays today for real: the server takes a new answer', async ({ page }) => {
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  await playAndSend(page)
  const first = await saved(page)
  expect(first.history[first.date]).toBeTruthy()

  await page.getByRole('heading', { level: 1 }).dblclick()
  await page.getByRole('dialog', { name: 'Debug' }).getByRole('button', { name: "Reset today's puzzle" }).click()

  // A fresh real game: empty board, no result, not practice, today gone from history.
  await expect(page.locator('.steps li')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.yday')).not.toHaveText('Practice')
  const cleared = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mtn:sent:')))
  expect(cleared).toEqual([])
  expect((await saved(page)).history[first.date]).toBeUndefined()

  // Sent again, the server saves it (200), rather than returning the old answer (409).
  await playAndSend(page)
  const second = await saved(page)
  expect(second.id).not.toBe(first.id)
  const db = createClient({ url: 'file:data/e2e.db' })
  const rows = await db.execute({
    sql: 'SELECT id FROM answers WHERE device_id = ? AND date = ?',
    args: [second.device, second.date],
  })
  db.close()
  expect(rows.rows.map((r) => r.id)).toEqual([second.id])
})

test('a reset that cannot reach the server changes nothing', async ({ page }) => {
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  await playAndSend(page)
  const before = await saved(page)

  await page.route('**/api/answer**', (route) =>
    route.request().method() === 'DELETE' ? route.abort() : route.continue(),
  )
  await page.getByRole('heading', { level: 1 }).dblclick()
  const menu = page.getByRole('dialog', { name: 'Debug' })
  await menu.getByRole('button', { name: "Reset today's puzzle" }).click()
  await expect(menu.getByRole('alert')).toHaveText("Couldn't reach the server. Try again when online.")
  expect(await saved(page)).toEqual(before)
})
