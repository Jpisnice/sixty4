// The hidden debug menu, opened by a double tap on the title. Loaded only then.
// Everything here stays on the phone: practice answers are never sent.
import { useState } from 'react'
import { S } from '../game/strings'
import type { TodayPuzzle } from '../game/puzzle'
import { read, remove, uuid, write } from './storage'
import type { History, Practice } from './storage'

const BIG = [25, 50, 75, 100]
const int = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(list: ReadonlyArray<T>) => list[int(list.length)]
const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10)

/** Random tiles with the same mix as the daily puzzle: 1 or 2 big, the rest 1 to 10. */
function dealTiles() {
  const big = BIG.slice().sort(() => Math.random() - 0.5).slice(0, 1 + int(2))
  const small = Array.from({ length: 6 - big.length }, () => 1 + int(10))
  return [...big, ...small].sort(() => Math.random() - 0.5)
}

/** Points a real day could give: mostly exact answers, some near ones. */
function dayPoints() {
  return Math.random() < 0.8 ? 10 * (3 + int(4)) + 10 * (1 + int(4)) : 3 * (9 - int(9))
}

/** History with a played streak of `days` days ending yesterday. Today is kept. */
function streakHistory(date: string, days: number): History {
  const today = read<History>('history', {})[date]
  const next: History = today ? { [date]: today } : {}
  for (let i = 1; i <= days; i++) next[shift(date, -i)] = { points: dayPoints() }
  // Yesterday's line needs the rarity numbers too.
  const bonus = pick([0, 25, 50])
  const players = 50 + int(450)
  const share = bonus === 50 ? 0.005 : bonus === 25 ? 0.05 : 0.2 + Math.random() / 5
  next[shift(date, -1)] = {
    points: 40 + 10 * int(7),
    bonus,
    players,
    same: Math.max(1, Math.round(players * share)),
  }
  return next
}

export default function Debug(props: {
  real: TodayPuzzle
  practice: boolean
  onPractice: (p: Practice | null) => void
  onHistory: (h: History) => void
  onClose: () => void
}) {
  const { real } = props
  const [text, setText] = useState('')
  const typed = Number(text)
  const valid = Number.isInteger(typed) && typed >= 1 && typed <= 999

  const start = (tiles: Array<number>, target: number, waysTotal: number) =>
    props.onPractice({ id: uuid(), date: real.date, tiles, target, waysTotal })

  function simulate(days: number) {
    const next = streakHistory(real.date, days)
    write('history', next)
    props.onHistory(next)
  }

  function clearHistory() {
    remove('history')
    // Lets the next visit restore the real days from the server.
    remove('me')
    props.onHistory({})
  }

  return (
    <section className="panel debug" role="dialog" aria-modal="false" aria-labelledby="debug-title">
      <div className="panel-top">
        <h2 id="debug-title">{S.debug}</h2>
        <button type="button" className="btn small" onClick={props.onClose}>
          {S.close}
        </button>
      </div>

      <label className="label" htmlFor="debug-target">
        {S.debugTarget}
      </label>
      <div className="debug-row">
        <input
          id="debug-target"
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          placeholder={String(real.target)}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          disabled={!valid}
          onClick={() => start(real.tiles, typed, typed === real.target ? real.waysTotal : 0)}
        >
          {S.playTarget}
        </button>
      </div>
      <button
        type="button"
        className="btn"
        onClick={() => start(dealTiles(), valid ? typed : 101 + int(899), 0)}
      >
        {S.newTiles}
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => start(real.tiles, real.target, real.waysTotal)}
      >
        {S.resetToday}
      </button>
      {props.practice && (
        <button type="button" className="btn" onClick={() => props.onPractice(null)}>
          {S.realPuzzle}
        </button>
      )}

      <p className="label">{S.simulateLabel}</p>
      <div className="debug-row">
        {[10, 20, 30].map((n) => (
          <button key={n} type="button" className="btn" onClick={() => simulate(n)}>
            {S.simulate(n)}
          </button>
        ))}
      </div>
      <button type="button" className="btn" onClick={clearHistory}>
        {S.clearHistory}
      </button>
    </section>
  )
}
