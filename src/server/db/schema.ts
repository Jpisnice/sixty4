import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { Step } from '../../game/rules'
import type { Solution } from '../solve.server'

export const puzzles = sqliteTable('puzzles', {
  /** India date, YYYY-MM-DD. */
  date: text('date').primaryKey(),
  number: integer('number').notNull().unique(),
  tiles: text('tiles', { mode: 'json' }).$type<Array<number>>().notNull(),
  target: integer('target').notNull(),
  solutions: text('solutions', { mode: 'json' }).$type<Array<Solution>>().notNull(),
  waysTotal: integer('ways_total').notNull(),
  /** Set once the day is closed and rarity bonuses are written. */
  closedAt: integer('closed_at', { mode: 'timestamp_ms' }),
})

export const answers = sqliteTable(
  'answers',
  {
    /** UUID made on the phone, so retries are safe. */
    id: text('id').primaryKey(),
    deviceId: text('device_id').notNull(),
    date: text('date').notNull(),
    steps: text('steps', { mode: 'json' }).$type<Array<Step>>().notNull(),
    canonical: text('canonical').notNull(),
    exact: integer('exact', { mode: 'boolean' }).notNull(),
    points: integer('points').notNull(),
    rarityBonus: integer('rarity_bonus'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    uniqueIndex('answers_device_date').on(t.deviceId, t.date),
    index('answers_date_canonical').on(t.date, t.canonical),
  ],
)

export const devices = sqliteTable(
  'devices',
  {
    deviceId: text('device_id').primaryKey(),
    reminderSlot: text('reminder_slot'),
    pushSubscription: text('push_subscription', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('devices_reminder_slot').on(t.reminderSlot)],
)

export const vitals = sqliteTable(
  'vitals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    value: real('value').notNull(),
    rating: text('rating').notNull(),
    /** The element behind the value, from the web-vitals attribution build. */
    target: text('target'),
    date: text('date').notNull(),
  },
  (t) => [index('vitals_date').on(t.date)],
)
