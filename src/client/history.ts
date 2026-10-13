// Reading this phone's history for the streak line and grid in the result panel.
import type { History } from './storage'

export const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10)

/** The Monday that starts the India week holding `date`. */
export const mondayOf = (date: string) =>
  shift(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7))

/** Days played in a row, up to today, or up to yesterday while today is open. */
export function streak(history: History, date: string) {
  let day = history[date] ? date : shift(date, -1)
  let n = 0
  while (history[day]) {
    n++
    day = shift(day, -1)
  }
  return n
}
