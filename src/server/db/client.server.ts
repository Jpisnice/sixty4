import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@libsql/client'
import type { Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

// Migrations are bundled into the server build, so they run wherever the
// server runs (Node, Vercel) without shipping the drizzle/ folder.
const migrations = import.meta.glob<string>('../../../drizzle/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export type Db = ReturnType<typeof drizzle<typeof schema>>

let ready: Promise<{ db: Db; client: Client }> | undefined

export async function getDb() {
  ready ??= open()
  return (await ready).db
}

/** The raw client, for transactions that need SQL the query builder lacks. */
export async function getClient() {
  ready ??= open()
  return (await ready).client
}

// DATABASE_URL and DATABASE_AUTH_TOKEN win when set. Otherwise use the names
// the Vercel Turso integration adds.
function databaseUrl() {
  const url = process.env.DATABASE_URL || process.env.DATABASE_TURSO_DATABASE_URL
  if (url) return url
  if (process.env.VERCEL) {
    console.warn(
      'No database URL is set: using /tmp, which Vercel wipes. Add the Turso integration or set DATABASE_URL.',
    )
    return 'file:/tmp/sixty4.db'
  }
  return 'file:data/sixty4.db'
}

async function open() {
  const url = databaseUrl()
  if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true })
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.DATABASE_TURSO_AUTH_TOKEN
  const client = createClient({ url, authToken })
  if (url.startsWith('file:')) {
    await client.execute('PRAGMA journal_mode = WAL')
    await client.execute('PRAGMA busy_timeout = 5000')
  }
  await migrate(client)
  return { db: drizzle(client, { schema }), client }
}

async function migrate(client: Client) {
  await client.execute(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  )
  // One read first, so a cold start against a remote database opens no write
  // transaction when every migration is in. The check inside the transaction
  // still guards two servers starting at once.
  const rows = await client.execute('SELECT name FROM _migrations')
  const applied = new Set(rows.rows.map((r) => String(r.name)))
  const files = Object.keys(migrations).sort()
  for (const file of files) {
    const name = file.slice(file.lastIndexOf('/') + 1)
    if (applied.has(name)) continue
    const tx = await client.transaction('write')
    try {
      const done = await tx.execute({ sql: 'SELECT 1 FROM _migrations WHERE name = ?', args: [name] })
      if (!done.rows.length) {
        for (const sql of migrations[file].split('--> statement-breakpoint')) {
          if (sql.trim()) await tx.execute(sql)
        }
        await tx.execute({
          sql: 'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)',
          args: [name, Date.now()],
        })
      }
      await tx.commit()
    } finally {
      tx.close()
    }
  }
}
