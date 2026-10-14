import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { findSteps } from './findSteps'
import type { Step } from '../src/game/rules'

const OP_NAME = { '+': 'Add', '-': 'Take away', '*': 'Multiply', '/': 'Divide' } as const

async function readPuzzle(page: Page) {
  await page.goto('/')
  const tiles = (await page.locator('.tiles button').allTextContents()).map(Number)
  const target = Number(await page.locator('.target strong').textContent())
  // Wait for hydration: the page reads saved steps after it.
  await page.locator('main[data-ready]').waitFor()
  return { tiles, target }
}

/** Plays steps by tapping, tracking where each slot is drawn. */
async function play(page: Page, steps: Array<Step>, done: Array<Step> = []) {
  const where = [0, 1, 2, 3, 4, 5]
  done.forEach((s, k) => (where[where.indexOf(s.a)] = 6 + k))
  for (const [k, s] of steps.entries()) {
    const tiles = page.locator('.tiles button')
    await tiles.nth(where.indexOf(s.a)).click()
    await page.getByRole('button', { name: OP_NAME[s.op] }).click()
    await tiles.nth(where.indexOf(s.b)).click()
    where[where.indexOf(s.a)] = 6 + done.length + k
  }
}

test('plays a full day: open, solve, send, share, reopen', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  // Force the copy fallback for Share.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined })
  })

  const { tiles, target } = await readPuzzle(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sixty4')
  const steps = findSteps(tiles, target)
  expect(steps).not.toBeNull()

  // Part way, then reload: the steps come back.
  await play(page, steps!.slice(0, 2))
  await expect(page.locator('.steps li')).toHaveCount(2)
  await page.reload()
  await page.locator('main[data-ready]').waitFor()
  await expect(page.locator('.steps li')).toHaveCount(2)

  await play(page, steps!.slice(2), steps!.slice(0, 2))
  await expect(page.locator('.target .close')).toHaveText('Exact!')

  await page.getByRole('button', { name: 'Send' }).click()
  const panel = page.getByRole('dialog')
  await expect(panel).toContainText('points')
  await expect(panel).toContainText(/You found 1 of \d+ ways/)
  await expect(panel.getByText('Saved')).toBeVisible()

  await panel.getByRole('button', { name: 'Share' }).click()
  await expect(panel.getByRole('button', { name: 'Copied' })).toBeVisible()
  const shared = await page.evaluate(() => navigator.clipboard.readText())
  expect(shared).toMatch(/^Sixty4: I made [\d,]+ for \d+ points\. .+\r?\nhttp:\/\/[^/]+\/$/)

  await page.reload()
  await expect(page.getByRole('dialog').getByText('Saved')).toBeVisible()
  await expect(page.getByRole('button', { name: /points/ }).first()).toBeVisible()
})

test('sends while offline, then saves when back online', async ({ page, context }) => {
  const { tiles, target } = await readPuzzle(page)
  const steps = findSteps(tiles, target)!
  await play(page, steps)

  await context.setOffline(true)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Will send when you are online')).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByRole('dialog').getByText('Saved')).toBeVisible()
})

test('refuses a hand-made padded answer', async ({ request, page }) => {
  const { tiles } = await readPuzzle(page)
  const date = await page.evaluate(() =>
    Object.keys(localStorage).find((k) => k.startsWith('mtn:steps:'))?.slice(10),
  )
  // Find a 1 from two tiles, then multiply some tile by it.
  let one: Step | null = null
  for (let a = 0; a < 6 && !one; a++)
    for (let b = 0; b < 6 && !one; b++)
      if (a !== b && tiles[a] - tiles[b] === 1) one = { a, op: '-', b }
  test.skip(!one, 'No two tiles differ by 1 today')
  const other = [0, 1, 2, 3, 4, 5].find((i) => i !== one!.a && i !== one!.b)!
  const res = await request.post('/api/answer', {
    data: {
      id: crypto.randomUUID(),
      deviceId: crypto.randomUUID(),
      date,
      steps: [one, { a: other, op: '*', b: 6 }],
    },
  })
  expect(res.status()).toBe(422)
  expect(await res.json()).toEqual({ error: 'wasted' })
})

for (const width of [320, 360, 412]) {
  test(`fits ${width} px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
    // Every control sits on screen without scrolling at 640 px tall.
    const send = await page.getByRole('button', { name: 'Send' }).boundingBox()
    expect(send!.y + send!.height).toBeLessThanOrEqual(640)
  })
}

test("a phone clock ahead of the server's shows the link, without reloading", async ({ page }) => {
  // The phone's clock says tomorrow, but the server's date has not moved on.
  await page.clock.setSystemTime(Date.now() + 864e5)
  let loads = 0
  let asks = 0
  page.on('load', () => loads++)
  page.on('response', (r) => {
    if (r.request().headers().pragma === 'no-cache') asks++
  })
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  const link = page.locator('.yday').getByRole('link', { name: 'This day is over. A new number is ready.' })
  await expect(link).toHaveAttribute('href', '/')

  // It asks for a new page each time it is shown, and the server's date keeps it from reloading.
  await expect.poll(() => asks).toBe(1)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect.poll(() => asks).toBe(2)
  await page.waitForTimeout(300)
  expect(loads).toBe(1)
})

test('a page left open overnight reloads for the new day when it is shown again', async ({ page }) => {
  let loads = 0
  page.on('load', () => loads++)
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  await expect(page.locator('.yday a')).toHaveCount(0)

  // Midnight passes while the phone is locked. The server can't be moved to tomorrow, so the
  // first new page it sends says tomorrow in its Date header; later ones say today again.
  const tomorrow = Date.now() + 864e5
  await page.clock.setSystemTime(tomorrow)
  let asks = 0
  await page.route('/', async (route) => {
    const res = await route.fetch()
    const headers = res.headers()
    if (route.request().headers().pragma === 'no-cache' && ++asks === 1) {
      headers.date = new Date(tomorrow).toUTCString()
    }
    await route.fulfill({ response: res, headers })
  })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect.poll(() => loads).toBe(2)

  // After the reload the server's date is today again, so the page stops and shows the link.
  await page.locator('main[data-ready]').waitFor()
  await expect.poll(() => asks).toBe(2)
  await expect(page.locator('.yday a')).toHaveAttribute('href', '/')
  await page.waitForTimeout(300)
  expect(loads).toBe(2)
})

test('points a new player to How it works, until they have seen it', async ({ page }) => {
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  const hint = page.getByRole('link', { name: 'How to play' })
  await expect(hint).toHaveText('How to play →')

  // A tap on the text, not the icon, opens it. Back doesn't bring the hint back.
  await hint.click({ position: { x: 20, y: 20 } })
  await expect(page).toHaveURL(/\/how-it-works$/)
  await page.goBack()
  await expect(page.getByRole('link', { name: 'How it works' })).toBeVisible()
  await expect(hint).toHaveCount(0)
})

test('opening How it works any other way also counts', async ({ page }) => {
  await page.goto('/how-it-works')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mtn:how'))).toBe('true')
  await page.goto('/')
  await page.locator('main[data-ready]').waitFor()
  await expect(page.getByRole('link', { name: 'How it works' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'How to play' })).toHaveCount(0)
})
