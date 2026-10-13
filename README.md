# Sixty4

A free daily number puzzle. Every day, everyone gets the same 6 tiles and a target, and builds the target by merging two tiles at a time with + − × ÷. Answers that need more tiles and more kinds of operation score higher; wasted steps such as × 1 or + 7 − 7 are refused. Puzzles start easy and get harder over the first 30 days: puzzle #1 has a two-digit target with at least 40 ways to make it, and from puzzle #30 on targets run from 101 to 999 with at least 10 ways.

Built with TanStack Start alone: its server renders the game, checks answers and stores them in SQLite. No other backend service.

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
  answers      POST /api/answer: validate, rate-limit, replay, refuse waste, save once per phone per day
src/client/    The game screen, result panel, storage, offline queue, idle work (service worker, vitals)
src/routes/    /, /how-it-works, /api/answer, /api/me, /api/vitals, /api/health
src/sw/sw.js   Hand-written service worker; sw-plugin.ts injects the asset list and minifies it
```

- **The server decides scores.** The page runs the same rules to show points at once; the server replays the steps from today's stored tiles and its reply replaces the page's result.
- **No cron.** The first request of each India day closes past days and makes tomorrow's puzzle in the background. Both are idempotent.
- **Personal data stays on the phone**: device ID, in-progress steps, today's answer, the history behind the streak grid. The cached HTML is the same for everyone until midnight IST.
- **Offline**: the service worker serves the cached page, steps are saved after every step, and a sent answer is queued in IndexedDB and replayed (Background Sync where available, otherwise when back online or on the next open).

## Performance budget

Checked by `pnpm budgets` and Lighthouse CI (`lighthouserc.json`) on every PR.

| Measure | Budget | Now |
| --- | --- | --- |
| First-load JS, gzip | ≤ 130 KB (brief: 120 KB) | 114.3 KB |
| Game code on top of the framework, gzip | ≤ 15 KB | 6.0 KB |
| Inline CSS | ≤ 6 KB | 5.6 KB |
| HTML, gzip | ≤ 8 KB | 3.5 KB |
| Service worker code, minified | ≤ 2 KB | 1.8 KB |
| Repeat visit transfer | ≤ 5 KB | about 3.5 KB (e2e test) |

The JS budget was raised to 130 KB because the bare TanStack Start skeleton, with no game code, is already 106 KB gzip (react-dom 64 KB, router and Start's hydration runtime the rest).

Local Lighthouse mobile runs (Slow 4G, 4× CPU) scored 94 to 99, with LCP 1.6 to 2.0 s, CLS 0 and about 108 KB transferred. Total Blocking Time from parsing and hydrating React on a slow CPU is the main risk to the 95 score and the 1.8 s LCP; watch the CI numbers and the field p75.

## Deploying on Vercel

`vercel.json` pins functions to `bom1` (Mumbai). Nitro detects Vercel at build time. Known gaps, to deal with later:

- **Database.** Set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` to a Turso database. Without them the app falls back to `/tmp`, which Vercel wipes.
- **Per-instance memory.** The puzzle cache, the single-flight map and the rate limits live in each function instance, so limits are looser across instances.
- **Background work.** Warming tomorrow and the day close start after the response; a serverless instance may be frozen before they finish. They rerun on later requests, so nothing is lost, but `waitUntil` would be cleaner.
- **Solver thread.** The puzzle maker runs in a `worker_threads` worker that loads its own built chunk. It falls back to solving inline if the worker can't start.

The brief's target setup is one long-lived Node process (for example Fly.io in `bom` with a volume and Litestream backups). `pnpm build && pnpm start` runs exactly that.

## Scaling past one instance

Keep the same Drizzle schema and move it to Postgres, and move the in-memory puzzle cache and rate limits to a shared store such as Redis. Not built yet.
