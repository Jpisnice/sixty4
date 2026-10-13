import { expect, test } from '@playwright/test'

test('debug menu: custom target, streak, back to the real puzzle', async ({ page }) => {
  const answers: Array<string> = []
  page.on('request', (r) => r.url().includes('/api/answer') && answers.push(r.url()))

  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  const real = await page.locator('.target strong').textContent()
  const tiles = (await page.locator('.tiles button').allTextContents()).map(Number)

  // Hidden behind a double tap on the title.
  await page.getByRole('heading', { level: 1 }).dblclick()
  const menu = page.getByRole('dialog', { name: 'Debug' })
  await expect(menu).toBeVisible()

  await menu.getByRole('button', { name: '30 days' }).click()
  const target = tiles[0] + tiles[1]
  await menu.getByLabel('Target to make').fill(String(target))
  await menu.getByRole('button', { name: 'Play this target' }).click()
  await expect(page.locator('.target strong')).toHaveText(String(target))
  await expect(page.locator('.yday')).toHaveText('Practice')

  const t = page.locator('.tiles button')
  await t.nth(0).click()
  await page.getByRole('button', { name: 'Add' }).click()
  await t.nth(1).click()
  await expect(page.locator('.target .close')).toHaveText('Exact!')
  await page.getByRole('button', { name: 'Send' }).click()

  const panel = page.getByRole('dialog').filter({ hasText: 'points' })
  await expect(panel).toContainText('Practice, not sent')
  await expect(panel).toContainText('30-day streak')
  await expect(panel).not.toContainText('You found')
  await expect(panel.locator('.sgrid .on')).toHaveCount(30)
  await expect(panel.locator('.sgrid')).toHaveAttribute('aria-hidden', 'true')
  expect(answers).toEqual([])

  await panel.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('heading', { level: 1 }).dblclick()
  await menu.getByRole('button', { name: 'Back to the real puzzle' }).click()
  await expect(page.locator('.target strong')).toHaveText(real!)
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible()

  await page.getByRole('link', { name: 'How it works' }).click()
  await expect(page).toHaveURL(/\/how-it-works$/)
})
