// The hidden debug menu, opened by a double tap on the title. Loaded only then.
// Practice puzzles stay on the phone and are never sent. "Reset today's puzzle" is the
// one thing that reaches the server: it asks it to forget this phone's answer for today.
import { useState } from 'react'
import { S } from '../game/strings'
import type { TodayPuzzle } from '../game/puzzle'
import { shift } from './history'
import { deviceId, progressKey, read, remove, sentKey, uuid, write } from './storage'
import type { History, Practice, Sent } from './storage'

const BIG = [25, 50, 75, 100]
const int = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(list: ReadonlyArray<T>) => list[int(list.length)]

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
  /** Today's answer is gone, here and on the server: start the real puzzle afresh. */
  onReset: () => void
  onHistory: (h: History) => void
  onClose: () => void
}) {
  const { real } = props
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const typed = Number(text)
  const valid = Number.isInteger(typed) && typed >= 1 && typed <= 999

  const start = (tiles: Array<number>, target: number, waysTotal: number) =>
    props.onPractice({ id: uuid(), date: real.date, tiles, target, waysTotal })

  function simulate(days: number) {
    const next = streakHistory(real.date, days)
    write('history', next)
    props.onHistory(next)
  }

  /** Replays today for real: the server forgets this phone's answer, then so does the phone. */
  async function resetToday() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/answer?deviceId=${deviceId()}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      // Nothing has changed yet, here or on the server.
      setBusy(false)
      setError(S.resetFailed)
      return
    }
    const date = real.date
    // An answer still waiting offline must not reach the server after the reset.
    const sent = read<Sent | null>(sentKey(date), null)
    if (sent) await import('./queue').then((q) => q.dequeue(sent.id))
    remove(progressKey(date))
    remove(sentKey(date))
    const history = { ...read<History>('history', {}) }
    delete history[date]
    write('history', history)
    props.onReset()
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
      <button type="button" className="btn" disabled={busy} onClick={() => void resetToday()}>
        {S.resetToday}
      </button>
      {error && (
        <p className="msg" role="alert">
          {error}
        </p>
      )}
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
