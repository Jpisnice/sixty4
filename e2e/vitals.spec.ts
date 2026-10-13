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

test('starts vitals once, even when practice mode remounts the game', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mtn:vitals', '"all"'))
  const beacons: Array<string> = []
  page.on('request', (r) => r.url().endsWith('/api/vitals') && beacons.push(r.postData() ?? ''))
  const chunk = page.waitForResponse((r) => /\/assets\/vitals-[^/]+\.js$/.test(r.url()))
  // Move the pointer off whatever it last clicked: a button that vanishes under a resting
  // pointer keeps headless Chrome drawing frames, and idle callbacks then never run.
  const idle = async () => {
    await page.mouse.move(0, 0)
    await page.evaluate(() => new Promise<void>((done) => requestIdleCallback(() => done())))
  }
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  await chunk
  await idle()

  // Into practice and back: two remounts, each running the idle work again.
  const menu = page.getByRole('dialog', { name: 'Debug' })
  await page.getByRole('heading', { level: 1 }).dblclick()
  await menu.getByRole('button', { name: 'New tiles' }).click()
  await expect(page.locator('.yday')).toHaveText('Practice')
  await idle()
  await page.getByRole('heading', { level: 1 }).dblclick()
  await menu.getByRole('button', { name: 'Back to the real puzzle' }).click()
  await expect(page.locator('.yday')).not.toHaveText('Practice')
  await idle()

  await page.locator('.tiles button').first().click()
  await expect.poll(() => beacons.length).toBeGreaterThan(0)
  await page.waitForTimeout(500)
  expect(beacons.filter((b) => b.includes('"LCP"'))).toHaveLength(1)
})
