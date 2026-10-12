// India date helpers. The day runs midnight to midnight India time (UTC+5:30),
// and only the server decides what day it is.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Puzzle #1 is played on this date. */
export const LAUNCH_DATE = process.env.LAUNCH_DATE ?? '2026-10-12'

/** Today's India date as YYYY-MM-DD. */
export function todayIST(now = Date.now()) {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

export function puzzleNumber(date: string) {
  return daysBetween(LAUNCH_DATE, date) + 1
}

/** Seconds until the next midnight in India, at least 1. */
export function secondsUntilMidnightIST(now = Date.now()) {
  const msIntoDay = (now + IST_OFFSET_MS) % DAY_MS
  return Math.max(1, Math.ceil((DAY_MS - msIntoDay) / 1000))
}
