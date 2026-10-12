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

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (process.env.VERCEL) {
    console.warn(
      'DATABASE_URL is not set: using /tmp, which Vercel wipes. Set DATABASE_URL to a Turso database.',
    )
    return 'file:/tmp/sixty4.db'
  }
  return 'file:data/sixty4.db'
}

async function open() {
  const url = databaseUrl()
  if (url.startsWith('file:')) mkdirSync(dirname(url.slice(5)), { recursive: true })
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN })
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
  const files = Object.keys(migrations).sort()
  for (const file of files) {
    const name = file.slice(file.lastIndexOf('/') + 1)
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
