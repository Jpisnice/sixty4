import { createClient } from '@libsql/client'
import { expect, test } from '@playwright/test'

test('sends field Web Vitals with sendBeacon', async ({ page }) => {
  // Opt this visit into the sample.
  await page.addInitScript(() => localStorage.setItem('mtn:vitals', '"all"'))
  const beacon = page.waitForRequest((r) => r.url().endsWith('/api/vitals'))
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  await page.waitForTimeout(500)
  // An input finalises LCP; leaving the page sends what is left.
  await page.locator('.tiles button').first().click()
  await page.goto('about:blank')
  const body = JSON.parse((await beacon).postData() ?? '{}') as { name: string; rating: string }
  expect(['LCP', 'INP', 'CLS']).toContain(body.name)

  const db = createClient({ url: 'file:data/e2e.db' })
  await expect
    .poll(async () => (await db.execute('SELECT name FROM vitals')).rows.map((r) => r.name))
    .toContain('LCP')
  db.close()
})
