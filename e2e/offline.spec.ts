import { request as httpRequest } from 'node:http'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Opens the game and waits until the service worker controls the page. */
async function openControlled(page: Page) {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r))
    }
  })
  // Load once under the worker so it saves the page.
  await page.reload()
  await page.locator('main[data-ready]').waitFor()
}

/** Bytes on the wire (headers and compressed body) for a GET, as a browser would ask. */
function wireSize(url: string) {
  return new Promise<number>((resolve, reject) => {
    const req = httpRequest(url, { headers: { 'accept-encoding': 'br, gzip' } }, (res) => {
      let bytes = Object.entries(res.headers).join('\r\n').length + 20
      res.on('data', (chunk: Buffer) => (bytes += chunk.length))
      res.on('end', () => resolve(bytes))
    })
    req.on('error', reject)
    req.end()
  })
}

test('opens offline from the service worker, with work kept', async ({ page, context }) => {
  await openControlled(page)
  const tiles = page.locator('.tiles button')
  await tiles.nth(0).click()
  await page.getByRole('button', { name: 'Add' }).click()
  await tiles.nth(1).click()
  await expect(page.locator('.steps li')).toHaveCount(1)

  await context.setOffline(true)
  await page.reload()
  await page.locator('main[data-ready]').waitFor()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sixty4')
  await expect(page.locator('.steps li')).toHaveCount(1)
  await context.setOffline(false)
})

test('a repeat visit transfers 5 KB or less', async ({ page, baseURL }) => {
  await openControlled(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  const fromWorker = new Set<string>()
  const network: Array<string> = []
  let pageBytes = 0
  cdp.on('Network.responseReceived', (e) => {
    if (e.response.fromServiceWorker) fromWorker.add(e.requestId)
    else network.push(e.response.url)
  })
  cdp.on('Network.loadingFinished', (e) => {
    if (!fromWorker.has(e.requestId)) pageBytes += e.encodedDataLength
  })
  await page.reload()
  await page.locator('main[data-ready]').waitFor()
  await page.waitForLoadState('networkidle')

  // Scripts come from the worker's cache; only the page itself goes to the network,
  // fetched by the worker through navigation preload.
  expect(network).toEqual([])
  const html = await wireSize(`${baseURL}/`)
  console.log(`page ${pageBytes} B, HTML on the wire ${html} B`)
  expect(pageBytes + html).toBeLessThanOrEqual(5 * 1024)
})

test("a page the CDN made before midnight is fetched again for today's", async ({ page, context }) => {
  await openControlled(page)
  // Playwright can't route a navigation preload, so the worker fetches the page itself.
  await page.evaluate(async () => (await navigator.serviceWorker.ready).navigationPreload.disable())
  // The first answer is the CDN's copy made yesterday and kept a day (Age), as it is served
  // once after midnight. It is marked so the test can tell it apart.
  const asked: Array<string> = []
  let marked = false
  await context.route('/', async (route) => {
    const pragma = (await route.request().headerValue('pragma')) ?? ''
    asked.push(pragma)
    const res = await route.fetch()
    if (pragma) return route.fulfill({ response: res })
    const body = (await res.text()).replace('<title>Sixty4</title>', '<title>Old</title>')
    marked = body.includes('<title>Old</title>')
    // The body is sent uncompressed now.
    const headers = res.headers()
    delete headers['content-encoding']
    delete headers['content-length']
    headers.date = new Date(Date.now() - 864e5).toUTCString()
    headers.age = '86400'
    await route.fulfill({ response: res, body, headers })
  })
  await page.reload()
  await page.locator('main[data-ready]').waitFor()

  // The worker asked again with pragma: no-cache, which makes the CDN build today's page,
  // then served and saved that page rather than the old copy.
  expect(marked).toBe(true)
  expect(asked).toEqual(['', 'no-cache'])
  await expect(page).toHaveTitle('Sixty4')
  const saved = await page.evaluate(async () => (await (await caches.open('pages')).match('/'))?.text())
  expect(saved).toContain('<title>Sixty4</title>')
})
