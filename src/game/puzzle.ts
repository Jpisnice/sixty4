/** Today's puzzle as the page gets it. It never includes the solutions. */
export interface TodayPuzzle {
  date: string
  number: number
  tiles: Array<number>
  target: number
  waysTotal: number
}

/** GET /api/me: what the page needs to redraw a phone's history. */
export interface MeBody {
  yesterday: { points: number; bonus: number; exact: boolean; same: number; players: number } | null
  /** [date, points, bonus] for the last 35 days played. */
  days: Array<[string, number, number]>
}
