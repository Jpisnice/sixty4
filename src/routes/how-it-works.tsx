import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { S } from '../game/strings'

export const Route = createFileRoute('/how-it-works')({
  head: () => ({ meta: [{ title: `${S.how}: Sixty4` }] }),
  component: HowItWorks,
})

function HowItWorks() {
  // However the player got here, the game stops pointing them to this page. Written
  // directly: importing storage.ts here would split it into an extra first-load chunk.
  useEffect(() => {
    try {
      localStorage.setItem('mtn:how', 'true')
    } catch {}
  }, [])

  return (
    <main className="game how">
      <header className="head">
        <h1>{S.how}</h1>
        <a href="/">Play</a>
      </header>
      <p>Every day, everyone gets the same 6 tiles and the same target.</p>
      <h2>Play</h2>
      <ol>
        <li>Tap a tile, then + − × or ÷, then another tile.</li>
        <li>The two tiles join into one new tile.</li>
        <li>Keep going until the newest tile is the target, or close to it.</li>
        <li>Each tile can be used once. Results must be whole numbers above 0.</li>
        <li>You can send one answer a day.</li>
      </ol>
      <h2>Points</h2>
      <ul>
        <li>Exact answer: 10 points for each tile you use, and 10 for each kind of operation.</li>
        <li>Up to 9 away: 3 × (10 − how far away). 1 away gives 27.</li>
        <li>Wasted steps, such as × 1 or + 7 − 7, give 0 points.</li>
        <li>
          The next day you get a bonus if few players found your way: +25 if 1 in 10 did, +50 if
          1 in 100 did.
        </li>
      </ul>
      <h2>Your data</h2>
      <p>
        There is no sign-up. Your phone keeps a random ID, your steps and your past points. The
        server keeps only your answers.
      </p>
    </main>
  )
}
