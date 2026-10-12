import { useState } from 'react'
import { S } from '../game/strings'
import type { TodayPuzzle } from '../game/puzzle'
import { Icon } from './icons'
import type { History, Sent } from './storage'

const shift = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 864e5).toISOString().slice(0, 10)

export function ResultPanel(props: {
  puzzle: TodayPuzzle
  sent: Sent
  offline: boolean
  history: History
  buzz: boolean
  onBuzz: (on: boolean) => void
  /** Offered only after a finished game, when the browser allows it. */
  onInstall: (() => void) | null
  onClose: () => void
}) {
  const { puzzle, sent, history } = props
  const [copied, setCopied] = useState(false)

  const lines = sent.exact
    ? [S.tilePoints(sent.tiles), S.kindPoints(sent.kinds)]
    : sent.points
      ? [S.nearPoints(sent.distance, sent.points)]
      : [S.wastedPoints]

  async function share() {
    const { shareText } = await import('./share')
    const text = S.shareText(puzzle.number, sent.exact, sent.tiles, sent.ops, sent.points)
    if ((await shareText(text)) === 'copied') setCopied(true)
  }

  const status =
    sent.state === 'saved' ? (
      <span className="good">
        <Icon name="check" />
        {S.saved}
      </span>
    ) : sent.state === 'refused' ? (
      <span>{S.refused}</span>
    ) : props.offline ? (
      <span>
        <Icon name="cloud" />
        {S.willSend}
      </span>
    ) : (
      <span className="muted">{S.sending}</span>
    )

  // 5 weeks of days, oldest first, ending today.
  const days = Array.from({ length: 35 }, (_, i) => shift(puzzle.date, i - 34))

  return (
    <section className="panel" role="dialog" aria-modal="false" aria-labelledby="result-title">
      <div className="panel-top">
        <h2 id="result-title">{S.points(sent.points)}</h2>
        <button type="button" className="btn small" onClick={props.onClose}>
          {S.close}
        </button>
      </div>
      <p className="muted">{lines.join(', ')}</p>
      {sent.exact && <p>{S.found(sent.waysTotal)}</p>}
      <p className="status" role="status">
        {status}
      </p>
      <button type="button" className="btn main" onClick={share}>
        <Icon name="share" />
        {copied ? S.copied : S.share}
      </button>
      <p className="muted">{S.tomorrow}</p>
      {props.onInstall && (
        <button type="button" className="btn" onClick={props.onInstall}>
          <Icon name="plus" />
          {S.install}
        </button>
      )}
      <p className="label muted">{S.lastWeeks}</p>
      <div className="grid" aria-hidden="true">
        {days.map((d) => {
          const h = history[d]
          const level = !h ? '' : h.points >= 80 ? 'l3' : h.points >= 40 ? 'l2' : 'l1'
          return <i key={d} className={level} title={h ? `${d}: ${h.points}` : d} />
        })}
      </div>
      <label className="switch">
        <input
          type="checkbox"
          checked={props.buzz}
          onChange={(e) => props.onBuzz(e.target.checked)}
        />
        {S.buzz}
      </label>
    </section>
  )
}
