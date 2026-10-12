import { useEffect, useMemo, useReducer, useState } from 'react'
import type { PointerEvent, MouseEvent } from 'react'
import { OPS, OP_SIGN, applySteps, calc, canSend, score } from '../game/rules'
import { S } from '../game/strings'
import type { TodayPuzzle } from '../game/puzzle'
import type { Op, Step } from '../game/rules'
import { Icon } from './icons'
import { ResultPanel } from './ResultPanel'
import { postAnswer } from './send'
import { deviceId, progressKey, read, sentKey, tidy, uuid, write } from './storage'
import type { History, Sent } from './storage'

interface State {
  steps: Array<Step>
  /** Selected slot, or -1. */
  sel: number
  op: Op | null
}

type Action =
  | { t: 'tile'; slot: number; tiles: ReadonlyArray<number> }
  | { t: 'op'; op: Op }
  | { t: 'undo' }
  | { t: 'reset' }
  | { t: 'load'; steps: Array<Step> }

const EMPTY: State = { steps: [], sel: -1, op: null }

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case 'tile': {
      const board = applySteps(a.tiles, s.steps)
      if (board.used.has(a.slot) || a.slot >= board.slots.length) return s
      if (s.sel === a.slot) return { ...s, sel: -1, op: null }
      if (s.sel < 0 || !s.op) return { ...s, sel: a.slot, op: null }
      if (!calc(board.slots[s.sel].v, s.op, board.slots[a.slot].v)) return s
      return { steps: [...s.steps, { a: s.sel, op: s.op, b: a.slot }], sel: -1, op: null }
    }
    case 'op':
      return s.sel < 0 ? s : { ...s, op: s.op === a.op ? null : a.op }
    case 'undo':
      return { steps: s.steps.slice(0, -1), sel: -1, op: null }
    case 'reset':
      return EMPTY
    case 'load':
      return { ...EMPTY, steps: a.steps }
  }
}

/** Acts on press for touch and mouse, and on click for keyboards. */
function press(fn: () => void) {
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button === 0) fn()
    },
    onClick: (e: MouseEvent) => {
      if (e.detail === 0) fn()
    },
  }
}

const isoDay = (date: string) => new Date(`${date}T00:00:00Z`)
const shiftDate = (date: string, days: number) =>
  new Date(isoDay(date).getTime() + days * 864e5).toISOString().slice(0, 10)

