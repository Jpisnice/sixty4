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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Make the Number #')
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
