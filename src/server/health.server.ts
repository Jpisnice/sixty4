import { getClient } from './db/client.server'
import { json } from './http'

/** GET /api/health: answers when the database does. */
export async function healthCheck() {
  try {
    await (await getClient()).execute('SELECT 1')
    return json(200, { ok: true })
  } catch {
    return json(503, { ok: false })
  }
}
