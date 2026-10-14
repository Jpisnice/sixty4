# Sixty4

A free daily number puzzle. Every day, everyone gets the same 6 tiles and a target, and builds the target by merging two tiles at a time with + − × ÷. Answers that need more tiles and more kinds of operation score higher; wasted steps such as × 1 or + 7 − 7 are refused. Puzzles start easy and get harder over the first 30 days: puzzle #1 has a two-digit target with at least 40 ways to make it, and from puzzle #30 on targets run from 101 to 999 with at least 10 ways.

**Live:** [sixty4-livid.vercel.app](https://sixty4-livid.vercel.app). Open it on a phone first. Double-tap the title for a hidden debug menu: play any target, reset today's answer, or fill in past days.

Built with TanStack Start alone: its server renders the game, checks answers and stores them in SQLite. No other backend service.

## The idea

One short task a day, a reward for doing it well, and a reason to come back tomorrow. The task is one number puzzle, the same for everyone. It takes a minute or two, and it fits in one screen.

### Who it is for

| Who plays | What Sixty4 does about it | Read more |
| --- | --- | --- |
| People on modest Android phones | A small app with strict size budgets checked on every PR: 114 KB of JS gzip in total, only 6 KB of it game code. Lighthouse mobile scores 94 to 99 on Slow 4G with a 4× slower CPU. | [The small bundle](docs/bundle-size.md) |
| People on mobile data, or a weak network | After the first visit the page opens from the phone. A repeat visit moves about 3.5 KB. It works offline: every step is saved, and an answer sent offline is sent on its own when the phone is back online. | [Offline-first architecture](docs/offline.md) |
| People who read English as a second language | Every word on screen lives in one file, [`src/game/strings.ts`](src/game/strings.ts): short, common words and no idioms ("Take away", not "subtract"; "Will send when you are online"). One file also makes translation easy later. | [`strings.ts`](src/game/strings.ts) |
| People who play with one hand | The layout is built for reach. The whole game fits on one screen with no scrolling, and Undo, Start again and Send are pinned to the bottom, under the thumb. Tiles are 64 px tall, operation keys 56 px, and the bottom buttons at least 48 px, clear of the phone's gesture bar. | [`styles.css`](src/styles.css) |

### What brings people back

Two rewards, on two days:

1. **Points today, for how well you solved it.** An exact answer scores 10 per tile used plus 10 per kind of operation used, up to 100. Getting within 9 of the target still earns some points. Wasted steps such as × 1 earn nothing, so the only way to score more is a richer answer, not a padded one.
2. **A bonus tomorrow, for how unusual your answer was.** When the day closes, each exact answer gets a rarity bonus of up to +50, based on how few players found the same way. You can't know it until the next day, so the reason to open the app tomorrow is twofold: a new number, and the result of yesterday's.

The rarity bonus is the only place players are compared, and it rewards thinking differently rather than playing more. This gives a sense of competition without a ranking that most players would sit at the bottom of. The full model, with worked examples, is in [Scoring, and how players compare](docs/scoring.md).

**The streak is only a record of progress.** The app shows a day count and a 6-week history grid, where brighter days scored more. Missing a day never costs points, and a long streak earns none. Streak rewards pay for showing up, not for playing well, and losing a streak feels like a penalty.

**Sharing brings in new players.** After sending an answer, Share sends a small PNG card in the game's own dark and marigold style: the day's target, your points, how many of the six tiles you used, which of + − × ÷ you used, and your streak once it is 2 days or more. It never shows which tiles or the steps, so friends still have to find the answer themselves. The card goes with a short line ("Sixty4: I made 347 for 90 points. Can you find another way?", or "I got close to …" for a near answer) and a link to play, ready to post in a chat or on social media. The card is drawn on the phone, in a small piece of code that loads only after the game is done ([`share.ts`](src/client/share.ts)). This came from a friend's feedback while testing the game.

### Fair and bug-free

When players earn something of value on a platform, they need to trust it. A wrong score, or a lost answer, costs more than a bad screen. So:

- **The server decides every score.** It replays the steps against the day's stored tiles, refuses wasted steps, takes one answer per phone per day, and counts an answer sent twice only once. See [Scoring](docs/scoring.md#who-decides-the-score) and [API endpoints](docs/api.md).
- **Tests run on every PR.** Unit tests cover the game rules, the solver, the puzzle maker, India dates and the day close. Playwright tests on a phone-sized screen cover a full day, playing offline, yesterday's bonus, resetting an answer and the debug menu. CI also runs lint, type checks, size budgets and Lighthouse ([`ci.yml`](.github/workflows/ci.yml)).
- **Real people played it.** I tested the app with friends on their own phones and changed it based on their feedback.

### What I left out

- **A leaderboard.** Rarity covers the comparison that matters; a global ranking mostly tells people they are losing.
- **Wildcard tiles**: a special tile that gives a bonus if your answer uses it.
- **User profiles and friends.** There is no sign-in; a phone is a player.
- **A light theme.** Dark only, for now.
- **Desktop layout.** The app is sized for phones. It works on a desktop, but in a phone-width column.

### Where I used AI

- **Research** into the patterns that make people come back to an app, which shaped the two-day reward loop above.
- **Looking for ways to make the app fast and reliable on a phone**: how the CDN caches the page, a service worker that serves repeat visits from the phone and works offline, and keeping the scripts small. AI suggested and explained the techniques, and I chose which ones to use ([offline.md](docs/offline.md), [bundle-size.md](docs/bundle-size.md)). It also helped find why the first visit after midnight could show yesterday's puzzle: the CDN still served its old copy.
- **Inline assists** while writing code.
- **Generating code blocks** for tests and for some functional modules, which I then reviewed and changed.
- **The docs in [`docs/`](docs)** were written with AI, from my direction, mainly to get the diagrams and tables into clean Markdown.

## Run it

```bash
pnpm install
pnpm dev                 # http://localhost:3000
pnpm build && pnpm start # production build on http://localhost:3000
```

The local database is created at `data/sixty4.db` on first request; migrations run automatically.

| Script | What it does |
| --- | --- |
| `pnpm test` | Unit tests: game rules, solver, puzzle maker, India dates, day close |
| `pnpm test:e2e` | Playwright on a Pixel 5 viewport against the production build (run `pnpm build` first) |
| `pnpm budgets` | Size budgets on the production build, and a check that no server code reaches the browser |
| `pnpm lint`, `pnpm typecheck` | ESLint and TypeScript |
| `pnpm db:generate` | New Drizzle migration after a schema change |
| `node scripts/make-icons.mjs` | Redraws the app icons |

## Environment

| Variable | Default | Use |
| --- | --- | --- |
| `DATABASE_URL` | `file:data/sixty4.db` | libSQL URL: a local file, or a Turso database in production |
| `DATABASE_AUTH_TOKEN` | none | Turso auth token |
| `DATABASE_TURSO_DATABASE_URL`, `DATABASE_TURSO_AUTH_TOKEN` | none | Set by the Vercel Turso integration. Used when `DATABASE_URL` and `DATABASE_AUTH_TOKEN` are not set |
| `LAUNCH_DATE` | `2026-10-12` | India date of puzzle #1 |
| `PORT` | `3000` | Node server port |

## Docs

In-depth explanations live in [`docs/`](docs):

| Doc | Covers |
| --- | --- |
| [Scoring, and how players compare](docs/scoring.md) | The board model, wasted steps, the standard form, points, the rarity bonus, the day close, puzzle difficulty |
| [Offline-first architecture](docs/offline.md) | localStorage, the service worker, the IndexedDB answer queue, Background Sync, the life of an answer |
| [The small bundle](docs/bundle-size.md) | The budgets and how they are measured, where the bytes go, and what keeps them small |
| [API endpoints](docs/api.md) | Every endpoint: requests, checks in order, responses, error codes, and the tables behind them |

## How it fits together

```
src/game/      Shared by page and server: rules (applySteps, isWasted, canonical, score), strings, types
src/server/    Server only (*.server.ts is blocked from the browser by Start's import protection)
  solve        Lists every non-wasted way to a target (DP over tile subsets)
  makePuzzle   Seeded puzzle for an India date; redraws until enough ways for its place in the 30-day ramp (40 down to 10), at most 300, and none with 2 tiles
  puzzles      getPuzzle: memory, then SQLite, then a worker thread; single-flight; warms tomorrow
  dayClose     Lazy day close: rarity bonuses for every past day still open, once
  answers      POST /api/answer: validate, rate-limit, replay, refuse waste, save once per phone per day (DELETE resets it, from the debug menu)
src/client/    The game screen, result panel, storage, offline queue, idle work (service worker, vitals)
src/routes/    /, /how-it-works, /api/answer, /api/me, /api/vitals, /api/health
src/sw/sw.js   Hand-written service worker; sw-plugin.ts injects the asset list and minifies it
```

- **The server decides scores.** The page runs the same rules to show points at once; the server replays the steps from today's stored tiles and its reply replaces the page's result.
- **No cron.** The first request of each India day closes past days and makes tomorrow's puzzle in the background. Both are idempotent.
- **Personal data stays on the phone**: device ID, in-progress steps, today's answer, the history behind the streak grid. The cached HTML is the same for everyone until midnight IST.
- **Offline**: the service worker serves the cached page, steps are saved after every step, and a sent answer is queued in IndexedDB and replayed (Background Sync where available, otherwise when back online or on the next open).