export function Game({ puzzle }: { puzzle: TodayPuzzle }) {
  const { tiles, target, date } = puzzle
  const [state, dispatch] = useReducer(reducer, EMPTY)
  const [sent, setSent] = useState<Sent | null>(null)
  const [history, setHistory] = useState<History>({})
  const [buzz, setBuzz] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [offline, setOffline] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const board = useMemo(() => applySteps(tiles, state.steps), [tiles, state.steps])
  const last = board.last

  // Personal data is read only after hydration, into space kept for it.
  useEffect(() => {
    tidy(date)
    const saved = read<Sent | null>(sentKey(date), null)
    dispatch({ t: 'load', steps: saved?.steps ?? read<Array<Step>>(progressKey(date), []) })
    setSent(saved)
    setPanelOpen(!!saved)
    setHistory(read<History>('history', {}))
    setBuzz(read('buzz', true))
    setLoaded(true)
  }, [date])

  // Never lose work: save after every step.
  useEffect(() => {
    if (loaded && !sent) write(progressKey(date), state.steps)
  }, [loaded, sent, date, state.steps])

  // Retry an answer that has not reached the server, now and when back online.
  useEffect(() => {
    if (!sent || sent.state !== 'local') return
    let stop = false
    const trySend = async () => {
      const out = await postAnswer({ id: sent.id, deviceId: deviceId(), date, steps: sent.steps })
      if (stop) return
      setOffline(out.kind === 'offline')
      if (out.kind === 'offline') return
      const next: Sent =
        out.kind === 'saved'
          ? { ...sent, points: out.result.points, exact: out.result.exact, waysTotal: out.result.waysTotal, state: 'saved' }
          : { ...sent, state: 'refused' }
      write(sentKey(date), next)
      setSent(next)
      if (out.kind === 'saved') record(out.result.points)
    }
    void trySend()
    window.addEventListener('online', trySend)
    return () => {
      stop = true
      window.removeEventListener('online', trySend)
    }
  }, [sent?.id, sent?.state])

  function record(points: number) {
    const next = { ...read<History>('history', {}) }
    next[date] = { ...next[date], points }
    for (const d of Object.keys(next)) if (d < shiftDate(date, -40)) delete next[d]
    write('history', next)
    setHistory(next)
  }

  function onSend() {
    if (!last || sent || !canSend(last, target)) return
    const sc = score(last, target)
    const ops = OPS.filter((_, i) => last.o & (1 << i))
      .map((o) => OP_SIGN[o])
      .join(' ')
    const next: Sent = {
      id: uuid(),
      date,
      steps: state.steps,
      points: sc.points,
      exact: sc.exact,
      tiles: sc.tiles,
      kinds: sc.kinds,
      distance: sc.distance,
      ops,
      waysTotal: puzzle.waysTotal,
      state: 'local',
    }
    write(sentKey(date), next)
    setSent(next)
    setPanelOpen(true)
    record(sc.points)
  }

  function tapTile(slot: number) {
    if (sent) return
    if (buzz && state.sel >= 0 && state.op && state.sel !== slot) {
      const x = board.slots[state.sel].v
      if (!board.used.has(slot) && calc(x, state.op, board.slots[slot].v)) 'vibrate' in navigator && navigator.vibrate(8)
    }
    dispatch({ t: 'tile', slot, tiles })
  }

  // Where each slot is drawn: a merged tile takes the place of the first tile.
  const where = [0, 1, 2, 3, 4, 5]
  state.steps.forEach((st, k) => {
    where[where.indexOf(st.a)] = 6 + k
  })

  const selected = state.sel >= 0 ? board.slots[state.sel] : null
  const free = board.slots.map((_, i) => i).filter((i) => !board.used.has(i))
  const opOk = (op: Op) =>
    !!selected && free.some((i) => i !== state.sel && calc(selected.v, op, board.slots[i].v) > 0)

  const distance = last ? Math.abs(last.v - target) : -1
  const sendable = !sent && canSend(last, target)
  const message = last?.w
    ? S.waste[last.w]
    : last && distance > 9 && state.steps.length >= 5
      ? S.tooFar
      : ''

  const thisWeek = daysThisWeek(history, date)
  const y = history[shiftDate(date, -1)]

  return (
    <main className="game" data-ready={loaded || undefined}>
      <header className="head">
        <h1>{S.title(puzzle.number)}</h1>
        <span className="muted">{loaded && thisWeek ? S.daysThisWeek(thisWeek) : ''}</span>
      </header>
      <p className="yday muted">
        {y?.bonus !== undefined && y.same !== undefined && y.players !== undefined
          ? S.yesterday(y.same, y.players, y.bonus)
          : ''}
      </p>

      <section className="target" aria-live="polite">
        <span className="label muted">{S.target}</span>
        <strong className="num">{target}</strong>
        <span className={distance === 0 ? 'close good' : 'close'}>
          {!last ? S.start : distance === 0 ? S.exact : S.away(distance)}
        </span>
      </section>

      <div className="tiles">
        {where.map((slot) => {
          const used = board.used.has(slot)
          const isSel = slot === state.sel
          const blocked =
            !used && !isSel && !!selected && !!state.op && !calc(selected.v, state.op, board.slots[slot].v)
          return (
            <Tile
              key={slot}
              value={board.slots[slot].v}
              merged={slot >= 6}
              used={used}
              selected={isSel}
              disabled={used || blocked || !!sent}
              onTap={() => tapTile(slot)}
            />
          )
        })}
      </div>

      <div className="ops">
        {OPS.map((op) => (
          <button
            key={op}
            type="button"
            className={state.op === op ? 'op on' : 'op'}
            aria-label={S.opName[op]}
            aria-pressed={state.op === op}
            disabled={!!sent || !opOk(op)}
            {...press(() => dispatch({ t: 'op', op }))}
          >
            {OP_SIGN[op]}
          </button>
        ))}
      </div>

      <ol className="steps" aria-label={S.steps}>
        {board.slots.slice(6).map((e, k) => {
          const st = state.steps[k]
          return (
            <li key={k} className="num">
              {board.slots[st.a].v} {OP_SIGN[st.op]} {board.slots[st.b].v} = {e.v}
            </li>
          )
        })}
      </ol>
      <p className="msg" role="status">
        {message}
      </p>

      <div className="bar">
        <button
          type="button"
          className="btn"
          disabled={!state.steps.length || !!sent}
          {...press(() => dispatch({ t: 'undo' }))}
        >
          <Icon name="undo" />
          {S.undo}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!state.steps.length || !!sent}
          {...press(() => dispatch({ t: 'reset' }))}
        >
          <Icon name="again" />
          {S.again}
        </button>
        {sent ? (
          <button type="button" className="btn main" {...press(() => setPanelOpen(true))}>
            <Icon name="check" />
            {S.points(sent.points)}
          </button>
        ) : (
          <button type="button" className="btn main" disabled={!sendable} onClick={onSend}>
            <Icon name="send" />
            {S.send}
          </button>
        )}
      </div>

      {sent && panelOpen && (
        <ResultPanel
          puzzle={puzzle}
          sent={sent}
          offline={offline}
          history={history}
          buzz={buzz}
          onBuzz={(on) => {
            setBuzz(on)
            write('buzz', on)
          }}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </main>
  )
}

function Tile(props: {
  value: number
  merged: boolean
  used: boolean
  selected: boolean
  disabled: boolean
  onTap: () => void
}) {
  const cls = ['tile', props.merged && 'new', props.used && 'used', props.selected && 'sel']
  return (
    <button
      type="button"
      className={cls.filter(Boolean).join(' ')}
      aria-label={S.tile(props.value)}
      aria-pressed={props.selected}
      disabled={props.disabled}
      {...press(props.onTap)}
    >
      {props.value}
    </button>
  )
}

/** Days played in the India week (Monday to Sunday) that holds `date`. */
function daysThisWeek(history: History, date: string) {
  const monday = shiftDate(date, -((isoDay(date).getUTCDay() + 6) % 7))
  return Object.keys(history).filter((d) => d >= monday && d <= date).length
}
