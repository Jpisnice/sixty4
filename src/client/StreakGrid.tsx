import { mondayOf, shift } from './history'
import type { History } from './storage'

/**
 * Days as small marigold cells: a week per row, Monday to Sunday, with this
 * week at the bottom. Brighter cells scored more; empty cells fade with age.
 */
export function StreakGrid(props: { history: History; date: string; weeks: number }) {
  const { history, date, weeks } = props
  const monday = mondayOf(date)
  const cells = []
  for (let w = weeks - 1; w >= 0; w--) {
    for (let col = 0; col < 7; col++) {
      const day = shift(monday, col - 7 * w)
      const h = day <= date ? history[day] : undefined
      cells.push(
        h ? (
          <i key={day} className="on" style={{ opacity: 0.3 + 0.7 * (Math.min(h.points, 100) / 100) }} />
        ) : day === date ? (
          <i key={day} className="now" />
        ) : (
          <i key={day} style={{ opacity: 1 - (0.6 * w) / weeks }} />
        ),
      )
    }
  }
  return (
    <div className="sgrid" aria-hidden="true">
      {cells}
    </div>
  )
}
