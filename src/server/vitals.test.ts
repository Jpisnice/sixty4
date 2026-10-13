import { describe, expect, it } from 'vitest'
import { handleVitals } from './vitals.server'

const post = (body: string) =>
  handleVitals(new Request('http://localhost/api/vitals', { method: 'POST', body }))

describe('POST /api/vitals', () => {
  it('refuses bodies that are not a JSON object', async () => {
    for (const body of ['not json', 'null', '1', '"LCP"', 'true']) {
      const res = await post(body)
      expect(res.status, body).toBe(400)
      expect(await res.json()).toEqual({ error: 'bad' })
    }
  })

  it('refuses a metric it does not know', async () => {
    const res = await post(JSON.stringify({ name: 'FID', value: 1, rating: 'good' }))
    expect(res.status).toBe(400)
  })
})
