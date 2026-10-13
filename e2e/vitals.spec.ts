import { createClient } from '@libsql/client'
import { expect, test } from '@playwright/test'

test('sends field Web Vitals with sendBeacon', async ({ page }) => {
  // Opt this visit into the sample.
  await page.addInitScript(() => localStorage.setItem('mtn:vitals', '"all"'))
  const beacon = page.waitForRequest((r) => r.url().endsWith('/api/vitals'))
  const chunk = page.waitForResponse((r) => /\/assets\/vitals-[^/]+\.js$/.test(r.url()))
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  // Vitals start at idle time, so wait until they are listening rather than for a fixed
  // time: on a slow CI machine the chunk can take well over half a second to arrive.
  await chunk
  await page.evaluate(() => new Promise<void>((done) => requestIdleCallback(() => done())))
  // An input finalises LCP, which is sent at once. Wait for it before doing anything else:
  // leaving the page straight away can beat the beacon on a slow machine.
  await page.locator('.tiles button').first().click()
  const body = JSON.parse((await beacon).postData() ?? '{}') as { name: string; rating: string }
  expect(body.name).toBe('LCP')

  const db = createClient({ url: 'file:data/e2e.db' })
  await expect
    .poll(async () => (await db.execute('SELECT name FROM vitals')).rows.map((r) => r.name))
    .toContain('LCP')
  db.close()
})
