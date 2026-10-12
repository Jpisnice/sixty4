/** Today's puzzle as the page gets it. It never includes the solutions. */
export interface TodayPuzzle {
  date: string
  number: number
  tiles: Array<number>
  target: number
  waysTotal: number
}
