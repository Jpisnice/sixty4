import { useState } from 'react'
import { S } from '../game/strings'
import type { TodayPuzzle } from '../game/puzzle'
import { streak } from './history'
import { Icon } from './icons'
import type { History, Sent } from './storage'
import { StreakGrid } from './StreakGrid'

export function ResultPanel(props: {
  puzzle: TodayPuzzle
  sent: Sent
  /** A debug puzzle: never sent, so it has no server status. */
  practice: boolean
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

  const status = props.practice ? (
    <span className="muted">{S.practiceNote}</span>
  ) : sent.state === 'saved' ? (
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

  const run = streak(history, puzzle.date)

  return (
    <section className="panel" role="dialog" aria-modal="false" aria-labelledby="result-title">
      <div className="panel-top">
        <h2 id="result-title">{S.points(sent.points)}</h2>
        <button type="button" className="btn small" onClick={props.onClose}>
          {S.close}
        </button>
      </div>
      <p className="muted">{lines.join(', ')}</p>
      {sent.exact && sent.waysTotal > 0 && <p>{S.found(sent.waysTotal)}</p>}
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
      <div className="streak-row">
        <p className={run >= 2 ? 'label streak' : 'label muted'}>
          {run >= 2 ? S.streak(run) : S.lastWeeks}
        </p>
        <StreakGrid history={history} date={puzzle.date} weeks={6} />
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

