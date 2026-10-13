import { Suspense, lazy, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { PointerEvent, MouseEvent } from 'react'
import { OPS, OP_SIGN, applySteps, calc, canSend, score } from '../game/rules'
import { S } from '../game/strings'
import type { TodayPuzzle } from '../game/puzzle'
import type { Op, Step } from '../game/rules'
import { indiaToday } from './history'
import { Icon } from './icons'
import { ResultPanel } from './ResultPanel'
import { postAnswer } from './send'
import type { Outcome, ServerResult } from './send'
import type { InstallPrompt } from './idle'
import { deviceId, practiceDay, progressKey, read, sentKey, tidy, uuid, write } from './storage'
import type { History, Practice, Sent } from './storage'

const Debug = lazy(() => import('./Debug'))

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

export function Game(props: {
  puzzle: TodayPuzzle
  /** Today's real puzzle, for the debug menu. */
  real: TodayPuzzle
  /** A debug puzzle: scored on the phone, never sent. */
  practice: boolean
  onPractice: (p: Practice | null) => void
  /** Today was reset from the debug menu: start the real puzzle afresh. */
  onReset: () => void
}) {
  const { puzzle, practice } = props
  const { tiles, target, date } = puzzle
  // Where this game's steps and answer are kept.
  const day = practice ? practiceDay(date) : date
  const [state, dispatch] = useReducer(reducer, EMPTY)
  const [debugOpen, setDebugOpen] = useState(false)
  const lastTap = useRef(0)
  const [sent, setSent] = useState<Sent | null>(null)
  const [history, setHistory] = useState<History>({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [offline, setOffline] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // Whether this phone has seen How it works (the page sets it). Until then a new player is pointed to it.
  const [knowsHow, setKnowsHow] = useState(true)
  const [stale, setStale] = useState(false)
  const [install, setInstall] = useState<InstallPrompt | null>(null)

  const board = useMemo(() => applySteps(tiles, state.steps), [tiles, state.steps])
  const last = board.last

  // Personal data is read only after hydration, into space kept for it.
  useEffect(() => {
    tidy(date)
    const saved = read<Sent | null>(sentKey(day), null)
    dispatch({ t: 'load', steps: saved?.steps ?? read<Array<Step>>(progressKey(day), []) })
    setSent(saved)
    setPanelOpen(!!saved)
    setHistory(read<History>('history', {}))
    setKnowsHow(read<boolean>('how', false))
    setLoaded(true)
  }, [day])

  // A page from an earlier day (served from the cache, or left open overnight) has an old puzzle.
  useEffect(() => {
    const check = () => setStale(indiaToday() > date)
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [date])

  // Never lose work: save after every step.
  useEffect(() => {
    if (loaded && !sent) write(progressKey(day), state.steps)
  }, [loaded, sent, day, state.steps])

  // Retry an answer that has not reached the server, now and when back online.
  // While offline it also waits in the service worker's queue.
  useEffect(() => {
    if (!sent || sent.state !== 'local') return
    let stop = false
    const trySend = async () => {
      const body = { id: sent.id, deviceId: deviceId(), date, steps: sent.steps }
      const out = await postAnswer(body)
      if (stop) return
      if (out.kind === 'offline') void import('./queue').then((q) => q.enqueue(body))
      settle(sent.id, out)
    }
    void trySend()
    window.addEventListener('online', trySend)
    return () => {
      stop = true
      window.removeEventListener('online', trySend)
    }
  }, [sent?.id, sent?.state])

  // After first paint and idle: service worker, install offer, and yesterday's
  // result when the page doesn't have it yet.
  useEffect(() => {
    const go = () => {
      void import('./idle').then((m) =>
        m.start({
          onInstallable: setInstall,
          onAnswer: (msg) =>
            settle(
              msg.id,
              msg.status < 300 || msg.status === 409
                ? { kind: 'saved', result: msg.data as ServerResult }
                : { kind: 'refused', error: msg.data.error ?? '' },
            ),
        }),
      )
      const yesterday = shiftDate(date, -1)
      const known = read<History>('history', {})
      const empty = !Object.keys(known).length
      const y = known[yesterday]
      if (empty || (y && y.bonus === undefined)) {
        void import('./me').then((m) =>
          m.syncHistory(date, yesterday).then((h) => h && setHistory(h)),
        )
      }
    }
    const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(go) : setTimeout(go, 1))
    if (document.readyState === 'complete') idle()
    else window.addEventListener('load', idle, { once: true })
  }, [])

  /** Applies the server's word on an answer. The server's result replaces the page's. */
  function settle(id: string, out: Outcome) {
    const cur = read<Sent | null>(sentKey(day), null)
    if (!cur || cur.id !== id || cur.state !== 'local') return
    setOffline(out.kind === 'offline')
    if (out.kind === 'offline') return
    const next: Sent =
      out.kind === 'saved'
        ? { ...cur, ...out.result, state: 'saved' }
        : { ...cur, state: 'refused' }
    write(sentKey(day), next)
    setSent(next)
    if (out.kind === 'saved') record(out.result.points)
    void import('./queue').then((q) => q.dequeue(id))
  }

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
      // Practice is never sent, so it is final at once.
      state: practice ? 'saved' : 'local',
    }
    write(sentKey(day), next)
    setSent(next)
    setPanelOpen(true)
    if (!practice) record(sc.points)
  }

  function tapTile(slot: number) {
    if (sent) return
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
  const hint = !knowsHow && !Object.keys(history).length
  const y = history[shiftDate(date, -1)]

  /** A double tap on the title opens the hidden debug menu. */
  function tapTitle(e: PointerEvent) {
    if (e.timeStamp - lastTap.current < 350) {
      lastTap.current = 0
      setPanelOpen(false)
      setDebugOpen(true)
    } else lastTap.current = e.timeStamp
  }

  return (
    <main className="game" data-ready={loaded || undefined}>
      <header className="head">
        <h1 onPointerUp={tapTitle}>{S.title(puzzle.number)}</h1>
        <div className="head-end">
          <span className="muted">{loaded && thisWeek ? S.daysThisWeek(thisWeek) : ''}</span>
          {/* Hidden on the tap too, so a page restored by Back doesn't still show it. */}
          <a
            className={hint ? 'info new' : 'info'}
            href="/how-it-works"
            aria-label={hint ? S.howHint : S.how}
            onClick={() => setKnowsHow(true)}
          >
            {hint && `${S.howHint} →`}
            <Icon name="info" />
          </a>
        </div>
      </header>
      <p className="yday muted">
        {stale ? (
          <a href="/">{S.dayOver}</a>
        ) : practice ? (
          <span className="label practice">{S.practice}</span>
        ) : y?.bonus === undefined ? (
          ''
        ) : y.points >= 40 && y.same !== undefined && y.players !== undefined ? (
          S.yesterday(y.same, y.players, y.bonus)
        ) : (
          S.yesterdayNear(y.points)
        )}
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
          practice={practice}
          offline={offline}
          history={history}
          onInstall={
            install &&
            (() => {
              void install.prompt()
              setInstall(null)
            })
          }
          onClose={() => setPanelOpen(false)}
        />
      )}

      {debugOpen && (
        <Suspense fallback={null}>
          <Debug
            real={props.real}
            practice={practice}
            onPractice={props.onPractice}
            onReset={props.onReset}
            onHistory={setHistory}
            onClose={() => setDebugOpen(false)}
          />
        </Suspense>
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
